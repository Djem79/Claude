# Area Data Hygiene (clean at entry) — Design Spec

**Date:** 2026-06-04
**Status:** Approved (design), pending implementation plan
**Origin:** Wave-2 surfaced a messy free-text `area` field (53 distinct values / 144 props: generic "Dubai" ×29, casing/spelling variants, a developer name in the area field). Fix at the point of entry so NEW imports and form submissions are clean. Existing records are NOT rewritten (user decision). `pricePerSqft`/unit size are explicitly deferred.

## Goal

Make the `area` field consistent for all newly imported or edited properties via a curated controlled vocabulary + a tolerant canonicalizer, so Popular Searches, catalog filters and area pages stay clean as inventory grows.

## Decisions (from brainstorming)

- **pricePerSqft / unit size: deferred** — not in this work.
- **Form area field: dropdown of controlled areas + an "Other…" free-text fallback** (never block the operator on a missing area).
- **Existing 144 records: untouched** (non-destructive; clean at entry only).

## Components

### 1. `lib/dubai-areas.ts` (new, pure, unit-tested)

- `DUBAI_AREAS: string[]` — curated canonical Dubai community names, alphabetic, e.g.: Al Furjan, Al Jaddaf, Arjan, Business Bay, Damac Hills, Damac Hills 2, Downtown Dubai, Dubai Creek Harbour, Dubai Harbour, Dubai Hills Estate, Dubai Marina, Dubai Maritime City, Dubai Production City, Dubai Science Park, Dubai South, Dubai Sports City, Dubailand, Emaar Beachfront, Expo City, JBR, JLT, JVC, Meydan, Mohammed Bin Rashid City, Palm Jumeirah, Sobha Hartland, The Oasis, The Valley. (Curated from the live distinct set + common communities; refine in the plan against `data/properties.json`.)
- `ALIAS_MAP: Record<string,string>` — normalized variant → canonical, covering the live mess: e.g. `jlt`/`jumeirah lake towers` → "JLT"; `sport city`/`sports city`/`dubai sports city` → "Dubai Sports City"; `maritime city`/`dubai maritime city` → "Dubai Maritime City"; `mbr city`/`mbr city district 7`/`sobha hartland, mohammed bin rashid city (mbr city)`/`sobha hartland, mbr city, dubai` → "Mohammed Bin Rashid City"; `jumeirah beach residences (jbr)` → "JBR"; `dubai investment park 2` → "Dubai Investment Park"; `dubai expo` → "Expo City"; etc.
- `canonicalizeArea(raw: string): string` — pure: trim/collapse whitespace; if the normalized value equals a canonical name (case-insensitively) return that canonical; else if it is in `ALIAS_MAP` return the mapped canonical; else return the **trimmed raw unchanged** (never invent, never drop — generic "Dubai" stays "Dubai"; unknown communities pass through). Empty → "".
- Unit test `lib/dubai-areas.test.ts`: variant→canonical, canonical→itself (case-insensitive), unknown→unchanged, "Dubai"→"Dubai", ""→"".

Canonical names are chosen to remain matched by the area-landing `aliases` (`propertyMatchesArea` is tolerant), so the 8 area pages keep working.

### 2. Import (new objects clean)

- `lib/property-extract.ts` SYSTEM prompt (`area` instruction): provide the controlled list and instruct Gemini to return the closest matching community from it; if none fits, return a short community name (not a street address). The list is injected from `DUBAI_AREAS`.
- `lib/property-map.ts`: run the extracted `area` through `canonicalizeArea` before it enters the draft (safety net regardless of what Gemini returns).

### 3. `app/admin/property/PropertyForm.tsx`

- Replace the free-text "Area / District" input with a `<select>` populated from `DUBAI_AREAS`, plus an `"Other…"` option. Selecting "Other…" reveals a text input for a custom area. On edit: if the property's current `area` is not in `DUBAI_AREAS`, preselect "Other…" and prefill the text input with the existing value (so editing never loses data).

## Out of scope

Rewriting existing `data/properties.json` records; `pricePerSqft`/`sizeSqft`; developer-field cleanup (already handled by `lib/developers.ts` aliases at read time).

## Verification

- `node --test --experimental-strip-types lib/dubai-areas.test.ts lib/*.test.ts` → green.
- `npm run build` "Compiled successfully"; `npx eslint` clean on touched files.
- Manual (after deploy, needs server `data/` + a real PDF import): import a brochure → draft `area` is a canonical value; PropertyForm shows the area dropdown with "Other…" working; editing a property whose area is off-list preselects "Other…" with the value intact.

## Non-negotiables honored

English only; no emojis; no `data/` writes; no schema change (uses existing `area: string`); deploy is a separate explicit step.
