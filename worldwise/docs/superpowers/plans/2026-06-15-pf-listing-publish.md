# Publish to Property Finder (catalog → PF listings) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> **Implementation is deferred to a later session.** This plan is the prepared deliverable.

**Goal:** An admin can selectively publish a worldwise property to Property Finder as a listing (two-step: draft → confirm credits → publish), track its status via webhook, and unpublish — without leaving worldwise.

**Architecture:** New admin-entered PF fields on `Property`; a server-only PF API client; a pure Property→PF-listing mapper (the risk core, fully tested); three section-guarded API routes (draft/publish/unpublish) that resolve agent/location/compliance and write PF state back onto the property; the existing signed `/api/pf-webhook` extended to flip listing status; a "Property Finder" panel in `PropertyForm`.

**Tech Stack:** Next.js 16 (Node runtime), TypeScript, `node:test` for the pure mapper, PF Enterprise API `https://atlas.propertyfinder.com`.

Spec: `docs/superpowers/specs/2026-06-15-pf-listing-publish-design.md`. Read it before starting.

**PREREQUISITE (operator, before deploy — not a code task):** create a **second PF API key** with scopes `listings:full_access` + `users:read` (the #1 key is `leads:read`+`users:read` only); set `PF_COMPANY_LICENSE` and `PF_PUBLIC_PROFILE_ID` in the server `.env.local` (resolve the profile id via `GET /v1/users`). Until then the routes will 401/403 against PF — expected.

## File structure

- Modify `types/index.ts` — new `Property` fields.
- Modify `lib/properties.ts` — whitelist new form fields in `coercePropertyInput`; add `setPfListingState(id, patch)` + `setPfStatusByListingId(pfListingId, patch)` (via `mutateProperties`).
- Modify `components/PropertyForm.tsx` — 3 new inputs + the "Property Finder" panel.
- Create `lib/pf-client.ts` — token cache + `pfFetch` (server-only). [routes only; the `.mjs` subscribe script keeps its own token fetch — `.mjs` can't import `.ts`]
- Create `lib/pf-listing-map.ts` + `lib/pf-listing-map.test.ts` — pure `validateForPf` + `mapPropertyToPfListing`.
- Create `app/api/admin/pf-listing/draft/route.ts`, `.../publish/route.ts`, `.../unpublish/route.ts`.
- Modify `app/api/pf-webhook/route.ts` — dispatch listing events.
- Modify `scripts/pf-subscribe-webhook.mjs` — subscribe listing events too.
- Modify `.env.example` — `PF_COMPANY_LICENSE`, `PF_PUBLIC_PROFILE_ID`.
- Modify `/admin` property table component — PF status badge.

---

### Task 1: Property data model + coercion

**Files:** Modify `types/index.ts`, `lib/properties.ts`

- [ ] **Step 1: Add fields to `Property`** (in `types/index.ts`, inside `interface Property`, after `permitNumber?`/`projectNumber?`):
```ts
  // Property Finder listing integration (#2)
  bathrooms?: string                 // PF enum: 'none' | '1'..'20'
  sizeSqft?: number                  // property area in sqft (PF `size`), required to publish
  furnishingType?: 'unfurnished' | 'semi-furnished' | 'furnished'
  pfListingId?: string               // PF listing id once a draft/listing exists
  pfListingStatus?: 'draft' | 'pending' | 'live' | 'unpublished' | 'action_required' | 'failed'
  pfLocationId?: number              // cached PF location tree id for this property's area
  pfPublishedAt?: string             // ISO; set when listing.published webhook arrives
```

- [ ] **Step 2: Whitelist the 3 admin-entered fields in `coercePropertyInput`** (`lib/properties.ts`). Find the field/length whitelist (it currently includes `['permitNumber', 120], ['projectNumber', 120], ['brochure', 80]`). Add `bathrooms` (string, short), `furnishingType` (string, short) to the same string-coercion list, and coerce `sizeSqft` as a non-negative number (mirror how `pricePerSqft`/`priceAed` numbers are coerced — no `NaN`). Do **NOT** whitelist any `pf*` state field (those are written only by the pf-listing routes).

- [ ] **Step 3: Type-check** — `npx tsc --noEmit` → clean for these files.

- [ ] **Step 4: Commit**
```bash
git add types/index.ts lib/properties.ts
git commit -m "feat(pf-listing): Property PF fields + coerce bathrooms/sizeSqft/furnishingType"
```

---

### Task 2: PF state writers in `lib/properties.ts`

**Files:** Modify `lib/properties.ts`

- [ ] **Step 1: Add two writers** (use the existing private `mutateProperties`, mirroring how other mutators in the file work):
```ts
export function setPfListingState(id: string, patch: Partial<Pick<Property,
  'pfListingId' | 'pfListingStatus' | 'pfLocationId' | 'pfPublishedAt'>>): Property | null {
  let updated: Property | null = null
  mutateProperties((list) => list.map((p) => {
    if (p.id !== id) return p
    updated = { ...p, ...patch }
    return updated
  }))
  return updated
}

// idempotent: locate the property by its PF listing id (webhook path)
export function setPfStatusByListingId(pfListingId: string, patch: Partial<Pick<Property,
  'pfListingStatus' | 'pfPublishedAt'>>): Property | null {
  let updated: Property | null = null
  mutateProperties((list) => list.map((p) => {
    if (p.pfListingId !== pfListingId) return p
    updated = { ...p, ...patch }
    return updated
  }))
  return updated
}
```
(Confirm the exact name of the private mutator by reading the top of `lib/properties.ts`; the spec assumes `mutateProperties`.)

- [ ] **Step 2: Type-check** — `npx tsc --noEmit` clean.

- [ ] **Step 3: Commit**
```bash
git add lib/properties.ts
git commit -m "feat(pf-listing): setPfListingState + setPfStatusByListingId (mutateProperties)"
```

---

### Task 3: `lib/pf-client.ts` (server-only token cache + pfFetch)

**Files:** Create `lib/pf-client.ts`

- [ ] **Step 1: Write the client**
```ts
import 'server-only'

const BASE = 'https://atlas.propertyfinder.com'
let cached: { token: string; expiresAt: number } | null = null

async function fetchToken(): Promise<{ token: string; expiresAt: number }> {
  const r = await fetch(`${BASE}/v1/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey: process.env.PF_API_KEY, apiSecret: process.env.PF_API_SECRET }),
  })
  if (!r.ok) throw new Error(`PF auth ${r.status}: ${await r.text()}`)
  const j = await r.json()
  // refresh ~60s before the documented 30-min expiry
  return { token: j.accessToken, expiresAt: Date.now() + (j.expiresIn ?? 1800) * 1000 - 60_000 }
}

export async function getAccessToken(): Promise<string> {
  if (!cached || Date.now() >= cached.expiresAt) cached = await fetchToken()
  return cached.token
}

export async function pfFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await getAccessToken()
  const headers = { ...(init.headers ?? {}), Authorization: `Bearer ${token}`, Accept: 'application/json' }
  return fetch(`${BASE}${path}`, { ...init, headers })
}
```
> Note: `Date.now()` is fine here — this is app code, not a workflow script. Do NOT import this from the `.mjs` subscribe script (ESM/`.ts` boundary); the script keeps its own token fetch.

- [ ] **Step 2: Type-check + lint** — `npx tsc --noEmit` clean; `npx eslint lib/pf-client.ts` clean.

- [ ] **Step 3: Commit**
```bash
git add lib/pf-client.ts
git commit -m "feat(pf-listing): server-only PF API client (token cache + pfFetch)"
```

---

### Task 4: Pure mapper `lib/pf-listing-map.ts` (TDD — the risk core)

**Files:** Create `lib/pf-listing-map.ts`, `lib/pf-listing-map.test.ts`

This is the most important task. NO `fs`/net/`@/` imports. Define a local `PropertyLike` input interface (the subset of `Property` fields the mapper reads) so it stays `node:test`-runnable. Use the **Mapping table** in the spec as the source of truth for every field.

- [ ] **Step 1: Write failing tests** covering:
  1. `validateForPf` returns `missing: ['bathrooms','sizeSqft','furnishingType']` (etc.) when those are absent; `ok:true` when a complete property is given.
  2. `mapPropertyToPfListing` for a **sale** property (`status:'secondary'`): `category:'residential'`, `type` passthrough, `price.type:'sale'`, `price.amounts.sale === priceAed`, `uaeEmirate:'dubai'`, `reference === id`, `compliance.listingAdvertisementNumber === permitNumber`, `compliance.issuingClientLicenseNumber === ctx.companyLicense`, `media.images[0].original.url` is an absolute `https://worldwise.pro/...` URL.
  3. A **rent** property (`status:'rent'`): `price.type:'yearly'`, `price.amounts.yearly === priceAed`.
  4. `bedrooms` normalization: input `'2 BR'`/`'Studio'` → `'2'`/`'studio'`.
  5. Amenity filtering: an input array mixing PF-valid (`'central-ac'`) and unknown (`'sea breeze'`) → only the valid ones remain.
  6. ASCII sanitization: a title/description with an emoji/`·` → stripped/replaced (PF rejects non-ASCII).

Write concrete assertions for each (see spec mapping table for exact expected values).

- [ ] **Step 2: Run tests, confirm they FAIL** — `node --test --experimental-strip-types lib/pf-listing-map.test.ts`.

- [ ] **Step 3: Implement `lib/pf-listing-map.ts`**: `PfLeadFields`-style local interfaces, `validateForPf(p)`, `mapPropertyToPfListing(p, ctx)`. Implement the mapping table from the spec: type passthrough, bedrooms normalizer, `PF_RESIDENTIAL_AMENITIES` allow-set + synonym map, sale/rent price branch, `projectStatus` from `ctx.compliance.saleType` + `p.status`, compliance block, absolute image URLs (`https://worldwise.pro` + path, guarding against already-absolute), ASCII sanitizer. `downPayment: 0` for sale (flagged risk — leave a `// TODO(pilot): confirm acceptable downPayment` comment).

- [ ] **Step 4: Run tests, confirm PASS** — same command; all green.

- [ ] **Step 5: Commit**
```bash
git add lib/pf-listing-map.ts lib/pf-listing-map.test.ts
git commit -m "feat(pf-listing): pure Property->PF listing mapper + validateForPf + tests"
```

---

### Task 5: API routes — draft / publish / unpublish

**Files:** Create `app/api/admin/pf-listing/draft/route.ts`, `.../publish/route.ts`, `.../unpublish/route.ts`

Follow the existing guarded-route pattern (see any `app/api/admin/*` or `app/api/properties/[id]` route): `export const runtime = 'nodejs'`, `requireSection('properties')` from `@/lib/auth` → return 403 on null. Use `pfFetch` from `@/lib/pf-client`, `mapPropertyToPfListing`/`validateForPf` from `@/lib/pf-listing-map`, `getProperties`/`setPfListingState` from `@/lib/properties`.

- [ ] **Step 1: `draft/route.ts`** — `POST {propertyId}`:
  1. `requireSection('properties')` → 403 if null.
  2. Load property; `validateForPf(p)` → `422 {missing}` if not ok.
  3. Resolve `locationId`: if `p.pfLocationId` use it; else `GET /v1/locations?search=<area>` (+ `filter[parent]` to disambiguate), pick the best match; if none → `422 {error:'location not found'}`.
  4. `GET /v1/compliances/{permitNumber}/{PF_COMPANY_LICENSE}?permitType=...` → parse; on non-2xx or price/type mismatch → `422` with the reason.
  5. `mapPropertyToPfListing(p, { publicProfileId: env, locationId, companyLicense: env, compliance })`.
  6. `POST /v1/listings` (draft) → on error return the PF error body (`4xx`); on success grab the new `listingId`.
  7. `setPfListingState(p.id, { pfListingId, pfListingStatus: 'draft', pfLocationId: locationId })`.
  8. `GET /v1/listings/{id}/publish/prices` → return `{ pfListingId, priceCredits }`.

- [ ] **Step 2: `publish/route.ts`** — `POST {propertyId}`: guard → load property (must have `pfListingId` + status `draft`) → `POST /v1/listings/{pfListingId}/publish` → `setPfListingState(id,{pfListingStatus:'pending'})` → return ok. (Status flips to `live` via webhook.)

- [ ] **Step 3: `unpublish/route.ts`** — `POST {propertyId}`: guard → `POST /v1/listings/{pfListingId}/unpublish` → `setPfListingState(id,{pfListingStatus:'unpublished'})` → ok.

- [ ] **Step 4: Verify** — `npx tsc --noEmit` clean; `npx eslint app/api/admin/pf-listing` clean.

- [ ] **Step 5: Commit**
```bash
git add app/api/admin/pf-listing
git commit -m "feat(pf-listing): draft/publish/unpublish routes (section-guarded, 2-step credits)"
```

---

### Task 6: Extend webhook + subscription for listing events

**Files:** Modify `app/api/pf-webhook/route.ts`, `scripts/pf-subscribe-webhook.mjs`

- [ ] **Step 1: Dispatch listing events in the route.** After the existing `lead.created` branch, before the final guard, branch on `e.type`:
```ts
import { setPfStatusByListingId } from '@/lib/leads' // NO — from '@/lib/properties'
// ...
const listingId = (event as { entity?: { id?: string } }).entity?.id
if (e.type === 'listing.published' && listingId) {
  setPfStatusByListingId(listingId, { pfListingStatus: 'live', pfPublishedAt: new Date().toISOString() })
  return NextResponse.json({ ok: true })
}
if (e.type === 'listing.unpublished' && listingId) {
  setPfStatusByListingId(listingId, { pfListingStatus: 'unpublished' })
  return NextResponse.json({ ok: true })
}
if (e.type === 'listing.action' && listingId) {
  console.warn('[pf-webhook] listing.action', listingId, JSON.stringify((event as any).payload?.actionType))
  setPfStatusByListingId(listingId, { pfListingStatus: 'action_required' })
  return NextResponse.json({ ok: true })
}
```
Keep the existing 200-ack for unknown types at the end. (Import `setPfStatusByListingId` from `@/lib/properties`.)

- [ ] **Step 2: Subscribe the listing events.** In `scripts/pf-subscribe-webhook.mjs`, change the single-event logic to iterate an array `['lead.created','listing.published','listing.unpublished','listing.action']`, subscribing each that isn't already present (same dedup check). Keep idempotent + loud-on-error.

- [ ] **Step 3: Verify** — `npx tsc --noEmit` clean; `node --check scripts/pf-subscribe-webhook.mjs`.

- [ ] **Step 4: Commit**
```bash
git add app/api/pf-webhook/route.ts scripts/pf-subscribe-webhook.mjs
git commit -m "feat(pf-listing): webhook flips listing status + subscribe listing.* events"
```

---

### Task 7: Admin UI — Property Finder panel + table badge

**Files:** Modify `components/PropertyForm.tsx`, the `/admin` property table component (find it: it renders the property rows under `app/admin`)

- [ ] **Step 1: Add 3 inputs to `PropertyForm`** near beds/permit: `bathrooms` (select `none,1..10`), `sizeSqft` (number), `furnishingType` (select). Wire into the form state + submit body exactly like the existing fields (they'll flow through `coercePropertyInput`).

- [ ] **Step 2: Add the "Property Finder" panel to `PropertyForm`** (back-office; admin glyphs OK). It reads `property.pfListingStatus` and renders:
  - status line: `Not on PF` / `Draft — {N} credits` / `Live` / `Action needed` / `Unpublished`;
  - if `validateForPf` (call a tiny client-safe copy or surface server validation) reports missing fields → disable the button and list them;
  - **Create draft** button → `POST /api/admin/pf-listing/draft` → shows returned `priceCredits`;
  - **Publish (N credits)** button → `POST .../publish`;
  - **Unpublish** button (when live) → `POST .../unpublish`.
  Use a confirm step before publish. Keep it a small focused subcomponent (e.g. `PfListingPanel.tsx`) so `PropertyForm` doesn't bloat.

- [ ] **Step 3: Add a PF status badge** to the `/admin` property table row (tiny pill from `pfListingStatus`).

- [ ] **Step 4: Verify** — `npm run build` green; `npx eslint` clean on touched files.

- [ ] **Step 5: Commit**
```bash
git add components/PropertyForm.tsx components/PfListingPanel.tsx app/admin
git commit -m "feat(pf-listing): admin Property Finder panel (2-step publish) + status badge"
```

---

### Task 8: Config docs + deploy/pilot checklist

**Files:** Modify `.env.example`

- [ ] **Step 1: Document env vars.** Append to `.env.example`:
```bash
# Property Finder listings (integration #2) — needs a PF key with listings:full_access + users:read
PF_COMPANY_LICENSE=
PF_PUBLIC_PROFILE_ID=
```

- [ ] **Step 2: Full verification** — `node --test --experimental-strip-types lib/*.test.ts` (all pass), `npm run build` green, `npx eslint .` clean.

- [ ] **Step 3: Commit**
```bash
git add .env.example
git commit -m "docs(pf-listing): env vars for listing publish (company license + public profile)"
```

- [ ] **Step 4 (operator, at deploy — not a code commit):**
  1. Create the second PF API key (`listings:full_access` + `users:read`) in PF Expert; put key/secret in server `.env.local` (replacing the leads key if reused, or keep both — the routes use `PF_API_KEY`/`PF_API_SECRET`, so decide which key those point to; simplest: upgrade to a key that has BOTH leads+listings+users scopes so one key serves everything).
  2. `GET /v1/users` → pick the owner's `publicProfile.id` → set `PF_PUBLIC_PROFILE_ID`; set `PF_COMPANY_LICENSE`.
  3. Deploy from `main` (backup data → rsync → build → pm2 restart).
  4. Re-run `scripts/pf-subscribe-webhook.mjs` (subscribes the new listing events).
  5. **Pilot:** pick ONE real property, fill bathrooms/sizeSqft/furnishing, Create draft (verify price), Publish, confirm `listing.published` flips status to `live`, verify on the PF website, then `unpublish`.

---

## Self-review

- **Spec coverage:** data model + coercion (T1) ✓; PF state writers (T2) ✓; client (T3) ✓; pure mapper + tests (T4) ✓; draft/publish/unpublish routes (T5) ✓; webhook + subscription (T6) ✓; admin UI (T7) ✓; config + deploy/pilot (T8) ✓. Decisions honored: new-fields-fill-on-publish (T1/T4/T7), only-new/no-reconcile (no import task — correct), two-step credits (T5/T7).
- **Placeholders:** none — code given for the testable/mechanical core; routes/UI reference exact existing patterns to follow with concrete logic. The single `// TODO(pilot)` is an intentional flagged risk (downPayment), not an unfinished step.
- **Type consistency:** `setPfListingState`/`setPfStatusByListingId` signatures (T2) are used verbatim in routes (T5) + webhook (T6); `mapPropertyToPfListing(p, ctx)` ctx shape (T4) matches what the draft route assembles (T5); `pfListingStatus` enum identical across T1/T2/T5/T6/T7. One note fixed inline: webhook imports `setPfStatusByListingId` from `@/lib/properties` (not `@/lib/leads`).
- **Scope:** one cohesive feature/plan; v2 items explicitly deferred in the spec.
