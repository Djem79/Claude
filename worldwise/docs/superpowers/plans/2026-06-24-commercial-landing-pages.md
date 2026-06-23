# Commercial SEO Landing Pages — Design + Implementation Plan

> Design-of-record + build plan. Roadmap feature #1. Mirrors the existing area-page pattern.

**Goal:** Templated SSG landing pages targeting high buyer-intent Dubai-property queries (commercial intent → landing pages rank + convert better than blog posts). Adding a landing = one entry in `lib/landings.ts`. Each page: SEO content + FAQ + a filtered properties grid + the area-page conversion stack. Seeds the funnel from the queries surfaced by the keyword-discovery + competitor-gap services.

## Architecture (copy the area-page pattern)
- **Route** `app/invest/[slug]/page.tsx` — server component: `generateStaticParams()` from `landingSlugs`, `generateMetadata()` (title/description/canonical/OG), JSON-LD via `<JsonLd>` (WebPage + FAQPage + BreadcrumbList). Whitelists `landingSlugs`; any other slug → `notFound()`. Dedicated `/invest/` segment avoids colliding with the root `[area]` route.
- **Client wrapper** `app/invest/[slug]/LandingClient.tsx` — owns `LeadModal` state (mirror `app/[area]/AreaPageClient.tsx`): renders content + grid + conversion. Read `AreaPageClient.tsx` and copy its structure/imports.
- **Data** `lib/landings.ts` — the `Landing` type + `landings` array + `landingSlugs` + `getLanding(slug)` + a pure `propertiesForLanding(landing, properties)` filter (node:test'd).
- **Sitemap** `app/sitemap.ts` — map `landingSlugs` (priority ~0.85, monthly).
- **Lead source** — `landing_<slug>` (add the prefix to the CLAUDE.md source-strings list).

## `Landing` type (lib/landings.ts)
```ts
export type Landing = {
  slug: string                 // url segment, e.g. 'buy-apartment-in-dubai'
  h1: string
  metaTitle: string            // ≤60 chars (the `%s | Worldwise` template adds brand)
  metaDescription: string      // ≤160 chars
  intro: string                // direct-answer first paragraph
  sections: { h2: string; body: string; table?: { headers: string[]; rows: string[][] } }[]
  faq: { q: string; a: string }[]
  propertyFilter: { type?: 'apartment'|'villa'|'townhouse'|'penthouse'; area?: string; maxPriceAed?: number }
  gridHeading: string          // e.g. 'Featured apartments in Dubai'
  leadSource: string           // `landing_<slug>`
}
```
`propertiesForLanding(landing, properties)`: filter by `type` (if set), `area` (case-insensitive substring if set), `maxPriceAed` (if set); return up to ~6. Pure → `lib/landings.test.ts` (or `propertiesForLanding` extracted so it's importable without Next; if importing `Property` type only, fine for `--experimental-strip-types`).

## Rendering (LandingClient)
- H1 + intro; then each section (h2 + body paragraphs; render a `<table>` when `section.table` present — reuse the blog table styling).
- `## FAQ` block from `faq[]` (and the same data powers the FAQPage JSON-LD).
- Properties grid: `propertiesForLanding(...)` → reuse `AreaFeaturedProperties` (generalize it to accept an optional `heading` prop, defaulting to the current area wording — backward-compatible) OR a thin grid using `PropertyCard`. Pass `gridHeading`.
- Conversion (mirror area pages): a primary CTA (`btn-primary`) opening `LeadModal` with `source: leadSource`; a lead-capture form section (reuse the same component AreaPageClient uses, or `LeadCaptureSection`); `MobileCtaBar` with the landing source. `<FloatingCTA />` + `<Footer />` present (UX rule). No emojis; gold-accessible utilities on light surfaces.

## Content (4 seed landings — author into `lib/landings.ts`)
Use facts consistent with `lib/articles.ts` (visa thresholds AED 750k/2M, DLD 4%, ~7% yields, AED pegged 3.67) — do NOT invent statistics. ~600–900 words each, English, brand-premium tone, no emojis. Each ends with a consultation CTA paragraph and 1–2 internal links (`[text](/path)` won't render here — these are landing components, so use `<Link>`/CTA, not markdown).

1. **buy-apartment-in-dubai** — H1 "Buy an Apartment in Dubai", filter `type: apartment`. Cover: who can buy (freehold zones, non-residents), price ranges by area, process/fees (DLD 4%, agency), payment options, yields, residency link. FAQ: can foreigners buy, min budget, fees, mortgage, off-plan vs ready.
2. **buy-villa-in-dubai** — H1 "Buy a Villa in Dubai", filter `type: villa`. Cover: villa communities (Dubai Hills, Damac Hills, The Valley, Palm), price ranges, freehold, family/golden-visa angle, handover.
3. **dubai-off-plan-payment-plans** — H1 "Dubai Off-Plan Payment Plans Explained", no type filter (featured off-plan). Cover + **table**: 40/60, 50/50, 60/40, post-handover, 1% monthly — what each means, pros/cons, escrow safety. Link to /mortgage-calculator + /properties.
4. **dubai-mortgage-for-non-residents** — H1 "Dubai Mortgage for Non-Residents", no type filter. Cover: eligibility, LTV/down-payment for non-residents (~50%), rates, documents, bank vs developer finance. Strong link/CTA to **/mortgage-calculator**. FAQ on eligibility, deposit, rates.

## Tasks (TDD where pure; branch `feat/landing-pages`)
1. **`lib/landings.ts`** — type + `landingSlugs`/`getLanding` + `propertiesForLanding` + the 4 entries (content). `lib/landings.test.ts`: `propertiesForLanding` filters by type/area/maxPrice + caps count; `landingSlugs` unique; each landing has faq + required fields.
2. **`AreaFeaturedProperties`** — add optional `heading` prop (default = existing area wording) so it's reusable for landings (backward-compatible; area pages unchanged).
3. **`app/invest/[slug]/page.tsx`** — server: generateStaticParams + generateMetadata (canonical `https://worldwise.pro/invest/<slug>`) + JSON-LD (WebPage + FAQPage + BreadcrumbList via `<JsonLd>`), `notFound()` for unknown slug; renders `LandingClient`.
4. **`app/invest/[slug]/LandingClient.tsx`** — content + grid + conversion (mirror AreaPageClient; LeadModal source `leadSource`; MobileCtaBar; FloatingCTA; Footer).
5. **`app/sitemap.ts`** — add `landingSlugs` mapping.
6. **Docs** — CLAUDE.md: a "Commercial landing pages" architecture note + add `landing_*` to the lead `source` strings list.
7. **Verify** — `npm run build` passes (primary gate); the 4 `/invest/<slug>` prerender; `node --test --experimental-strip-types lib/landings.test.ts` green.
8. **Deploy** — rsync working tree → server `npm run build` + `pm2 restart` (these are real SSG pages — a rebuild is required); confirm the 4 URLs render + are in the sitemap.

## Non-goals
- No new lead-form component (reuse `useLeadSubmit`+`Honeypot` via existing forms). No CMS. No per-landing images beyond the shared hero/og. No automated content generation (these 4 are hand-authored + reviewed; future landings can be seeded from gap/discovery data manually).
