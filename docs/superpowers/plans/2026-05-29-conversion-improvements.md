# Worldwise Conversion & Usability Improvements — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lift lead-capture conversion on worldwise.pro by adding mobile-first, WhatsApp-first, trust-rich conversion patterns drawn from best-in-class real-estate and design sites — without rebuilding what already works.

**Architecture:** Incremental component-level changes on the existing Next.js 14 App Router + Tailwind stack (navy/gold palette). Tier 1 reuses existing components (`FloatingCTA`, `LeadModal`, `PropertyCard`, `globals.css`) and adds two small new components. No new data fields or DB. Tier 2/3 outlined separately (some need new `Property` fields).

**Tech Stack:** Next.js 14 (App Router), TypeScript, Tailwind CSS, `lib/analytics.ts` `track()` (GA4), file-based JSON data.

**Project constraints (from CLAUDE.md — must hold for every task):**
- Every lead form keeps the hidden honeypot `<input ref={hpRef} />` and sends `_hp` in the POST body.
- Lead forms stay minimal: **name + phone** required (email/budget optional only).
- Keep the `source` taxonomy consistent; new CTAs add **new** `source` strings (listed per task) — update the CLAUDE.md taxonomy list when added.
- No external image URLs (developer logos must live in `public/images/`).
- No test runner exists → verification = `npm run build` + live curl/visual check.
- Deploy from `main` only (rsync deploys the working tree; see CLAUDE.md deploy caution). Work on a feature branch, open a PR against `claude`, merge to `main`, then deploy from `main`.

**Verification baseline (run once before starting):**
```bash
export PATH="/Users/dzhambulat/.nvm/versions/node/v24.15.0/bin:$PATH"
cd worldwise && npm run build   # must pass clean before any change
```

---

## File Structure

**New files (Tier 1):**
- `worldwise/components/MobileCtaBar.tsx` — client component, sticky bottom bar (Enquire + WhatsApp), shown on property detail + area pages.
- `worldwise/components/SocialProofStrip.tsx` — server component, compact trust row (rating + transaction volume + developer logos) for placement next to lead forms.
- `worldwise/lib/whatsapp.ts` — tiny pure helper that builds a prefilled `wa.me` link (DRY: used by `FloatingCTA`, `PropertyCard`, `MobileCtaBar`, `LeadModal`).

**Modified files (Tier 1):**
- `worldwise/app/globals.css` — add `--gold-dark` token + `.text-gold-accessible` utility; fix gold-on-light text contrast.
- `worldwise/components/PropertyCard.tsx` — add per-card WhatsApp button (prefilled with property title).
- `worldwise/components/LeadModal.tsx` — add a secondary WhatsApp CTA inside the form; accept an optional `ctaLabel` for action-specific buttons.
- `worldwise/components/FloatingCTA.tsx` — use the shared `lib/whatsapp.ts` helper (DRY).
- `worldwise/app/properties/[slug]/page.tsx` — render `<MobileCtaBar>` + `<SocialProofStrip>`; pass action-specific CTA labels/sources.
- `worldwise/app/[area]/AreaPageClient.tsx` — render `<MobileCtaBar>`.
- `worldwise/components/LeadCaptureSection.tsx` — render `<SocialProofStrip>` above the form.
- `worldwise/CLAUDE.md` — add new `source` strings to the taxonomy list.

**Assets to add:**
- `worldwise/public/images/developers/{emaar,damac,sobha,nakheel,meraas}.svg` (or `.png`) — partner logos (must be locally hosted; obtain official brand assets).

---

## Tier 1 — Quick Wins (high impact, low effort)

### Task 1: Shared WhatsApp link helper

**Files:**
- Create: `worldwise/lib/whatsapp.ts`

- [ ] **Step 1: Create the helper**

```ts
// Builds a prefilled WhatsApp deep link. Number falls back to the same default
// used by FloatingCTA. Keep messages short and URL-encoded.
const DEFAULT_WA = '971506960435'

export function waNumber(): string {
  return process.env.NEXT_PUBLIC_WHATSAPP ?? DEFAULT_WA
}

export function waLink(message: string): string {
  return `https://wa.me/${waNumber()}?text=${encodeURIComponent(message)}`
}

/** Prefilled message for a specific property enquiry. */
export function waPropertyMessage(title: string): string {
  return `Hi Worldwise, I'm interested in "${title}". Please send details.`
}
```

- [ ] **Step 2: Build**

Run: `cd worldwise && npm run build`
Expected: PASS (new module compiles; nothing imports it yet).

- [ ] **Step 3: Commit**

```bash
git add worldwise/lib/whatsapp.ts
git commit -m "feat(lead): shared prefilled WhatsApp link helper"
```

---

### Task 2: Accessible gold text (WCAG contrast fix)

**Context:** `.btn-primary` is already `bg-gold text-navy` — navy-on-gold passes, leave it. The real failure is **gold used as text on light backgrounds** (section labels, `Read More`, stat values, `text-gold` on white/`--bg`): `#C9A84C` on `#F8F8F6` ≈ 2.0:1, fails WCAG AA (needs 4.5:1 for normal text). Introduce a darker gold for text-on-light and swap the offending usages.

**Files:**
- Modify: `worldwise/app/globals.css`
- Modify (find/replace): components using `text-gold` on light backgrounds (e.g. `BlogPreview.tsx`, `app/blog/page.tsx`, `components/*Section*.tsx`, `Hero.tsx` stat labels are on dark — those are fine).

- [ ] **Step 1: Add a darker gold token + utility**

In `worldwise/app/globals.css`, add to `:root`:
```css
  --gold-dark: #8A6D1F; /* ~4.5:1 on #F8F8F6 — gold for text on light bg */
```
And inside `@layer components`:
```css
  /* Use for gold-colored TEXT on light backgrounds (labels, links, stats).
     Plain `text-gold` only on dark/navy backgrounds where contrast passes. */
  .text-gold-accessible {
    color: var(--gold-dark);
  }
```

- [ ] **Step 2: Verify the chosen hex passes AA**

Confirm `#8A6D1F` on `#F8F8F6` ≥ 4.5:1 (e.g. via any contrast checker). If short, darken toward `#7A5F18`. Record the ratio in the commit message.

- [ ] **Step 3: Swap offending usages**

Replace `text-gold` → `text-gold-accessible` ONLY where the background is light. Concrete known spots:
- `worldwise/components/BlogPreview.tsx` — the eyebrow label `text-gold` (line ~20) and "All Articles →" / "Read More →" gold text on white.
- `worldwise/app/blog/page.tsx` — "Read More →" span.
- Any `*Section*.tsx` eyebrow labels rendered on white/`--bg` (grep below).

Find them:
```bash
cd worldwise && grep -rn "text-gold\b" components app | grep -viE "bg-navy|bg-gold|/images|text-white"
```
Leave gold-on-navy/dark usages untouched.

- [ ] **Step 4: Build + visual check**

Run: `cd worldwise && npm run build`
Then visual: the eyebrow labels and "Read More" should now be a deeper, clearly-readable gold on white sections; gold-on-navy (hero stats, nav) unchanged.

- [ ] **Step 5: Commit**

```bash
git add worldwise/app/globals.css worldwise/components worldwise/app/blog/page.tsx
git commit -m "fix(a11y): darker gold for text on light backgrounds (WCAG AA)"
```

---

### Task 3: Per-card WhatsApp button

**Files:**
- Modify: `worldwise/components/PropertyCard.tsx`

**Approach:** Add a small WhatsApp icon button in the card's price/CTA row, beside "View Details". It is an `<a>` (not nested in the card image `Link`), prefilled with the property title, and fires `track('whatsapp_click', { source: 'property_card', property })`. New `source` string: **`property_card`**.

- [ ] **Step 1: Add imports + button**

At top of `PropertyCard.tsx`:
```tsx
import { waLink, waPropertyMessage } from '@/lib/whatsapp'
import { track } from '@/lib/analytics'
```
In the CTA row (currently the `<div className="flex items-center justify-between pt-4 border-t border-gray-100">` containing the price and the "View Details" `Link`), replace the single "View Details" link with a two-button group:
```tsx
          <div className="flex items-center gap-2">
            <a
              href={waLink(waPropertyMessage(property.title))}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => track('whatsapp_click', { source: 'property_card', property: property.title })}
              aria-label={`WhatsApp about ${property.title}`}
              className="flex items-center justify-center w-11 h-11 rounded-sm bg-[#25D366] text-white hover:opacity-90 transition-opacity shrink-0"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/></svg>
            </a>
            <Link
              href={`/properties/${property.slug}`}
              className="btn-outline-gold text-sm px-5 py-2.5"
            >
              View Details
            </Link>
          </div>
```
(The WhatsApp button is 44×44px — meets the ≥44px tap-target rule.)

- [ ] **Step 2: Build**

Run: `cd worldwise && npm run build`
Expected: PASS.

- [ ] **Step 3: Visual check (dev)**

Run `npm run dev`, open `/properties`, confirm each card shows a green WhatsApp button + "View Details"; clicking WhatsApp opens `wa.me` with the property title prefilled; image/title still navigate to the detail page (no nested-anchor warning in console).

- [ ] **Step 4: Commit**

```bash
git add worldwise/components/PropertyCard.tsx
git commit -m "feat(lead): per-card WhatsApp button with prefilled property message"
```

---

### Task 4: Mobile sticky bottom CTA bar

**Files:**
- Create: `worldwise/components/MobileCtaBar.tsx`
- Modify: `worldwise/app/properties/[slug]/page.tsx`
- Modify: `worldwise/app/[area]/AreaPageClient.tsx`

**Approach:** A `mobile-only` (`md:hidden`) fixed bottom bar with two thumb-zone actions: **Enquire** (opens the existing `LeadModal` via a client wrapper) and **WhatsApp** (prefilled). Respects iOS safe area. Shown on the two warmest page types. Does not duplicate `FloatingCTA` — to avoid stacking, `FloatingCTA` is hidden on mobile where the bar is present (see Step 4).

New `source` strings: **`mobile_bar`** (Enquire), WhatsApp uses `track('whatsapp_click', { source: 'mobile_bar' })`.

- [ ] **Step 1: Create the component**

```tsx
'use client'

import { useState } from 'react'
import LeadModal from './LeadModal'
import { waLink } from '@/lib/whatsapp'
import { track } from '@/lib/analytics'

export default function MobileCtaBar({
  enquireSource,
  enquireLabel = 'Enquire Now',
  waMessage,
  propertySlug,
  propertyTitle,
}: {
  enquireSource: string
  enquireLabel?: string
  waMessage: string
  propertySlug?: string
  propertyTitle?: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <div
        className="md:hidden fixed bottom-0 inset-x-0 z-40 flex gap-2 bg-white/95 backdrop-blur border-t border-gray-200 px-3 py-2.5"
        style={{ paddingBottom: 'calc(0.625rem + env(safe-area-inset-bottom))' }}
      >
        <button
          onClick={() => setOpen(true)}
          className="btn-primary flex-1 py-3 text-base"
        >
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
      <LeadModal
        isOpen={open}
        onClose={() => setOpen(false)}
        source={enquireSource}
        propertySlug={propertySlug}
        propertyTitle={propertyTitle}
      />
    </>
  )
}
```
(The bar lives in `app/properties/[slug]/` next to `LeadModal`? No — `LeadModal` is at `components/LeadModal.tsx`; import path is `@/components/LeadModal` if the file sits in `components/`. **Place `MobileCtaBar.tsx` in `worldwise/components/` and import `LeadModal` from `./LeadModal`.**)

- [ ] **Step 2: Mount on property detail**

In `worldwise/app/properties/[slug]/page.tsx`, import and render before `</>`/`<Footer/>`:
```tsx
import MobileCtaBar from '@/components/MobileCtaBar'
import { waPropertyMessage } from '@/lib/whatsapp'
// ...inside the returned JSX, after </main> or near Footer:
<MobileCtaBar
  enquireSource="property_enquiry"
  enquireLabel="Enquire Now"
  waMessage={waPropertyMessage(property.title)}
  propertySlug={property.slug}
  propertyTitle={property.title}
/>
```

- [ ] **Step 3: Mount on area pages**

In `worldwise/app/[area]/AreaPageClient.tsx`, render the bar with the area's lead source:
```tsx
import MobileCtaBar from '@/components/MobileCtaBar'
// source mirrors the page's existing area_<slug_underscored> source:
<MobileCtaBar
  enquireSource={`area_${area.slug.replace(/-/g, '_')}`}
  enquireLabel={`Invest in ${area.name}`}
  waMessage={`Hi Worldwise, I'm interested in investing in ${area.name}, Dubai.`}
/>
```
(Confirm `AreaPageClient` receives `area`; it already owns `LeadModal` state per CLAUDE.md.)

- [ ] **Step 4: Prevent FAB/bar overlap on mobile**

In `worldwise/components/FloatingCTA.tsx`, add `hidden md:flex` to the FAB container so on mobile the sticky bar is the single CTA and on desktop the FABs remain:
Change `className="fixed bottom-6 right-6 z-40 flex flex-col gap-3 items-end"` → `className="fixed bottom-6 right-6 z-40 hidden md:flex flex-col gap-3 items-end"`.
(Desktop keeps FABs; mobile uses the bar. Both still expose WhatsApp + consultation.)

- [ ] **Step 5: Build + responsive check**

Run: `cd worldwise && npm run build`
Then `npm run dev`, open `/properties/<slug>` and `/dubai-marina` at mobile width (≤767px): a bottom bar with "Enquire"/"Invest in …" + WhatsApp is pinned, sits above the home indicator, and the desktop FABs are hidden. At ≥768px the bar disappears and FABs return.

- [ ] **Step 6: Commit**

```bash
git add worldwise/components/MobileCtaBar.tsx worldwise/app/properties/[slug]/page.tsx worldwise/app/[area]/AreaPageClient.tsx worldwise/components/FloatingCTA.tsx
git commit -m "feat(lead): mobile sticky bottom CTA bar on property & area pages"
```

---

### Task 5: WhatsApp + action-specific CTA inside LeadModal; DRY FloatingCTA

**Files:**
- Modify: `worldwise/components/LeadModal.tsx`
- Modify: `worldwise/components/FloatingCTA.tsx`

**Approach:** (a) Add an optional `ctaLabel` prop so callers can render action-specific buttons ("Get Payment Plan", "Book a Viewing", "Get ROI Breakdown"). (b) Add a secondary WhatsApp link under the submit button as an alternative low-friction path. (c) Point `FloatingCTA`'s WhatsApp at `lib/whatsapp.ts` (DRY).

- [ ] **Step 1: Add `ctaLabel` prop + WhatsApp alt in LeadModal**

In `LeadModal.tsx` props add `ctaLabel?: string` (default `'Request Consultation'`). Use it as the submit button text:
```tsx
{loading ? 'Sending...' : ctaLabel}
```
Under the privacy line, add a WhatsApp alternative:
```tsx
import { waLink } from '@/lib/whatsapp'
// ...after the privacy <p>:
<a
  href={waLink(propertyTitle ? `Hi Worldwise, I'm interested in "${propertyTitle}".` : "Hi Worldwise, I'd like a consultation about Dubai property.")}
  target="_blank"
  rel="noopener noreferrer"
  onClick={() => track('whatsapp_click', { source, ...(propertyTitle ? { property: propertyTitle } : {}) })}
  className="mt-3 flex items-center justify-center gap-2 w-full rounded-sm py-3 text-sm font-medium border border-[#25D366] text-[#1c9e4d] hover:bg-[#25D366]/10 transition-colors"
>
  Or message us on WhatsApp
</a>
```
(`#1c9e4d` is a WCAG-safe green for text on white.)

- [ ] **Step 2: DRY FloatingCTA**

In `FloatingCTA.tsx`, replace the inline `wa` constant + hard-coded href with the helper:
```tsx
import { waLink } from '@/lib/whatsapp'
// remove: const wa = process.env.NEXT_PUBLIC_WHATSAPP ?? '971506960435'
// href becomes:
href={waLink("Hi Worldwise, I'm interested in Dubai property.")}
```

- [ ] **Step 3: Wire action-specific CTAs on the property detail page**

On `/properties/[slug]`, the embedded `PropertyEnquiryForm` (or a `LeadModal` trigger) gets a context label. Where the detail page opens a modal/form for the unit, pass `ctaLabel="Get Payment Plan & ROI"` and `source="property_enquiry"`. If adding distinct buttons (e.g. a secondary "Book a Viewing"), use `source="book_viewing"`. New `source` strings: **`book_viewing`** (and reuse `property_enquiry`).

- [ ] **Step 4: Build + check**

Run: `cd worldwise && npm run build`
Then `npm run dev`: open any modal — submit button reads the action label; a WhatsApp alt button appears under it and is readable (contrast); FloatingCTA WhatsApp still works.

- [ ] **Step 5: Commit**

```bash
git add worldwise/components/LeadModal.tsx worldwise/components/FloatingCTA.tsx worldwise/app/properties/[slug]/page.tsx
git commit -m "feat(lead): WhatsApp alt + action-specific CTA labels in LeadModal"
```

---

### Task 6: Social-proof strip beside lead forms

**Files:**
- Create: `worldwise/components/SocialProofStrip.tsx`
- Add assets: `worldwise/public/images/developers/*.svg`
- Modify: `worldwise/components/LeadCaptureSection.tsx`
- Modify: `worldwise/app/properties/[slug]/page.tsx` (above the enquiry form)

**Approach:** A compact, reusable row: Google rating (5.0★), transaction volume ("$30M+ transacted"), "RERA-certified", and a developer **wordmark** strip. Numbers match the hero stats already used (`50+`, `$30M+`, `5.0★`) — confirmed current by the owner. Server component (no interactivity). Developers to show (confirmed): **Emaar, Nakheel, DAMAC, Meraas, Ellington, Danube, Sobha, Aldar**. Render them as uniform **text wordmarks** (no external brand assets — project forbids external URLs and official SVGs aren't on hand). Component is built logo-ready: if official local SVGs are later dropped into `public/images/developers/`, swap the wordmark `<span>` for `<Image>` with no layout change.

- [ ] **Step 1: Create the component (text-wordmark developer strip)**

```tsx
const DEVELOPERS = ['Emaar', 'Nakheel', 'DAMAC', 'Meraas', 'Ellington', 'Danube', 'Sobha', 'Aldar']

export default function SocialProofStrip({ dark = false }: { dark?: boolean }) {
  const sub = dark ? 'text-white/60' : 'text-gray-500'
  const val = dark ? 'text-white' : 'text-navy'
  const logo = dark ? 'text-white/70' : 'text-gray-500'
  return (
    <div className="w-full">
      <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-center">
        <Stat value="5.0 ★" label="Google rating" val={val} sub={sub} />
        <Stat value="$30M+" label="Transacted" val={val} sub={sub} />
        <Stat value="50+" label="Investors served" val={val} sub={sub} />
        <Stat value="RERA" label="Certified" val={val} sub={sub} />
      </div>
      <p className={`mt-6 text-center text-[11px] uppercase tracking-widest ${sub}`}>
        We work with Dubai&apos;s leading developers
      </p>
      <div className={`mt-3 flex flex-wrap items-center justify-center gap-x-7 gap-y-2 font-serif text-base tracking-wide ${logo}`}>
        {DEVELOPERS.map(d => (
          <span key={d}>{d}</span>
        ))}
      </div>
    </div>
  )
}

function Stat({ value, label, val, sub }: { value: string; label: string; val: string; sub: string }) {
  return (
    <div>
      <div className={`font-serif text-xl ${val}`}>{value}</div>
      <div className={`text-xs uppercase tracking-wider ${sub}`}>{label}</div>
    </div>
  )
}
```
(No image assets needed for this version. The `public/images/developers/` asset step is deferred to a future upgrade.)

- [ ] **Step 2: Place it in `LeadCaptureSection.tsx`**

Render `<SocialProofStrip dark />` (or light, depending on that section's background) directly above the form heading. Read the file first to match its container width/spacing.

- [ ] **Step 4: Place it on the property detail page**

Render `<SocialProofStrip />` just above the `PropertyEnquiryForm` in the sticky sidebar column (or directly below it on mobile), so proof sits at the decision point.

- [ ] **Step 5: Build + visual check**

Run: `cd worldwise && npm run build`
Confirm logos load from `/images/developers/`, the strip reads correctly on both light and dark backgrounds, and stat numbers match the hero.

- [ ] **Step 6: Commit**

```bash
git add worldwise/components/SocialProofStrip.tsx worldwise/public/images/developers worldwise/components/LeadCaptureSection.tsx worldwise/app/properties/[slug]/page.tsx
git commit -m "feat(trust): social-proof strip (rating, volume, RERA, developer logos) beside lead forms"
```

---

### Task 7: Update the `source` taxonomy in CLAUDE.md

**Files:**
- Modify: `worldwise/CLAUDE.md` (symlink → root `CLAUDE.md`)

- [ ] **Step 1: Add new sources**

Add `property_card`, `mobile_bar`, `book_viewing` to the "Lead `source` strings in use" list and note them as group (1) on-site CTAs.

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(claude-md): add property_card, mobile_bar, book_viewing lead sources"
```

---

### Tier 1 — Final verification & ship

- [ ] `cd worldwise && npm run build` passes clean.
- [ ] Open PR against `claude`; merge to `main`.
- [ ] `git checkout main && git pull claude main`; confirm working tree = full live state (grep markers of recent features per CLAUDE.md deploy caution).
- [ ] Deploy from `main`: backup `data/` → rsync → `npm run build && pm2 restart worldwise` on server.
- [ ] Live checks: mobile bottom bar on `/properties/<slug>` + `/dubai-marina`; per-card WhatsApp on `/properties`; readable gold labels; social-proof strip renders with logos; submit a test lead and confirm it lands (Telegram notify) with the new `source`.

---

## Tier 2 — Outline (high impact, medium effort; needs data/design work)

Each becomes its own plan when scheduled.

1. **Golden Visa angle** — Add `goldenVisaEligible?: boolean` (or derive from `priceAed >= 2_000_000`) to `Property`; show a "Golden Visa eligible" badge on cards/detail; build a `/golden-visa` SSG landing page mirroring the `lib/areas.ts` pattern (hero, eligibility explainer, qualifying-listings grid via a price filter, FAQ + JSON-LD, lead form with `source: 'golden_visa'`). *Files:* `types/index.ts`, `PropertyCard.tsx`, `app/golden-visa/page.tsx`, `app/sitemap.ts`. *Effort: Medium.*
2. **Multi-step qualifying lead form** — A 3-step variant (budget → area/ready-vs-offplan → name+phone) as a new `QualifyingModal` posting the extra fields to `/api/leads` (which already accepts `budget`). Keeps name+phone required; honeypot retained. Improves lead quality. *Files:* new `components/QualifyingModal.tsx`, `app/api/leads/route.ts` (accept `area`, `propertyType`). *Effort: Medium.*
3. **Gated lead magnet** — "Dubai Investment Guide 2026" PDF in `public/files/` + a gated form (name+phone → reveal/download link), and/or a rental-yield estimator extending the `/mortgage-calculator` pattern. `source: 'lead_magnet_guide'`. *Files:* `app/guide/page.tsx`, asset in `public/files/`. *Effort: Easy–Medium.*
4. **ROI/yield + payment-plan on cards & detail** — Add `grossYield?: number` and `paymentPlan?: string` (e.g. "20/40/40") to `Property` + admin `PropertyForm` fields; render a yield line + payment-plan badge on `PropertyCard` and the detail spec block. *Files:* `types/index.ts`, `PropertyForm.tsx`, `PropertyCard.tsx`, `app/properties/[slug]/page.tsx`. *Effort: Medium (data-entry + UI).* 
5. **Real agent presence on detail** — Agent photo + name + RERA BRN + "replies in ~5 min" beside the sticky enquiry form. Static single-agent block first; per-property agent later. *Files:* `app/properties/[slug]/page.tsx`, asset in `public/images/`. *Effort: Easy–Medium.*

## Tier 3 — Outline (polish / brand)

1. **Scroll-reveal microinteractions** — A small `Reveal` wrapper using `IntersectionObserver`, animating `opacity`/`translateY` once, gated by `prefers-reduced-motion`. Apply to section headers + card grids. *Effort: Easy–Medium.*
2. **Typography & spacing rhythm** — Adopt a modular type scale; increase inter-section vertical padding; add a dark navy band behind `LeadCaptureSection` so the gold CTA pops. *Effort: Easy.*
3. **Multi-currency display** — Daily-cached FX (USD/EUR/GBP) with a toggle on price displays; cache a rate server-side to avoid per-request calls. *Effort: Medium.*
4. **Core Web Vitals audit** — Measure LCP/CLS/INP (PageSpeed/Lighthouse) before changing anything; then targeted fixes (image sizing, lazy below-fold, defer non-critical JS). Hero is already `priority`. *Effort: Medium; measure first.*

---

## Self-Review notes

- **Spec coverage:** all 5 Tier-1 items mapped to Tasks 2–6; helper (Task 1) + taxonomy (Task 7) support them; Tier 2/3 outlined per request.
- **No test runner:** verification steps use `npm run build` + dev/live visual checks (project has no test suite — CLAUDE.md).
- **Constraints honored:** honeypot retained (LeadModal unchanged in that respect), name+phone stay required, new `source` strings enumerated and added to CLAUDE.md, developer logos local-only, deploy-from-main checklist included.
- **Type consistency:** helper exports `waLink`/`waPropertyMessage`/`waNumber` used identically across Tasks 3–5; `MobileCtaBar` props match its call sites in Tasks 4.
- **Open input needed before execution:** (a) real developer logo assets; (b) confirm transaction/rating figures are current; (c) confirm `AreaPageClient` exposes `area` to mount the mobile bar.
