# Homepage Image Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cut homepage image payload (blog-preview 1.6 MB PNGs, area-card ~500 KB JPGs, 192 KB Damac logo) without changing the rendered design.

**Architecture:** Two component edits swap raw `<img>` / CSS `background-image` for `next/image` (`fill`), so Next's optimizer serves resized AVIF lazily from the same sources. One asset edit recompresses oversized developer-logo PNGs in place with macOS `sips`.

**Tech Stack:** Next.js 14 App Router, `next/image` (AVIF/WebP already enabled in `next.config.mjs`), Tailwind, macOS `sips` for image resizing.

**Verification note:** This codebase has no component test runner (only `node:test` for pure `lib/` helpers — not applicable here). The verification gate per task is `npm run build` passing plus a browser DevTools Network check. Run build commands from the `worldwise/` directory. Work happens on branch `feat/homepage-image-optimization` (already created; the spec is already committed there).

---

### Task 1: Blog preview thumbnail → next/image

**Files:**
- Modify: `worldwise/components/BlogPreview.tsx` (add import on line 1-area; replace the `<img>` branch at lines 48-55)

- [ ] **Step 1: Add the next/image import**

At the top of `components/BlogPreview.tsx`, the current first two lines are:

```tsx
import Link from 'next/link'
import { getAllArticles } from '@/lib/articles'
```

Add the `Image` import so they become:

```tsx
import Link from 'next/link'
import Image from 'next/image'
import { getAllArticles } from '@/lib/articles'
```

- [ ] **Step 2: Replace the raw `<img>` with next/image fill**

The current image branch (lines 48-55) is:

```tsx
              {'image' in a && a.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={a.image} alt={a.title} className="h-48 w-full object-cover" />
              ) : (
                <div className="h-48 bg-gradient-to-br from-navy to-navy-light flex items-center justify-center">
                  <span className="font-serif text-4xl text-gold/30">W</span>
                </div>
              )}
```

Replace it with (wrap in a positioned container because `fill` needs a relative parent; drop the now-unneeded eslint-disable):

```tsx
              {'image' in a && a.image ? (
                <div className="relative h-48 w-full overflow-hidden">
                  <Image
                    src={a.image}
                    alt={a.title}
                    fill
                    sizes="(max-width: 768px) 100vw, 33vw"
                    className="object-cover"
                  />
                </div>
              ) : (
                <div className="h-48 bg-gradient-to-br from-navy to-navy-light flex items-center justify-center">
                  <span className="font-serif text-4xl text-gold/30">W</span>
                </div>
              )}
```

- [ ] **Step 3: Build to verify it compiles**

Run (from `worldwise/`):

```bash
npm run build
```

Expected: build succeeds, no TypeScript errors. (`a.image` is narrowed to `string` by the `'image' in a && a.image` guard, which satisfies next/image's `src`.)

- [ ] **Step 4: Commit**

```bash
git add components/BlogPreview.tsx
git commit -m "perf(blog): serve blog-preview thumbnails via next/image (1.6MB PNG -> AVIF)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Area cards → next/image

**Files:**
- Modify: `worldwise/components/AreasSection.tsx` (add import on line 1; replace the background-image `<div>` ~lines 55-58)

- [ ] **Step 1: Add the next/image import**

The current first two lines of `components/AreasSection.tsx` are:

```tsx
import Link from 'next/link'
import { areas as areaData } from '@/lib/areas'
```

Add the `Image` import:

```tsx
import Link from 'next/link'
import Image from 'next/image'
import { areas as areaData } from '@/lib/areas'
```

- [ ] **Step 2: Replace the background-image div with next/image fill**

The current backdrop div (inside the `<Link className="group relative overflow-hidden rounded-sm aspect-[4/3] cursor-pointer">`) is:

```tsx
                    <div
                      className="absolute inset-0 bg-cover bg-center group-hover:scale-105 transition-transform duration-500"
                      style={{ backgroundImage: `url('${area.img}')` }}
                    />
```

Replace it with (the parent `Link` is already `relative … aspect-[4/3] overflow-hidden`, so `fill` works; the gradient overlay div and text div below it stay unchanged):

```tsx
                    <Image
                      src={area.img}
                      alt=""
                      fill
                      sizes="(max-width: 768px) 50vw, 25vw"
                      className="object-cover group-hover:scale-105 transition-transform duration-500"
                    />
```

- [ ] **Step 3: Build to verify it compiles**

Run (from `worldwise/`):

```bash
npm run build
```

Expected: build succeeds, no TypeScript errors. `area.img` is a `string` (typed in the `AreaCard` type), satisfying next/image's `src`. The `/images/areas/*.jpg` paths are plain static public files (no `next.config` rewrite), so the optimizer handles them directly.

- [ ] **Step 4: Commit**

```bash
git add components/AreasSection.tsx
git commit -m "perf(areas): serve homepage area cards via next/image (~500KB JPG -> AVIF)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Recompress oversized developer logos

**Files:**
- Modify (binary, in place): `worldwise/public/images/developers/damac.png`, `emaar.png`, `meraas.png`

Logos render at `h-5` (20 px) in `SocialProofStrip.tsx` but the raster PNGs are 160 px tall. Resize to 80 px height (4× the display size, ample for retina). `pngquant`/`cwebp`/ImageMagick are not installed locally; macOS `sips` is.

- [ ] **Step 1: Record current sizes (baseline)**

Run (from `worldwise/`):

```bash
cd public/images/developers && for f in damac.png emaar.png meraas.png; do printf "%-14s %7s B\n" "$f" "$(stat -f%z "$f")"; done; cd -
```

Expected output (baseline): `damac.png ~192519 B`, `emaar.png ~46875 B`, `meraas.png ~25291 B`.

- [ ] **Step 2: Resize the three PNGs to 80 px height in place**

Run (from `worldwise/`):

```bash
sips --resampleHeight 80 public/images/developers/damac.png public/images/developers/emaar.png public/images/developers/meraas.png
```

Expected: `sips` prints each file path with no error. (`--resampleHeight 80` preserves aspect ratio: damac 1246×160 → 623×80, etc.)

- [ ] **Step 3: Verify the new sizes dropped substantially**

Run (from `worldwise/`):

```bash
cd public/images/developers && for f in damac.png emaar.png meraas.png; do printf "%-14s %7s B  %s\n" "$f" "$(stat -f%z "$f")" "$(file "$f" | grep -oE '[0-9]+ x [0-9]+' | head -1)"; done; cd -
```

Expected: `damac.png` now well under 50 KB (target ballpark ~25-40 KB), `emaar.png` and `meraas.png` ~10-18 KB, each dimension showing `… x 80`. If `damac.png` is still > 50 KB, that is acceptable for this task (resize is the bulk of the win); note it for a later optional `pngquant` pass.

- [ ] **Step 4: Commit**

```bash
git add public/images/developers/damac.png public/images/developers/emaar.png public/images/developers/meraas.png
git commit -m "perf(logos): downscale oversized developer logo PNGs (damac 192KB -> ~30KB)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Final whole-page verification

**Files:** none (verification only)

- [ ] **Step 1: Production build passes**

Run (from `worldwise/`):

```bash
npm run build
```

Expected: build succeeds with no errors or new warnings about the touched components.

- [ ] **Step 2: Browser / Network check**

Run `npm run dev`, open <http://localhost:3000/> in a browser, open DevTools → Network → filter `Img`, hard-reload, and confirm:

- Blog-preview thumbnails are requested via `/_next/image?url=...blog-image...` and served as `image/avif` at ~15-30 KB (NOT a 1.6 MB `image/png` from `/api/blog-image`).
- Scrolling to the "Investment Areas" grid loads each area card via `/_next/image?...areas...` as `image/avif` ~30-50 KB, and only as it scrolls into view (lazy).
- `damac.png` transfers at the new reduced size.

- [ ] **Step 3: Visual regression check**

In the same browser, confirm the design is unchanged at a desktop width and a mobile width (DevTools device toolbar, e.g. 375 px):

- Blog grid: three cards with images filling the same 192 px-tall area, no distortion.
- Area grid: 2 columns mobile / 4 columns desktop, hover-zoom on the image still works, the dark gradient overlay and the name/price/ROI text are still legible on top.
- Social-proof logo row: logos render at the same height, not blurry.

If anything looks off, STOP and re-check the relevant task's className/structure before proceeding.

---

## Self-Review

**Spec coverage:**
- Blog preview (spec §1) → Task 1. ✓
- Area cards (spec §2) → Task 2. ✓
- Developer logos (spec §3) → Task 3 (damac + emaar + meraas; ellington/aldar/SVG left as-is per spec). ✓
- Verification (spec "Verification") → Task 4 (build + Network + visual). ✓
- Out-of-scope items (property cards, listing pagination, deploy) → not included. ✓

**Placeholder scan:** No TBD/TODO; every code step shows the exact before/after; every command has expected output. ✓

**Type consistency:** `Image` imported in both components before use; `a.image` (narrowed `string`) and `area.img` (`string` per `AreaCard`) both satisfy next/image `src`; `fill` used with positioned parents in both cases (`relative h-48` wrapper in Task 1; existing `relative … aspect-[4/3]` Link in Task 2). ✓
