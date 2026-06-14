# Publish to Property Finder (catalog → PF listings) — design

**Date:** 2026-06-15
**Status:** approved (design), pending implementation plan — **implementation deferred to a later session**
**Direction:** Integration #2 of the PF Enterprise API (listings out). Integration #1 (leads in) is already live.

## Context

worldwise lists properties on its own site (`data/properties.json`, ~147 properties). The agency also pays for placement on Property Finder, where listings are **currently entered by hand** in PF Expert. PF's Enterprise API (`https://atlas.propertyfinder.com`) exposes full listing CRUD. This feature lets an admin **selectively publish a property from worldwise to PF** via a button — making worldwise the source of truth and removing manual double-entry.

Auth + webhook infra already exist from integration #1 (`PF_API_KEY`/`PF_API_SECRET` → 30-min JWT; signed `/api/pf-webhook`; `PF_WEBHOOK_SECRET`). The key used for #1 has scope `listings:full_access`? **No** — it has `leads:read` + `users:read` only. **A new key (or a key with `listings:full_access` + `users:read`) is required for this feature** (scopes are immutable post-creation; create a second key). Note this in deployment.

## Decisions (locked with the user)

1. **Missing PF-required fields** → add them to `Property` + `PropertyForm`; the Publish button validates and shows what's missing; fill only for the listings actually published.
2. **Reconciliation** → v1 publishes **only new** listings. Listings already entered manually in PF are left untouched; v1 does NOT import them. (Avoids `listing_duplicate` penalties + `reference` collisions.)
3. **Credits UX** → **two-step**: button creates a PF **draft** + shows the credit price; a second explicit "Publish (N credits)" actually publishes.

## Scope

**v1:** create draft → show price → publish → track status via webhook → unpublish. Per-property, admin-triggered, selective.
**Out of v1 (later):** editing/re-syncing an already-published listing; bulk publish; importing existing manual PF listings; Abu Dhabi (ADREC) flow; featured/premium upgrades.

## Architecture

### 1. Data model (`types/index.ts`, `lib/properties.ts`, `components/PropertyForm.tsx`)

Add to `Property`:
- **PF-required listing fields** (admin-entered, surfaced in `PropertyForm`):
  - `bathrooms?: string` — `'1'..'10'` (PF enum `none,1..20`); required for publish.
  - `sizeSqft?: number` — property area in sqft (PF `size`); required.
  - `furnishingType?: 'unfurnished' | 'semi-furnished' | 'furnished'` — default `unfurnished` in the form.
- **PF listing state** (set by the publish flow, NOT the form):
  - `pfListingId?: string`, `pfListingStatus?: 'draft' | 'pending' | 'live' | 'unpublished' | 'action_required' | 'failed'`, `pfLocationId?: number` (cached), `pfPublishedAt?: string`.

`coercePropertyInput()` (`lib/properties.ts`) must whitelist the three new admin-entered fields (`bathrooms`, `sizeSqft`, `furnishingType`) with type coercion; the `pf*` state fields are written only by the pf-listing routes via `mutateProperties`, never trusted from the form body. `PropertyForm` gets three new inputs (bathrooms select, sizeSqft number, furnishingType select) near the existing beds/permit fields.

### 2. `lib/pf-client.ts` (server-only, fs/net)

Shared PF API client, reused by the subscribe script + all listing routes:
- `getAccessToken()` — exchanges `PF_API_KEY`/`PF_API_SECRET` at `POST /v1/auth/token`, caches the JWT in module state until ~60s before the 30-min expiry.
- `pfFetch(path, init)` — wraps `fetch` with the Bearer header + base URL; throws on non-2xx with status + body.
Refactor `scripts/pf-subscribe-webhook.mjs` to use it (DRY).

### 3. `lib/pf-listing-map.ts` (PURE — node:test'd, no fs/net/`@/`)

- `validateForPf(property): { ok: boolean; missing: string[] }` — checks: `permitNumber`, `bathrooms`, `sizeSqft`, `furnishingType`, `priceAed > 0`, `title`, `description`, `images.length >= 1`, and that the property is Dubai (v1 assumption). Returns the human-readable list of what's missing so the UI can show it.
- `mapPropertyToPfListing(property, ctx): PfListingPayload` where `ctx = { publicProfileId, locationId, companyLicense, compliance }` (all resolved by the route, passed in — keeps the mapper pure). Produces the `POST /v1/listings` body.

**Mapping table (PF required field → our source / rule):**

| PF field | Source / rule |
| -------- | ------------- |
| `category` | `'residential'` (all our `type`s are residential) |
| `type` | `property.type` maps 1:1 (`apartment/villa/townhouse/penthouse` are valid PF types) |
| `bedrooms` | normalize `property.bedrooms` → PF enum (`'studio'`/`'1'`..); strip `" BR"` etc. |
| `bathrooms` | new `property.bathrooms` |
| `furnishingType` | new `property.furnishingType` |
| `size` | new `property.sizeSqft` |
| `uaeEmirate` | `'dubai'` (v1) |
| `reference` | `property.id` (stable + unique) |
| `title.en` / `description.en` | `property.title` / `property.description`, ASCII-sanitized (PF rejects non-ASCII/emoji) |
| `price.type` + `price.amounts` | `status` `off-plan`/`secondary` → `sale` (`amounts.sale = priceAed`); `rent` → `yearly` (`amounts.yearly = priceAed`) |
| `downPayment` | required when `price.type=sale`; v1 default `0` (refine in pilot — flagged risk) |
| `projectStatus` | derived from DLD compliance `saleType` (primary→`*_primary`, secondary→plain) + our `status` |
| `compliance.listingAdvertisementNumber` | `property.permitNumber` |
| `compliance.type` | `'rera'` (v1; `dtcm` holiday-homes is out of scope) |
| `compliance.issuingClientLicenseNumber` | `PF_COMPANY_LICENSE` (agency-wide, from env) |
| `media.images[].original.url` | each `property.images[]` → absolute `https://worldwise.pro<path>` |
| `amenities` | filter `property.amenities` to PF's allowed **residential** enum; map known synonyms; **drop unknown** (amenities are optional) |

Mapping is the main risk → fully `node:test`'d, plus a 1-listing pilot before any volume.

### 4. API routes (`app/api/admin/pf-listing/*`, every handler `requireSection('properties')` → 403)

- `POST /api/admin/pf-listing/draft` `{propertyId}`:
  1. Load property; `validateForPf` → 422 with `missing[]` if invalid.
  2. Resolve `publicProfileId` (env `PF_PUBLIC_PROFILE_ID`), `companyLicense` (env), `locationId` (use cached `pfLocationId`, else `GET /v1/locations?search=<area>` + disambiguate, cache it).
  3. `GET /v1/compliances/{permitNumber}/{PF_COMPANY_LICENSE}?permitType=…` — fetch DLD data; if mismatch (price/type) → 422 with the discrepancy.
  4. `POST /v1/listings` (draft) → store `pfListingId` + `pfListingStatus:'draft'` + `pfLocationId` on the property (`mutateProperties`).
  5. `GET /v1/listings/{id}/publish/prices` → return `{ pfListingId, priceCredits }`.
- `POST /api/admin/pf-listing/publish` `{propertyId}`:
  - `POST /v1/listings/{pfListingId}/publish` → set `pfListingStatus:'pending'`. Async — the webhook flips to `live`.
- `POST /api/admin/pf-listing/unpublish` `{propertyId}`:
  - `POST /v1/listings/{pfListingId}/unpublish` → `pfListingStatus:'unpublished'`. (No credit cost.)

All credit spend happens on **publish**, not draft — so a validation/DLD rejection costs nothing.

### 5. Webhook (extend `app/api/pf-webhook/route.ts` + subscribe script)

The existing signed endpoint additionally handles listing events (same HMAC gate):
- `listing.published` → find property by `pfListingId === event.entity.id`, set `pfListingStatus:'live'`, `pfPublishedAt`.
- `listing.unpublished` → `'unpublished'`.
- `listing.action` → `'action_required'` + log the action message (compliance issue the admin must resolve, else PF auto-unpublishes).

A new module `lib/pf-listing-store.ts` (or an extension of `lib/properties.ts`) exposes `setPfStatusByListingId(pfListingId, patch)` using `mutateProperties` (dedup/idempotent on the id). The dispatch by `event.type` stays in the route. `scripts/pf-subscribe-webhook.mjs` is extended to also subscribe `listing.published`, `listing.unpublished`, `listing.action` (needs `listings:read`, present on the new key).

### 6. Admin UI (`PropertyForm` + `/admin` table)

- In `PropertyForm`: a **"Property Finder" panel** showing `pfListingStatus` (`Not on PF` / `Draft — N credits` / `Live` / `Action needed` / `Unpublished`) and the two-step control: **Create draft** → shows credit price → **Publish (N credits)** / **Unpublish**. If `validateForPf` fails, the button is disabled and the missing fields are listed inline.
- In the `/admin` property table: a small PF status badge per row.
- Section-gated (`properties`); back-office UI, so admin glyphs/emoji are fine (not public-facing).

### 7. Config (server `.env.local`, server-only)

- `PF_COMPANY_LICENSE` — agency real-estate company license number (for DLD compliance).
- `PF_PUBLIC_PROFILE_ID` — the PF Expert public-profile id to attach listings to (resolve once via `GET /v1/users`).
- **New PF API key** with `listings:full_access` + `users:read` (+ default webhooks/compliance/locations/projects scopes). The #1 key (`leads:read`+`users:read`) cannot publish listings.

## Error handling & credits safety

- Draft creation never spends credits; only `publish` does → validation/DLD failures are free.
- `publish/prices` is always shown before the publish click.
- DLD mismatch / mapping rejection → 422 with a readable reason surfaced in the panel.
- Publish is async: a `200` ≠ published. Status only becomes `live` on the `listing.published` webhook; if no webhook in ~60s, the panel shows `pending` and the admin can refresh (a later `GET /v1/listings/{id}` status check is a v2 nicety).
- **Pilot first:** publish exactly ONE real listing end-to-end before any further use.

## Testing

- `lib/pf-listing-map.test.ts` (`node:test`): `validateForPf` (each missing field) + `mapPropertyToPfListing` (sale vs rent, type/bedrooms/amenity mapping, compliance block, ASCII sanitization, absolute image URLs).
- `npm run build` green; routes compile; `eslint` clean.
- Live pilot: one property → draft (price shown) → publish → `listing.published` webhook flips status to `live` → verify on the PF website → `unpublish` works.

## Open risks (flagged, resolve in pilot)

- `downPayment` for sale listings (default 0 may be rejected — confirm acceptable value in pilot).
- `compliance.type` `rera` vs `dtcm` (v1 assumes `rera`).
- `bedrooms` string normalization (our format vs PF enum).
- Amenity synonym coverage (unknown amenities are dropped — acceptable).
- Real permit/field coverage across the 147 (validate-and-block handles gaps; selective publish means we only need the ones we publish).

## Deferred to v2

Edit/re-sync published listings; bulk publish; import existing manual listings; ADREC (Abu Dhabi); featured/premium upgrades; auto `GET /v1/listings/{id}` status reconciliation.
