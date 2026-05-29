# Worldwise Tier 3 — Polish & Brand Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Checkbox steps.

**Goal:** Raise the perceived quality ("Apple/Linear feel") and conversion without changing the site's information architecture: tasteful motion, tighter spacing/typography rhythm, optional multi-currency pricing, and a measured Core Web Vitals pass.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind (navy/gold), `tailwind.config.ts`, `app/globals.css`.

**Constraints:** respect `prefers-reduced-motion`; no layout shift (CLS) from motion; no external image URLs; deploy from `main`; `npm run build` clean; keep changes reversible. Aesthetic changes are high-blast-radius — keep them conservative and consistent.

**Risk note:** Tasks 1 & 4 are low-risk (motion, perf). Task 2 (typography/spacing) touches the whole site visually — keep it conservative/token-driven. Task 3 (multi-currency) is an integration — gated on owner decision + FX source.

---

## Task 1 — Scroll-reveal microinteractions (low risk)

**Files:** `worldwise/components/Reveal.tsx` (new client component), apply on homepage section wrappers + card grids (`app/page.tsx` sections, `FeaturedProperties`, `BlogPreview`, `AreasSection`).

- [ ] Create `Reveal.tsx`: a client wrapper using `IntersectionObserver` that adds an "in-view" class once (then unobserves). Animate only `opacity` 0→1 and `translateY(12px)→0`, duration ~450ms ease-out. If `window.matchMedia('(prefers-reduced-motion: reduce)').matches`, render children immediately with no transform (no animation). Accept `as`/`className`/`delay` props. Default to `<div>`.
- [ ] Reserve space so there's NO CLS: the element occupies its final layout box from first paint; only opacity/transform animate (both compositor-only, no reflow).
- [ ] Wrap homepage section headers and the property/blog/area card grids in `<Reveal>` (stagger optional via `delay`). Do NOT wrap the hero (above the fold — must paint instantly for LCP).
- [ ] Verify: `npm run build`; in dev, sections fade/rise once on scroll; with OS "reduce motion" on, content appears statically; Lighthouse CLS unaffected.
- [ ] Commit: `feat(ux): tasteful scroll-reveal (reduced-motion aware)`

---

## Task 2 — Typography & spacing rhythm (conservative, token-driven)

**Files:** `worldwise/tailwind.config.ts` (type scale / spacing tokens), `worldwise/app/globals.css` (`.section-title`/`.section-subtitle` + a shared section padding utility), selected section components.

- [ ] Audit current section vertical padding (`py-16`/`py-20` are mixed). Standardize on a consistent rhythm via a `.section-y` utility (e.g. `@apply py-20 md:py-28`) and apply it where sections use ad-hoc padding — visual only, no structural change.
- [ ] Tighten the type scale: ensure headings use a consistent modular scale (the serif display is already used; verify `section-title` sizes step cleanly). Cap body line-length on long-form (`/blog/[slug]`, area `whyInvest`) at `max-w-[68ch]` for readability.
- [ ] Add a dark navy band framing for the final `LeadCaptureSection` if not already dark, so the gold CTA pops (verify current bg first — it's `bg-navy`, likely already done; if so, skip).
- [ ] Keep it reversible and conservative — no font swaps, no color changes. This is spacing/scale consistency, not a redesign.
- [ ] Verify: `npm run build`; eyeball homepage + a blog article + an area page for improved rhythm; nothing overlaps or breaks at mobile/desktop.
- [ ] Commit: `style(ui): consistent section rhythm + readable line length`

**Owner decision:** conservative (recommended) vs bolder restyle.

---

## Task 3 — Multi-currency price display (OPTIONAL — gated on decision)

**Files:** `worldwise/lib/fx.ts` (server-cached rates), `worldwise/components/PriceTag.tsx` (client, AED + selected currency + toggle), apply in `PropertyCard` + property detail price.

- [ ] `lib/fx.ts`: fetch AED→{USD,EUR,GBP} once per day from a free FX API (e.g. `https://open.er-api.com/v6/latest/AED` — no key) using Next fetch with `next: { revalidate: 86400 }`; fall back to hardcoded approximate rates if the fetch fails (AED is USD-pegged at 3.6725, so USD is near-constant). Return a rates object.
- [ ] `PriceTag.tsx`: shows AED price; a small toggle (USD/EUR/GBP/AED) converts client-side using rates passed from the server. Persist choice in `localStorage`. Default AED.
- [ ] Use on `PropertyCard` and the detail page price. Keep AED primary (it's the transaction currency); converted value is secondary ("≈ $X").
- [ ] Verify: `npm run build`; prices convert; FX fetch cached; offline/failed fetch falls back gracefully.
- [ ] Commit(s): `feat(ux): multi-currency price display`

**Owner decision:** include multi-currency now? And OK to call a free external FX API server-side (cached daily)? (No external *images* — this is a JSON API, allowed.)

---

## Task 4 — Core Web Vitals: measure then fix (diagnostic-first)

**Files:** measurement (no code), then targeted fixes in `Hero.tsx`, `next.config.mjs` (image formats), any heavy client components.

- [ ] **Measure first:** run PageSpeed Insights (mobile) on `/`, `/properties`, a `/properties/[slug]`, `/golden-visa`. Record LCP / INP / CLS. (Use the PSI API or the web UI.) Do NOT change code before measuring.
- [ ] Targeted fixes only for real findings: confirm hero image is `priority` (it is) and served as AVIF/WebP (`next.config.mjs images.formats`); ensure all `<img>`/gallery images have explicit dimensions (CLS); defer any non-critical client JS; confirm the cookie banner reserves space.
- [ ] Re-measure; record before/after.
- [ ] Commit: `perf(cwv): <specific fix>` per fix (only if measurements justify).

---

## Self-Review notes
- Task 1 & 4 are safe/diagnostic → execute first. Task 2 conservative + reversible. Task 3 gated on owner.
- Motion respects reduced-motion and is compositor-only (no CLS). No font/color changes in Task 2. FX is a cached JSON API (not an image), with offline fallback.
- Open decisions: (a) multi-currency yes/no + external FX API ok; (b) typography pass conservative vs bolder.
