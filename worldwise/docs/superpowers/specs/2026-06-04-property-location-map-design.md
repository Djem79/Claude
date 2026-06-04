# Property Location Map — Design Spec

**Date:** 2026-06-04
**Status:** Approved (pending user spec review)
**Feature:** Add a "Location" section with a lazy, click-to-load Google map to the property detail page (`/properties/[slug]`), inspired by Metropolitan. Coordinates resolve per-property when known, otherwise fall back to the district centre.

## Goal & context

Today "location" on the site is plain text only — `Developer · Area, Dubai` on both the detail page and the listing card; there is no map and **no coordinates in the data** (`Property` carries only the free-text `area`). This feature adds a real, premium-feeling location section on the highest-converting page (the property detail page) without harming its performance or violating the site's strict cookie-consent posture.

Non-goals: a map on the small listing/grid card (unrealistic at that size); a multi-property cluster map; live transit/POI data.

## Key decisions (locked during brainstorming)

1. **Placement:** detail page only (`/properties/[slug]`).
2. **Precision:** district-level now, building-level where geocoding resolves confidently. **If a property has no coordinates, the map centres on the district** (graceful fallback). No coordinates at all → no map, only the text location block.
3. **Map tech:** **lazy, click-to-load Google Maps `iframe` (`output=embed`, no API key needed for the embed).** Zero weight / zero cookies / zero LCP impact until the user clicks "Show map" — the load is user-initiated, which keeps it clean under GDPR (the rest of the site gates even GA behind consent).
4. **Coordinates source:** **Google Geocoding API** (better Dubai coverage than OSM), key from the existing GCP project `worldwise-497520` with the Geocoding API enabled. Run once as a server-side seeder over the 144 properties.
5. **Build order (user-directed):** (1) admin fields + data model → (2) run Google Geocoding to populate coordinates → (3) build the map UI feature per the implementation plan.

## Data model

`types/index.ts` — extend `Property`:

```ts
lat?: number   // decimal degrees, building-level when known
lng?: number
```

`lib/areas.ts` — add a district centre to each of the 11 area entries:

```ts
coords: { lat: number; lng: number }   // district centroid, the per-property fallback
```

Pure resolver (own module, `node:test`-covered — keep it free of `next`/`fs`/`@/` value-imports so type-stripped tests resolve, per the area-hygiene lesson):

```ts
// resolvePropertyCoords(property, areaCoords) →
//   { lat, lng, zoom: 16, level: 'building' }  when property.lat/lng present
//   { lat, lng, zoom: 13, level: 'area' }       when only areaCoords present
//   null                                          when neither → no map
```

## Components & flow

### 1. Admin — `PropertyForm`
- Add two optional numeric inputs: **Latitude / Longitude** (grouped, e.g. under the area field).
- `coercePropertyInput()` (`lib/properties.ts`) whitelists `lat`/`lng`: coerce to `Number`, drop on `NaN`, never invent. Out-of-range values (lat ∉ [-90,90], lng ∉ [-180,180]) are dropped.
- Lets an admin add/correct building coordinates manually — this is the "building later" path and the correction tool for bad geocodes.

### 2. Geocoding seeder — `scripts/seed-coords.cjs` (server-only, mirrors `seed-gross-yield.cjs`)
- Reads `data/properties.json`; for each property **without** `lat/lng`, queries Google Geocoding API with `q = "<title>, <area>, Dubai, United Arab Emirates"`.
- Uses `GOOGLE_GEOCODING_API_KEY` from server `.env.local` (rsync-excluded, persists across deploys — same pattern as `GSC_*`).
- Confidence gate: accept a result only when `geometry.location_type` is `ROOFTOP` or `GEOMETRIC_CENTER` **and** the result's bounds fall within a Dubai bounding box (~24.7–25.4 N, 54.9–55.6 E). Otherwise leave the property without coordinates (area fallback applies). This stops a mis-resolved project name from dropping a pin in the wrong emirate/country.
- Modes: dry-run (default, prints proposed coords + the chosen `location_type` for review) → `--apply` writes `lat/lng` via `writeFileAtomic` → then `npm run build` on the server (SSG pages are prerendered).
- Rate: the Geocoding API tolerates the small batch; add a light delay between calls anyway. 144 calls ≈ within the free tier (~$0).

### 3. Detail page — `<PropertyLocation>` component
Rendered in the detail page body (a new "Location" section). Receives the resolved coords + the property + the matched area.
- **Always shown (when there's an area):** heading "Location", the area name, an optional one-line connectivity note, and a prominent **internal link to the area landing page** (`/<area-slug>`) — reinforces the site's main internal-link hub (SEO).
- **Map (when coords resolve):** a lightweight local placeholder panel + a "Show map" button. On click, inject:
  `https://www.google.com/maps?q=<lat>,<lng>(<encoded title>)&z=<zoom>&output=embed` into an `<iframe loading="lazy">`. Building coords → `z=16`; area-only → `z=13`.
- **External link:** "Open in Google Maps →" (`https://www.google.com/maps/search/?api=1&query=<lat>,<lng>`).
- **No coords at all:** render only the text location block (no map, no broken embed).

### 4. SEO — JSON-LD
In the detail page's `RealEstateListing` JSON-LD (via `<JsonLd>`), add `geo` when coords resolve:
```json
"geo": { "@type": "GeoCoordinates", "latitude": <lat>, "longitude": <lng> }
```
Use building coords when present; otherwise the area centroid is acceptable (still truthful at district level).

## Privacy / performance

- The map `iframe` loads **only after an explicit click** → no Google request, no Google cookies, no third-party JS before user consent, and **no LCP cost** on the conversion page. This is the reason for the click-to-load design over an always-on embed.
- No external image URLs introduced (the placeholder is a local asset / CSS panel); no API key shipped to the client (the embed URL needs none; the Geocoding key stays server-side in the seeder).

## Verification

- `node --test --experimental-strip-types` on the pure `resolvePropertyCoords` module (building vs area vs null cases; out-of-range rejection).
- `npm run build` passes.
- Manual: a property with building coords shows the building at z16; a property without coords shows its district at z13; a property whose area has no centroid (shouldn't happen — all 11 seeded) shows the text-only block. Map only loads after clicking "Show map".

## Out of scope / later

- Listing-card location chip (separate, smaller change if wanted later).
- Replacing the embed with Leaflet/OSM (privacy-max alternative — declined in favour of Google's Dubai coverage + the click-to-load mitigation).
- Distance-to-landmark data per property (the connectivity note is curated per area, not per property).
