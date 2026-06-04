# Separate floor-plan / site-plan extraction pass (Wave 3/D refinement)

**Date:** 2026-06-04
**Status:** Design approved, ready for implementation plan
**Context:** D (gated floor plans) shipped, but auto-extraction was wrong twice: (1) the broad `floorplan` category sent community master-plans into the gate while real unit layouts were missing; (2) lowering the 50 KB image gate to catch the small floor plans **exploded the candidate set (35 → 232) and broke the gallery** (CLASSIFY_MAX=120 truncated to front-section junk, dropping the real exterior/interior renders). Both are reverted. Root cause: **floor plans are small (19–45 KB), portrait line-art, and appear late in the brochure — they fundamentally conflict with the clean-gallery 50 KB filter in a single extraction pass.** This spec adds a **separate, geometry-targeted pass** for plans that never touches the gallery pipeline.

## Decisions (locked)

- **Gallery** = `exterior → interior → amenity` only (cap 24). **Master-plans are removed from the gallery.**
- **Plans section** (the existing `Property.floorPlans` field) = **up to 2 master-plans** + the **unit floor plans**, cap 12 total-ish (2 + up to `FLOORPLAN_MAX`). Section label on the property page: **"Floor plans & site plans"**.
- **Plan candidates** = images that FAIL the 50 KB gallery gate but are `≥ 12 KB` AND have **floor-plan geometry** (min side ≥ 250 px AND area ≥ 150 000 px²). This geometry gate drops icons/dividers/thin banners, narrowing ~138 small images to ~20–40.
- **Two independent Gemini classify passes** (gallery pool, plans pool) so the small plans never crowd the gallery's 120-cap.

## Architecture / data flow (`lib/pdf-images.ts`)

`extractImagesFromPdf(pdfBuf, id)` keeps returning `{ gallery: string[]; floorPlans: string[] }`. New internal flow:

1. `pdfimages -all` → all raster files (unchanged), then split by the 50 KB gate (`isLikelyPhoto`):
   - `galleryFiles` = pass 50 KB (unchanged gallery pool).
   - `smallFiles` = below 50 KB.
2. **Plan candidate pool:** from `smallFiles`, keep those `≥ 12 KB` whose dimensions pass `isLikelyFloorPlanDims(w, h)`. Read dimensions with ImageMagick `identify -format "%w %h"` (already a dependency; bounded by `mapLimit`). Cap the pool at `PLAN_CLASSIFY_MAX = 60`.
3. **Classify (two calls):**
   - Gallery pass: thumbnail + `classifyImages(galleryFiles[..CLASSIFY_MAX])` → `galleryCats` (unchanged).
   - Plans pass: thumbnail + `classifyImages(planPool)` → `planCats` (same prompt/model; it already distinguishes `floorplan` / `masterplan` / `other`).
4. **Route:**
   - `gallery` = `partitionGallery(galleryCats, 24)` → exterior → interior → amenity (ranked, cap 24). [`masterplan` no longer in this order.]
   - `floorPlans` = first **2** `masterplan` indices from `galleryCats` (mapped to their gallery files) **+** `floorplan` indices from `planCats` (mapped to plan files), capped at `FLOORPLAN_MAX = 12`.
5. **Write:** all chosen files (gallery + the plan-section files) into `public/images/properties/<id>/` with continuous numbering, then split the returned URLs back into `{ gallery, floorPlans }` by group sizes (same write trick as today).
6. **Fallbacks:** classification unavailable (no key / API error / no ImageMagick) → gallery falls back to document order (as today), `floorPlans = []`. No `identify` → skip the plans pass entirely (`floorPlans = []`); the gallery is unaffected. Both non-fatal, logged.

## Pure, testable helpers (`lib/image-classify.ts`)

- `isLikelyFloorPlanDims(width: number, height: number): boolean` — `min(w,h) ≥ 250 && w*h ≥ 150_000`. Pure, unit-tested (a 487×618 / 318×1022 floor plan passes; a 200×200 icon, a 1000×80 banner, a 400×300 thumb fail).
- `partitionGallery(cats, cap)` — gallery indices ranked `exterior → interior → amenity` (rename/trim of today's `partitionByCategory` gallery half; `masterplan` dropped from the gallery order).
- `selectPlanSection(galleryCats, planCats, maxMaster, maxFloor)` — returns `{ master: number[]; floor: number[] }`: up to `maxMaster` `masterplan` indices from `galleryCats` and the `floorplan` indices from `planCats` (capped `maxFloor`), preserving document order. Pure, unit-tested.

(The existing `partitionByCategory` is superseded by `partitionGallery` + `selectPlanSection`; keep `selectByCategory` as-is for its existing tests, or remove if unused — decide in the plan.)

## Taxonomy / classifier

No prompt change needed beyond what already shipped (the `floorplan` = individual-unit-layout / `masterplan` = community-map split is already deployed and verified on the DAMAC Islands 2 images). The plans pass reuses `classifyImages` unchanged.

## UI

- `components/FloorPlanGate.tsx` — header text "Floor plans" → **"Floor plans & site plans"**. No structural change (still blurred grid → form → reveal; `source: floor_plan`). The mix of 1–2 site plans + unit layouts renders identically.
- `app/properties/[slug]/page.tsx` — unchanged (renders when `floorPlans.length > 0`).

## Constants

`MIN_PHOTO_BYTES = 50 KB` (gallery, unchanged), `PLAN_MIN_BYTES = 12 KB`, plan-dim gate `min side 250 / area 150 000`, `PLAN_CLASSIFY_MAX = 60`, `MASTERPLAN_IN_PLANS = 2`, `FLOORPLAN_MAX = 12`.

## Invariants respected

- The 50 KB gallery gate and the gallery pipeline are **unchanged** — no regression risk to exteriors/interiors.
- Floor-plan images live in `public/images/properties/<id>/` (existing media route); no new storage.
- `floorPlans` already whitelisted in `coercePropertyInput`; no type/route change.
- Pure helpers stay `node:test`-able (no fs/next imports); ImageMagick/Gemini calls live only in `pdf-images.ts`.

## Out of scope

- Per-unit-type labels (1BR/2BR price-from) — feature C.
- Manual floor-plan upload already exists in `PropertyForm` (unchanged).
- Changing the gallery's 50 KB gate (explicitly must NOT change).

## Verification

- `node --test` for `isLikelyFloorPlanDims`, `partitionGallery`, `selectPlanSection`.
- `npm run build` green.
- **Real re-import of DAMAC Islands 2** on the server: gallery shows exteriors/interiors (NO master-plans, NO people); the "Floor plans & site plans" section shows the pages 73–78 unit layouts + up to 2 site/master plans; candidate explosion does not recur (gallery pool stays ~94, plans pool ≤60). (The classifier already proved floor plans → `floorplan`, master-plans → `masterplan` on these exact images.)

## File touch list

- `lib/image-classify.ts` — `isLikelyFloorPlanDims`, `partitionGallery`, `selectPlanSection` (+ drop `masterplan` from gallery order)
- `lib/image-classify.test.ts` — tests for the three helpers
- `lib/pdf-images.ts` — two-pool extraction + two classify passes + `identify` dimension read + routing
- `components/FloorPlanGate.tsx` — label "Floor plans & site plans"
- (`app/api/admin/import/route.ts`, `types`, `coerce` — unchanged)
