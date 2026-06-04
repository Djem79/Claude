# Gated floor plans per property (Conversion Wave 3 — feature D)

**Date:** 2026-06-04
**Status:** Design approved, ready for implementation plan
**Scope:** Second feature of Conversion Wave 3 ("enrich existing property pages"), built after E (brochure gate). This spec covers **D (gated floor plans)** only. B (payment-plan visualizer) is a later spec; F (multilingual) is a separate strategic decision; per-unit-type labelling (1BR/2BR price-from) is feature **C**, explicitly out of scope here.

## Why (analysis)

Floor plans are a top off-plan buyer need; gating them ("Request layout") is direct, high-intent lead capture — the same conversion value as the brochure (E).

- **vs current:** today any floor-plan images that survive import sit **untagged in the main photo gallery**, mixed with renders, not presented as layouts and not gated. D gives a dedicated, gated "Floor plans" section.
- **Data path:** the PDF import already *classifies* images (`lib/image-classify.ts`, category `floorplan`) but discards the category — kept images collapse into a flat `images[]`. D persists that classification by routing `floorplan`-classified images into a new `floorPlans` field, so brochures **auto-populate floor plans going forward**. Existing 144 properties have none until uploaded.
- **Reuse:** E already shipped the gate pattern (`BrochureGate`) and the import-persistence pattern; D reuses both.
- **SEO:** none (gated). **Weight:** one gated-gallery component + conditional images already in the property folder — negligible.

## Decisions (locked)

- **Separate `floorPlans` field, removed from the main gallery** (user choice): the import routes `floorplan`-classified images into `floorPlans`, NOT into `images[]`, so the photo gallery stays clean.
- **Blurred-grid teaser → form → reveal** (user choice): show N blurred thumbnails so the visitor sees layouts exist, then reveal full images after the lead form. More enticing than a plain CTA card.
- **Soft gate** (like E/`/guide`): images are public URLs hidden in the UI until the form is submitted.

## Data model

Add one optional field to `Property` (`types/index.ts`):

```ts
floorPlans?: string[]   // image URLs under /images/properties/<id>/, shown gated; separate from `images`
```

- Floor plans are **images in the existing property folder** (`public/images/properties/<id>/<n>.png`) — **no new storage**, served by the existing runtime media route.
- Add `floorPlans` to `ARRAY_FIELDS` in `coercePropertyInput()` (`lib/properties.ts`) — cleaned via `cleanStringArray`.

## Import — split floor plans out of the gallery

`lib/image-classify.ts` gains a pure, unit-tested partition helper, e.g.:

```ts
// Ranked gallery indices (exterior→interior→amenity, capped) vs floorplan indices.
export function partitionByCategory(cats: ImgCategory[], cap: number):
  { gallery: number[]; floorPlans: number[] }
```

`extractImagesFromPdf` (`lib/pdf-images.ts`) changes its return type from `string[]` to
`{ gallery: string[]; floorPlans: string[] }` (its only caller is the import route), mapping each index set to its URL. The import route (`app/api/admin/import/route.ts`) sets `fields.images = gallery` and `fields.floorPlans = floorPlans`. Floor-plan files are still written to the same `public/images/properties/<draftId>/` folder (continuous numbering) — only the field they're referenced from differs.

## Property page — gated "Floor plans" section

New client component `FloorPlanGate` (modeled on `BrochureGate`), rendered on `/properties/[slug]` **only when `floorPlans.length > 0`**. Three states:

1. **Teaser:** a grid of the floor-plan thumbnails rendered **blurred** (CSS `filter: blur`, `pointer-events:none`, `user-select:none`) with a "Request layout" overlay/CTA and a count ("3 floor plans").
2. **Form:** name + phone + **clip-hidden honeypot** → `POST /api/leads` `{ source:'floor_plan', propertySlug, propertyTitle, _hp }`; fire `track('lead_form_submit', { source:'floor_plan', property })`.
3. **Revealed:** the same images un-blurred, each opening full-size in a new tab.

No change to `/api/leads` (already accepts these fields). The blur is presentational; the soft gate matches E.

## PropertyForm — manage floor plans

A floor-plans control mirroring the gallery uploader: upload images via the existing `POST /api/upload?kind=gallery` (writes to the property folder, returns paths), but the form pushes returned paths into the **`floorPlans`** list (not `images`); supports remove and reorder. Included in the saved payload as `floorPlans`. Lets the operator curate auto-extracted plans or add them manually for the existing 144.

## Lead source

`floor_plan` — add to the documented source list in CLAUDE.md ("Lead `source` strings in use"). Flows into CRM + CSV automatically.

## Invariants respected

- Honeypot clip-hidden pattern (CLAUDE.md anti-spam rule).
- Property writes go through `coercePropertyInput()` (+`floorPlans` whitelisted) → atomic write; `id`/`createdAt` never trusted from body.
- Floor-plan images live in `public/images/properties/<id>/`, served by the existing `app/api/media/properties/[id]/[file]` runtime route (no new storage, no static-404 issue).
- `selectByCategory`/`partitionByCategory` stay pure and unit-tested; no native modules.
- All copy English; no emojis; brand button utilities.

## Out of scope

- Hard-gating (token) — soft gate only.
- Per-unit-type table (1BR/2BR/3BR size + price-from) — that is feature **C**.
- Bulk backfill of the 144 existing properties — manual per flagship as needed.
- Features B (payment-plan visualizer) and F (multilingual).

## Verification

- `node --test` for the new `partitionByCategory` helper (and existing `selectByCategory` tests stay green).
- `npm run build` green.
- On a test property with `floorPlans` set: the blurred teaser renders with the right count; submitting the form creates a lead with `source: floor_plan` and un-blurs the images; properties without floor plans show no section.
- Importing a sample developer PDF that contains floor-plan pages leaves those images in `floorPlans` and OUT of `images` (gallery), with the published property showing the gated section.

## File touch list

- `types/index.ts` — `Property.floorPlans?: string[]`
- `lib/properties.ts` — `floorPlans` in `ARRAY_FIELDS`
- `lib/image-classify.ts` — `partitionByCategory` (+ test)
- `lib/image-classify.test.ts` — tests for the partition helper
- `lib/pdf-images.ts` — `extractImagesFromPdf` returns `{ gallery, floorPlans }`
- `app/api/admin/import/route.ts` — set `fields.images` + `fields.floorPlans` from the split
- `components/FloorPlanGate.tsx` — **new** blurred-grid gate (client)
- `app/properties/[slug]/page.tsx` — mount `FloorPlanGate` when `floorPlans.length`
- `app/admin/property/PropertyForm.tsx` — floor-plans management control
- `CLAUDE.md` — document `floor_plan` source + the floorPlans field
