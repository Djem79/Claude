# Security & Privacy Audit — worldwise.pro

Date: 2026-05-20
Scope: auth (`lib/session.ts`, `lib/auth.ts`, `middleware.ts`), public API (`/api/leads`, `/api/upload`, `/api/telegram-webhook`, `/api/auth/login`), data layer (`lib/leads.ts`, `lib/users.ts`, `lib/dynamic-articles.ts`), article pipeline (`scripts/generate-article.mjs`), blog renderer (`app/blog/[slug]/page.tsx`), notifications (`lib/notify.ts`), CSV export, security headers (`next.config.mjs`).

Severity legend: **Critical** = remote, unauthenticated, high impact / public reach · **High** = serious, plausible attack path · **Medium** = real but constrained · **Low** = hardening / defence-in-depth.

---

## Summary table

| ID | Severity | Finding | File |
|----|----------|---------|------|
| C1 | Critical | Stored XSS on public blog — article content rendered via `dangerouslySetInnerHTML` with no HTML escaping; CSP `unsafe-inline` doesn't block it | `app/blog/[slug]/page.tsx` |
| H1 | High | Session HMAC key == `ADMIN_PASSWORD` (low-entropy human password reused as crypto key) | `lib/session.ts` |
| H2 | High | Owner bootstrap not gated to first-run — any unused username + `ADMIN_PASSWORD` mints an owner at any time | `app/api/auth/login/route.ts` |
| H3 | High | Brute-force / rate-limit bypass via spoofable client IP headers | `api/auth/login`, `api/leads` |
| M1 | Medium | Stale token claims — `role` trusted from 7-day token, never re-checked against DB | `middleware.ts`, `lib/auth.ts` |
| M2 | Medium | CSV formula injection in leads export | `app/admin/leads/LeadsClient.tsx` |
| M3 | Medium | Non-atomic JSON writes — crash mid-write corrupts data | `lib/leads.ts`, `lib/users.ts`, `lib/dynamic-articles.ts` |
| M4 | Medium | No length limits on public lead fields — storage DoS | `app/api/leads/route.ts` |
| M5 | Medium | Upload type validated only by client MIME, not magic bytes | `app/api/upload/route.ts` |
| L1 | Low | Webhook secret compared with `!==` (not constant-time) | `app/api/telegram-webhook/route.ts` |
| L2 | Low | `Date.now()` IDs collide under same-ms load | `lib/leads.ts`, `lib/users.ts` |
| L3 | Low | `await req.json()` without try/catch → 500 on malformed body | `api/auth/login`, `api/leads` |
| L4 | Low | Gemini API key passed as URL query param | `scripts/generate-article.mjs` |
| L5 | Low | CSP `script-src 'unsafe-inline'` weakens XSS defence | `next.config.mjs` |
| L6 | Low | Dead duplicate unsafe-HTML render path | `app/blog/[slug]/page.tsx` |

---

## Critical

### C1 — Stored XSS on the public blog
**File:** `app/blog/[slug]/page.tsx` (`formatInline`, `ArticleContent`, lines 176–266)

`formatInline()` converts `**bold**`/`*italic*` but performs **no HTML escaping**, and its output is injected with `dangerouslySetInnerHTML` for every paragraph, list item and (via the dead path) heading. Any `<`/`>` in article content is rendered as live markup.

**Trust boundary:** article `content` comes from two sources merged by `lib/articles.ts`:
1. Static editorial (trusted, author-controlled).
2. **AI-generated** (`data/articles.json`) produced by `scripts/generate-article.mjs`, which feeds **attacker-influenceable Google News RSS headlines** into the Gemini prompt. AI output is untrusted by definition; a prompt-injected or hallucinated `<script>`/`<img onerror=…>` lands verbatim in the DOM.

**Why the existing controls don't catch it:**
- The Telegram approval step shows only a 400-char, markdown-stripped preview (`scripts/generate-article.mjs:191`) — a payload appended later in the article is never seen by the approver.
- CSP is `script-src 'self' 'unsafe-inline'` (`next.config.mjs:18`), so injected inline `<script>` and event-handler attributes execute.

**Impact:** session/cookie theft of any public visitor (note: admin session cookie is `httpOnly`, but visitor tracking, redirect-to-phishing, and defacement remain), drive-by on the highest-traffic content surface.

**Fix:** escape HTML before `formatInline`, or render through a sanitiser. Minimal: an `escapeHtml()` that replaces `& < > " '` applied to each text segment *before* the bold/italic regex, applied in `formatInline` and to headings/table cells. Remove the dead `rendered` path (L6). Optionally tighten CSP (L5).

---

## High

### H1 — Session signing key is the admin login password
**File:** `lib/session.ts:18-22, 42-49`

`getSecret()` returns `process.env.ADMIN_PASSWORD` and uses it directly as the HMAC-SHA256 key for every session token. The same value is the human-typed bootstrap login password (H2). Consequences:
- A captured token (`base64(payload).hmac`) lets an attacker run an **offline brute-force / dictionary attack** against `ADMIN_PASSWORD` — the payload is known plaintext and the HMAC is the oracle. A human-memorable password has far less entropy than a 256-bit key.
- Recovering it yields both token forgery (any `uid`/`role`) **and** the master bootstrap password (H2) → full takeover.

**Fix:** introduce a dedicated high-entropy `SESSION_SECRET` (≥32 random bytes) used only for signing, separate from `ADMIN_PASSWORD`. Note in CLAUDE.md that rotating it invalidates all sessions (consistent with the existing "don't change payload shape" rule). Keep `ADMIN_PASSWORD` solely for first-run bootstrap.

### H2 — Owner bootstrap is a permanent backdoor, not first-run only
**File:** `app/api/auth/login/route.ts:43-49`

The comment says "if no users exist," but the guard is `if (!user && !getUserByUsername(username))` — it only checks that *this* username is free, **not** that the user table is empty. So at **any time**, anyone who submits a new username together with the value of `ADMIN_PASSWORD` gets a freshly created **owner** account. Combined with H1/H3 this is a privilege-escalation and persistence path; even without compromise it makes `ADMIN_PASSWORD` a perpetual master credential that silently mints owners.

**Fix:** gate the bootstrap on `getUsers().length === 0`. Once any user exists, the env password must never create accounts.

### H3 — Brute-force / rate-limit bypass via spoofable IP headers
**Files:** `app/api/auth/login/route.ts:8-15,17-27`, `app/api/leads/route.ts:9-16,18-28`

`getIp()` trusts `cf-connecting-ip` → `x-real-ip` → last hop of `x-forwarded-for`, all client-supplied. Requests that reach the app **not** via Cloudflare (e.g. direct to origin `62.238.35.20:80/3000`, or any path where nginx forwards rather than overwrites these headers) let the client set an arbitrary value. By rotating the header every request the attacker gets a fresh rate-limit bucket, defeating:
- login throttling (5 / 15 min) → effectively unlimited password guessing against `ADMIN_PASSWORD` (see H1/H2) and user passwords (bcrypt cost 10 only slows, not stops);
- lead throttling (10 / hr) → unlimited spam / storage abuse (M4).

**Fix:** trust only the header set by the front proxy and ensure nginx **overwrites** it (`proxy_set_header X-Real-IP $remote_addr;` and do not pass through client `cf-connecting-ip`). In code, prefer a single trusted header and treat it as authoritative only behind the known proxy; otherwise fall back to the socket address. Verify Cloudflare "Authenticated Origin Pulls" / firewall so origin can't be hit directly.

---

## Medium

### M1 — Stale token claims (role not revalidated)
**Files:** `middleware.ts:25-27`, `lib/auth.ts:7-16`

`middleware.ts` authorises `/admin/users` purely on `session.role` decoded from the token. `getSession()` checks the user still exists and is `active`, but **not** that the DB role still matches the token's `role`. A user demoted owner→manager keeps `owner` access for up to 7 days (token TTL). Deactivation/deletion *is* caught (good).

**Fix:** in `getSession()`, take `role` (and ideally `name`) from the fresh DB record, not the token. Middleware runs on Edge and can't read the JSON store, so the authoritative role check belongs in `getSession()`/server pages (which `/admin/users/page.tsx` already calls) — make that check use DB role. Optionally shorten TTL.

### M2 — CSV formula injection in leads export
**File:** `app/admin/leads/LeadsClient.tsx:283-297`

`escape()` wraps values in quotes and doubles `"`, which handles CSV delimiting but **not** spreadsheet formula injection. A lead `name`/`notes`/`message` (public, attacker-controlled) beginning with `= + - @` (or tab/CR variants) executes as a formula when the admin opens the file in Excel/Sheets → data exfiltration or DDE command execution.

**Fix:** prefix any cell starting with `= + - @ \t \r` with a leading apostrophe or `\t` before quoting.

### M3 — Non-atomic JSON writes
**Files:** `lib/leads.ts:17-19`, `lib/users.ts:13-17`, `lib/dynamic-articles.ts:55,65-69`, webhook `:97`

All writes use `fs.writeFileSync(path, …)` directly. Concurrency within the single PM2 instance is safe (sync read+write, no `await` interleave), but a crash/disk-full **mid-write truncates the file**, losing all leads/users/articles. No DB allowed (per CLAUDE.md), so durability must come from atomic writes.

**Fix:** write to `path + '.tmp'` then `fs.renameSync()` (atomic on same filesystem). Centralise in one helper reused by all three libs and the webhook.

### M4 — No length limits on public lead fields
**File:** `app/api/leads/route.ts:32-54`

`name, email, budget, message, propertyTitle, source` are persisted with no max length. An unauthenticated client can POST megabyte-sized strings, bloating `leads.json` (which is fully read+rewritten on every operation → O(n) amplification) and oversized Telegram/email payloads.

**Fix:** cap each field (e.g. name ≤120, message ≤2000, others ≤200), reject or truncate; validate `source` against the known allow-list; basic email format check.

### M5 — Upload type trusted from client MIME
**File:** `app/api/upload/route.ts:32-40`

Type is checked via `f.type` (client-controlled) only; content bytes are never inspected. `propertyId` regex blocks path traversal (good) and SVG is excluded (good — avoids SVG XSS). Residual risk is low (admin-only, files served static with image extension, `X-Content-Type-Options: nosniff` set), so this is Medium-low.

**Fix:** sniff magic bytes (JPEG `FF D8`, PNG `89 50 4E 47`, GIF `47 49 46`, WEBP `RIFF…WEBP`) and reject mismatches; cap file count per request.

---

## Low

- **L1** `app/api/telegram-webhook/route.ts:66` — `secret !== process.env.WEBHOOK_SECRET` is not constant-time. Remote timing attacks on a header are impractical, but use the existing `timingSafeEqual` pattern for consistency.
- **L2** `lib/leads.ts:25`, `lib/users.ts:39` — IDs are `String(Date.now())`; two records in the same millisecond collide, and update/delete then hit the wrong row. Use a counter suffix or `crypto.randomUUID()`.
- **L3** `api/auth/login:34`, `api/leads:33` — `await req.json()` has no try/catch; malformed body throws → 500. Wrap and return 400.
- **L4** `scripts/generate-article.mjs:126` — `?key=${GEMINI_KEY}` in the URL can be captured by intermediate logs/proxies. Low (server-to-Google over TLS); acceptable per Google's API style, note only.
- **L5** `next.config.mjs:18` — `script-src 'unsafe-inline'` lets injected inline scripts run (amplifies C1). Migrating to per-request nonces for Next/GTM/JSON-LD would let `unsafe-inline` be dropped. Larger change; defence-in-depth.
- **L6** `app/blog/[slug]/page.tsx:77-118` — the `rendered` array is built (with the same unsafe `dangerouslySetInnerHTML`) but never used in JSX. Dead code; delete to shrink attack surface.

---

## Recommended remediation order

1. **C1** — stored XSS (escape HTML in blog renderer + delete dead path L6). Highest impact, smallest change.
2. **H2** — gate owner bootstrap to empty user table. One-line logic fix, closes backdoor.
3. **H1** — separate `SESSION_SECRET` from `ADMIN_PASSWORD`.
4. **H3** — trust only proxy-set IP + nginx/Cloudflare origin hardening (code + infra).
5. **M1** — DB-authoritative role in `getSession()`.
6. **M2, M3, M4** — CSV escaping, atomic writes helper, lead field caps.
7. **M5, L1–L5** — hardening pass.

Build gate: `npm run build` must pass after each change set before deploy.

---

## Remediation status (2026-05-21)

Approved scope: **all Critical + High + Medium**. `npm run build` passes (✓ compiled, types valid; only pre-existing `<img>` LCP warnings remain).

| ID | Status | Change |
|----|--------|--------|
| C1 | ✅ Fixed | `escapeHtml()` added and applied inside `formatInline()`; dead `rendered`/`renderTables` paths removed (`app/blog/[slug]/page.tsx`). |
| H1 | ✅ Fixed (action required) | Token signing key moved to dedicated `SESSION_SECRET` (`lib/session.ts`); `.env.example` + `CLAUDE.md` updated. **Set `SESSION_SECRET` in the server `.env.local` before deploy** (`openssl rand -base64 48`) or login + all sessions break. Deploy logs out all current admins (expected). |
| H2 | ✅ Fixed | Bootstrap gated on `getUsers().length === 0` (`app/api/auth/login/route.ts`). |
| H3 | ✅ Fixed (full, deployed 2026-05-21) | Closed end-to-end. (1) `worldwise.pro` switched from DNS-only to **Proxied** on Cloudflare + SSL mode **Full (strict)**. (2) nginx `real_ip` added (`/etc/nginx/conf.d/cloudflare-realip.conf`: 22 `set_real_ip_from` CF ranges + `real_ip_header CF-Connecting-IP`) — restores the real visitor IP into `$remote_addr`/`X-Real-IP` (verified: real client IP in nginx logs, not the CF edge). (3) `lib/ip.ts` trusts **only** `x-real-ip` (deployed). (4) ufw locked to CF ranges for 80/443; catch-all `ALLOW Anywhere` removed (SSH untouched). Verified: site 200 via CF, **direct origin access blocked** (timeout). Earlier brief outage (firewall locked before proxy was confirmed) was rolled back — see `tasks/lessons.md`. |
| M1 | ✅ Fixed | `getSession()` returns DB `role`/`name`, not stale token claims (`lib/auth.ts`). |
| M2 | ✅ Fixed | CSV export prefixes `=,+,-,@,\t,\r` cells with `'` (`app/admin/leads/LeadsClient.tsx`). |
| M3 | ✅ Fixed | `lib/atomic-write.ts` (temp + rename) used in `lib/leads.ts`, `lib/users.ts`, `lib/dynamic-articles.ts`, the webhook, and `scripts/generate-article.mjs`. |
| M4 | ✅ Fixed | Lead fields length-capped before persistence (`app/api/leads/route.ts`). |
| M5 | ✅ Fixed | Uploads validated by magic bytes (`sniffMime`) + max file count; extension derived from detected type (`app/api/upload/route.ts`). |
| L1–L6 | Deferred | Out of approved scope (L6 dead-code removal done as part of C1). |

**Deploy checklist:**
1. Add `SESSION_SECRET` (high-entropy, ≠ `ADMIN_PASSWORD`) to the server `.env.local`.
2. Backup `data/` on the server before deploy (per CLAUDE.md).
3. Confirm nginx sets `X-Real-IP` and the origin is firewalled to Cloudflare (H3).
4. After restart, re-login to the admin (all sessions invalidated by H1).
