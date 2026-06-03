# Conversion Wave 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the highest-ROI conversion mechanics from metropolitan.realestate — a per-property mortgage affordability anchor, price-per-sqft, a homepage intent-router, a stronger DLD trust link — using only existing `Property` fields.

**Architecture:** One new pure module (`lib/mortgage.ts`, unit-tested) feeds both the existing homepage calculator and a new per-property "from X/mo" anchor. UI changes are small edits to existing server/client components plus two new small client components (`IntentRouter`, `MortgageAnchorBar`). No schema/data changes; deploy is a separate, explicit step.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind, node:test (type-stripping) for the pure helper. No component test runner exists — UI tasks verify via `npm run build` + manual checks.

**Spec:** `docs/superpowers/specs/2026-06-04-conversion-wave-1-design.md`

**Path note:** Repo parent dir contains a non-breaking space. Resolve git root in every shell step:
`GD="$(dirname "$(find /Users/dzhambulat/Documents -maxdepth 3 -name .git -type d 2>/dev/null | grep '/Claude/.git')")"; cd "$GD/worldwise"`
The Read/Edit/Write tools resolve to a phantom tree — make file edits via `python3`/heredoc against `"$GD/worldwise/..."`, and after each, confirm with `git -C "$GD" status --short`.

**Run commands** (PATH may need nvm): `export PATH="/Users/dzhambulat/.nvm/versions/node/v24.15.0/bin:$PATH"`.

---

## File Structure

- **Create** `lib/mortgage.ts` — pure mortgage math (`estimateMonthly`, `MORTGAGE_DEFAULTS`).
- **Create** `lib/mortgage.test.ts` — node:test for the above.
- **Create** `components/IntentRouter.tsx` — homepage intent tiles (client; holds QualifyingModal).
- **Create** `components/MortgageAnchorBar.tsx` — desktop centered sticky pill (client; holds LeadModal, source `mortgage_anchor`).
- **Modify** `components/MortgageCalculator.tsx` — use `estimateMonthly` for the monthly figure (DRY).
- **Modify** `app/properties/[slug]/page.tsx` — Price/sqft stat, inline "/mo" line, DLD live link, mount `MortgageAnchorBar`, pass monthly note to `MobileCtaBar`.
- **Modify** `components/MobileCtaBar.tsx` — optional `monthlyNote` line.
- **Modify** `components/PropertyCard.tsx` — add price/sqft to the meta row.
- **Modify** `app/page.tsx` — mount `<IntentRouter />` after `<Hero />`.
- **Modify** `CLAUDE.md` — document the `mortgage_anchor` lead source.

---

## Task 1: Pure mortgage helper (TDD)

**Files:** Create `lib/mortgage.ts`, Test `lib/mortgage.test.ts`

- [ ] **Step 1: Write the failing test** — create `lib/mortgage.test.ts`:

```ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { estimateMonthly, MORTGAGE_DEFAULTS } from './mortgage.ts'

test('defaults are 25% down, 4.5%, 25 years', () => {
  assert.deepEqual(MORTGAGE_DEFAULTS, { downPct: 0.25, ratePct: 4.5, years: 25 })
})

test('AED 2,000,000 at defaults ≈ 8,337/mo', () => {
  const m = estimateMonthly(2_000_000)
  assert.ok(Math.round(m) >= 8335 && Math.round(m) <= 8339, `got ${Math.round(m)}`)
})

test('zero interest splits the financed amount evenly', () => {
  assert.equal(estimateMonthly(1_200_000, { downPct: 0.25, ratePct: 0, years: 25 }), 900_000 / 300)
})

test('100% down (no loan) returns 0', () => {
  assert.equal(estimateMonthly(1_000_000, { downPct: 1 }), 0)
})

test('overriding opts changes the payment', () => {
  assert.ok(estimateMonthly(2_000_000, { downPct: 0.5 }) < estimateMonthly(2_000_000))
})
```

- [ ] **Step 2: Run test, verify it fails**

Run: `export PATH="/Users/dzhambulat/.nvm/versions/node/v24.15.0/bin:$PATH"; node --test --experimental-strip-types lib/mortgage.test.ts`
Expected: FAIL (cannot find module './mortgage.ts').

- [ ] **Step 3: Write minimal implementation** — create `lib/mortgage.ts`:

```ts
// Pure mortgage math, shared by the homepage MortgageCalculator and the per-property
// "from X/mo" affordability anchor. No React, no I/O — unit-tested.

export interface MortgageOpts {
  downPct?: number // fraction, e.g. 0.25 = 25% down
  ratePct?: number // annual interest rate %, e.g. 4.5
  years?: number   // term in years
}

// Defaults for the per-property anchor (agreed: 25% down / 4.5% / 25 yrs).
export const MORTGAGE_DEFAULTS = { downPct: 0.25, ratePct: 4.5, years: 25 } as const

// Monthly annuity payment (AED). Returns 0 when nothing is financed (e.g. 100% down).
export function estimateMonthly(priceAed: number, opts: MortgageOpts = {}): number {
  const downPct = opts.downPct ?? MORTGAGE_DEFAULTS.downPct
  const ratePct = opts.ratePct ?? MORTGAGE_DEFAULTS.ratePct
  const years = opts.years ?? MORTGAGE_DEFAULTS.years
  const loan = priceAed * (1 - downPct)
  if (loan <= 0) return 0
  const r = ratePct / 100 / 12
  const n = years * 12
  if (r === 0) return loan / n
  return (loan * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `node --test --experimental-strip-types lib/mortgage.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
GD="$(dirname "$(find /Users/dzhambulat/Documents -maxdepth 3 -name .git -type d 2>/dev/null | grep '/Claude/.git')")"
git -C "$GD" add worldwise/lib/mortgage.ts worldwise/lib/mortgage.test.ts
git -C "$GD" commit -m "feat(mortgage): pure estimateMonthly helper + defaults (25/4.5/25)"
```

---

## Task 2: DRY — calculator reuses estimateMonthly

**Files:** Modify `components/MortgageCalculator.tsx`

- [ ] **Step 1: Add the import** — after the existing imports, add:
`import { estimateMonthly } from '@/lib/mortgage'`

- [ ] **Step 2: Replace the inline monthly formula.** In the `calc` useMemo, replace these lines:

```ts
    const monthlyRate = rate / 100 / 12
    const n = termYears * 12
    const monthly =
      monthlyRate === 0
        ? loan / n
        : (loan * monthlyRate * Math.pow(1 + monthlyRate, n)) /
          (Math.pow(1 + monthlyRate, n) - 1)
```

with:

```ts
    const n = termYears * 12
    const monthly = estimateMonthly(price, { downPct: effectiveDown / 100, ratePct: rate, years: termYears })
```

(`n` is still used for `totalPaid = monthly * n`.)

- [ ] **Step 3: Build**

Run: `export PATH="/Users/dzhambulat/.nvm/versions/node/v24.15.0/bin:$PATH"; npm run build 2>&1 | grep -iE "Compiled successfully|error|Failed"`
Expected: "Compiled successfully", no errors. The displayed monthly figure must be unchanged for the same inputs.

- [ ] **Step 4: Commit**

```bash
GD="$(dirname "$(find /Users/dzhambulat/Documents -maxdepth 3 -name .git -type d 2>/dev/null | grep '/Claude/.git')")"
git -C "$GD" add worldwise/components/MortgageCalculator.tsx
git -C "$GD" commit -m "refactor(mortgage): calculator uses shared estimateMonthly"
```

---

## Task 3: Property detail — price/sqft stat, "/mo" line, DLD link

**Files:** Modify `app/properties/[slug]/page.tsx`

- [ ] **Step 1: Import the helper.** After `import PriceTag from '@/components/PriceTag'` add:
`import { estimateMonthly } from '@/lib/mortgage'`

- [ ] **Step 2: Add Price/sq.ft to the key-stats array.** In the stats array (currently Starting Price, Bedrooms, ROI, Gross Yield, Handover, Payment Plan), add after the Bedrooms entry:

```tsx
                  ...(property.pricePerSqft ? [{ label: 'Price / sq.ft', value: `AED ${property.pricePerSqft.toLocaleString('en-US')}` }] : []),
```

- [ ] **Step 3: Add the inline mortgage line** directly AFTER the closing `</div>` of the Key-stats grid (the `.map(...)` block). Render only for non-rent:

```tsx
              {property.status !== 'rent' && (
                <p className="-mt-6 text-sm text-gray-500">
                  ≈ <span className="text-navy font-medium">AED {Math.round(estimateMonthly(property.priceAed)).toLocaleString('en-US')}/mo</span> with a mortgage
                  <span className="text-gray-400"> · 25% down · 4.5% · 25 yrs</span>
                  {' '}<Link href="/mortgage-calculator" className="text-gold-accessible hover:underline">Estimate yours →</Link>
                </p>
              )}
```

- [ ] **Step 4: Add the DLD live verification link.** In the DLD block, replace this line:

```tsx
                      <p className="text-xs text-gray-400 pt-2">
                        Issued by Dubai Land Department (DLD) · Real Estate Regulatory Agency (RERA)
                      </p>
```

with:

```tsx
                      <p className="text-xs text-gray-400 pt-2">
                        Issued by Dubai Land Department (DLD) · Real Estate Regulatory Agency (RERA) ·{' '}
                        <a href="https://dubailand.gov.ae/en/" target="_blank" rel="noopener noreferrer" className="text-gold-accessible hover:underline">Verify on dubailand.gov.ae →</a>
                      </p>
```

- [ ] **Step 5: Build**

Run: `npm run build 2>&1 | grep -iE "Compiled successfully|error|Failed"`
Expected: "Compiled successfully".

- [ ] **Step 6: Commit**

```bash
GD="$(dirname "$(find /Users/dzhambulat/Documents -maxdepth 3 -name .git -type d 2>/dev/null | grep '/Claude/.git')")"
git -C "$GD" add "worldwise/app/properties/[slug]/page.tsx"
git -C "$GD" commit -m "feat(property): price/sqft stat, mortgage /mo line, DLD verify link"
```

---

## Task 4: Desktop sticky affordability pill

**Files:** Create `components/MortgageAnchorBar.tsx`, Modify `app/properties/[slug]/page.tsx`

- [ ] **Step 1: Create the component** `components/MortgageAnchorBar.tsx`:

```tsx
'use client'

import { useState } from 'react'
import LeadModal from './LeadModal'

// Desktop-only centered sticky pill (bottom-center) — leaves the bottom-right
// corner free for FloatingCTA (fixed bottom-6 right-6 z-40). z-30 keeps it below.
export default function MortgageAnchorBar({
  monthlyLabel,
  propertySlug,
  propertyTitle,
}: {
  monthlyLabel: string
  propertySlug?: string
  propertyTitle?: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <div className="hidden md:flex fixed bottom-6 left-1/2 -translate-x-1/2 z-30 items-center gap-4 bg-navy/95 backdrop-blur border border-gold/25 shadow-xl rounded-full pl-6 pr-2 py-2 text-white">
        <p className="text-sm whitespace-nowrap">
          Own this from <span className="font-serif text-gold text-lg">{monthlyLabel}</span>/mo
          <span className="text-white/45"> · 25% down · 4.5% · 25 yrs</span>
        </p>
        <button onClick={() => setOpen(true)} className="btn-primary py-2 px-5 text-sm rounded-full">
          Get pre-approved
        </button>
      </div>
      <LeadModal
        isOpen={open}
        onClose={() => setOpen(false)}
        source="mortgage_anchor"
        propertySlug={propertySlug}
        propertyTitle={propertyTitle}
        title="Get mortgage pre-approval"
        subtitle="Our advisors work with 15+ UAE banks to find your best rate."
        ctaLabel="Request pre-approval"
      />
    </>
  )
}
```

- [ ] **Step 2: Import + mount on the detail page.** In `app/properties/[slug]/page.tsx` add import after the MobileCtaBar import:
`import MortgageAnchorBar from '@/components/MortgageAnchorBar'`
Then, immediately before the existing `<MobileCtaBar ... />` near the end, add (non-rent only):

```tsx
      {property.status !== 'rent' && (
        <MortgageAnchorBar
          monthlyLabel={`AED ${Math.round(estimateMonthly(property.priceAed)).toLocaleString('en-US')}`}
          propertySlug={property.slug}
          propertyTitle={property.title}
        />
      )}
```

- [ ] **Step 3: Build**

Run: `npm run build 2>&1 | grep -iE "Compiled successfully|error|Failed"`
Expected: "Compiled successfully".

- [ ] **Step 4: Commit**

```bash
GD="$(dirname "$(find /Users/dzhambulat/Documents -maxdepth 3 -name .git -type d 2>/dev/null | grep '/Claude/.git')")"
git -C "$GD" add worldwise/components/MortgageAnchorBar.tsx "worldwise/app/properties/[slug]/page.tsx"
git -C "$GD" commit -m "feat(property): desktop sticky mortgage affordability pill (source mortgage_anchor)"
```

---

## Task 5: Mobile sticky bar shows the monthly figure

**Files:** Modify `components/MobileCtaBar.tsx`, `app/properties/[slug]/page.tsx`

- [ ] **Step 1: Add the `monthlyNote` prop + render it.** In `components/MobileCtaBar.tsx`, add `monthlyNote?: string` to the props type, then restructure the fixed container to a column with the note on top. Replace the container `<div ...>...</div>` (the one with `md:hidden fixed bottom-0`) so its children are wrapped:

```tsx
      <div
        className="md:hidden fixed bottom-0 inset-x-0 z-40 flex flex-col gap-1 bg-white/95 backdrop-blur border-t border-gray-200 px-3 py-2.5"
        style={{ paddingBottom: 'calc(0.625rem + env(safe-area-inset-bottom))' }}
      >
        {monthlyNote && (
          <p className="text-[11px] text-gray-500 text-center leading-tight">{monthlyNote}</p>
        )}
        <div className="flex gap-2">
          <button onClick={() => setOpen(true)} className="btn-primary flex-1 py-3 text-base">
            {enquireLabel}
          </button>
          <a
            href={waLink(waMessage)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => track('whatsapp_click', { source: 'mobile_bar', ...(propertyTitle ? { property: propertyTitle } : {}) })}
            aria-label="Chat on WhatsApp"
            className="flex items-center justify-center w-14 rounded-sm bg-[#25D366] text-white shrink-0"
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/></svg>
          </a>
        </div>
      </div>
```

- [ ] **Step 2: Pass the note from the detail page.** In `app/properties/[slug]/page.tsx`, on the `<MobileCtaBar ... />`, add this prop (non-rent only; use a ternary so rentals omit it):

```tsx
        monthlyNote={property.status !== 'rent' ? `Own from AED ${Math.round(estimateMonthly(property.priceAed)).toLocaleString('en-US')}/mo (mortgage)` : undefined}
```

- [ ] **Step 3: Build**

Run: `npm run build 2>&1 | grep -iE "Compiled successfully|error|Failed"`
Expected: "Compiled successfully".

- [ ] **Step 4: Commit**

```bash
GD="$(dirname "$(find /Users/dzhambulat/Documents -maxdepth 3 -name .git -type d 2>/dev/null | grep '/Claude/.git')")"
git -C "$GD" add worldwise/components/MobileCtaBar.tsx "worldwise/app/properties/[slug]/page.tsx"
git -C "$GD" commit -m "feat(property): mobile sticky bar shows from-AED/mo affordability note"
```

---

## Task 6: Property card — price per sq.ft

**Files:** Modify `components/PropertyCard.tsx`

- [ ] **Step 1: Add price/sqft to the meta row.** In the meta `<div className="flex flex-wrap gap-3 ...">` block, add a new span after the `bedrooms` span:

```tsx
          {property.pricePerSqft && <span>📐 AED {property.pricePerSqft.toLocaleString('en-US')}/ft²</span>}
```

- [ ] **Step 2: Build**

Run: `npm run build 2>&1 | grep -iE "Compiled successfully|error|Failed"`
Expected: "Compiled successfully".

- [ ] **Step 3: Commit**

```bash
GD="$(dirname "$(find /Users/dzhambulat/Documents -maxdepth 3 -name .git -type d 2>/dev/null | grep '/Claude/.git')")"
git -C "$GD" add worldwise/components/PropertyCard.tsx
git -C "$GD" commit -m "feat(card): show price per sq.ft when present"
```

---

## Task 7: Homepage intent-router band

**Files:** Create `components/IntentRouter.tsx`, Modify `app/page.tsx`

- [ ] **Step 1: Create the component** `components/IntentRouter.tsx`:

```tsx
'use client'

import Link from 'next/link'
import { useState } from 'react'
import QualifyingModal from './QualifyingModal'

export default function IntentRouter() {
  const [open, setOpen] = useState(false)
  const card = 'flex flex-col items-center text-center gap-2 bg-white rounded-sm border border-gray-200 px-4 py-6 hover:border-gold hover:shadow-md transition-all'
  return (
    <section className="bg-[#F8F8F6] py-10 md:py-12">
      <div className="max-w-6xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-5">
        <Link href="/properties" className={card}>
          <span className="text-3xl">🏙</span>
          <span className="font-serif text-lg text-navy">Browse Properties</span>
          <span className="text-xs text-gray-500">Explore our Dubai portfolio</span>
        </Link>
        <button type="button" onClick={() => setOpen(true)} className={card}>
          <span className="text-3xl">🎯</span>
          <span className="font-serif text-lg text-navy">Find My Property</span>
          <span className="text-xs text-gray-500">Matched to your budget</span>
        </button>
        <Link href="/mortgage-calculator" className={card}>
          <span className="text-3xl">📊</span>
          <span className="font-serif text-lg text-navy">Mortgage Calculator</span>
          <span className="text-xs text-gray-500">Estimate monthly payments</span>
        </Link>
        <Link href="/golden-visa" className={card}>
          <span className="text-3xl">🛂</span>
          <span className="font-serif text-lg text-navy">Golden Visa</span>
          <span className="text-xs text-gray-500">10-year UAE residency</span>
        </Link>
      </div>
      <QualifyingModal isOpen={open} onClose={() => setOpen(false)} source="qualify" />
    </section>
  )
}
```

- [ ] **Step 2: Mount it after the hero.** In `app/page.tsx`, add the import with the other component imports:
`import IntentRouter from '@/components/IntentRouter'`
Then insert `<IntentRouter />` between `<Hero />` and `<TrustBar />`:

```tsx
        <Hero />
        <IntentRouter />
        <TrustBar />
```

- [ ] **Step 3: Build**

Run: `npm run build 2>&1 | grep -iE "Compiled successfully|error|Failed"`
Expected: "Compiled successfully".

- [ ] **Step 4: Commit**

```bash
GD="$(dirname "$(find /Users/dzhambulat/Documents -maxdepth 3 -name .git -type d 2>/dev/null | grep '/Claude/.git')")"
git -C "$GD" add worldwise/components/IntentRouter.tsx worldwise/app/page.tsx
git -C "$GD" commit -m "feat(home): intent-router band under hero (Browse/Find/Mortgage/Golden Visa)"
```

---

## Task 8: Document the new lead source

**Files:** Modify `CLAUDE.md`

- [ ] **Step 1:** In the "Lead `source` strings in use" list in `CLAUDE.md`, add `mortgage_anchor` to the on-site CTA group (next to `mortgage_calculator`). Keep the prose grouping accurate (it's a property-page CTA set by `MortgageAnchorBar`).

- [ ] **Step 2: Commit**

```bash
GD="$(dirname "$(find /Users/dzhambulat/Documents -maxdepth 3 -name .git -type d 2>/dev/null | grep '/Claude/.git')")"
git -C "$GD" add CLAUDE.md
git -C "$GD" commit -m "docs: add mortgage_anchor lead source"
```

---

## Task 9: Full verification

- [ ] **Step 1: Unit tests** — `node --test --experimental-strip-types lib/*.test.ts` → all pass (incl. mortgage).
- [ ] **Step 2: Build + lint** — `npm run build` "Compiled successfully"; `npx eslint components/IntentRouter.tsx components/MortgageAnchorBar.tsx components/MortgageCalculator.tsx components/MobileCtaBar.tsx components/PropertyCard.tsx lib/mortgage.ts "app/properties/[slug]/page.tsx" app/page.tsx` → exit 0.
- [ ] **Step 3: Manual (dev server `npm run dev`)**
  - `/` → intent-router band shows under hero (2×2 mobile, 4-across desktop); "Find My Property" opens QualifyingModal; other tiles navigate.
  - `/properties` → cards show price/ft² where present; yield/Golden Visa/WhatsApp/currency intact.
  - An off-plan property detail → key stats include "Price / sq.ft"; inline "≈ AED X/mo … Estimate yours →" present; DLD block has "Verify on dubailand.gov.ae →"; desktop centered pill visible bottom-center and does NOT overlap the bottom-right FloatingCTA at 1280px; resize to 360px → mobile sticky bar shows "Own from AED X/mo" and Enquire/WhatsApp aren't clipped.
  - A `rent` property → no /mo line, no pill, no mobile note.
- [ ] **Step 4:** Report results. Deploy is a SEPARATE step — only on explicit user request (backup → rsync → build → restart per CLAUDE.md).

---

## Self-Review (done)

- **Spec coverage:** mortgage anchor (T1–T5), price/sqft (T3 detail, T6 card), intent-router (T7), DLD link (T3), lead source (T8). All five Wave-1 items covered.
- **Scope trim vs spec:** `lib/format-price.ts`/`compactAed` dropped (YAGNI — PriceTag + `toLocaleString` already cover all formatting). Card was already rich (beds/payment-plan/handover/yield present), so T6 narrowed to price/sqft only. Desktop sticky implemented as a bottom-center pill (not full-width) to avoid the `FloatingCTA` bottom-right corner.
- **Type consistency:** `estimateMonthly(priceAed, opts)` / `MORTGAGE_DEFAULTS` used identically in T1/T2/T3/T4/T5; `MortgageAnchorBar` prop `monthlyLabel`, `MobileCtaBar` prop `monthlyNote` — names consistent across tasks.
- **No placeholders:** every code step is complete and copy-paste ready.
