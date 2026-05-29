# Worldwise Tier 2 Conversion — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Add higher-leverage, investor-specific conversion features on top of the shipped Tier 1: Golden Visa hook, a qualifying multi-step lead form, a gated lead magnet, and ROI/payment-plan data surfaced on listings.

**Scope note:** The "real agent presence on detail page" item from the original Tier 2 outline is **dropped** per owner. Each task below is self-contained and shippable on its own.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind (navy/gold). File-based JSON data; admin `PropertyForm`. `lib/analytics.ts` `track()`. Shipped Tier 1 primitives: `lib/whatsapp.ts`, `LeadModal` (has `ctaLabel`, honeypot `_hp`, budget select), `SocialProofStrip`, `MobileCtaBar`.

**Project constraints (must hold):** honeypot `_hp` on every form; name+phone required/minimal; new `source` strings added to CLAUDE.md taxonomy; no external image URLs; deploy from `main`; no test runner → verify via `npm run build` + live checks. Area/landing pages follow the `lib/areas.ts` SSG pattern.

**Recommended execution order:** Task 1 (Property fields — unlocks 2 & 5) → Task 2 (Golden Visa) → Task 5 (ROI/payment-plan display) → Task 3 (qualifying form) → Task 4 (lead magnet). Tasks 2/3/4 are independent of each other.

---

## Task 1 — Add optional investor fields to `Property`

**Why first:** Golden Visa badge and ROI/payment-plan display read these. All optional → no migration; admin fills them incrementally; existing listings render unchanged.

**Files:** `worldwise/types/index.ts` (add fields), `worldwise/app/admin/property/PropertyForm.tsx` (or wherever the form lives — `find worldwide/app/admin -name 'PropertyForm*'`), `worldwise/app/api/properties/route.ts` + `[id]/route.ts` (accept/persist new fields if they whitelist keys).

- [ ] Add to the `Property` interface in `types/index.ts`:
  - `grossYield?: number` — annual gross rental yield %, e.g. `7.5`.
  - `paymentPlan?: string` — already exists? `grep -n "paymentPlan" worldwise/types/index.ts` first; the property detail page already references `property.paymentPlan`, so it likely EXISTS — if so, only add `grossYield`.
- [ ] Add the field(s) to the admin `PropertyForm` (number input for `grossYield`, text for `paymentPlan` if missing), matching existing field markup. Keep them optional.
- [ ] If the create/update API handlers explicitly pick fields, add the new key(s); if they spread the body, no change needed (verify).
- [ ] Verify: `npm run build`; in dev, edit a property, set `grossYield`, save, confirm it persists (admin is section-guarded — test with owner login) and the value round-trips.
- [ ] Commit: `feat(property): optional grossYield field for investor display`

---

## Task 2 — Golden Visa badge + `/golden-visa` landing page

**Why:** Residency is a top motivator for international buyers; AED 2M threshold is derivable from `priceAed` — no data entry needed. Mirrors the `lib/areas.ts` SSG + JSON-LD + lead-form pattern already proven.

**Files:** `worldwise/lib/golden-visa.ts` (constants + `qualifies(priceAed)`), `worldwise/components/PropertyCard.tsx` (+ badge), `worldwise/app/properties/[slug]/page.tsx` (+ badge in header), `worldwise/app/golden-visa/page.tsx` (new SSG landing), `worldwise/app/golden-visa/GoldenVisaClient.tsx` (LeadModal owner), `worldwise/app/sitemap.ts` (add URL), `worldwise/CLAUDE.md` (+ `golden_visa` source).

- [ ] `lib/golden-visa.ts`: `export const GOLDEN_VISA_AED = 2_000_000; export function qualifiesForGoldenVisa(priceAed: number) { return priceAed >= GOLDEN_VISA_AED }`.
- [ ] Badge on `PropertyCard` (top-left badge stack) and on the detail header, shown when `qualifiesForGoldenVisa(property.priceAed)`: gold-on-navy `badge` reading `Golden Visa Eligible`. Reuse existing `badge` utility; ensure WCAG (navy text on gold or gold-accessible).
- [ ] `/golden-visa` page (server component): hero (value prop: "Own property from AED 2M → 10-year UAE residency"), how-it-works steps, eligible-listings grid (`getProperties().filter(p => qualifiesForGoldenVisa(p.priceAed))` → `PropertyCard`), FAQ (5 Q&A), JSON-LD `FAQPage` + `BreadcrumbList`, and a `LeadCaptureSection`/`LeadModal` with `source="golden_visa"`. Client wrapper owns modal state (mirror `AreaPageClient`). Mount `<MobileCtaBar enquireSource="golden_visa" enquireLabel="Check Eligibility" waMessage="Hi Worldwise, am I eligible for the Golden Visa through property?" />` and `<FloatingCTA/>` + `<Footer/>`.
- [ ] `generateMetadata` (title/desc/canonical/OG) + `export const revalidate = 60`. Hero image must be local (`public/images/`).
- [ ] Add `https://worldwise.pro/golden-visa` to `app/sitemap.ts`.
- [ ] Add `golden_visa` to the CLAUDE.md source taxonomy (group 1).
- [ ] Verify: `npm run build`; live `/golden-visa` returns 200, shows only ≥AED 2M listings, badge appears on those cards site-wide, FAQ JSON-LD validates.
- [ ] Commit(s): `feat(golden-visa): eligibility helper + badge` / `feat(golden-visa): /golden-visa landing page + sitemap`

---

## Task 5 — Surface ROI/yield + payment-plan on cards & detail

**Why:** The investor's primary decision metrics. Reads Task 1 fields; renders only when present (graceful for empty data).

**Files:** `worldwise/components/PropertyCard.tsx`, `worldwise/app/properties/[slug]/page.tsx`.

- [ ] `PropertyCard`: if `property.grossYield`, show a small yield pill near the price (e.g. `7.5% yield` in gold-accessible). Note: a `roi` ROI badge already exists top-right — keep; `grossYield` is the rental-yield line. If `property.paymentPlan`, the card already shows `📋 {paymentPlan}` — leave or restyle as a badge.
- [ ] Detail page: the key-stats grid already conditionally renders `Est. ROI` and `Payment Plan`; add `Gross Yield` stat when `grossYield` present. (Confirm against current `page.tsx` stat array.)
- [ ] Verify: `npm run build`; a listing with `grossYield` set shows the metric on card + detail; one without shows no empty slot.
- [ ] Commit: `feat(property): show gross yield on cards and detail`

---

## Task 3 — Multi-step qualifying lead form

**Why:** A progressive form feels lighter and captures budget/area/timeline → higher lead quality and fewer junk viewings. Still ends on name+phone; honeypot retained.

**Files:** `worldwise/components/QualifyingModal.tsx` (new), `worldwise/app/api/leads/route.ts` (accept extra optional fields), call sites that opt in (e.g. a homepage hero secondary CTA or a dedicated button), `worldwise/CLAUDE.md` (note extra fields).

- [ ] `QualifyingModal`: 3 steps — (1) budget (reuse `LeadModal` `BUDGETS`), (2) ready vs off-plan + preferred area (areas from `lib/areas.ts`), (3) name + phone (required) + honeypot `_hp`. Progress indicator; Back/Next; final POST to `/api/leads` with `{ name, phone, source, budget, propertyType, area, _hp }`. On success reuse the LeadModal success UI/Telegram bonus. `track('lead_form_submit', { source })`.
- [ ] `/api/leads`: accept optional `propertyType`, `area` (persist into the lead record / notes). Keep honeypot + phone validation + rate limit intact.
- [ ] Wire one entry point with `source="qualify"` (e.g. a "Find my investment" CTA in the hero or `WhyWorldwise`). Add `qualify` to CLAUDE.md taxonomy.
- [ ] Verify: `npm run build`; complete the 3-step flow in dev → lead saved with budget/type/area; honeypot still blocks bots; refresh resets steps.
- [ ] Commit(s): API change, then component + wiring.

---

## Task 4 — Gated lead magnet ("Dubai Investment Guide")

**Why:** High-intent investors trade contact info for credible data; cheap, high-converting; captures blog/area traffic. Extends the `/mortgage-calculator` minimal-nav landing pattern.

**Files:** `worldwise/public/files/dubai-investment-guide.pdf` (asset — owner provides or we draft + export), `worldwise/app/guide/page.tsx` + client wrapper (gated form), `worldwise/app/sitemap.ts`, `worldwise/CLAUDE.md` (+ `lead_magnet_guide`).

- [ ] `/guide` landing (minimal nav per UX rule): value prop + cover image (local) + a name+phone form (honeypot) with `source="lead_magnet_guide"`. On submit → POST `/api/leads`, then reveal/redirect to the PDF (`/files/dubai-investment-guide.pdf`). The static `/files/` path is already used for lead attachments — confirm public files under `public/files/` are served (note CLAUDE.md excludes `public/files/` from rsync, so the PDF must be uploaded to the server separately or that exclude adjusted for this asset).
- [ ] Add `/guide` to sitemap; add `lead_magnet_guide` to taxonomy. Link to `/guide` from blog article footers / `BlogPreview`.
- [ ] Verify: `npm run build`; submit gated form in dev → lead saved, PDF served; on server, confirm the PDF is present (deploy caveat re `public/files/` exclude).
- [ ] Commit(s): page + wiring (+ doc).

**Open input:** the actual guide PDF content (owner-provided, or draft via the content skills and export to PDF).

---

## Self-Review notes
- Spec coverage: all Tier-2 items except the dropped live-agent are tasked. Property fields (Task 1) gate Tasks 2/5.
- Constraints: honeypot + name/phone preserved in Tasks 3/4; new sources (`golden_visa`, `qualify`, `lead_magnet_guide`) enumerated for CLAUDE.md; local-only images/PDF; `public/files/` rsync-exclude flagged for Task 4.
- Open inputs: (a) whether listings will carry `grossYield` (Task 1 — optional either way); (b) the guide PDF (Task 4).
