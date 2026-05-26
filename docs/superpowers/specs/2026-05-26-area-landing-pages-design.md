# Area Landing Pages — Design Spec

**Date:** 2026-05-26
**Status:** Approved → ready for implementation plan
**Goal:** Capture high-intent Dubai area search traffic (e.g. "Dubai Marina apartments for sale") by giving each priority district its own SEO-optimised landing page that converts to leads.

## Context

worldwise.pro currently has only a filtered listing (`/properties?area=...`) for districts. That URL canonicals to `/properties`, so Google does not index it as standalone. Area-specific queries are some of the highest-traffic keywords in Dubai property search; we are missing them entirely. The `AreasSection` component already has hero images and base metrics for 8 priority districts — sufficient foundation to ship the full set in one pass.

## Scope (launch v1)

8 districts, all in one rollout:

1. Dubai Marina
2. Downtown Dubai
3. Palm Jumeirah
4. Business Bay
5. Dubai Hills
6. JLT
7. Creek Harbour
8. Emaar Beachfront

Each gets a static SSG page at `/<slug>` (flat URL, e.g. `/dubai-marina`).

## URL & Routing

- **Flat URLs:** `/dubai-marina`, `/downtown-dubai`, `/palm-jumeirah`, `/business-bay`, `/dubai-hills`, `/jlt`, `/creek-harbour`, `/emaar-beachfront`.
- **Route handler:** single dynamic route `app/[area]/page.tsx` with `generateStaticParams()` returning the 8-slug allowlist. Anything else on this route returns 404 via `notFound()`.
- **No conflict with existing top-level routes** (`/properties`, `/blog`, `/admin`, `/mortgage-calculator`, `/privacy`, `/terms`, `/api`, `/files`, `/login`, `/sitemap.xml`, `/robots.txt`) — file-system routing gives them priority, and `[area]` only catches whitelisted slugs.
- **AreasSection update:** the homepage card grid switches from `href={'/properties?area=<name>'}` to `href={'/<slug>'}` so the homepage becomes an internal-link hub for the new pages.

## Page Template (top to bottom)

| # | Block | Purpose |
|---|-------|---------|
| 1 | Hero | Area image full-width, `<h1><Area></h1>`, 2-line pitch, 3 metric chips (avg price, ROI, listing count), primary CTA → `LeadModal` (`source: 'area_<slug>'`). |
| 2 | Why invest | 3–4 unique paragraphs of copy per area (~300 words). Critical for Helpful Content; no templated boilerplate. |
| 3 | Key stats | Card row: avg price/sqft, ROI range, typical apartment size, off-plan handover horizon. Source: `lib/areas.ts`. |
| 4 | Featured properties | Server-side filter on `data/properties.json` where `property.area === '<Area name>'`. Up to 6 `PropertyCard`s. CTA "View all in `<Area>`" → `/properties?area=<Area>`. If 0 matches: hide block + CTA goes to "Browse all properties" → `/properties`. |
| 5 | What's nearby | Bullet list of metro, beaches, schools, malls, business hubs. Unique per area, written. |
| 6 | FAQ | 3–5 questions per area in an accordion. Also emits JSON-LD `FAQPage`. |
| 7 | LeadCaptureSection | Full-width lead form, `source: 'area_<slug>'`. |
| 8 | FloatingCTA + Footer | Per global UX rules in CLAUDE.md. |

## Data Layer

Single new module `lib/areas.ts` — the source of truth for area data and copy.

```ts
export type Area = {
  slug: string                       // 'dubai-marina'
  name: string                       // 'Dubai Marina' (must match Property.area exactly)
  heroImage: string                  // '/images/areas/dubai-marina.jpg'
  tagline: string                    // 2-line pitch under H1
  metrics: {
    avgPrice: string                 // 'AED 1,850/sqft'
    roi: string                      // '7–8%'
    typicalSize: string              // '650–1,400 sqft'
    handover: string                 // '2026–2028' (for off-plan summary)
  }
  whyInvest: string[]                // 3–4 paragraphs of unique copy
  whatsNearby: string[]              // bullet items: metro, beach, schools, etc.
  faq: { q: string; a: string }[]    // 3–5 entries
  metaDescription: string            // unique per area (155–160 chars)
}

export const areas: Area[]
export function getArea(slug: string): Area | undefined
export const areaSlugs: string[]     // for generateStaticParams + sitemap
```

`Property.area` already matches the `name` field exactly (e.g. `"Dubai Marina"`), so filtering needs no normalisation.

## SEO Layer (per page)

- **`<title>`:** `<Area> Apartments & Investment Properties | Worldwise Real Estate`
- **`<meta description>`:** `area.metaDescription` (unique, includes avgPrice and ROI).
- **`<link rel="canonical">`:** `https://worldwise.pro/<slug>`.
- **OpenGraph:** absolute `area.heroImage` URL as `og:image`, `og:title`, `og:description`.
- **Twitter card:** `summary_large_image`.
- **JSON-LD:** three blocks — `Place` (with `name`, `description`, `image`, `address.addressLocality: 'Dubai'`), `BreadcrumbList` (`Home > <Area>`), `FAQPage` (built from `area.faq`).
- **Sitemap:** all 8 URLs added in `app/sitemap.ts` with `changeFrequency: 'monthly'`, `priority: 0.8`.
- **`robots.txt`:** unchanged.

## Conversion & Analytics

- **New lead `source` values:** `area_dubai_marina`, `area_downtown_dubai`, `area_palm_jumeirah`, `area_business_bay`, `area_dubai_hills`, `area_jlt`, `area_creek_harbour`, `area_emaar_beachfront`. Added to the `Lead source strings in use` list in CLAUDE.md.
- **GA4 events:** existing `lead_form_submit` (with new source), `whatsapp_click` (from FloatingCTA), `property_view` (from featured PropertyCards). No new events needed.
- **CRM:** `/admin/leads` filter discovers source values dynamically — new sources appear without code changes.

## Components (new vs reused)

| File | Status | Purpose |
|------|--------|---------|
| `lib/areas.ts` | new | Data + copy + helper functions |
| `app/[area]/page.tsx` | new | Route handler, metadata, JSON-LD, page composition |
| `components/AreaHero.tsx` | new | Hero block with image, H1, metric chips, primary CTA |
| `components/AreaFeaturedProperties.tsx` | new | Server-rendered 6-card grid + "View all" CTA |
| `components/AreaFAQ.tsx` | new | Accordion with progressive disclosure |
| `components/AreasSection.tsx` | edit | Switch homepage cards to flat slug URLs |
| `app/sitemap.ts` | edit | Add 8 area URLs |
| `CLAUDE.md` | edit | Add new sources to Lead source list; add Area pages subsection under Architecture |

Reused without modification: `LeadModal`, `LeadCaptureSection`, `FloatingCTA`, `Footer`, `PropertyCard`.

## Honeypot / Anti-Spam

Any new form CTA uses the existing `LeadModal` — which already includes the honeypot field and rate-limited POST to `/api/leads`. No new server endpoint is added. The lead `source` is set by the caller (the area page) before opening the modal.

## What We're NOT Building (YAGNI)

- No hub page at `/areas` — the homepage `AreasSection` already serves this role.
- No admin UI to edit area copy — content lives in `lib/areas.ts`, edited via PR (mirrors `lib/articles.ts` pattern for static editorial).
- No interactive map / Google Maps embed — would force CSP changes and Core Web Vitals hit.
- No per-area sub-blog or category pages.
- No new `Property.areaSlug` field — `Property.area` (free string) stays the source of truth.

## Verification (acceptance criteria)

After implementation:

1. `npm run build` — output shows 8 new SSG routes under `[area]`.
2. `curl -sI https://worldwise.pro/dubai-marina` → 200; response includes correct `<title>`, `<link rel="canonical">`, JSON-LD `Place` + `BreadcrumbList` + `FAQPage`.
3. Each of the 8 URLs renders the full template in the browser; featured properties block shows real cards from `data/properties.json` filtered by area.
4. Homepage `AreasSection` cards open the new flat URLs (no longer the filtered listing).
5. `curl https://worldwise.pro/sitemap.xml` contains all 8 area URLs.
6. Submitting a lead from a new area page shows `source: 'area_<slug>'` in `/admin/leads`.
7. After deploy, submit `/dubai-marina` to GSC URL Inspection → Request Indexing.

## Out of scope for v1 — captured for later

- Adding more districts beyond the initial 8 (e.g. JVC, Arabian Ranches, MBR City) — same template, just more rows in `lib/areas.ts`.
- A/B test of hero CTA copy.
- Auto-generated area copy via Gemini (mirroring auto-blog) — only if manual content proves expensive to maintain.
