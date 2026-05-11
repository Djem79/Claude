# Design: Navbar Transparency Fix + White Logo

**Date:** 2026-05-11  
**Status:** Approved  
**Files affected:**
- `components/Navigation.tsx`
- `app/page.tsx`
- `public/images/logo-white.svg` (new file)

---

## Problem

1. `Navigation` starts as `bg-transparent` at scroll position 0. On pages with a light-coloured top section the white nav text is invisible.
2. The existing `logo.png` (green/black) is unreadable on the navy navbar background. There is no dark-background version of the logo.

---

## Solution A — Navbar transparency

Add a `transparent?: boolean` prop to `Navigation`.

| Prop value | Behaviour |
|---|---|
| `transparent` (true) | Current behaviour: `bg-transparent py-5` at top → `bg-navy/95 py-3` after 40 px scroll. Used on homepage only. |
| default (false / omitted) | Always `bg-navy/95 py-3` — no transparency at any scroll position. |

**Page changes required:**
- `app/page.tsx` — add `<Navigation transparent />` (only change needed here)
- All other pages (`/blog`, `/blog/[slug]`, `/mortgage-calculator`, `/properties`, `/properties/[slug]`, `/privacy`, `/admin/*`) — no change; they already omit the prop and will automatically render with solid navy.

---

## Solution B — White/gold SVG logo

Create `public/images/logo-white.svg` — a vector recreation of the Worldwise W mark adapted for dark backgrounds.

### W mark geometry

A geometric "W" built from four parallelogram polygons in a `0 0 64 50` viewBox:

| Polygon | Points | Fill |
|---|---|---|
| Left outer arm | `0,2 14,2 28,48 14,48` | gold `#C9A96E` |
| Left inner arm | `14,48 28,48 36,22 22,22` | gold `#C9A96E` |
| Right inner arm | `22,22 36,22 50,48 36,48` | white `#FFFFFF` |
| Right outer arm | `36,48 50,48 64,2 50,2` | white `#FFFFFF` |

Left half gold / right half white — mirrors the green/black split of the original logo, adapted for the navy background.

### Typography in the SVG

- `WORLDWISE` — serif (`Georgia, 'Times New Roman', serif`), font-size 9, letter-spacing 2, fill white, centred at x=32 y=60
- `REAL ESTATE` — same family, font-size 6, letter-spacing 3, fill `rgba(255,255,255,0.7)`, centred at x=32 y=70

Full SVG viewBox: `0 0 64 72`

### Navigation update

Replace:
```tsx
<img src="/images/logo.png" alt="Worldwise" className="h-10 w-auto" />
<span className="font-serif text-2xl text-white tracking-wide hidden sm:inline">WORLDWISE</span>
```

With:
```tsx
<img src="/images/logo-white.svg" alt="Worldwise Real Estate" className="h-12 w-auto" />
```

The SVG contains both the W mark and the text, so the separate `<span>` is no longer needed.

---

## Acceptance criteria

- [ ] On `/blog`, `/mortgage-calculator`, `/properties` — navbar is immediately visible (navy bg) without scrolling
- [ ] On `/` (homepage) — navbar starts transparent, becomes navy after 40 px scroll (unchanged)
- [ ] Logo is visible and legible on the navy navbar background on all pages
- [ ] No layout shift or flash of invisible nav on any page
- [ ] `npm run build` passes with no TypeScript errors
