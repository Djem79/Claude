# Homepage image optimization — design

**Date:** 2026-06-05
**Status:** Approved (design)
**Scope:** Cut homepage payload from three oversized image sources without changing the visual appearance. No deploy in this task (the user deploys separately).

## Problem

A performance audit of the live site (`worldwise.pro`) found the homepage shell is light (~290 KB HTML+JS+CSS+fonts, hero AVIF ~68 KB) and well-built, but three image sources inflate the real page weight:

| Source | Current | Measured |
| ------ | ------- | -------- |
| Blog preview thumbnails | raw `<img>` of `/api/blog-image` OG card (1200×630 PNG) | **1.64 MB each, ×3 newest AI articles ≈ 4.9 MB** |
| Area cards | CSS `background-image` of raw JPG | **~450–570 KB each, ×12** |
| Damac developer logo | raw `<img>` of oversized PNG | **192 KB** (1246×160, shown at 20px tall) |

Property-card images are already optimal (next/image + `sizes` + lazy, ~28 KB AVIF) and are **out of scope**.

## Goal

Reduce these three sources to optimized, lazily-loaded assets while keeping the rendered design pixel-identical (same layout, hover-zoom, gradient overlays, text).

## Design

Three independent changes.

### 1. Blog preview — `components/BlogPreview.tsx`

AI-generated articles store `image = /api/blog-image?slug=…&title=…&tag=…` (set in `scripts/generate-article.mjs:346`). That route returns a 1.6 MB branded OG PNG. `BlogPreview` currently renders it with a raw `<img>` at 192 px height.

**Change:** replace the raw `<img>` with `next/image` using `fill`:

- Wrap the image in a `relative h-48 w-full overflow-hidden` container (next/image `fill` requires a positioned parent).
- `<Image src={a.image} alt={a.title} fill sizes="(max-width: 768px) 100vw, 33vw" className="object-cover" />`.
- The gradient "W" fallback for articles without `image` (static editorial articles) is unchanged.

**Effect:** Next's optimizer fetches `/api/blog-image` once (generation ~2 s), downscales to the card width, serves AVIF (~25 KB), and lazy-loads. ~1.6 MB → ~25 KB per thumbnail, branded look preserved.

**Notes / risks:**
- `/api/blog-image` is a same-origin local path → no `next.config` `remotePatterns` entry needed; the optimizer can fetch it.
- CSP `img-src 'self'` already allows `/_next/image` output and the same-origin source.
- The query-string `src` is fine for next/image (it URL-encodes into `/_next/image?url=…`).

### 2. Area cards — `components/AreasSection.tsx`

Currently a `<div className="bg-cover" style={{ backgroundImage: url(area.img) }}>` inside a `Link` that is already `relative overflow-hidden rounded-sm aspect-[4/3]`.

**Change:** replace the background-image `<div>` with `next/image`:

- `<Image src={area.img} alt="" fill sizes="(max-width: 768px) 50vw, 25vw" className="object-cover transition-transform duration-500 group-hover:scale-105" />`.
- The gradient overlay `<div>` and the text block stay as absolutely-positioned siblings on top (unchanged).
- Source files `public/images/areas/*.jpg` are **NOT modified** — the same files are reused at large size elsewhere (`PropertyLocation` backdrop, area landing pages). next/image downscales per usage, so one source serves every screen optimally.

**Effect:** ~500 KB raw JPG → ~40 KB AVIF per card, responsive, lazy. The grid is below the fold, so cards load on scroll.

**Notes:** `/images/areas/*` are plain static public files (no `next.config` rewrite, unlike `/images/properties` and `/images/qr`), so next/image optimizes them directly.

### 3. Developer logos — `public/images/developers/`

`SocialProofStrip.tsx:35` renders `<img className="h-5 w-auto" loading="lazy">` (display height 20 px). Raster PNGs are 160 px tall — 8× oversized — and Damac is 192 KB.

**Change:** recompress the raster PNGs in place (binary assets, not code):

- Resize to ~80 px height (≈4× the 20 px display, ample for retina) with macOS built-in `sips --resampleHeight 80 <file>.png` — `pngquant`/`cwebp`/ImageMagick are not installed locally; `sips` is.
- Targets (worth recompressing): `damac.png` (192 KB, primary), `emaar.png` (47 KB), `meraas.png` (25 KB). `ellington.png` (15 KB) and `aldar.png` (5 KB) are already small — recompress only if `sips` gives a clear win, otherwise leave.
- SVG logos (`nakheel.svg`, `sobha.svg`) and the `<img>` render in `SocialProofStrip.tsx` are **unchanged**.

**Effect:** Damac ~192 KB → ~25–40 KB after resize (target <15 KB is reachable if `pngquant` is later installed; resize alone is the bulk of the win and is sufficient for this task). Logos render identically (same `h-5 w-auto`).

**Notes:** keep PNG format (transparency, universal support). `sips` resize is lossless-ish re-encode; visually identical at 20 px display.

## Verification

1. `npm run build` passes (primary gate).
2. `npm run dev`, open `/` in the browser, DevTools → Network, filter Img:
   - Blog preview thumbnails load as AVIF ~25 KB (not 1.6 MB PNG).
   - Area cards load as AVIF ~30–50 KB each (and only on scroll into view).
   - `damac.png` transfer < ~40 KB.
3. Visual check: blog grid, area grid hover-zoom, gradient overlays, and all text are unchanged at desktop and mobile widths.
4. `git status` on `public/images/developers/` shows only the recompressed logo binaries changed.

## Out of scope

- Property-card images (already optimal).
- `/properties` listing pagination and the 1311 image paths in its RSC payload (separate concern, noted in the audit).
- Hero, fonts, JS bundles (already light).
- Deployment (done separately by the user).

## Files touched

- `components/BlogPreview.tsx` — `+import Image`, raw `<img>` → `next/image` fill.
- `components/AreasSection.tsx` — `+import Image`, background-image `<div>` → `next/image` fill.
- `public/images/developers/damac.png` (+ `emaar.png`, `meraas.png` if a clear win) — recompressed binaries.
