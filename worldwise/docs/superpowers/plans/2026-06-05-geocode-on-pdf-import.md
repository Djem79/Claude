# Geocode-on-PDF-import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** When a developer PDF is imported and carries no coordinates, automatically resolve the building's lat/lng by name (Google Geocoding) and pre-fill them on the staged draft, so the admin sees a map pin in `PropertyForm` before publishing.

**Architecture:** Add a small, self-contained `lib/geocode.ts` that wraps the Google Geocoding API and applies the SAME confidence policy already proven in `scripts/seed-coords.cjs` (accept only `ROOFTOP`/`GEOMETRIC_CENTER` inside a Dubai bounding box; never trust a generic resale title). Call it from the import `POST` route after the area is canonicalised, as a **non-fatal** step (same pattern as image/brochure extraction). The pure decision logic gets a `node:test`. The published property already carries `lat`/`lng` through `coercePropertyInput` (whitelisted) and `PropertyForm` already shows the fields — no changes needed there.

**Tech Stack:** Next.js 14 Node-runtime API route, TypeScript, Google Geocoding API (`GOOGLE_GEOCODING_API_KEY`, already in server `.env.local`), `node:test`.

**Status:** PLAN ONLY — not started. Design agreed in chat 2026-06-05: geocode at import time (not publish), admin reviews the pin, confidence-gated + graceful fallback.

**Working directory:** `worldwise/`. If npm/node missing: `export PATH="/Users/dzhambulat/.nvm/versions/node/v24.15.0/bin:$PATH"`.

**Branch to create when starting:** `feat/geocode-on-import` (off `main`).

---

## Background facts (verified in the codebase)

- Import POST: `app/api/admin/import/route.ts`. It builds `fields` from `extractPropertyFromPdf(buf)`, then runs `if (fields.area) fields.area = canonicalizeArea(fields.area)`, then image extraction (non-fatal try/catch) and brochure persist (non-fatal try/catch), then `addDraft({ draftId, fields, ... })`. The route is `export const dynamic = 'force-dynamic'` and runs in the Node runtime (it already uses `fs` + child-process image extraction), so `fetch` and `process.env` are available.
- `PropertyDraft.fields` is `Partial<Property>` (`types/index.ts`); `Property.lat?`/`lng?` already exist, so setting `fields.lat`/`fields.lng` is type-valid and flows through publish.
- Publish (`app/api/admin/import/[draftId]/publish/route.ts`) goes through `coercePropertyInput()`, which already whitelists + range-validates `lat`/`lng`. `PropertyForm` already renders Latitude/Longitude inputs (admin can correct).
- The confidence policy already exists in `scripts/seed-coords.cjs`: Dubai bbox `lat 24.7–25.4, lng 54.8–55.7`; `GOOD_TYPES = {ROOFTOP, GEOMETRIC_CENTER}`; generic-title skip regex `/^\s*(\d+\s*-?\s*bed\w*|studio|apartment|retail|duplex|plot)\b/i`. This plan duplicates that policy in `lib/geocode.ts` (a `.cjs` cron script can't import a `.ts` lib); **keep the two in sync** — noted in code comments. (A later refactor could unify them; out of scope here.)

---

## Task 1: `lib/geocode.ts` — name→coordinates with a pure, tested confidence gate

**Files:**
- Create: `lib/geocode.ts`
- Test: `lib/geocode.test.ts`

Keep the module free of `@/` / `next` / `fs` imports so `node --test --experimental-strip-types` resolves it (same constraint as `lib/property-coords.ts`).

- [ ] **Step 1: Write the failing test**

Create `lib/geocode.test.ts`:

```ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { acceptGeocode } from './geocode.ts'

test('accepts a ROOFTOP result inside Dubai for a named project', () => {
  assert.equal(acceptGeocode('Mercer House', { lat: 25.06, lng: 55.14, type: 'ROOFTOP' }), true)
})
test('accepts GEOMETRIC_CENTER inside Dubai for a named project', () => {
  assert.equal(acceptGeocode('Sobha Seahaven', { lat: 25.09, lng: 55.14, type: 'GEOMETRIC_CENTER' }), true)
})
test('rejects a generic resale title even when the point is fine', () => {
  assert.equal(acceptGeocode('3-Bedroom Apartment in Dubai Hills Estate', { lat: 25.1, lng: 55.25, type: 'ROOFTOP' }), false)
})
test('rejects APPROXIMATE results', () => {
  assert.equal(acceptGeocode('Some Tower', { lat: 25.1, lng: 55.25, type: 'APPROXIMATE' }), false)
})
test('rejects a point outside the Dubai bounding box', () => {
  assert.equal(acceptGeocode('Oman Villa', { lat: 23.6, lng: 58.5, type: 'ROOFTOP' }), false)
})
test('null result → false', () => {
  assert.equal(acceptGeocode('X', null), false)
})
```

- [ ] **Step 2: Run the test, confirm it FAILS**

Run: `node --test --experimental-strip-types lib/geocode.test.ts`
Expected: FAIL — cannot find module `./geocode.ts`.

- [ ] **Step 3: Write the implementation**

Create `lib/geocode.ts`:

```ts
// Resolve a Dubai property's building coordinates by NAME, for PDF imports that
// carry no geolocation. Shares the confidence policy of scripts/seed-coords.cjs:
//   - accept only ROOFTOP / GEOMETRIC_CENTER results inside the Dubai bbox
//   - never trust a generic resale title ("3-Bedroom Apartment in X") — those
//     geocode to the wrong district.
// KEEP THIS POLICY IN SYNC with scripts/seed-coords.cjs (a .cjs cron can't import
// this .ts module). No `@/` / `next` / `fs` imports so the pure gate is node:test-able.

export type GeocodeResult = { lat: number; lng: number; type: string }

const DUBAI = { latMin: 24.7, latMax: 25.4, lngMin: 54.8, lngMax: 55.7 }
const GOOD_TYPES = new Set(['ROOFTOP', 'GEOMETRIC_CENTER'])
const GENERIC_TITLE = /^\s*(\d+\s*-?\s*bed\w*|studio|apartment|retail|duplex|plot)\b/i

/** Pure: is this geocode result trustworthy as a building pin for `title`? */
export function acceptGeocode(title: string, r: GeocodeResult | null): boolean {
  if (!r) return false
  if (GENERIC_TITLE.test(title || '')) return false
  if (!GOOD_TYPES.has(r.type)) return false
  return r.lat >= DUBAI.latMin && r.lat <= DUBAI.latMax && r.lng >= DUBAI.lngMin && r.lng <= DUBAI.lngMax
}

/**
 * Look up building coordinates for a property by name. Returns {lat,lng} only on
 * a confident in-Dubai match, else null (caller falls back to the area centroid).
 * Never throws — missing key, generic title, network/parse error → null.
 */
export async function geocodeDubaiProperty(
  title: string,
  area: string
): Promise<{ lat: number; lng: number } | null> {
  const key = process.env.GOOGLE_GEOCODING_API_KEY
  if (!key || !title || GENERIC_TITLE.test(title)) return null
  const q = `${title}, ${area || ''}, Dubai, United Arab Emirates`
  try {
    const url =
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(q)}&region=ae&key=${key}`
    const res = await fetch(url)
    const data = await res.json()
    const top = data?.results?.[0]
    if (!top) return null
    const r: GeocodeResult = {
      lat: top.geometry.location.lat,
      lng: top.geometry.location.lng,
      type: top.geometry.location_type,
    }
    if (!acceptGeocode(title, r)) return null
    return { lat: Number(r.lat.toFixed(6)), lng: Number(r.lng.toFixed(6)) }
  } catch {
    return null
  }
}
```

- [ ] **Step 4: Run the test, confirm it PASSES**

Run: `node --test --experimental-strip-types lib/geocode.test.ts`
Expected: PASS — 6 tests, 0 failures.

- [ ] **Step 5: Commit**

```bash
git add lib/geocode.ts lib/geocode.test.ts
git commit -m "feat(import): name->coords geocoder with confidence gate + tests"
```

---

## Task 2: Call the geocoder in the import POST route (non-fatal, pre-fill the draft)

**Files:**
- Modify: `app/api/admin/import/route.ts`

- [ ] **Step 1: Add the import**

At the top of `app/api/admin/import/route.ts`, alongside the other `@/lib` imports, add:

```ts
import { geocodeDubaiProperty } from '@/lib/geocode'
```

- [ ] **Step 2: Insert the geocode block**

Immediately AFTER the line `if (fields.area) fields.area = canonicalizeArea(fields.area)` and BEFORE the `let imageCandidates: string[] = []` block, insert:

```ts
  // No coordinates in the brochure? Resolve the building by name so the admin sees
  // a pre-filled map pin in PropertyForm. Non-fatal + confidence-gated (generic
  // titles / low-confidence / API errors leave coords empty → area-centroid fallback).
  if (typeof fields.lat !== 'number' && fields.title) {
    try {
      const c = await geocodeDubaiProperty(fields.title, fields.area || '')
      if (c) { fields.lat = c.lat; fields.lng = c.lng }
    } catch (e) {
      console.error('[import] geocoding failed:', e) // non-fatal
    }
  }
```

(The `geocodeDubaiProperty` function already swallows its own errors and returns null; the surrounding try/catch is belt-and-suspenders matching the route's existing non-fatal style.)

- [ ] **Step 3: Verify the build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add app/api/admin/import/route.ts
git commit -m "feat(import): auto-geocode building coords on PDF import"
```

---

## Task 3: Docs + end-to-end verification on the server

**Files:**
- Modify: `CLAUDE.md` (root; `worldwise/CLAUDE.md` is a symlink to it)

- [ ] **Step 1: Document it**

Under the "Developer PDF import" section, add a sentence:

```md
On import, if the extracted fields carry no coordinates, the route calls
`geocodeDubaiProperty` (`lib/geocode.ts`, Google Geocoding) to pre-fill `lat`/`lng`
by name — same confidence gate as `scripts/seed-coords.cjs` (ROOFTOP/GEOMETRIC_CENTER
in the Dubai bbox; generic resale titles skipped). Non-fatal: a miss just leaves the
draft without coords (area-centroid fallback on the page), and the admin can set the
pin in `PropertyForm`. Needs `GOOGLE_GEOCODING_API_KEY` in the server `.env.local`.
```

- [ ] **Step 2: Run the test + build gate**

Run:
```bash
node --test --experimental-strip-types lib/*.test.ts
npm run build
```
Expected: all suites pass; build succeeds.

- [ ] **Step 3: Manual end-to-end on the server (the real environment)**

The Geocoding API runs server-side only. After deploying this branch's code to the server (rsync + `npm run build` + `pm2 restart`):
1. Confirm the running app sees the key: `ssh … "grep -c '^GOOGLE_GEOCODING_API_KEY=' /var/www/worldwise/.env.local"` → `1`. (Next.js loads `.env.local` into the server process at `npm run start`; if a stale PM2 process predates the key, `pm2 restart` reloads it.)
2. In `/admin`, import a brochure for a **named** project (e.g. has a real building name). After extraction, open the draft in `PropertyForm` and confirm Latitude/Longitude are pre-filled and the pin is sane (paste into Google Maps).
3. Import a brochure whose title is **generic** ("N-Bedroom Apartment in …") and confirm Latitude/Longitude are left **empty** (gate working).
4. Optionally inspect `data/property-drafts.json` on the server for the new draft's `fields.lat/lng`.

- [ ] **Step 4: Commit + open PR**

```bash
git add CLAUDE.md
git commit -m "docs(import): document auto-geocode on PDF import"
git push -u claude feat/geocode-on-import
gh pr create --base main --head feat/geocode-on-import --repo Djem79/Claude \
  --title "feat(import): auto-geocode building coordinates on PDF import" \
  --body "When an imported PDF has no geolocation, resolve the building by name (Google Geocoding, same confidence gate as seed-coords.cjs) and pre-fill the draft's lat/lng for admin review. Plan in docs/superpowers/plans/."
```

---

## Self-review notes

- **Spec coverage:** name→coords helper + gate (Task 1), wired into import non-fatally (Task 2), docs + e2e verify (Task 3). The publish path and `PropertyForm` already carry `lat`/`lng` (verified) — no work needed there.
- **Type consistency:** `geocodeDubaiProperty(title, area) → {lat,lng}|null` and `acceptGeocode(title, GeocodeResult|null) → boolean` are used identically in Task 1 (def + tests) and Task 2 (call site). `fields.lat/lng` are `number | undefined` (Partial<Property>) — the `typeof fields.lat !== 'number'` guard is correct.
- **No silent caps / honesty:** a geocode miss is deliberately left empty (area fallback), never fabricated — matching the established policy. The generic-title gate is the main guard against confident-but-wrong pins.
- **Out of scope (note in PR if asked):** a manual "Geocode now" button in `PropertyForm`; unifying the gate between `lib/geocode.ts` and `scripts/seed-coords.cjs`; re-geocoding on area edit.
```
