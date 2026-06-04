# Property Location Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Location" section with a lazy, click-to-load Google map to the property detail page, with per-property coordinates (geocoded) falling back to the district centre.

**Architecture:** Three phases, matching the user-directed build order. **Phase 1** — data model + admin fields (`Property.lat/lng`, area centroids, a pure coords resolver, form inputs). **Phase 2** — a server-only Google Geocoding seeder that populates `lat/lng` over the 144 properties. **Phase 3** — the `<PropertyLocation>` UI (lazy Google embed) wired into the detail page + JSON-LD `geo`. Each phase is independently deployable.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind. `node:test` for the pure resolver. Google Geocoding API (server-side, one-time). Google Maps `output=embed` iframe (no API key, click-to-load).

**Spec:** `docs/superpowers/specs/2026-06-04-property-location-map-design.md`

**Working directory for all commands:** `worldwise/` (the Next.js app). If `npm`/`node` not found: `export PATH="/Users/dzhambulat/.nvm/versions/node/v24.15.0/bin:$PATH"`.

**Branch:** `feat/property-location-map` (already created; the spec is committed there).

---

## Phase 1 — Data model & admin fields

### Task 1: Add `lat`/`lng` to the `Property` type

**Files:**
- Modify: `types/index.ts` (the `Property` interface, after `floorPlans?`)

- [ ] **Step 1: Add the fields**

In `types/index.ts`, inside `interface Property`, immediately after the `floorPlans?: string[]` line (currently line 27) and before `createdAt: string`, add:

```ts
  lat?: number   // decimal degrees; building-level coordinate when known
  lng?: number   // decimal degrees; paired with lat. Absent → fall back to area centroid
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: no new errors (exit 0).

- [ ] **Step 3: Commit**

```bash
git add types/index.ts
git commit -m "feat(location): Property.lat/lng optional coordinates"
```

---

### Task 2: Whitelist + range-validate `lat`/`lng` in `coercePropertyInput`

`coercePropertyInput` (`lib/properties.ts`) is the single validation gate for the property API. `lat`/`lng` must NOT go through the plain `NUMBER_FIELDS` loop — those accept any finite number, but a coordinate out of range (a typo, a swapped lat/lng) should be dropped, not stored. Add a dedicated block.

**Files:**
- Modify: `lib/properties.ts` (after the `NUMBER_FIELDS` loop, before the `BOOLEAN_FIELDS` loop — currently around line 63)

- [ ] **Step 1: Add the coordinate-validation block**

In `lib/properties.ts`, immediately after the `for (const key of NUMBER_FIELDS) { ... }` loop closes (line 63) and before `for (const key of BOOLEAN_FIELDS)`, insert:

```ts
  // lat/lng: validated as a pair with range gates (a swapped or typo'd coordinate
  // must be dropped, not stored — it would drop a map pin in the wrong place).
  // Out-of-range or NaN → silently cleared (optional fields). Dubai is ~25N, 55E
  // but we accept any globally valid coordinate; the geocoder applies the tighter box.
  for (const key of ['lat', 'lng'] as const) {
    if (has(key)) {
      const n = cleanNumber(b[key])
      const limit = key === 'lat' ? 90 : 180
      out[key] = n !== undefined && Math.abs(n) <= limit ? n : undefined
    }
  }
```

(Setting `out[key] = undefined` on a partial PUT is how the existing optional numbers clear a field — `updateProperty` spreads `out` over the stored object; an explicit `undefined` blanks a previously-set coordinate.)

- [ ] **Step 2: Verify with an inline check (the sanctioned `npx tsx` pattern)**

Run:
```bash
npx tsx -e "import {coercePropertyInput} from './lib/properties.ts'; \
const ok=coercePropertyInput({title:'X',priceAed:1,lat:25.08,lng:55.14},{partial:false}); \
const bad=coercePropertyInput({title:'X',priceAed:1,lat:999,lng:55.14},{partial:false}); \
console.log('valid:', ok.ok && ok.value.lat===25.08 && ok.value.lng===55.14); \
console.log('out-of-range lat dropped:', bad.ok && bad.value.lat===undefined && bad.value.lng===55.14);"
```
Expected output:
```
valid: true
out-of-range lat dropped: true
```

- [ ] **Step 3: Commit**

```bash
git add lib/properties.ts
git commit -m "feat(location): coerce + range-validate lat/lng in property input"
```

---

### Task 3: Pure coordinate resolver + `node:test`

A pure module (no `@/`, no `fs`, no `next` imports — so `node --test --experimental-strip-types` resolves it, per the area-hygiene lesson). It decides whether to show the map at building zoom, area zoom, or not at all.

**Files:**
- Create: `lib/property-coords.ts`
- Test: `lib/property-coords.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/property-coords.test.ts`:

```ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolvePropertyCoords } from './property-coords.ts'

const AREA = { lat: 25.08, lng: 55.14 }

test('building coords win → zoom 16, level building', () => {
  const r = resolvePropertyCoords({ lat: 25.2, lng: 55.27 }, AREA)
  assert.deepEqual(r, { lat: 25.2, lng: 55.27, zoom: 16, level: 'building' })
})

test('no property coords → area centroid, zoom 13, level area', () => {
  const r = resolvePropertyCoords({}, AREA)
  assert.deepEqual(r, { lat: 25.08, lng: 55.14, zoom: 13, level: 'area' })
})

test('neither → null (no map)', () => {
  assert.equal(resolvePropertyCoords({}, undefined), null)
})

test('partial property coords (lat only) → ignored, falls back to area', () => {
  const r = resolvePropertyCoords({ lat: 25.2 }, AREA)
  assert.equal(r?.level, 'area')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test --experimental-strip-types lib/property-coords.test.ts`
Expected: FAIL — `Cannot find module './property-coords.ts'`.

- [ ] **Step 3: Write minimal implementation**

Create `lib/property-coords.ts`:

```ts
export type ResolvedCoords = {
  lat: number
  lng: number
  zoom: number
  level: 'building' | 'area'
}

type LatLng = { lat?: number; lng?: number }

/**
 * Decide the map centre for a property.
 *  - property has BOTH lat & lng → building-level pin (zoom 16)
 *  - else areaCoords present     → district-level pin (zoom 13)
 *  - else                        → null (render no map, text block only)
 * Pure: takes the area centroid as an argument so this module stays free of the
 * `lib/areas.ts` value-import that would break `node --test` resolution.
 */
export function resolvePropertyCoords(
  property: LatLng,
  areaCoords: { lat: number; lng: number } | undefined
): ResolvedCoords | null {
  if (typeof property.lat === 'number' && typeof property.lng === 'number') {
    return { lat: property.lat, lng: property.lng, zoom: 16, level: 'building' }
  }
  if (areaCoords) {
    return { lat: areaCoords.lat, lng: areaCoords.lng, zoom: 13, level: 'area' }
  }
  return null
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test --experimental-strip-types lib/property-coords.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/property-coords.ts lib/property-coords.test.ts
git commit -m "feat(location): pure resolvePropertyCoords helper + tests"
```

---

### Task 4: Add `coords` (district centre) to every area

**Files:**
- Modify: `lib/areas.ts` — add `coords` to the `Area` type and to each of the 12 area entries

- [ ] **Step 1: Add the field to the `Area` type**

In `lib/areas.ts`, inside `export type Area = { ... }`, after the `tagline: string` line, add:

```ts
  /** District centre, used as the map fallback when a property has no lat/lng. */
  coords: { lat: number; lng: number }
```

- [ ] **Step 2: Add `coords` to each area entry**

For each of the 12 entries in `export const areas`, add a `coords` line right after that entry's `tagline:` line. Use these district centres:

| slug | coords line to add |
| ---- | ------------------ |
| `dubai-marina` | `coords: { lat: 25.0805, lng: 55.1403 },` |
| `downtown-dubai` | `coords: { lat: 25.1950, lng: 55.2744 },` |
| `palm-jumeirah` | `coords: { lat: 25.1124, lng: 55.1390 },` |
| `business-bay` | `coords: { lat: 25.1850, lng: 55.2650 },` |
| `dubai-hills` | `coords: { lat: 25.1050, lng: 55.2480 },` |
| `jlt` | `coords: { lat: 25.0693, lng: 55.1440 },` |
| `mbr-city` | `coords: { lat: 25.1700, lng: 55.3000 },` |
| `creek-harbour` | `coords: { lat: 25.1980, lng: 55.3530 },` |
| `emaar-beachfront` | `coords: { lat: 25.0950, lng: 55.1430 },` |
| `damac-hills` | `coords: { lat: 25.0250, lng: 55.2480 },` |
| `damac-hills-2` | `coords: { lat: 24.9100, lng: 55.2700 },` |
| `the-valley` | `coords: { lat: 25.0100, lng: 55.4200 },` |

(These are approximate district centroids — fine for the area-level `z=13` pin. They can be nudged later without code changes elsewhere.)

- [ ] **Step 3: Verify type-check passes (catches any missed entry)**

Run: `npx tsc --noEmit`
Expected: exit 0. If `Property 'coords' is missing` appears, an area entry was skipped — add it.

- [ ] **Step 4: Commit**

```bash
git add lib/areas.ts
git commit -m "feat(location): district centre coords for all 12 areas"
```

---

### Task 5: Add lat/lng inputs to `PropertyForm`

The form state is a `Partial<Property>`; `handleSubmit` spreads `...form` into the POST body, so new fields flow straight to `coercePropertyInput`. We only need a `BLANK` default and two number inputs that use the existing `set(key, value)` helper (mirrors the Gross Yield input at line 300).

**Files:**
- Modify: `app/admin/property/PropertyForm.tsx` (`BLANK` object ~line 21; a new field row near the area field)

- [ ] **Step 1: Add lat/lng to the `BLANK` default**

In `app/admin/property/PropertyForm.tsx`, in the `BLANK` object, after the `grossYield: undefined,` line (line 21), add:

```ts
  lat: undefined,
  lng: undefined,
```

- [ ] **Step 2: Add the input row**

After the closing `</div>` of the grid row that contains the Handover/Badge fields (the row ending at line ~317), insert a new two-column grid row:

```tsx
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Latitude</label>
          <input type="number" step="any" className={fieldClass} value={form.lat ?? ''} onChange={e => set('lat', e.target.value ? Number(e.target.value) : undefined)} placeholder="e.g. 25.0805" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Longitude</label>
          <input type="number" step="any" className={fieldClass} value={form.lng ?? ''} onChange={e => set('lng', e.target.value ? Number(e.target.value) : undefined)} placeholder="e.g. 55.1403" />
          <p className="text-xs text-gray-400 mt-1">Optional. Blank → the map centres on the district. Find a building: right-click it in Google Maps → copy the lat, lng.</p>
        </div>
      </div>
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: build succeeds (`✓ Compiled successfully`).

- [ ] **Step 4: Commit**

```bash
git add app/admin/property/PropertyForm.tsx
git commit -m "feat(location): lat/lng inputs in PropertyForm"
```

---

## Phase 2 — Google Geocoding seeder

### Task 6: Create the geocoding seeder script + document the env var

**Files:**
- Create: `scripts/seed-coords.cjs`
- Modify: `.env.example` (document `GOOGLE_GEOCODING_API_KEY`)

- [ ] **Step 1: Add the env var to `.env.example`**

Append to `.env.example`:

```
# Google Geocoding API key (server-side only, used by scripts/seed-coords.cjs to
# populate Property.lat/lng). Enable "Geocoding API" in GCP project worldwise-497520
# and create an API key. Stays in server .env.local (rsync-excluded), never shipped to the client.
GOOGLE_GEOCODING_API_KEY=
```

- [ ] **Step 2: Create the seeder**

Create `scripts/seed-coords.cjs`:

```js
#!/usr/bin/env node
/*
 * seed-coords.cjs — populate Property.lat/lng via the Google Geocoding API.
 * Server-only (reads/writes data/properties.json). Run from /var/www/worldwise.
 *
 *   node --env-file=.env.local scripts/seed-coords.cjs            # dry-run (prints plan)
 *   node --env-file=.env.local scripts/seed-coords.cjs --apply    # write
 *   node --env-file=.env.local scripts/seed-coords.cjs --force    # also re-geocode props that already have coords
 *   then: npm run build && pm2 restart worldwise   (SSG pages are prerendered)
 *
 * Confidence gate: a result is accepted only when location_type is ROOFTOP or
 * GEOMETRIC_CENTER AND the point falls inside the Dubai bounding box. Anything
 * else (APPROXIMATE, or a pin outside Dubai from a mis-resolved project name) is
 * left unset → the site falls back to the district centre. Never fabricate.
 */
const fs = require('fs')
const path = require('path')

const PROPERTIES = path.join(process.cwd(), 'data', 'properties.json')
const APPLY = process.argv.includes('--apply')
const FORCE = process.argv.includes('--force')
const KEY = process.env.GOOGLE_GEOCODING_API_KEY
if (!KEY) { console.error('GOOGLE_GEOCODING_API_KEY missing (load with --env-file=.env.local)'); process.exit(1) }

// Dubai bounding box (generous): lat 24.7–25.4 N, lng 54.8–55.7 E.
const inDubai = (lat, lng) => lat >= 24.7 && lat <= 25.4 && lng >= 54.8 && lng <= 55.7
const GOOD_TYPES = new Set(['ROOFTOP', 'GEOMETRIC_CENTER'])
const sleep = ms => new Promise(r => setTimeout(r, ms))

async function geocode(q) {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(q)}&region=ae&key=${KEY}`
  const res = await fetch(url)
  const data = await res.json()
  if (data.status === 'OVER_QUERY_LIMIT' || data.status === 'REQUEST_DENIED') {
    throw new Error(`Geocoding API ${data.status}: ${data.error_message || ''}`)
  }
  const top = data.results && data.results[0]
  if (!top) return null
  const { lat, lng } = top.geometry.location
  const type = top.geometry.location_type
  const ok = GOOD_TYPES.has(type) && inDubai(lat, lng)
  return { lat, lng, type, ok, formatted: top.formatted_address }
}

;(async () => {
  const arr = JSON.parse(fs.readFileSync(PROPERTIES, 'utf8'))
  let accepted = 0, rejected = 0, skipped = 0
  for (const p of arr) {
    if (!FORCE && typeof p.lat === 'number' && typeof p.lng === 'number') { skipped++; continue }
    const q = `${p.title}, ${p.area}, Dubai, United Arab Emirates`
    let r
    try { r = await geocode(q) } catch (e) { console.error('ABORT:', e.message); break }
    await sleep(120) // gentle pacing
    if (r && r.ok) {
      accepted++
      if (APPLY) { p.lat = Number(r.lat.toFixed(6)); p.lng = Number(r.lng.toFixed(6)) }
      console.log(`OK   ${p.title} → ${r.lat.toFixed(5)},${r.lng.toFixed(5)} [${r.type}] (${r.formatted})`)
    } else {
      rejected++
      console.log(`SKIP ${p.title} [${p.area}] → ${r ? `${r.type} ${r.lat.toFixed(4)},${r.lng.toFixed(4)} (out of box/approx)` : 'no result'}`)
    }
  }
  console.log(`\ntotal ${arr.length} | accepted ${accepted} | rejected ${rejected} | already-set ${skipped} | ${APPLY ? 'APPLIED' : 'DRY-RUN'}`)
  if (APPLY) {
    fs.writeFileSync(PROPERTIES + '.tmp', JSON.stringify(arr, null, 2))
    fs.renameSync(PROPERTIES + '.tmp', PROPERTIES)
    console.log('WRITTEN OK')
  }
})()
```

- [ ] **Step 3: Syntax-check the script locally (it cannot run locally — no `data/`, no key)**

Run: `node --check scripts/seed-coords.cjs`
Expected: no output, exit 0 (valid syntax).

- [ ] **Step 4: Commit**

```bash
git add scripts/seed-coords.cjs .env.example
git commit -m "feat(location): Google Geocoding seeder for property coordinates"
```

---

### Task 7: Run the geocoder on the server (ops — done with the user)

This task runs against live `data/` and needs the API key. **Do not run locally.** Coordinates committed to `data/` are server-only.

- [ ] **Step 1: User enables the Geocoding API & creates a key**

In GCP console, project `worldwise-497520`: APIs & Services → Library → enable **Geocoding API**. Credentials → Create credentials → API key. (Optional but recommended: restrict the key to the Geocoding API.) The user pastes the key to us.

- [ ] **Step 2: Put the key in the server `.env.local`**

```bash
ssh -i ~/.ssh/id_ed25519 root@62.238.35.20 \
  "grep -q '^GOOGLE_GEOCODING_API_KEY=' /var/www/worldwise/.env.local \
   && sed -i 's#^GOOGLE_GEOCODING_API_KEY=.*#GOOGLE_GEOCODING_API_KEY=PASTE_KEY#' /var/www/worldwise/.env.local \
   || echo 'GOOGLE_GEOCODING_API_KEY=PASTE_KEY' >> /var/www/worldwise/.env.local"
```
(Replace `PASTE_KEY`. The script `scripts/seed-coords.cjs` must already be on the server — deploy Phase 1+2 first, or `scp` the file.)

- [ ] **Step 3: Back up data, then dry-run and review**

```bash
ssh -i ~/.ssh/id_ed25519 root@62.238.35.20 \
  "cp -r /var/www/worldwise/data /var/www/worldwise/data_backup_coords_$(date +%Y%m%d_%H%M%S) && \
   cd /var/www/worldwise && node --env-file=.env.local scripts/seed-coords.cjs | tee /tmp/coords-dryrun.log"
```
Review the `OK`/`SKIP` lines and the accepted/rejected counts. Spot-check a few `OK` coordinates by pasting them into Google Maps.

- [ ] **Step 4: Apply, rebuild, restart**

```bash
ssh -i ~/.ssh/id_ed25519 root@62.238.35.20 \
  "cd /var/www/worldwise && node --env-file=.env.local scripts/seed-coords.cjs --apply && npm run build && pm2 restart worldwise"
```
Expected: `WRITTEN OK`, a successful build, PM2 restart. (The map UI from Phase 3 must be deployed for the coordinates to be visible; if Phase 3 isn't live yet, the data is simply staged for it.)

---

## Phase 3 — Location UI on the detail page

### Task 8: `<PropertyLocation>` component (lazy Google embed)

A client component (it holds the "map shown?" state). Until the user clicks "Show map", it renders only a styled placeholder — no Google request, no cookies, no LCP cost. Always renders the text location block + the internal area link when an area is known.

**Files:**
- Create: `components/PropertyLocation.tsx`

- [ ] **Step 1: Create the component**

Create `components/PropertyLocation.tsx`:

```tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'

type Props = {
  title: string
  area: string
  /** Resolved map centre + zoom; null → render the text block only, no map. */
  coords: { lat: number; lng: number; zoom: number; level: 'building' | 'area' } | null
  /** Area landing-page slug, when the property's area maps to one. */
  areaSlug?: string
}

export default function PropertyLocation({ title, area, coords, areaSlug }: Props) {
  const [show, setShow] = useState(false)

  const embedSrc = coords
    ? `https://www.google.com/maps?q=${coords.lat},${coords.lng}(${encodeURIComponent(title)})&z=${coords.zoom}&output=embed`
    : null
  const externalHref = coords
    ? `https://www.google.com/maps/search/?api=1&query=${coords.lat},${coords.lng}`
    : null

  return (
    <div className="border-t border-gray-100 pt-8">
      <h2 className="font-serif text-2xl text-navy mb-2">Location</h2>
      <p className="text-gray-500 text-sm mb-5">
        {area}, Dubai.
        {areaSlug && (
          <>
            {' '}
            <Link href={`/${areaSlug}`} className="text-gold-accessible hover:underline">
              Explore {area} →
            </Link>
          </>
        )}
        {coords?.level === 'area' && ' Map shows the district; exact building location available on request.'}
      </p>

      {embedSrc && (
        show ? (
          <div className="rounded-sm overflow-hidden bg-[#F8F8F6]">
            <iframe
              title={`Map of ${title}`}
              src={embedSrc}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className="w-full h-[360px] border-0"
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShow(true)}
            className="w-full h-[200px] rounded-sm bg-[#F1F1ED] border border-gray-200 flex flex-col items-center justify-center gap-2 text-navy hover:bg-[#E9E9E3] transition-colors"
            aria-label="Show map"
          >
            <span className="font-serif text-lg">Show map</span>
            <span className="text-xs text-gray-500">{area}, Dubai · loads Google Maps</span>
          </button>
        )
      )}

      {externalHref && (
        <a
          href={externalHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block mt-3 text-sm text-gold-accessible hover:underline"
        >
          Open in Google Maps →
        </a>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add components/PropertyLocation.tsx
git commit -m "feat(location): PropertyLocation component — lazy Google map by click"
```

---

### Task 9: Wire `<PropertyLocation>` into the detail page + JSON-LD `geo`

**Files:**
- Modify: `app/properties/[slug]/page.tsx` (imports; compute matched area + resolved coords; render the section; add `geo` to `listingLd`)

- [ ] **Step 1: Add imports**

In `app/properties/[slug]/page.tsx`, after the existing imports (around line 19), add:

```ts
import PropertyLocation from '@/components/PropertyLocation'
import { areas, propertyMatchesArea } from '@/lib/areas'
import { resolvePropertyCoords } from '@/lib/property-coords'
```

- [ ] **Step 2: Compute the matched area + resolved coords**

In the `PropertyPage` component, after the `similar` computation (after line 75), add:

```ts
  const matchedArea = areas.find(a => propertyMatchesArea(property.area, a))
  const resolvedCoords = resolvePropertyCoords(property, matchedArea?.coords)
```

- [ ] **Step 3: Add `geo` to the listing JSON-LD**

In the `listingLd` object, after the `address: { ... }` block (after line 129), add:

```ts
    ...(resolvedCoords
      ? {
          geo: {
            '@type': 'GeoCoordinates',
            latitude: resolvedCoords.lat,
            longitude: resolvedCoords.lng,
          },
        }
      : {}),
```

- [ ] **Step 4: Render the Location section**

In the left column (`lg:col-span-2`), insert the section after the Amenities block's closing (after line 222, before the DLD Permit/QR block at line 224):

```tsx
              {/* Location */}
              <PropertyLocation
                title={property.title}
                area={property.area}
                coords={resolvedCoords}
                areaSlug={matchedArea?.slug}
              />
```

- [ ] **Step 5: Verify build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 6: Verify locally in the browser**

Run: `npm run dev`, open `http://localhost:3000/properties/<any-slug>`.
- Confirm a "Location" section renders with the area name + "Explore <area> →" link (for a property whose area maps to a landing page).
- Confirm "Show map" renders a placeholder; clicking it loads the Google iframe; "Open in Google Maps →" opens the right pin.
- (Locally no property has `lat/lng` yet, so every map is the district-level `z=13` fallback — that is expected until Phase 2 runs on the server.)

- [ ] **Step 7: Commit**

```bash
git add app/properties/[slug]/page.tsx
git commit -m "feat(location): mount PropertyLocation on detail page + geo JSON-LD"
```

---

### Task 10: Document the feature + final verification

**Files:**
- Modify: `CLAUDE.md` (root) — add a short note under the conversion-UI / architecture section
- Modify: `worldwise/CLAUDE.md` if it mirrors the same section

- [ ] **Step 1: Add a docs note**

Add a bullet under the "Conversion & investor UI" section describing the location feature:

```md
- **Per-property location map** — `PropertyLocation` on `/properties/[slug]` renders a "Location" section: area name + internal link to the area landing page, plus a **lazy click-to-load** Google Maps embed (`output=embed`, no API key, no cookies/LCP until "Show map" is clicked — GDPR-clean). Centre resolves via `resolvePropertyCoords` (`lib/property-coords.ts`): `Property.lat/lng` → building pin (z16), else the area centroid from `lib/areas.ts` `coords` → district pin (z13), else no map. `scripts/seed-coords.cjs` (server-only) populates `lat/lng` via the Google Geocoding API (`GOOGLE_GEOCODING_API_KEY`), with a ROOFTOP/GEOMETRIC_CENTER + Dubai-bounding-box confidence gate. JSON-LD `RealEstateListing` gains `geo` when coords resolve.
```

- [ ] **Step 2: Run the full test + build gate**

Run:
```bash
node --test --experimental-strip-types lib/*.test.ts
npm run build
```
Expected: all `node:test` suites pass; build succeeds.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md worldwise/CLAUDE.md
git commit -m "docs(location): document the per-property location map feature"
```

- [ ] **Step 4: Push the branch and open a PR against `claude`**

```bash
git push -u claude feat/property-location-map
gh pr create --base main --head feat/property-location-map --repo Djem79/Claude \
  --title "feat: per-property location map (lazy Google embed + geocoded coords)" \
  --body "Adds a Location section to the property detail page. Phases: data model + admin lat/lng, Google Geocoding seeder, lazy click-to-load map UI. Spec + plan in docs/superpowers/."
```

---

## Self-review notes

- **Spec coverage:** data model (Task 1), coerce/validation (Task 2), resolver (Task 3), area centroids (Task 4), admin fields (Task 5), geocoding seeder + env (Task 6–7), UI component (Task 8), detail-page wiring + JSON-LD geo (Task 9), docs (Task 10). All spec sections mapped.
- **Type consistency:** `resolvePropertyCoords(property, areaCoords)` signature and its `{ lat, lng, zoom, level }` return shape are identical in Task 3 (definition), Task 8 (the `coords` prop type), and Task 9 (call site). `Area.coords` is `{ lat, lng }` in Task 4 and consumed as `matchedArea?.coords` in Task 9. `GOOGLE_GEOCODING_API_KEY` is the same name in Task 6, 7, and the docs.
- **Ordering:** Phase 1 ships the admin fields the user wanted first; Phase 2 the geocode; Phase 3 the visible feature — each independently buildable. The geocoded data (Phase 2) only becomes visible once Phase 3 is deployed, which is fine (district fallback covers the interim).
- **Deploy caution:** per CLAUDE.md, deploy reflects the working tree (union of branches). Merge to `main` and deploy from `main`, and grep for sibling-branch feature markers before the server `npm run build`.
