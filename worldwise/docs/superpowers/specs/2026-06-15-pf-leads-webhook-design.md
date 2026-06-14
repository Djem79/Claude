# Property Finder leads → CRM (webhook) — design

**Date:** 2026-06-15
**Status:** approved (design), pending implementation plan
**Direction:** Integration #1 of the PF Enterprise API (leads in). Catalog→PF (listings out) is a separate, later project.

## Context

Property Finder is the agency's main paid lead source, but PF inquiries are currently typed into the Telegram bot by hand. PF now exposes an **Enterprise API** (`https://atlas.propertyfinder.com`) with a `lead.created` webhook. An API key (scopes `leads:read` + `users:read`, plus default `webhooks:full_access`) has been created and validated (`POST /v1/auth/token` → 200, JWT, 30-min TTL).

This spec covers ingesting PF leads automatically into the existing CRM (`data/leads.json`) via a signed webhook, reusing the existing lead-save + notify pipeline.

## Goal

When a new lead is created on Property Finder, it appears in the CRM with `source: property_finder` and fires the existing Telegram new-lead notification — with zero manual entry.

## Non-goals (v1 scope — YAGNI)

- Only `lead.created`. `lead.updated` / `lead.assigned` (project / PRIMARY PLUS leads) are **out** of v1.
- **No outbound PF API call inside the webhook hot path** (no token exchange, no `/v1/users` agent-name resolution). Keeping the handler self-contained guarantees the <5s ack. Agent-name enrichment is a possible v2.
- No catalog push (listings out). Separate key + project.
- No new CRM UI — PF leads render in the existing `/admin/leads` board (the `property_finder` source string already exists).

## Architecture

```
PF (lead.created) ──POST + X-Signature──▶ POST /api/pf-webhook
   1. read RAW body text
   2. verify HMAC-SHA256(raw, PF_WEBHOOK_SECRET) == X-Signature   (timing-safe) → else 401
   3. JSON.parse(raw); ignore non-`lead.created` types → 200 (no retry)
   4. map payload → Lead fields (pure: lib/pf-lead.ts)
   5. savePfLead(...) — idempotent insert inside ONE mutateLeads critical section (dedup on pfLeadId)
   6. notifyTelegram(lead, baseUrl)  [try/catch, must not break ack]
   7. respond 200
```

### Components

| File | Kind | Responsibility |
| ---- | ---- | -------------- |
| `lib/pf-lead.ts` | **pure** (no fs/net/`@/`) | `mapPfLead(payload): {pfLeadId, name, phone, email?, message, source}` — extract sender, contacts, channel, listing.reference into our shape. Mirrors `lib/lead-parse.ts` style. |
| `lib/pf-lead.test.ts` | `node:test` | Cases: phone+email lead, email-only (phone→`''`), whatsapp/call/email channels, missing listing, missing sender name. |
| `lib/leads.ts` → `savePfLead(data, pfLeadId)` | fs (mutation) | New export. Inside **one** `mutateLeads` callback: if any lead already has this `pfLeadId`, return it unchanged (`deduped:true`); else append (reuse the same id/createdAt/status defaults as `saveLead`). Race-free idempotency per the `mutateJsonFile` invariant. |
| `app/api/pf-webhook/route.ts` | Node route | `POST` handler: raw-body HMAC verify → parse → `mapPfLead` → `savePfLead` → `notifyTelegram` → 200. `GET`/others → 405. |
| `types/index.ts` | type | Add `pfLeadId?: string` to `Lead` (dedup + provenance). |
| `scripts/pf-subscribe-webhook.mjs` | Node ESM | One-time, idempotent: token → `GET /v1/webhooks` (skip if `lead.created`+our URL already subscribed) → `POST /v1/webhooks {eventId:'lead.created', callbackUrl, secret:PF_WEBHOOK_SECRET}`. Run on server with `--env-file=.env.local`. |

### Mapping (PF `WHPayloadLead` → `Lead`)

| Lead field | Source |
| ---------- | ------ |
| `name` | `payload.sender.name` (fallback `"Property Finder lead"`) |
| `phone` | first `sender.contacts[]` with `type:'phone'` → `value`; else `''` |
| `email` | first `sender.contacts[]` with `type:'email'` → `value`; else omit |
| `message` | `Property Finder · {channel}` + (` · listing {payload.listing.reference}` if present) |
| `source` | `'property_finder'` (constant; already a known CRM source) |
| `pfLeadId` | top-level event `entity.id` (the lead id) — dedup key |

`status` defaults to `new`, `createdAt`/`id` set by `savePfLead` (same as `saveLead`). Attribution (`utm_*`/gclid) is N/A for portal leads.

## Security & reliability

- **HMAC over the RAW body**, not a re-serialized object (PF signs the exact bytes). Read `await req.text()` first, verify, then `JSON.parse`. Compare with `crypto.timingSafeEqual` (mirror the `safeEqual` helper in `telegram-webhook/route.ts`).
- Bad/missing signature → **401**. (Secret is always set, so signature is always required.)
- **Idempotency:** PF delivers at-least-once and retries on non-2xx; dedup on `pfLeadId` inside the mutation makes repeat deliveries no-ops.
- **Fast ack (<5s):** lead save is a synchronous file write; `notifyTelegram` is wrapped in `try/catch` so a slow/failed Telegram call still returns 200 (lead is already persisted). PF requires a 2xx within 5s or it retries.
- `app/robots.ts` already blocks `/api`. The route is public POST (no admin session); the HMAC is the only gate — consistent with `telegram-webhook` (header-secret gate). Reaches origin through Cloudflare exactly like the Telegram webhook.

## Environment variables (server `.env.local` only — excluded from rsync/git)

- `PF_API_KEY` — 40-char API key (used by the subscribe script only, not the webhook).
- `PF_API_SECRET` — 32-char secret (subscribe script only).
- `PF_WEBHOOK_SECRET` — random ≤32 chars (`openssl rand -hex 16`); signs/verifies the webhook HMAC. Set identically in the subscription `secret` and in the route's verify.

## Edge cases

- **Email-only / call leads:** `phone` may be absent → store `''` (trusted source; CRM still shows the lead, email/channel captured in `message`).
- **Unknown/other event types** (`lead.updated`, etc.): ack 200 and ignore → PF won't retry.
- **Duplicate delivery:** skipped via `pfLeadId` dedup.
- **Malformed JSON / missing sender:** mapper is defensive (fallback name, optional fields); if body fails HMAC it never reaches the mapper.

## Verification

1. `node --test --experimental-strip-types lib/pf-lead.test.ts` — mapper cases pass.
2. `npm run build` — green (route + type compile).
3. After deploy + running `pf-subscribe-webhook.mjs`: trigger a real test inquiry on a live PF listing → confirm it appears in `/admin/leads` with `source: property_finder` and a Telegram notification fired.
4. Negative: `curl -X POST .../api/pf-webhook` with a bad `X-Signature` → **401**; a valid signed replay of the same `pfLeadId` → no duplicate lead.

## Deploy

1. Add `PF_API_KEY`, `PF_API_SECRET`, `PF_WEBHOOK_SECRET` to server `.env.local`.
2. rsync working tree → server `npm run build` → `pm2 restart worldwise` (standard flow; back up `data/` first).
3. One-time: `ssh … "cd /var/www/worldwise && node --env-file=.env.local scripts/pf-subscribe-webhook.mjs"`.
4. Verify per step 3–4 above.

## Future (v2, not now)

- Resolve agent name via `GET /v1/users` (we have `users:read`) — enrich `message`/assignment.
- Handle `lead.assigned` for project (PRIMARY PLUS) leads.
- Direction #2: catalog → PF (listings publish) — separate key with `listings:full_access`, DLD compliance flow, consumes credits.
