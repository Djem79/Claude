# Conversion Wave 2 — Design Spec

**Date:** 2026-06-04
**Status:** Approved (design), pending implementation plan
**Origin:** Competitive teardown of metropolitan.realestate → "Wave 2" (traffic/SEO). See `project_competitor_metropolitan` memory + `2026-06-04-conversion-wave-1-design.md`.

## Goal

Grow organic traffic and internal-linking depth with a developers directory, a Popular-Searches SEO grid (filterable catalog deep-links), and thematic grouping of the area hub — without losing existing edges.

## Approved decisions (from brainstorming)

- **Developers directory:** pages for every canonical developer with **≥2 properties** (after canonicalizing the messy free-text `developer` field).
- **Popular Searches:** build it fully ("по-максимуму") — live counts + "From AED" + deep-links into a URL-param-filterable catalog (catalog will grow).
- **Area themes:** **Waterfront & Beachfront** (Dubai Marina, Palm Jumeirah, Emaar Beachfront, Dubai Creek Harbour) / **City & Business** (Downtown Dubai, Business Bay, JLT) / **Family & Lifestyle** (Dubai Hills).
- **Read-time: ALREADY IMPLEMENTED — OUT OF SCOPE.** Both static `Article` and AI `DynamicArticle` carry `readTime`, rendered in `BlogPreview`, `/blog`, and `/blog/[slug]`. No work needed.

## Data note (no schema changes)

Uses existing `Property.developer` (free text, messy: casing + duplicate variants like "DAR GLOBAL"/"DarGlobal", "MAG Properties"/"Mag Properties"/"MAG Property"/"Mag Lifestyle", "SOBHA REALTY"/"Sobha", "Aqua Properties"/"Aqua properties", "IGO"/"Invest Group Overseas (IGO)", "Expo City Dubai"/"Expo City"). Canonicalization happens in code (curated list + aliases), mirroring the area `aliases` pattern — `data/` is untouched. Developer logos exist for only 7 brands (`public/images/developers/`: emaar, damac, ellington, sobha, meraas, aldar, nakheel) → graceful fallback to an initials chip when absent.

## Feature 1 — Developers directory

- **`lib/developers.ts`** (mirror of `lib/areas.ts`): `interface Developer { slug; name; aliases?: string[]; blurb: string; logo?: string }`, a curated `developers: Developer[]` (canonical brands with ≥2 properties), `developerSlugs`, and a **pure** `propertyMatchesDeveloper(propDeveloper: string, dev: Developer): boolean` — normalize (lowercase, trim, collapse whitespace) and match the property's developer against the canonical `name` or any `alias` by equality (NOT substring, to avoid false positives). Aliases must cover the live distinct set (derive from server `data/properties.json` during implementation). Unit test: `lib/developers.test.ts`.
- **`/developers`** — index (server component): grid of developer cards (logo if present, else initials chip) with the live property count; intro copy; JSON-LD `BreadcrumbList`. SEO hub + internal links.
- **`/developers/[slug]`** — detail (mirror `app/[area]/`): `app/developers/[slug]/page.tsx` server component (`generateStaticParams` from `developerSlugs`, `generateMetadata`, `<JsonLd>` `Organization` + `BreadcrumbList`) composing a client wrapper `DeveloperPageClient.tsx` that owns `LeadModal`. Sections: hero (name + blurb, logo), "About <developer>", matched-properties grid (`propertyMatchesDeveloper`, reusing `PropertyCard`), lead CTA. Lead `source: developer_<slug>` (underscored). 404 for any slug not in `developerSlugs`.
- **`app/sitemap.ts`**: add `/developers` + every `/developers/<slug>`.

## Feature 2 — Popular Searches + URL-param catalog

- **`app/properties/PropertiesClient.tsx`**: initialize the existing `area`/`type`/`status` filter state from `useSearchParams()` (`?area=`, `?type=`, `?status=`) so external links open a pre-filtered catalog. Values map to the existing filter options; unknown values fall back to "all"/"All Areas". No change to the filtering logic itself.
- **`components/PopularSearches.tsx`**: a curated set of area×type combinations; for each, compute the live count and min price ("From AED …") from the passed `properties`, render only combos with ≥1 match, link to `/properties?area=<area>&type=<type>`. Server-rendered (homepage passes `properties`). Mounted on the homepage (after `AreasSection`). Headings/links only, no emojis.

## Feature 3 — Thematic area groups

- **`components/AreasSection.tsx`**: add a `theme` to each entry of the local `AREAS` array and render the areas grouped under three subheadings — **Waterfront & Beachfront**, **City & Business**, **Family & Lifestyle** (mapping above). Existing card markup, images, and links unchanged; only grouping + subheadings added.

## Out of scope (Wave 3)

"Project" content type (payment-plan visualizer, unit-type table, floor plans, brochure) on the PDF-import base; gated floor-plan PDFs; multilingual.

## Verification

- `node --test --experimental-strip-types lib/developers.test.ts lib/*.test.ts` → green.
- `npm run build` "Compiled successfully"; `npx eslint` clean on touched files.
- Manual (note: property pages need server `data/`, so developer/popular-search counts verify after deploy): `/developers` lists brands with counts/logos-or-initials; a developer page shows its matched properties + lead form; `/properties?area=Dubai Marina&type=apartment` opens pre-filtered; homepage shows Popular Searches (only non-empty combos) and the three area theme groups; sitemap includes developer URLs.

## Non-negotiables honored

English only; **no emojis on public pages**; honeypot on any new lead form path (DeveloperPageClient uses `LeadModal`, which already has it); all JSON-LD via `<JsonLd>`; no `data/` writes; deploy is a separate explicit step.
