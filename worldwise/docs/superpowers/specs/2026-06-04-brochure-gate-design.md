# Gated brochure per property (Conversion Wave 3 — feature E)

**Date:** 2026-06-04
**Status:** Design approved, ready for implementation plan
**Scope:** First feature of Conversion Wave 3 ("enrich existing property pages"). Waves are built one feature at a time; this spec covers **E (gated brochure)** only. D (floor plans) and B (payment-plan visualizer) are later specs; F (multilingual) is a separate strategic decision.

## Why (analysis)

Off-plan buyers' top CTA is "download the brochure". We have no per-property brochure today.

- **Value:** strongest lead magnet of Wave 3 — the whole developer PDF, not a single data point.
- **Data path:** the PDF import already *receives* the brochure; today it stores only the filename string and discards the bytes. Persisting the uploaded PDF makes brochures **auto-populate for every future import** — unlike payment-plan (B), which is rarely in the brochure and would stay manual.
- **Reuse:** the `/guide` lead-magnet gate (`GuideClient`) is the exact pattern; `/api/leads` already accepts `source` + `propertySlug` + `propertyTitle` + honeypot, so the leads API is unchanged.
- **SEO:** none (gated asset). **Weight:** one inline client component + one Node route handler, both conditional on `brochure` being set — negligible, all SSG.

## Decisions (locked)

- **Soft gate** (like `/guide`): the download route serves the PDF without a token; the link is simply hidden in the UI until the lead form is submitted. Acceptable for a marketing PDF.
- **Inline block** (like `/guide`): a self-contained component on the property page, not the shared `LeadModal` (avoids teaching `LeadModal` a post-success download branch).

## Data model

Add one optional field to `Property` (`types/index.ts`):

```ts
brochure?: string   // filename under public/files/brochures/, e.g. "436475789132.pdf". Presence => show the gate.
```

- SSG-friendly: render decision is a field check, no disk I/O at render.
- Add `brochure` to the `coercePropertyInput()` whitelist (`lib/properties.ts`) — string, capped, never trusted beyond a basename.

## Storage

Brochure bytes live at `public/files/brochures/<id>.pdf`.

- `public/files/` is **excluded from rsync** (CLAUDE.md deploy step) — so brochures are **server-only**, like lead attachments, never committed, never clobbered by a deploy.
- Existing 144 properties have no brochure until one is uploaded; the field is optional, so they simply don't show the block.

## Serving — gated download route

`GET /api/properties/[id]/brochure` (Node runtime — **not** Edge; uses `fs`):

- Validates `id` (numeric-string, same guard style as `pdf-images.ts`).
- Reads `public/files/brochures/<id>.pdf` from disk **at runtime** — this sidesteps the known `next start` gotcha where files written to `public/` after build 404 until a rebuild (same reason the property-image media route exists).
- Streams with `Content-Type: application/pdf` and `Content-Disposition: attachment; filename="..."`.
- 404 if the file is missing.
- Soft gate: no auth/token; the UI controls reveal. (Hard-gating is explicitly out of scope.)

## Capture flow — `BrochureGate` client component

Modeled on `GuideClient`. Rendered on `/properties/[slug]` **only when `property.brochure` is set**.

Three states (see mockup): CTA button -> form -> unlocked link.

1. **CTA:** "Download brochure (PDF)" with a one-line subtitle.
2. **Form:** name + phone + **clip-hidden honeypot** (the mandated `clip:rect(0,0,0,0)` pattern, never `left:-9999px`).
3. On submit -> `POST /api/leads` with `{ name, phone, source: 'brochure_request', propertySlug, propertyTitle, _hp }`; fire `track('lead_form_submit', { source: 'brochure_request', property: title })`.
4. **Unlocked:** reveal `<a href="/api/properties/<id>/brochure" download>Download PDF</a>`.

No change to `/api/leads` — it already accepts and caps all these fields and routes them to the CRM/CSV.

## Population (two paths)

1. **PDF import (primary, auto-populating).** In `app/api/admin/import/route.ts`, after a successful extraction, write the uploaded PDF buffer to `public/files/brochures/<draftId>.pdf` and set `draft.fields.brochure = '<draftId>.pdf'`. Because `draftId` becomes the property `id` on publish, the file is already correctly named and needs no move (same trick the extracted images use). Non-fatal on write failure (logged), consistent with image extraction.
2. **PropertyForm (manual / backfill).** Extend `/api/upload` with `kind=brochure`: accept a single PDF, write to `public/files/brochures/<propertyId>.pdf`, return the filename; `PropertyForm` gets an optional brochure upload control that sets `property.brochure`. Used to backfill flagship listings.

## Lead source

`brochure_request` — add to the documented source list in CLAUDE.md ("Lead `source` strings in use"). Flows into CRM + CSV automatically (source is free text, capped at 60).

## Invariants respected

- Honeypot uses the clip-hidden pattern (CLAUDE.md anti-spam rule).
- Property writes go through `coercePropertyInput()` + `createProperty()`/`updateProperty()` (atomic write) — `brochure` whitelisted; `id`/`createdAt` never trusted from the body.
- PDF served via a **Node** route handler (`fs`), not Edge, not an npm native addon.
- `public/files/` stays rsync-excluded; brochures are server-only like lead files.
- All copy English; no emojis; the gate block uses brand button utilities.

## Out of scope

- Hard-gating (one-time token) — soft gate only.
- Bulk backfill of the 144 existing properties — manual per flagship as needed.
- Features D (floor plans) and B (payment-plan visualizer) — separate later specs.
- Multilingual (F) — separate strategic decision.

## Verification

- `npm run build` green; `node --test` for any new pure helper (e.g. an id/basename guard).
- On a test property with `brochure` set: the block renders; submitting the form creates a lead with `source: brochure_request` (visible in CRM) and reveals the link; `GET /api/properties/<id>/brochure` streams the PDF as an attachment; a missing file 404s.
- Importing a sample developer PDF leaves `public/files/brochures/<draftId>.pdf` on disk and `brochure` set on the draft -> published property shows the gate.

## File touch list

- `types/index.ts` — `Property.brochure?`
- `lib/properties.ts` — whitelist `brochure` in `coercePropertyInput`
- `app/api/properties/[id]/brochure/route.ts` — **new** gated download (Node runtime)
- `components/BrochureGate.tsx` — **new** inline gate (client)
- `app/properties/[slug]/page.tsx` — mount `BrochureGate` when `brochure` set
- `app/api/upload/route.ts` — `kind=brochure` (PDF -> public/files/brochures)
- `app/admin/property/PropertyForm.tsx` — optional brochure upload control
- `app/api/admin/import/route.ts` — persist uploaded PDF + set `draft.fields.brochure`
- `CLAUDE.md` — document `brochure_request` source (+ note brochures live in rsync-excluded `public/files/brochures/`)
