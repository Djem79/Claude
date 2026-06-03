# Conversion Wave 1 — Design Spec

**Date:** 2026-06-04
**Status:** Approved (design), pending implementation plan
**Origin:** Competitive teardown of metropolitan.realestate → "Wave 1" (highest-ROI, low-effort conversion + listing improvements).

## Goal

Lift lead conversion on the property surfaces and route homepage traffic into the funnel from the first screen, by porting the strongest, low-effort mechanics observed on a leading Dubai competitor — without losing our existing edges (multi-currency `PriceTag`, gross-yield badge, per-card WhatsApp, Golden Visa).

## Approved decisions (from brainstorming)

- **Mortgage anchor assumptions:** 25% down payment, 4.5% annual rate, 25-year term.
- **Anchor placement:** sticky bottom bar on the property page **and** a line beside the price.
- **Card data:** existing `Property` fields only — no new manual data entry (no baths/parking/size fields).
- **Intent-router tiles:** Catalog / Find-by-budget / Mortgage / Golden Visa.

## Data model (no schema changes)

Uses existing `Property` fields only: `priceAed`, `pricePerSqft?`, `developer`, `completionDate?` (handover), `paymentPlan?`, `bedrooms`, `type`, `status`, `grossYield?`, `qrImage?`, `permitNumber?`, `projectNumber?`. No new fields, no migration.

## Shared, pure, unit-tested helpers

1. **`lib/mortgage.ts`** — `estimateMonthly(priceAed, opts?) : number` (standard annuity formula) + `MORTGAGE_DEFAULTS = { downPct: 0.25, ratePct: 4.5, years: 25 }`. The amortization formula currently inside `MortgageCalculator.tsx` is extracted here and re-used by both the calculator and the anchor (single source of truth). Test: `lib/mortgage.test.ts` (node:test) — known-value cases + edge (0% rate, full down payment).
2. **`lib/format-price.ts`** — `compactAed(n) : string` → "AED 1.2M" / "AED 781k" / "AED 950" (no decimals below 1k). Test: `lib/format-price.test.ts`.

## Features

### 1. Mortgage affordability anchor ("from X AED/mo")
- **Line beside price** on `app/properties/[slug]/page.tsx`: under `PriceTag`, render `≈ AED {estimateMonthly(priceAed)} /mo with a mortgage` + sub-note "25% down · 4.5% · 25 yrs" + small link "Calculate →" → `/mortgage-calculator`. Hidden when `status === 'rent'`.
- **Sticky bar:**
  - Mobile: extend existing `components/MobileCtaBar.tsx` to include "from AED {monthly}/mo".
  - Desktop: a slim sticky strip at the bottom of the property detail showing the monthly figure + CTA "Get pre-approved" → opens `LeadModal` with `source: 'mortgage_anchor'`.
  - Must not overlap `FloatingCTA` (which is `hidden md:flex`) — the desktop strip sits above the footer; verify at 360/768/1280.

### 2. Price per sq.ft
- Card + detail: show `pricePerSqft` as "AED {n}/ft²" only when present. On detail it becomes a first-class entry in the facts strip. Derived unit size is intentionally NOT shown (avoid misleading estimates).

### 3. Intent-router band (`components/IntentRouter.tsx`)
- Rendered in `app/page.tsx` immediately after `<Hero />`. Four tiles (icon + label + one-line microcopy), 2×2 on mobile / 4-across on desktop, navy/gold palette, using existing button/utility classes:
  - **Browse properties** → `/properties`
  - **Find my property** (budget) → opens `QualifyingModal` (`source: 'qualify'`)
  - **Mortgage** → `/mortgage-calculator`
  - **Golden Visa** → `/golden-visa`
- Static links + one modal trigger; below the hero so no LCP impact.

### 4. DLD/RERA trust block (detail)
- Where `qrImage`/`permitNumber`/`projectNumber` already render on the property detail, add verification copy: "Verified with the Dubai Land Department (DLD) / RERA", show permit/project numbers prominently, and link to the official register `https://dubailand.gov.ae/` (the QR remains the canonical verifier). Render only when the data exists.

### 5. Property card enrichment (`components/PropertyCard.tsx`)
- Add a compact meta row: **bedrooms** (icon) · **type** · **developer** (small). Badges: **"Handover {completionDate}"** when present; **payment-plan** badge (e.g. "60/40") when present; **"AED {pricePerSqft}/ft²"** when present. For `status === 'off-plan'`, render the price as **"from {compactAed(priceAed)}"**.
- **Preserve existing edges:** `PriceTag` (AED + ≈ USD/EUR/GBP), gross-yield badge, Golden Visa badge, per-card WhatsApp deep-link (`source: property_card`).

## Lead source

New source string **`mortgage_anchor`** (anchor CTA). Add to the documented source list in `CLAUDE.md` (Conversion section). `Lead.source` is already typed as `string`, so no type change.

## Out of scope (later waves)

Gated floor-plan PDFs, payment-plan visualizer, developers directory, Popular-Searches SEO grid, multilingual, "project vs unit" content type, catalog filter chips. (Wave 2/3.)

## Verification

- `npm run build` passes; `npx eslint` clean on touched files.
- `node --test --experimental-strip-types lib/mortgage.test.ts lib/format-price.test.ts` green.
- Manual: homepage shows intent-router; `/properties` cards show new meta + badges and keep yield/WhatsApp/Golden-Visa/currency; one off-plan and one ready property detail show the anchor line + sticky bar + price/ft² + DLD block; 360px mobile — sticky bar doesn't overlap CTAs.

## Non-negotiables honored

All copy English; honeypot untouched on forms; `<JsonLd>` unchanged; no `data/` writes; deploy is a separate, explicit step.
