# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **Working in parallel with another Claude session?** Read [`AGENTS.md`](AGENTS.md) first — it covers the coordination contract (who's lead, before-you-touch checks, push/deploy discipline, and the hard rules from past multi-session regressions).

## Before starting any task

Before writing a single line of code, state in one sentence how you will verify the work is correct — for example: "I'll run `npm run build`, open `/mortgage-calculator` in the browser and confirm the monthly payment updates when sliders change." Only then proceed. This applies to every task, including small edits.

## Core principles

- **Simplicity first** — every change as simple as possible. Minimum code.
- **No lazy fixes** — find root causes. No temporary patches. Senior-engineer standard.
- **Minimal footprint** — touch only what's necessary. No side effects.

## Workflow orchestration

### 1. Default planning mode

Use Plan mode for any non-trivial task (3+ steps or architecture). If something goes wrong — STOP and replan immediately. Use the plan for verification steps, not just building. Write detailed specs upfront — eliminate ambiguity before writing a line of code.

### 2. Subagent strategy

Use subagents generously — keep main context clean. Offload research, reconnaissance, and parallel analysis to subagents. For complex tasks, throw more compute at subagents. One task per subagent for focus.

### 3. Self-improvement cycle

After ANY user correction: update `tasks/lessons.md` with the pattern. Write yourself rules that prevent repeating the mistake. Ruthlessly iterate on lessons until errors drop. Re-read lessons at session start for the relevant project.

### 4. Verification before "done"

Never mark a task done without proving it works. Compare main behavior vs your changes when relevant. Ask yourself: "Would a staff engineer approve this?" Run tests, check logs, demonstrate correctness.

### 5. Demand elegance (in moderation)

On non-trivial changes: pause and ask "is there a more elegant path?" If a fix is a hack: "knowing everything now, make it elegant." Skip this for simple obvious fixes — no over-engineering. Doubt your work before showing it.

### 6. Autonomous bug fixing

Got a bug report — just fix it. Don't ask to be led by the hand. Point to logs, errors, failing tests — and close them. Zero context switching on the user's side. Go fix failing CI tests without hints on "how."

## Task management

1. **Plan first** — non-trivial work goes through `superpowers:brainstorming` → `writing-plans` → `executing-plans` (or `subagent-driven-development`). Specs land in `docs/superpowers/specs/`, plans in `docs/superpowers/plans/`. For one-shot fixes, the TodoWrite tool is enough.
2. **Get approval** — pause for user sign-off before starting implementation.
3. **Track progress** — use TodoWrite to mark items as you go; one task `in_progress` at a time.
4. **Explain changes** — brief summary at each step; communicate what changed and why.
5. **Fix lessons** — after any user correction, append a rule to `worldwise/tasks/lessons.md` so the mistake doesn't repeat.

## Repository layout

The git root is `/Users/dzhambulat/Projects/Claude/` (moved out of iCloud to a clean ASCII path on 2026-06-04 — the old `~/Documents/…(NBSP)…/Claude` location caused phantom-tree writes and risked iCloud-corrupting `.git`; the old path remains as a symlink). The actual Next.js app lives in the `worldwise/` subdirectory — all commands below must be run from there.

**Git remotes (non-obvious):** two remotes exist. `claude` → `Djem79/Claude.git` is the **primary** repo — all feature branches and the canonical `main` live here; push branches and open PRs against `claude`. `origin` → `Djem79/worldwise.git` is a **deploy mirror** holding only `main` + `data-backup`. Deployment is done by **rsync of the working tree** (see *Production deployment*), **not** by `git pull` on the server — so `main` can lag well behind what's actually live, and that's expected. (If a tool needs `origin/HEAD` and errors with "unknown revision", run `git remote set-head origin -a` once.)

## Common commands

Node is managed via NVM. If `npm` is not found, run one of these:

```bash
# Option 1 — export for the current shell session
export PATH="/Users/dzhambulat/.nvm/versions/node/v24.15.0/bin:$PATH"

# Option 2 — let nvm activate the right version
source ~/.nvm/nvm.sh && nvm use 24
```

From `worldwise/`:

- `npm run dev` — local dev server on <http://localhost:3000>
- `npm run build` — production build (must pass before deploying)
- `npm run lint` — ESLint check
- `npm run start` — run production build (PM2 uses this on server)

There is no `npm test` script and no test runner dependency, but a few **pure helpers have `node:test` unit tests** (`lib/slug.test.ts`, `lib/lead-parse.test.ts`). Run them directly with Node's type stripping:

```bash
node --test --experimental-strip-types lib/*.test.ts   # all
node --test --experimental-strip-types lib/slug.test.ts # one file
```

`npm run build` is still the primary gate — always run it locally before deploying. For ad-hoc verification of a single `lib/` function, `npx tsx -e "import {...} from './lib/x.ts'; ..."` is the established pattern (type stripping handles the `.ts` imports).

## What NOT to do

These constraints are non-negotiable — violating them causes data loss or security issues:

- **Never touch `data/` locally.** All files in `data/` exist only on the server — this includes `leads.json`, `users.json`, `properties.json`, `articles.json`, `article-draft.json`, `article-mode.json`, `article-keywords.json`, and `article-tag-index.json`. Never create, edit, or rsync them from local — they hold live business and state data.
- **Never add a database.** The JSON file approach is intentional — simple, zero-dependency, backed up automatically. A database would require a migration and breaks the single-PM2-instance assumption.
- **Never run multiple PM2 instances.** The file-based data layer has no locking. Two processes writing simultaneously will corrupt JSON.
- **Never change the session token payload structure** (`SessionPayload` in `lib/session.ts`) without invalidating all existing sessions first — the HMAC signs the exact payload shape.
- **Never install npm packages with native bindings** (C++ addons). `middleware.ts` runs in the Edge runtime which does not support native modules.
- **Never use external image URLs** for property photos or area images. All images must be in `public/images/`. Unsplash URLs in Hero.tsx are an accepted legacy exception.
- **Never add a lead capture form without the honeypot field.** Every form must include a hidden `<input ref={hpRef} />` and send `_hp` in the POST body. See existing components for the pattern.
- **Never `git add -A` or `git add .`** — stage files by name to avoid accidentally committing `.env.local` or leftover data files.

## Production deployment

Hetzner VPS `62.238.35.20` (Ubuntu 24.04). SSH key: `~/.ssh/id_ed25519`. Project at `/var/www/worldwise/`, PM2 process `worldwise`, Nginx reverse-proxies `localhost:3000`.

```bash
# 0. Backup data on server before any deploy
ssh -i ~/.ssh/id_ed25519 root@62.238.35.20 \
  "cp -r /var/www/worldwise/data /var/www/worldwise/data_backup_$(date +%Y%m%d_%H%M%S)"

# 1. Sync (exclude git, node_modules, build artifacts, server-only data, env secrets, and the AI-docs symlinks)
rsync -avz --exclude='.git' --exclude='node_modules' --exclude='.next' --exclude='data/' --exclude='public/files/' --exclude='public/images/blog/' --exclude='.env.local' --exclude='AGENTS.md' --exclude='CLAUDE.md' --exclude='ruvector.db' --exclude='file-storage/' \
  -e "ssh -i ~/.ssh/id_ed25519" worldwise/ root@62.238.35.20:/var/www/worldwise/

# 2. Build and restart on server
ssh -i ~/.ssh/id_ed25519 root@62.238.35.20 \
  "cd /var/www/worldwise && npm install && npm run build && pm2 restart worldwise"
```

> **One-time server prerequisite for PDF import:** `apt-get install -y poppler-utils imagemagick` (`pdfimages`/`pdftoppm` for extraction; `convert`/`magick` to downscale print-resolution rasters to ~1600px web images). Without poppler, photo extraction silently degrades to fields-only; without ImageMagick, extracted images are copied at native size (large/slow).

The server has a separate git repo at `/var/www/worldwise/` tracking only `data/` on the `data-backup` branch (auto-commits every 6 hours via cron, pushes to GitHub).

> **⚠️ Deploy reflects your working tree, not git.** Because deployment rsyncs the working tree (excluding `data/`), the server holds the **union of all unmerged branches' code**. Deploying from a feature branch will silently **revert files that only exist on a sibling branch** to whatever your branch has. Before any deploy, your working tree must contain the full intended live state: prefer **merging open PRs into `main` and deploying from `main`**, or pull missing files from sibling branches first (`git checkout <branch> -- <files>`). After rsync and **before `npm run build` on the server**, `grep` for markers of every recent feature to confirm nothing was clobbered — the old build keeps serving until you rebuild, so a caught mistake is recoverable.

## Scheduled jobs on server

Six cron entries run on the Hetzner VPS (root crontab). Each writes to its own log under `/var/log/`. `--env-file=.env.local` loads server-side secrets where needed; the file persists across deploys because it's excluded from rsync.

| When (UTC) | Script | Log | Purpose |
| ---------- | ------ | --- | ------- |
| `0 */6 * * *` | `/root/backup-data.sh` | `/root/backup.log` | Commit `data/` to the `data-backup` git branch + push to GitHub |
| `0 6 * * *` | `scripts/post-from-plan.mjs` | `/var/log/worldwise-plan-post.log` | Daily Telegram channel post from the autopost plan |
| `0 9 * * *` | `scripts/generate-article.mjs` | `/var/log/worldwise-blog.log` | Gemini auto-blog draft → Telegram approval (see *Auto-blog pipeline* under Architecture) |
| `0 4 * * 0` (Sun) | `scripts/prune-leads.mjs` | `/var/log/worldwise-prune.log` | Weekly maintenance pass over `data/leads.json` |
| `0 6 * * 1` (Mon) | `scripts/gsc.mjs digest` | `/var/log/worldwise-gsc.log` | Weekly Search Console digest → Telegram (see *GSC CLI* under Architecture) |
| `0 8 * * 1` (Mon) | `scripts/seo-audit.mjs` | `/var/log/worldwise-seo-audit.log` | Weekly site self-check (URL reachability, SSL, robots.txt, sitemap freshness) → Telegram |

All scripts are committed under `worldwise/scripts/`. View any log with `ssh -i ~/.ssh/id_ed25519 root@62.238.35.20 "tail -50 /var/log/<logfile>"`.

## DNS & infrastructure

DNS is managed via **Cloudflare** (nameservers: `ainsley.ns.cloudflare.com`, `sterling.ns.cloudflare.com`). A records for `worldwise.pro` and `www` point to `62.238.35.20` and are **Proxied** (orange cloud) — all visitor traffic flows through the Cloudflare edge, not directly to the origin. Cloudflare SSL/TLS mode is **Full (strict)**. Email MX records point to `mx1.hosting.reg.ru` / `mx2.hosting.reg.ru` (reg.ru hosting handles the mailbox for `dzhambulat@worldwise.pro`).

**Origin is locked to Cloudflare.** `ufw` allows ports 80/443 only from Cloudflare IP ranges (plus SSH on 22); direct requests to `62.238.35.20` are dropped. Refresh the CF ranges from `https://www.cloudflare.com/ips-v4` + `ips-v6` if Cloudflare changes them. Because the origin is not directly reachable, the **real visitor IP** is restored by nginx's `real_ip` module — see `/etc/nginx/conf.d/cloudflare-realip.conf` (`set_real_ip_from` CF ranges + `real_ip_header CF-Connecting-IP`). App code must read the client IP from `x-real-ip` (see `lib/ip.ts`), never `cf-connecting-ip` (spoofable).

SSL certificate is issued by Let's Encrypt via certbot, auto-renewed by the `certbot.timer` systemd unit. **Renewal uses the DNS-01 challenge** (`certbot-dns-cloudflare`) — *not* `--nginx`, which would fail since port 80 is firewalled to Cloudflare only. Cloudflare API token (scope `Zone:DNS:Edit` + `Zone:Zone:Read`) lives in `/root/.secrets/cloudflare.ini` (chmod 600); a deploy hook at `/etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh` reloads nginx after renewal. Test with `certbot renew --dry-run`.

A full security & privacy audit (findings + remediation status) is in `worldwise/tasks/security-audit.md`; recurring operational lessons in `worldwise/tasks/lessons.md`.

## Project status (May 2026)

**Live and complete:**

- Public site: homepage, `/properties` listing, `/properties/[slug]` detail pages
- Area landing pages: 8 flat-URL SSG pages (`/dubai-marina`, `/downtown-dubai`, `/palm-jumeirah`, `/business-bay`, `/dubai-hills`, `/jlt`, `/creek-harbour`, `/emaar-beachfront`) — content in `lib/areas.ts`
- Blog: `/blog` listing + `/blog/[slug]` — static editorial articles in `lib/articles.ts` + AI-generated articles from `data/articles.json`
- Auto-blog pipeline: Gemini-powered article generator runs daily at 09:00 UTC, alternates keyword/news mode, Telegram approval flow
- Analytics: GA4 (consent-aware) with conversion event tracking on all lead forms and CTAs
- Tools: `/mortgage-calculator` — dedicated SEO/ads landing page with full calculator
- Admin CRM: `/admin` (stats + properties), `/admin/leads` (full CRM), `/admin/users` (owner-only)
- Multi-user auth: bcryptjs + HMAC-signed session tokens, role-based access (`owner` / `manager`) + per-section manager permissions (`properties` / `leads` / `dashboard`)
- Activity log on leads, anti-spam on lead capture, CSV export
- SEO layer: sitemap (ISR 1h revalidation), robots, JSON-LD, per-property og:image
- GSC tooling: `scripts/gsc.mjs` for local diagnostics + weekly Telegram digest cron on the server (Monday 06:00 UTC)
- Telegram channel growth: CRM TG-link, ROI image autoposter, `/add_keyword` bot command
- Infrastructure: Cloudflare DNS, Hetzner VPS, PM2 + Nginx, Let's Encrypt SSL, git-based data backup

**Not built yet (possible next steps):**

- WhatsApp chat widget
- Property comparison feature
- Meta Pixel integration

## Conversion & UX logic

The primary goal of the site is lead capture: getting a visitor to submit their phone number and name. Every page decision should serve this.

**Conversion hierarchy:**

1. `FloatingCTA` — persistent WhatsApp + phone buttons, present on every page. Never remove.
2. `LeadModal` — modal form triggered by CTAs throughout the site. Tracks `source` for analytics.
3. `LeadCaptureSection` — full-width section at the bottom of the homepage, last chance before footer.

**Key conversion pages:**

- `/properties/[slug]` — warmest traffic (visitor looked at a specific property). Has `PropertyEnquiryForm` embedded. This is the highest-converting page.
- `/mortgage-calculator` — designed as a Google Ads landing page. Calculator as the hook, lead form as the exit. Do not clutter with navigation distractions.
- Homepage — awareness + trust building. MortgageCalculator, Testimonials and BlogPreview support the journey to contact.

**Lead `source` strings in use** (keep consistent for CRM analytics):
`hero_cta`, `mortgage_calculator`, `mortgage_anchor`, `roi_calculator`, `property_enquiry`, `lead_capture_section`, `floating_cta`, `blog_cta`, `golden_visa`, `lead_magnet_guide`, `brochure_request`, `floor_plan`, `property_card`, `mobile_bar`, `qualify`, `telegram`, `property_finder`, `bayut`, `instagram_dm`, `whatsapp`, `other`, `area_dubai_marina`, `area_downtown_dubai`, `area_palm_jumeirah`, `area_business_bay`, `area_dubai_hills`, `area_jlt`, `area_creek_harbour`, `area_emaar_beachfront`

Three groups: (1) on-site CTAs — `hero_cta` … `blog_cta` plus `property_card` (per-listing WhatsApp button) and `mobile_bar` (mobile sticky bottom CTA on property/area pages) — set by the React component the user submitted from. (2) Telegram-bot intake — `telegram`, `property_finder`, `bayut`, `instagram_dm`, `whatsapp`, `other` — an agent pastes a lead into the bot, the bot saves it, and the source is chosen via inline buttons (default `telegram` until a button is tapped). (3) Area-page CTAs — `area_<slug_underscored>` — set automatically by the area landing pages, one source per district.

**UX rules:**

- Every page must include `<FloatingCTA />` and `<Footer />`.
- New feature pages that are meant for ads (high-intent traffic) should have minimal navigation — calculator or tool at the top, CTA at the bottom.
- Blog articles end with a CTA to consultation — do not make them dead ends.
- All copy in English. No Russian on any public-facing page.
- **No emojis on any public-facing page.** The brand is luxury/premium — use words, typographic glyphs (`→ ← ✕ ★ ✓`) or SVG/line icons, never pictographic emoji (🏙💬📞🔒, flag emojis, etc.). Admin CRM + Telegram-bot messages are back-office, not the site, and may keep their glyphs.

## Architecture

Next.js 14 App Router, TypeScript, Tailwind CSS.

### Load-bearing invariants (read before editing data, SEO, or forms)

These cross-cutting rules are easy to violate by following the "obvious" local pattern, and several were real shipped bugs. They span multiple files — keep them intact.

- **All JSON-LD goes through `<JsonLd data={...} />`** (`components/JsonLd.tsx`, backed by `lib/jsonld.ts`). Never hand-write `<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(x) }}>` — raw `JSON.stringify` does **not** escape `<`, so untrusted content (AI article titles, CRM property text) containing `</script>` is a stored-XSS breakout. The component makes the escaping the only path.
- **All JSON file writes go through `writeFileAtomic` (`lib/atomic-write.ts`)** — temp-file + rename, so a crash/full-disk can't leave a truncated data file. Don't reintroduce raw `fs.writeFileSync` on a `data/*.json` file.
- **Read-modify-write on the JSON stores is NOT serialized across concurrent async handlers** — building a new array from a snapshot read *before* an `await` and writing it *after* loses concurrent changes (lost-update). For lead attachments, use `mutateLeadAttachments()` (`lib/leads.ts`), which re-reads fresh inside a synchronous critical section. A general per-file mutex for *all* mutations (`updateLead`/`saveLead`/properties/users) is a known pending task — see the `project_json_mutation_race` auto-memory.
- **`getProperties()` returns `[]` only on a genuinely missing file (`ENOENT`)** and **throws** on a present-but-corrupt/unparseable one — masking a bad read as "no properties" would let the next `create/update/delete` overwrite the whole catalog with near-empty data.
- **Property API bodies are validated/coerced via `coercePropertyInput()`** (`lib/properties.ts`) — whitelists fields, coerces types (no `NaN` price), normalizes the slug (only regenerates from title on create, never silently on a partial PUT), and never trusts `id`/`createdAt` from the body. Don't spread a raw request body into a stored property.
- **`LeadStatus` values live once in `lib/lead-status.ts` (`LEAD_STATUSES`)** — imported by both the `PUT /api/leads/[id]` enum validation and the CRM board. Add a status there, not in parallel literal arrays.
- **Area text is canonicalised at the EDGE, never stored-normalised retroactively** — `Property.area` is free text, run through `canonicalizeArea()` (`lib/dubai-areas.ts`, controlled `DUBAI_AREAS` vocab + `ALIAS_MAP`) at the three entry points (import route, `PropertyForm` `<select>`, extract prompt) and at display grouping (`PopularSearches`, `PropertiesClient`). `canonicalizeArea` NEVER invents — unknown input passes through trimmed. Keep it OUT of pure `node:test`'d lib modules (`property-map.ts` etc.): a value-import via `@/` or an extensionless relative path breaks `node --test --experimental-strip-types` resolution — wire it in at call sites instead.
- **Modal a11y is shared via `useFocusTrap` (`lib/useFocusTrap.ts`)** — `LeadModal`/`QualifyingModal` get `role="dialog"`, `aria-modal`, Escape-to-close, first-field focus, and a Tab trap from it. New modals should use the hook, not re-implement it.

### Data layer — file-based JSON, no database

All JSON files live in `data/` on the server only — never committed to git, never rsynced from local. Read/written synchronously.

| File | Library | Type |
| ---- | ------- | ---- |
| `data/properties.json` | `lib/properties.ts` | `Property[]` |
| `data/leads.json` | `lib/leads.ts` | `Lead[]` |
| `data/users.json` | `lib/users.ts` | `AdminUser[]` |
| `data/articles.json` | `lib/dynamic-articles.ts` | `DynamicArticle[]` (published AI articles) |
| `data/article-draft.json` | `lib/dynamic-articles.ts` | `DynamicArticle \| null` (pending Telegram approval) |
| `data/article-mode.json` | `scripts/generate-article.mjs` | `{ mode: "keyword" \| "news" }` |
| `data/article-keywords.json` | `scripts/generate-article.mjs` | `{ keywords: string[], index: number }` |
| `data/article-tag-index.json` | `lib/dynamic-articles.ts` + script | `{ index: number }` (round-robin tag rotation) |

`types/index.ts` is the single source of truth for all shapes. Key types: `Property`, `Lead`, `LeadStatus` (`'new' | 'contacted' | 'in-progress' | 'won' | 'lost'`), `AdminUser`, `AdminRole` (`'owner' | 'manager'`), `ActivityEntry`.

Single PM2 instance only — concurrent writes from multiple processes would corrupt JSON.

### Auth — multi-user, signed session tokens

`lib/session.ts` issues and verifies signed tokens using Web Crypto (`crypto.subtle` HMAC-SHA256). Token format: `base64url(JSON(payload)).hmac-sha256`. Signed with the dedicated `SESSION_SECRET` env var (high-entropy, separate from `ADMIN_PASSWORD`). `SessionPayload` carries `uid`, `username`, `name`, `role`.

`lib/users.ts` handles user CRUD with bcryptjs password hashing. `data/users.json` stores `AdminUser[]` (passwords as bcrypt hashes).

**First-run bootstrap:** only when `data/users.json` is empty (no users exist) and the login password matches `ADMIN_PASSWORD`, the owner account is auto-created. Once any user exists, `ADMIN_PASSWORD` can no longer mint accounts. No manual seeding needed.

`middleware.ts` (Edge runtime) guards `/admin/:path*` by verifying the signed token from the `ww_admin_session` cookie. `/admin/users` additionally requires `role === 'owner'`. Middleware does **not** enforce per-section access (the Edge token deliberately carries no `sections` — see below); that happens in the page/API handlers.

Every mutating API handler also calls `isAuthenticated()` / `getSession()` / `requireSection()` from `lib/auth.ts` — defence-in-depth since middleware does not run on API routes.

`lib/auth.ts` exports (all `async`, HMAC verification):

- `getSession()` → `Session | null` — `SessionPayload` enriched with `sections: AdminSection[]` read **fresh from the DB** (not the token), so demotion/section-revocation applies instantly. Use when you need the user identity (e.g. activity log).
- `isAuthenticated()` → `boolean` — simple "is there a valid session" check.
- `requireSection(section)` → `Session | null` — returns the session if it can access `section` (owner always passes), else `null`. API handlers return **403** on `null`.

### Per-section access control (managers)

Owners have full access. A `manager` is restricted to the sections listed in `AdminUser.sections` (`AdminSection = 'properties' | 'leads' | 'dashboard' | 'files'`). **Absent `sections` = legacy user = full access** (backward-compat); new managers default to `['properties']`. The owner-only Users section is never part of `sections`. When adding a new section, append it LAST to `ALL_SECTIONS` (so existing users' `landingPath` is unchanged) and add its entry to `SECTION_PATH` (permissions) and `SECTION_LABEL` (`UsersClient` — TS exhaustiveness enforces this).

`lib/permissions.ts` is the single source of truth (a **pure** module — no `fs`/`next` imports, so it's importable from client components and Edge alike): `ALL_SECTIONS`, `DEFAULT_SECTIONS`, `SECTION_PATH`, `effectiveSections(user)` (the `undefined → all` rule lives here only), `canAccess(user, section)`, `landingPath(user)` (first accessible section's path, or `null`).

Enforced in three layers — **all three must stay in sync when you add an admin surface**:

1. **Nav** (`app/admin/AdminNav.tsx`) — hides tabs via `canAccess`. UX only.
2. **Server pages** — each guarded page redirects with `redirect(landingPath(session) ?? '/admin')`; `/admin` is the single no-access terminal (shows a message when the user has zero sections). Real enforcement.
3. **API routes** — `requireSection(...)` → 403. Real enforcement.

The token shape (`SessionPayload`) is intentionally unchanged — do not add `sections` to it. Login redirects each user to `landingPath(user) ?? '/admin'`.

**When restricting a resource, guard EVERY route under it, not just the index.** `find app/api/<resource> -name route.ts` and guard each handler — a section is only as protected as its least-guarded sibling route (the lead-attachment sub-routes under `app/api/leads/[id]/files/**` were missed once; see `tasks/lessons.md`). The static `/files/leads/` path stays auth-only at the middleware layer (Edge can't read sections); the app reaches those files only through the section-guarded download API.

### Admin routes

- `/admin` — property table + stats (properties count, lead counts) — section `properties`; also the no-access terminal
- `/admin/leads` — full CRM: filter by status/source/search, inline status change, notes, activity log, CSV export — section `leads`
- `/admin/dashboard` — lead stats/funnel — section `dashboard`
- `/admin/users` — owner-only: add/edit/deactivate/delete admin accounts, reset passwords, **set manager section access** (checkboxes shown only for role `manager`)
- `/admin/property/new` and `/admin/property/[id]` — both use `PropertyForm` (drag-and-drop gallery, DLD QR + permit/project numbers) — section `properties`
- `/admin/files` — shared staff file manager (folders, upload, download, rename, delete, global name search) — section `files`

### Admin file storage (Files tab)

A shared file manager for staff documents (`/admin/files`, `FilesClient.tsx`), gated by the `files` section. **Virtual folders:** file bytes are stored flat on disk keyed by a server-generated id at `file-storage/<id>.<ext>` (repo root, **outside `public/`** like `lead-files/` — served only via the authenticated download route, never statically); the folder tree + metadata live in `data/files-storage.json`. Because no user string ever reaches a filesystem path, traversal is structurally impossible. `file-storage/` is gitignored and rsync-excluded (survives deploys — rsync has no `--delete`); `data/files-storage.json` is server-only like the other JSON stores.

- **Logic split:** pure core `lib/file-storage-core.ts` (sniff/sanitize, allowed-type maps, tree helpers, search — `node:test`'d, NO fs/`@/` imports) + fs layer `lib/file-storage.ts` (`readStore` ENOENT→empty/throw-on-corrupt, `mutateStore` synchronous re-read critical section, atomic writes, recursive delete that writes the index **before** unlinking bytes).
- **Upload validation:** per-file ≤25 MB, extension in `ALLOWED_EXT` (PDF/Word/Excel/PowerPoint/jpg/png/webp/zip/**csv** — **SVG excluded**). Binary types must pass a magic-byte sniff matching the extension (client MIME never trusted); **signature-less text types in `SNIFFLESS_EXT` (csv)** instead pass `looksLikeText` (no NUL byte) since they have no magic bytes — safe because csv is download-only. Bytes written before the index entry (orphaned bytes are harmless; an index entry without bytes is a broken download). Multi-file upload via the picker (`multiple`) and **drag-and-drop** onto the list (folder mode only) both hit the same `POST`.
- **Download** (`GET /api/admin/files/[id]/download`) always forces `Content-Disposition: attachment` + `Content-Type: application/octet-stream` — an uploaded HTML/SVG can never render or execute. Filename uses RFC 5987 `filename*=UTF-8''` so Cyrillic names download intact.
- **Preview / lightbox** (`GET /api/admin/files/[id]/preview`, `isPreviewable` whitelist = images + pdf only → others 404) serves bytes **inline** for the `FilesClient` lightbox (images via `<img>`, PDF via `<iframe>`) + lazy thumbnails. **LOAD-BEARING CSP INVARIANT (couples this route to `next.config.mjs`):** the in-app PDF iframe needs the global CSP to allow **same-origin framing** — keep `frame-src 'self'` and `frame-ancestors 'self'` (NOT `'none'`; consistent with `X-Frame-Options: SAMEORIGIN`), and the preview route MUST **NOT** set `Content-Security-Policy: sandbox` (WebKit/Safari refuses to render a PDF in a sandboxed iframe — verified; only "no sandbox" renders, Chrome renders either way). Don't "harden" either back, or PDF preview breaks. Protection without sandbox: auth gate + `isPreviewable` whitelist + `nosniff` + global CSP + the browser's own PDF-JS isolation.
- **Names** are Unicode-aware (`sanitizeStorageName` keeps Cyrillic/case/spaces, strips control/path/hostile chars); the on-disk file is `<id>.<ext>`, so the display name never touches a path. Rename keeps the real ext (case-insensitive).
- **Routes** under `app/api/admin/files/**` — every handler guards with `requireSection('files')` → 403: `GET` (list folder / `?q=` global search) + `POST` (multi-upload); `POST /folder`, `PATCH|DELETE /folder/[id]` (delete is recursive); `PATCH|DELETE /[id]`; `GET /[id]/download`; `GET /[id]/preview`.
- Move-between-folders is intentionally not built (v2). Specs/plans (3 increments): `docs/superpowers/specs/2026-06-09-admin-file-storage-design.md` (+ `-preview-`, `-csv-dragdrop-`) and matching `plans/`.

### API routes

| Route | Auth | Purpose |
| ----- | ---- | ------- |
| `POST /api/leads` | none (public) | Save lead → Telegram + email notify |
| `GET /api/leads` | section `leads` | List all leads |
| `PUT /api/leads/[id]` | section `leads` | Update status/notes; appends `ActivityEntry` with actor from session |
| `DELETE /api/leads/[id]` | section `leads` | Remove lead |
| `…/api/leads/[id]/files/**` (list/upload/delete/download/log/send) | section `leads` | Lead attachments — **every sub-route guarded** |
| `GET /api/admin/users` | owner only | List users (passwordHash stripped) |
| `POST /api/admin/users` | owner only | Create user (validates `sections`; owner forced to all) |
| `PUT /api/admin/users/[id]` | owner only | Update name/role/active/password/`sections` |
| `DELETE /api/admin/users/[id]` | owner only | Delete user (cannot delete self) |
| `POST /api/upload?kind=gallery\|qr` | section `properties` | Save images to `public/images/` |
| `GET /api/properties` | none (public) | List properties (used by the site) |
| `GET /api/fx` | none (public) | AED→USD/EUR/GBP rates, cached daily (`revalidate 86400`) + fallback; used by `PriceTag` |
| `POST /api/properties` | section `properties` | Create property |
| `PUT/DELETE /api/properties/[id]` | section `properties` | Update / delete property |
| `POST /api/telegram-webhook` | `WEBHOOK_SECRET` header | Receives Telegram callbacks: publish/skip article buttons, `/add_keyword` command |
| `POST /api/admin/import` | section `properties` | Upload developer PDF → Gemini field extraction + poppler photo extraction → staged draft |
| `GET /api/admin/import` | section `properties` | List pending import drafts |
| `PUT/DELETE /api/admin/import/[draftId]` | section `properties` | Update draft fields / reject draft (+ delete its image folder) |
| `POST /api/admin/import/[draftId]/publish` | section `properties` | Publish draft → property (reuses draftId as id) |

(Section guards return **403** when the authenticated user lacks the section; owners always pass. `GET /api/properties` and `POST /api/leads` are deliberately public.)

### Activity log

`lib/leads.ts` `updateLead()` accepts an optional `actor` param `{ uid, username, name }`. When provided, it appends an `ActivityEntry` to `lead.activityLog[]` describing what changed (status transition and/or notes update). The `PUT /api/leads/[id]` handler always passes the session user as actor. The log is displayed in reverse-chronological order in the expanded lead row in `LeadsClient.tsx`.

### Anti-spam (lead capture)

`POST /api/leads` enforces: honeypot field (`_hp`) check → phone digit validation (7–15 digits) → in-memory rate limit (10 submissions/IP/hour). Rate limit is counted after validation so typos don't consume quota. The `rateMap` resets per 1-hour window and lives in module state (single PM2 instance).

All lead capture components (`LeadModal`, `LeadCaptureSection`, `PropertyEnquiryForm`, `QualifyingModal`, `GuideClient`; `FloatingCTA` opens `LeadModal`) include a hidden honeypot `<input name="website">` and send `_hp` in the POST body. Keep `source` strings consistent across components for analytics.

**Honeypot must be clip-hidden, not off-screen-left.** Use `style={{ position:'absolute', width:'1px', height:'1px', margin:'-1px', padding:0, overflow:'hidden', clip:'rect(0,0,0,0)', border:0 }}`. The old `left:-9999px` pattern makes the page horizontally scrollable into a huge empty band on **iOS Safari** (Chrome clamps it, so it won't reproduce in headless testing) — that was a real shipped bug. Any new honeypot must use the clip pattern.

### Conversion & investor UI (Tier 1–3, added 2026-05)

A set of conversion/polish components layered on the public site. Most are shared and mounted across pages:

- **`MobileCtaBar`** — mobile-only (`md:hidden`) fixed bottom bar (Enquire opens `LeadModal` + prefilled WhatsApp), on `/properties/[slug]` and area pages. `FloatingCTA` FABs are `hidden md:flex` so the two never overlap. Sources: `property_enquiry` / `area_*` / `golden_visa` (Enquire) and `mobile_bar` (WhatsApp).
- **`lib/whatsapp.ts`** — `waLink(msg)` / `waPropertyMessage(title)` build prefilled `wa.me` links. Use it everywhere instead of hand-built URLs. Per-card WhatsApp button lives in `PropertyCard` (source `property_card`).
- **`Reveal`** — scroll-reveal wrapper (opacity+transform only → zero CLS, `prefers-reduced-motion` aware, `<noscript>` fallback). Wraps homepage sections **below the hero** (never the hero — LCP). Triggers early (`threshold:0`, `rootMargin:'0px 0px 300px 0px'`) so sections finish fading before they enter view.
- **`SocialProofStrip`** — rating/volume/RERA + a developer-logo row (logos in `public/images/developers/`, white chips so they read on dark/light). Shown in `LeadCaptureSection` (dark) and beside `PropertyEnquiryForm` (light).
- **Multi-currency** — `lib/fx.ts` (`getRates()` from open.er-api.com, `next: { revalidate: 86400 }` + `FALLBACK_RATES`) → `GET /api/fx` (cached JSON). Client: `CurrencySelect` (sets `localStorage 'ww_currency'` + `ww_currency` event) and `PriceTag` (AED primary + secondary `≈` converted; one shared `/api/fx` fetch per page). AED stays the displayed default everywhere.
- **`QualifyingModal` + `QualifyCta`** — 3-step qualifying form (budget → ready/off-plan + area → name+phone), `source: qualify`. Posts optional `propertyType`/`area` (length-capped like `budget` in `/api/leads`; surfaced in the CRM lead view + CSV). The homepage band is a navy card on a light section (don't make it full-bleed navy — it merges with the navy `MortgageCalculator` below).
- **Golden Visa** — `lib/golden-visa.ts` (`qualifiesForGoldenVisa(priceAed)`, AED 2M, derived — no data entry); a "Golden Visa" badge on qualifying cards/detail; SSG landing `app/golden-visa/` (mirrors the area-page client-wrapper pattern), `source: golden_visa`. **Intentionally not linked in the nav** — SEO/ads landing only; surface it in nav only if GSC shows demand.
- **Lead magnet** — gated `app/guide/` (minimal-nav landing) reveals `public/dubai-investment-guide.pdf` after name+phone, `source: lead_magnet_guide`. The PDF lives at `public/` root (NOT `public/files/`, which rsync excludes) so it deploys normally.
- **Per-property brochure** (Wave 3/E) — `BrochureGate` on `/properties/[slug]` (shown only when `Property.brochure` is set) soft-gates a PDF behind a name+phone form, `source: brochure_request`, then reveals `GET /api/properties/[id]/brochure` (Node route, runtime disk read). Brochure bytes live **server-only** at `public/files/brochures/<id>.pdf` (rsync-excluded, like lead attachments). The PDF import persists the uploaded brochure there automatically; `PropertyForm` can upload one via `POST /api/upload?kind=brochure`. The 144 existing properties have none until uploaded.
- **Per-property floor plans** (Wave 3/D) — `FloorPlanGate` on `/properties/[slug]` (shown only when `Property.floorPlans` is non-empty), labelled **"Floor plans & site plans"**: blurred thumbnails → name+phone form → reveal, `source: floor_plan`. Images live in the existing `public/images/properties/<id>/` folder (media route, no separate store); `PropertyForm` can upload/reorder more (kind=gallery, tracked in `floorPlans`). **Extraction uses TWO independent passes in `lib/pdf-images.ts` (do not merge them):** the **gallery pass** keeps images ≥ `MIN_PHOTO_BYTES` (50 KB — do NOT lower it; see lessons.md 2026-06-04) and routes exterior→interior→amenity (`partitionGallery`); the **plan pass** takes the SMALL images the 50 KB gate rejected, narrows them by floor-plan **geometry** (`isLikelyFloorPlanDims`, dims via ImageMagick `identify`), classifies them in a SEPARATE Gemini call, and `selectPlanSection` puts up to 2 `masterplan` (from the gallery pass) + the `floorplan`s into `floorPlans`. The two passes keep small floor plans from flooding the gallery's classify cap. Classifier categories (`lib/image-classify.ts`): `floorplan` = single-unit layout, `masterplan` = community/site map — kept distinct so site maps never crowd the gate.
- **Per-property location map** — `PropertyLocation` on `/properties/[slug]` renders a "Location" section: area name + internal link to the area landing page, plus a **lazy click-to-load** Google Maps embed (`output=embed`, no API key, no Google request/cookies/LCP cost until "Show map" is clicked — GDPR-clean on the highest-converting page). The map centre resolves via the pure `resolvePropertyCoords` (`lib/property-coords.ts`): `Property.lat/lng` → building pin (z16), else the area centroid from `lib/areas.ts` `coords` → district pin (z13), else no map (text block only). `scripts/seed-coords.cjs` (server-only, mirrors `seed-gross-yield.cjs`) populates `lat/lng` via the Google Geocoding API (`GOOGLE_GEOCODING_API_KEY`, server `.env.local`), gated to `ROOFTOP`/`GEOMETRIC_CENTER` results inside a Dubai bounding box (mis-resolved names fall back to the district, never fabricate). JSON-LD `RealEstateListing` gains a `geo` `GeoCoordinates` when coords resolve.

### Investor metrics: `grossYield` + monthly yield review

`Property` carries optional `roi`, `paymentPlan`, and **`grossYield?: number`** (gross rental yield %, shown as `📈 X% yield` on cards and a "Gross Yield" detail stat). Area-level yields live in `lib/areas.ts` `metrics.roi` and must stay consistent with the prose/FAQ/`metaDescription` (all four mention yields).

`worldwise/scripts/seed-gross-yield.cjs` (server-only) seeds `grossYield` per property from researched per-district yields (tolerant area matching; **specific tokens before general**, e.g. "Damac Hills 2" before "Damac Hills"; never fabricate for unrecognised/generic areas). Run on the server: `node scripts/seed-gross-yield.cjs` (dry-run) → `--apply` → `npm run build && pm2 restart worldwise`. The script header documents the **monthly yield-review process** (re-verify yields vs E&V / DLD / Bayut, update `lib/areas.ts` + re-seed). A recurring monthly calendar reminder drives it.

> Editing `data/properties.json` directly (vs an rsync deploy) requires a **server `npm run build`** afterwards — SSG pages are prerendered, so a `pm2 restart` alone serves the stale build.

### Developer PDF import

Admins import developer brochure PDFs into the catalog from `/admin` (the `ImportPanel` above the Properties table). Flow: upload a PDF → `extractPropertyFromPdf` (`lib/property-extract.ts`, Gemini `gemini-2.5-flash` multimodal, strict JSON `responseSchema`) fills property fields via the pure `mapGeminiToProperty` (`lib/property-map.ts`); `extractImagesFromPdf` (`lib/pdf-images.ts`) pulls candidate photos with **poppler-utils** (`pdfimages -png`, fallback `pdftoppm`) straight into `public/images/properties/<draftId>/`. The result is staged as a `PropertyDraft` in `data/property-drafts.json` (`lib/property-drafts.ts`, server-only, gitignored). The admin reviews/edits via the existing `PropertyForm` at `/admin/property/new?draft=<id>` (or quick-publishes), and publishing goes through `coercePropertyInput()` + `createProperty()` **reusing `draftId` as the property `id`** — so the extracted images need no move. AI only pre-fills; nothing reaches the public site without the manual publish step.

On import, if the extracted fields carry no coordinates, the route calls `geocodeDubaiProperty` (`lib/geocode.ts`, Google Geocoding) to pre-fill `lat`/`lng` by **name** — same confidence gate as `scripts/seed-coords.cjs` (accept only `ROOFTOP`/`GEOMETRIC_CENTER` inside the Dubai bbox; skip generic resale titles like "N-Bedroom Apartment in …" that geocode to the wrong district). Non-fatal: a miss just leaves the draft without coords (area-centroid fallback on the page) and the admin can set the pin in `PropertyForm`. Needs `GOOGLE_GEOCODING_API_KEY` in the server `.env.local`. The gate logic is intentionally duplicated in `lib/geocode.ts` and `seed-coords.cjs` (a `.cjs` cron can't import the `.ts`) — keep them in sync.

**Dependencies:** the server needs `poppler-utils` (`pdfimages`/`pdftoppm`, extraction) and `imagemagick` (`convert`/`magick`, downscaling extracted rasters to ~1600px). Both are system binaries invoked via `child_process` (not npm native addons), so they don't violate the Edge-runtime no-native-modules rule. If poppler is missing, extraction degrades to fields-only; if ImageMagick is missing, images are copied at native size — both logged, non-fatal.

### Blog / articles

Two article sources, merged by `lib/articles.ts`:

1. **Static editorial** — `articles` array in `lib/articles.ts`. Add an entry here for manually written articles. Shape: `{ slug, tag, title, excerpt, readTime, content }` where `content` is a Markdown-like string parsed by `parseContent()`.

2. **AI-generated** — `data/articles.json` on the server (server-only, never committed). Managed by `lib/dynamic-articles.ts`. Shape adds `publishedAt` and `source: 'ai-generated'`.

`getAllArticles()` in `lib/articles.ts` merges `[...dynamic, ...static]` (dynamic first, newest at top) and then **collapses slug collisions via `bestBySlug()`**, which keeps one entry per slug: a **hand-written static article always wins over an AI-generated one** of the same slug; between two of the same kind the longer `content` wins. `getArticleBySlug()` is derived from `getAllArticles()`, so it resolves the same winner. This is load-bearing: it (a) stops an empty/thin AI draft from shadowing a real article and rendering duplicate cards, and (b) lets you **override a thin AI article by promoting it to a static one with the same slug — no `data/` edit needed**. `publishDraft()` in `lib/dynamic-articles.ts` also suffixes a colliding slug (`-2`, `-3`…) so newly published AI drafts can't shadow existing content. All three functions feed the blog listing, article page, and sitemap.

`app/blog/[slug]/page.tsx` uses a custom `parseContent()` parser that converts the content string into typed blocks (h2, h3, p, ul, ol, table). `generateStaticParams()` pre-renders static article slugs at build time; dynamic article routes are rendered on demand.

### Auto-blog pipeline

Cron runs `scripts/generate-article.mjs` daily at 09:00 UTC (`0 9 * * *`). The script is a Node.js ESM module invoked with `node --env-file=.env.local scripts/generate-article.mjs`.

**Mode alternation:** `data/article-mode.json` holds `{ mode: "keyword" | "news" }`. Each successful generation flips the mode. On Gemini failure the mode is NOT flipped — the next run retries the same mode.

- **keyword mode** — picks the next query from `data/article-keywords.json` (`keywords[index]`), fetches Google News RSS for supporting context, prompts Gemini to write a 600–800 word SEO article answering that specific investor search query, increments `index`.
- **news mode** — fetches Google News RSS, prompts Gemini to summarise recent UAE property headlines.

**Keyword bank exhaustion:** when `index >= keywords.length`, the script sends a Telegram notification and exits without generating an article or flipping the mode.

**Approval flow:** generated article is saved to `data/article-draft.json`. Telegram message is sent with Publish / Skip inline buttons. `POST /api/telegram-webhook` handles button callbacks via `publishDraft()` / `deleteDraft()` from `lib/dynamic-articles.ts`. The `/add_keyword <query>` Telegram text command appends to `data/article-keywords.json` — only accepted from the first chat ID in `TELEGRAM_CHAT_ID`.

**Tag rotation:** `data/article-tag-index.json` cycles through `['Market Update', 'Investment Guide', 'Area Spotlight', 'Legal Guide', 'Visa & Residency']`. This index is shared between the script and `lib/dynamic-articles.ts` — do not rename `TAGS` or change its order without updating both files.

**To run manually on server:**

```bash
ssh -i ~/.ssh/id_ed25519 root@62.238.35.20 \
  "cd /var/www/worldwise && node --env-file=.env.local scripts/generate-article.mjs"
```

**To monitor cron logs:**

```bash
ssh -i ~/.ssh/id_ed25519 root@62.238.35.20 "tail -50 /var/log/worldwise-blog.log"
```

### Analytics

`components/Analytics.tsx` — consent-aware GA4 loader. Renders `<Script>` tags only after the user accepts cookies. Listens for the `ww_consent_accepted` custom event dispatched by `CookieBanner.tsx` (also checks `localStorage` on mount for returning visitors). Mounted in `app/layout.tsx`.

`lib/analytics.ts` — thin `track(event, params?)` helper that calls `window.gtag()` when available. Import this in any client component that needs to fire a GA4 event. Do not call `window.gtag` directly.

**Events in use:** `lead_form_submit` (source + optional property), `whatsapp_click` (source + optional property), `property_view` (property title).

### Marketing attribution (UTM / click-IDs)

First-touch attribution feeds paid-ad ROI (Google Search is live). `lib/utm.ts`: pure `parseUtmParams()` (node:test'd) + `captureUtmOnFirstTouch()` / `getStoredAttribution()` store `utm_source/medium/campaign/term/content` + `gclid`/`fbclid` in `localStorage` key `ww_attribution` — **first touch wins** (a later organic visit never overwrites). `components/UtmCapture.tsx` (mounted in `app/layout.tsx`) captures on mount and is **deliberately NOT gated on cookie consent** — gclid lands even when GA4 is blocked, which is what makes consent-independent **Offline Conversion Import (gclid)** possible (see `docs/marketing/2026-06-09-google-ads-fixes-and-conversion-tracking.md`).

**Invariant:** every lead form spreads `...getStoredAttribution()` into its `/api/leads` POST body (LeadModal, LeadCaptureSection, PropertyEnquiryForm, QualifyingModal, BrochureGate, FloorPlanGate, GuideClient). `POST /api/leads` whitelists + length-caps the fields (never spread the raw body); `Lead` carries them; the CRM expanded view shows an "Attribution" line and CSV export includes the columns. A new lead form MUST attach `getStoredAttribution()`, or its paid clicks are untracked. The Telegram new-lead notification (`lib/notify.ts`) flags paid leads (utm_source/gclid present) and offers a one-tap "Reply on WhatsApp" button (speed-to-lead).

### GSC CLI (local diagnostics)

`scripts/gsc.mjs` is a Node ESM CLI for Google Search Console — used both as a local diagnostic tool (URL inspection, top queries, top pages, sitemap status) and as a weekly cron on the server that posts a Telegram digest.

**Auth:** OAuth 2.0 Desktop client (refresh token in `.env.local`). The Service Account path is blocked because GSC refuses to add service-account emails as users on personal Gmail properties — OAuth runs against the property owner's own account.

**Env vars in `.env.local`:**

- `GSC_OAUTH_CLIENT_ID` — from the GCP OAuth client (Desktop type) in project `worldwise-497520`
- `GSC_OAUTH_CLIENT_SECRET` — same source
- `GSC_REFRESH_TOKEN` — written automatically by `gsc.mjs auth`
- `GSC_SITE_URL` (optional) — defaults to `https://worldwise.pro/`

**Commands (run from `worldwise/`):**

```bash
node --env-file=.env.local scripts/gsc.mjs auth                               # one-time OAuth
node --env-file=.env.local scripts/gsc.mjs inspect https://worldwise.pro/<x>  # URL inspection
node --env-file=.env.local scripts/gsc.mjs queries [--days=N] [--limit=N]     # top queries
node --env-file=.env.local scripts/gsc.mjs pages   [--days=N] [--limit=N]     # top pages
node --env-file=.env.local scripts/gsc.mjs sitemaps                           # sitemap status
node --env-file=.env.local scripts/gsc.mjs digest [--dry-run]                 # send weekly snapshot to Telegram
```

**Weekly cron on the server** (Hetzner VPS) runs the `digest` command every Monday at 06:00 UTC and appends to `/var/log/worldwise-gsc.log`:

```text
0 6 * * 1 cd /var/www/worldwise && node --env-file=.env.local scripts/gsc.mjs digest >> /var/log/worldwise-gsc.log 2>&1
```

The digest needs `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` on the server (already present, used by lead notifications) plus the three `GSC_*` vars — these were copied to server `.env.local` during initial setup (the file is excluded from rsync, so it persists across deploys).

If the refresh token expires (`invalid_grant`), re-run `auth` locally and re-copy `GSC_REFRESH_TOKEN` to server `.env.local`. Tokens can be revoked at any time via `myaccount.google.com/permissions` (the consent screen is named `Worldwise GSC CLI`).

### Area landing pages

8 flat-URL SSG pages target Dubai districts: `/dubai-marina`, `/downtown-dubai`, `/palm-jumeirah`, `/business-bay`, `/dubai-hills`, `/jlt`, `/creek-harbour`, `/emaar-beachfront`. All content (metrics, copy, FAQ) lives in `lib/areas.ts` — the single source of truth, edited via PR like `lib/articles.ts`.

Route `app/[area]/page.tsx` is a server component (handles `generateStaticParams` + `generateMetadata` + JSON-LD). It composes a client wrapper `app/[area]/AreaPageClient.tsx` that owns the `LeadModal` state. Adding a new district = adding one entry to `areas` in `lib/areas.ts` (no new route file needed) plus ensuring `public/images/areas/<slug>.jpg` exists. `generateStaticParams` whitelists `areaSlugs`; any other slug on this route returns 404.

Leads from these pages carry `source: area_<slug_underscored>` (e.g. `area_dubai_marina`). Each page emits three JSON-LD blocks: `Place`, `BreadcrumbList`, and `FAQPage`. The homepage `AreasSection` links to these flat URLs as the main internal-link hub.

The featured-properties grid on the area page matches `Property.area` **tolerantly** via `propertyMatchesArea()` in `lib/areas.ts` — case-insensitive, normalized-substring (so `"Dubai Hills Estate"` matches the `"Dubai Hills"` area), plus an optional `aliases: string[]` per area for spellings that don't share a substring (e.g. JLT ↔ `"Jumeirah Lake Towers"`). `Property.area` is free text from CRM/imports, so do **not** rely on exact spelling — if a known-good listing doesn't appear on its area page, add its spelling to that area's `aliases` rather than editing the data. Verify against the live distinct-area set (read `data/properties.json` on the server) so short alias tokens don't cause false positives.

### SEO / crawler layer

- `app/robots.ts` — blocks `/admin` and `/api`
- `app/sitemap.ts` — dynamic sitemap (homepage + /blog + /mortgage-calculator + /properties + /golden-visa + /guide + 8 area landing pages + all property and article slugs)
- `next.config.mjs` — `images.formats: ['image/avif','image/webp']` (AVIF for smaller LCP); old Tilda `/tpost/*` and `/tproduct/*` URLs 301-redirect to `/blog` / `/properties` (two high-traffic posts to topically-matched articles)
- `app/layout.tsx` — `metadataBase`, default `og:image`, `twitter:card: summary_large_image`, JSON-LD `RealEstateAgent`
- `app/properties/[slug]/page.tsx` — per-property `og:image`, JSON-LD `RealEstateListing` + `BreadcrumbList`
- `app/mortgage-calculator/page.tsx` — JSON-LD `WebApplication` + `FAQPage` (5 questions)
- `public/llms.txt` — plain-text site summary for AI crawlers

### Images

Local area images: `public/images/areas/` — never use external URLs. Property galleries: `public/images/properties/<id>/`. QR codes: `public/images/qr/`.

### Styling

Custom Tailwind palette: `navy` / `gold` (see `tailwind.config.ts`). Global button utilities `btn-primary`, `btn-outline`, `btn-outline-gold` in `app/globals.css` — use for all CTAs.

**Gold-as-text accessibility:** `--gold` (#C9A84C) on a light background is ~2:1 — fails WCAG AA. For gold *text* on light surfaces (eyebrow labels, "Read More", stat values) use the `.text-gold-accessible` utility (`--gold-dark` #8A6D1F, ~4.6:1). Plain `text-gold` only on dark/navy backgrounds, and `btn-primary` (navy text on gold) is fine. **Gold-outline buttons:** `btn-outline-gold` (gold border + gold text) is for **dark/navy** backgrounds only; on **light** surfaces use `btn-outline-gold-light` (resting text `#8A6D1F`, gold fill + navy text on hover, AA-compliant). Don't put `btn-outline-gold` on a light section.

## Environment variables

See `.env.example`. Key vars:

- `ADMIN_PASSWORD` — first-run owner bootstrap password only (no longer signs tokens)
- `SESSION_SECRET` — high-entropy key that signs/verifies session tokens; must differ from `ADMIN_PASSWORD`. Rotating it logs out all admins. Generate with `openssl rand -base64 48`
- `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` — lead notifications and auto-blog approvals; comma-separated for multiple recipients. The first ID is the admin who can use `/add_keyword`.
- `WEBHOOK_SECRET` — validates `X-Telegram-Bot-Api-Secret-Token` header on `POST /api/telegram-webhook`
- `GEMINI_API_KEY` — Gemini 2.0 Flash API key used by `scripts/generate-article.mjs`
- `SMTP_HOST/PORT/USER/PASS` + `NOTIFY_EMAIL` — optional email notifications via nodemailer
- `NEXT_PUBLIC_SITE_URL` — absolute URLs in Telegram messages and sitemap
- `NEXT_PUBLIC_GA_ID` — Google Analytics 4 Measurement ID (e.g. `G-XXXXXXXXXX`); GA loads only after cookie consent
- `NEXT_PUBLIC_WHATSAPP`, `NEXT_PUBLIC_PHONE`, `NEXT_PUBLIC_EMAIL` — contact details in `FloatingCTA` and `Footer`
