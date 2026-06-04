# Floor-plan / site-plan extraction pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auto-extract unit floor plans (+ up to 2 site/master plans) into the gated "Floor plans & site plans" section via a SEPARATE geometry-targeted pass over the small images the gallery gate rejects — without touching the 50 KB gallery pipeline.

**Architecture:** `lib/image-classify.ts` gains three pure helpers (`isLikelyFloorPlanDims`, `partitionGallery`, `selectPlanSection`) replacing `partitionByCategory`. `lib/pdf-images.ts` `extractImagesFromPdf` builds two candidate pools — the existing ≥50 KB gallery pool and a new small (≥12 KB) + floor-plan-geometry pool (dims via ImageMagick `identify`) — classifies each in its own Gemini call, and routes exterior/interior/amenity → gallery, up to 2 masterplan + the floorplans → the plans section.

**Tech Stack:** Next.js 14, TypeScript, poppler (`pdfimages`/`pdftoppm`), ImageMagick (`convert`/`identify`), Gemini `gemini-2.5-flash`, `node:test` for pure helpers.

**Repo:** git root `/Users/dzhambulat/Projects/Claude`, app in `worldwise/` (run commands there). `export PATH="/Users/dzhambulat/.nvm/versions/node/v24.15.0/bin:$PATH"` if npm missing. Edit/Write work normally (ASCII path). Commit on `main`, stage by exact path, never `data/`, co-author line `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

**Constants (final):** `MIN_PHOTO_BYTES=50KB` (gallery, unchanged), `PLAN_MIN_BYTES=12*1024`, geometry gate `min side 250 / area 150_000`, `PLAN_CLASSIFY_MAX=60`, `MASTERPLAN_IN_PLANS=2`, `FLOORPLAN_MAX=12`, existing `MAX_CANDIDATES=24`, `CLASSIFY_MAX=120`.

---

## Task 1: Pure helpers in `lib/image-classify.ts` (TDD)

**Files:**
- Modify: `lib/image-classify.ts`
- Test: `lib/image-classify.test.ts`

- [ ] **Step 1: Write failing tests** — in `lib/image-classify.test.ts`, REPLACE the two existing `partitionByCategory ...` tests (the ones added for D) with:

```ts
test('isLikelyFloorPlanDims: accepts floor-plan-sized images, rejects icons/banners/thumbs', () => {
  assert.equal(isLikelyFloorPlanDims(487, 618), true)   // real plan
  assert.equal(isLikelyFloorPlanDims(318, 1022), true)  // tall plan
  assert.equal(isLikelyFloorPlanDims(200, 200), false)  // icon (area 40k)
  assert.equal(isLikelyFloorPlanDims(1000, 80), false)  // thin banner (min side 80)
  assert.equal(isLikelyFloorPlanDims(400, 300), false)  // small thumb (area 120k)
})

test('partitionGallery ranks exterior -> interior -> amenity, drops everything else (incl. masterplan)', () => {
  const cats: ImgCategory[] = ['masterplan', 'interior', 'mood', 'exterior', 'amenity', 'floorplan']
  assert.deepEqual(partitionGallery(cats, 24), [3, 1, 4]) // exterior(3) interior(1) amenity(4)
})

test('partitionGallery respects the cap', () => {
  const cats: ImgCategory[] = ['exterior', 'exterior', 'interior']
  assert.deepEqual(partitionGallery(cats, 2), [0, 1])
})

test('selectPlanSection takes up to maxMaster masterplans (from gallery cats) + floorplans (from plan cats)', () => {
  const galleryCats: ImgCategory[] = ['exterior', 'masterplan', 'masterplan', 'masterplan']
  const planCats: ImgCategory[]    = ['other', 'floorplan', 'floorplan', 'mood']
  const r = selectPlanSection(galleryCats, planCats, 2, 12)
  assert.deepEqual(r.master, [1, 2]) // first 2 masterplan indices, document order
  assert.deepEqual(r.floor, [1, 2])  // floorplan indices from plan cats
})

test('selectPlanSection caps floorplans and tolerates no masterplans', () => {
  const galleryCats: ImgCategory[] = ['exterior', 'interior']
  const planCats: ImgCategory[]    = ['floorplan', 'floorplan', 'floorplan']
  const r = selectPlanSection(galleryCats, planCats, 2, 2)
  assert.deepEqual(r.master, [])
  assert.deepEqual(r.floor, [0, 1])
})
```

Update the import line at the top of the test file to:
```ts
import { selectByCategory, normalizeCategory, isLikelyFloorPlanDims, partitionGallery, selectPlanSection, type ImgCategory } from './image-classify.ts'
```
(Drop `partitionByCategory` from the import.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test --experimental-strip-types lib/image-classify.test.ts`
Expected: FAIL — `isLikelyFloorPlanDims` / `partitionGallery` / `selectPlanSection` are not exported.

- [ ] **Step 3: Implement** — in `lib/image-classify.ts`, REPLACE the entire `partitionByCategory` function (the `export function partitionByCategory(...) { ... }` block) with these three exports:

```ts
// True only for images shaped like a floor plan / site plan: reasonably large in
// BOTH dimensions (drops thin banners) and decent area (drops icons/small thumbs).
// Used to narrow the SMALL-image pool (the ones the 50KB gallery gate rejects) before
// the plans classify pass, so it isn't flooded by section-cover/decorative crops.
// Pure — unit-tested.
export function isLikelyFloorPlanDims(width: number, height: number): boolean {
  return Math.min(width, height) >= 250 && width * height >= 150_000
}

// Gallery indices ranked exterior -> interior -> amenity (document order within each),
// capped. Master-plans and everything else are intentionally NOT in the gallery —
// they go to the plans section (selectPlanSection) or are dropped. Pure — unit-tested.
export function partitionGallery(cats: ImgCategory[], cap: number): number[] {
  const ORDER: ImgCategory[] = ['exterior', 'interior', 'amenity']
  const out: number[] = []
  for (const cat of ORDER) {
    for (let i = 0; i < cats.length; i++) if (cats[i] === cat) out.push(i)
  }
  return out.slice(0, cap)
}

// Build the gated "Floor plans & site plans" section: up to `maxMaster` master-plan
// indices (from the GALLERY classify pass — master-plans are large) plus the floorplan
// indices (from the separate PLAN classify pass — unit layouts are small). Document
// order within each; index spaces are separate (master -> gallery files, floor ->
// plan files), so the caller maps them to the right file arrays. Pure — unit-tested.
export function selectPlanSection(
  galleryCats: ImgCategory[],
  planCats: ImgCategory[],
  maxMaster: number,
  maxFloor: number,
): { master: number[]; floor: number[] } {
  const master: number[] = []
  for (let i = 0; i < galleryCats.length && master.length < maxMaster; i++) {
    if (galleryCats[i] === 'masterplan') master.push(i)
  }
  const floor: number[] = []
  for (let i = 0; i < planCats.length && floor.length < maxFloor; i++) {
    if (planCats[i] === 'floorplan') floor.push(i)
  }
  return { master, floor }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test --experimental-strip-types lib/image-classify.test.ts` → all pass.
Run: `node --test --experimental-strip-types lib/*.test.ts` → full suite green.

- [ ] **Step 5: Commit**

```bash
git add worldwise/lib/image-classify.ts worldwise/lib/image-classify.test.ts
git commit -m "feat(plans): pure helpers — floor-plan geometry gate + gallery/plan-section split (Wave 3/D)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Rework `extractImagesFromPdf` — two pools, two classify passes

**Files:**
- Modify: `lib/pdf-images.ts`

**Context:** the current function (1) filters extracted files to `usable` (≥50 KB), (2) classifies the first `CLASSIFY_MAX`, (3) `partitionByCategory` → `galleryIdx`/`floorIdx`, (4) writes `[...galleryFiles, ...floorFiles]`. You will replace steps 2–4 with two pools + two classify passes + the new routing. READ the whole file first; keep the helpers (`findResizer`, `mapLimit`, `collect`, `sizeOk`, the thumbnail/resize blocks) and the `finally { fs.rmSync }`.

- [ ] **Step 1: Update imports + constants** — at the top of `lib/pdf-images.ts`:

Change the classify import to:
```ts
import { classifyImages, isLikelyFloorPlanDims, partitionGallery, selectPlanSection, type ImgCategory } from '@/lib/image-classify'
```
Also import the gallery byte gate constant (already imported `isLikelyPhoto` from `@/lib/photo-filter`); add `MIN_PHOTO_BYTES`:
```ts
import { isLikelyPhoto, MIN_PHOTO_BYTES } from '@/lib/photo-filter'
```
After the existing `const FLOORPLAN_MAX = 12` (add it if not present) add:
```ts
const PLAN_MIN_BYTES = 12 * 1024
const PLAN_CLASSIFY_MAX = 60
const MASTERPLAN_IN_PLANS = 2
```

- [ ] **Step 2: Add an `identify` dimension reader** — add this helper near `findResizer` (it returns the IM7 vs IM6 identify invocation; `null` when ImageMagick is absent):

```ts
// Read "<w> <h>" via ImageMagick identify (IM7 = `magick identify`, IM6 = `identify`).
// Returns null on any failure so the caller can skip the plan-geometry filter.
async function imageDims(resizer: string | null, file: string): Promise<{ w: number; h: number } | null> {
  if (!resizer) return null
  const [bin, pre] = resizer === 'magick' ? ['magick', ['identify']] : ['identify', []]
  try {
    const { stdout } = await execFileP(bin, [...pre, '-format', '%w %h', file], { timeout: PROC_TIMEOUT_MS })
    const [w, h] = stdout.trim().split(/\s+/).map(Number)
    return Number.isFinite(w) && Number.isFinite(h) ? { w, h } : null
  } catch { return null }
}
```

- [ ] **Step 3: Replace the candidate-selection + write section.** Replace the block from `const sizeOk = ...` (line ~79) down to the `return urls`/`return { gallery..., floorPlans... }` (the end of the keep/write logic, just before `} finally {`) with:

```ts
    const sizeOk = (f: string) => isLikelyPhoto(fs.statSync(path.join(tmpDir, f)).size, f)
    const collect = (prefix: string) =>
      fs.readdirSync(tmpDir).filter(f => f.startsWith(prefix) && /\.(png|jpe?g)$/i.test(f)).sort()

    try { await execFileP('pdfimages', ['-all', pdfPath, path.join(tmpDir, 'img')], { timeout: PROC_TIMEOUT_MS }) }
    catch (e) { console.error('[pdf-images] pdfimages failed', e) }
    let galleryPool = collect('img').filter(sizeOk)
    let rasterised = false

    if (galleryPool.length === 0) {
      try { await execFileP('pdftoppm', ['-jpeg', '-r', '120', pdfPath, path.join(tmpDir, 'page')], { timeout: PROC_TIMEOUT_MS }) }
      catch (e) { console.error('[pdf-images] pdftoppm failed', e) }
      galleryPool = collect('page').filter(sizeOk)
      rasterised = true
    }
    if (galleryPool.length === 0) return { gallery: [], floorPlans: [] }

    const resizer = await findResizer()

    const thumbnail = (files: string[]) => mapLimit(files, RESIZE_CONCURRENCY, async (f, i) => {
      const thumbPath = path.join(tmpDir, `thumb-${path.basename(f)}-${i}.jpg`)
      await execFileP(resizer as string, [path.join(tmpDir, f), '-thumbnail', '320x320', '-background', 'white', '-flatten', '-strip', '-quality', '70', thumbPath], { timeout: PROC_TIMEOUT_MS })
      return { b64: fs.readFileSync(thumbPath).toString('base64'), mime: 'image/jpeg' }
    })

    // ---- Gallery pass (large renders, unchanged gate) ----------------------
    const classifiable = galleryPool.slice(0, CLASSIFY_MAX)
    if (galleryPool.length > CLASSIFY_MAX) console.warn(`[pdf-images] ${galleryPool.length} gallery candidates; classifying first ${CLASSIFY_MAX}`)
    let galleryIdx: number[]
    let galleryCats: ImgCategory[] = []
    try {
      if (!resizer) throw new Error('no ImageMagick for thumbnails')
      const cats = await classifyImages(await thumbnail(classifiable))
      galleryCats = classifiable.map((_, i) => cats[i] ?? 'other')
      galleryIdx = partitionGallery(galleryCats, MAX_CANDIDATES)
      if (galleryIdx.length === 0) {
        console.warn('[pdf-images] classifier kept no gallery image; falling back to document order')
        galleryIdx = classifiable.map((_, i) => i).slice(0, MAX_CANDIDATES)
      }
    } catch (e) {
      console.error('[pdf-images] gallery classification failed; using document order', e)
      galleryIdx = galleryPool.map((_, i) => i).slice(0, MAX_CANDIDATES)
      galleryCats = []
    }

    // ---- Plan pass (SMALL images with floor-plan geometry) -----------------
    // Skipped without ImageMagick (no identify/thumbnails) or when we rasterised
    // pages (those are full-page renders, not embedded unit plans).
    let planPool: string[] = []
    if (resizer && !rasterised && galleryCats.length) {
      const smalls = collect('img').filter(f => {
        const b = fs.statSync(path.join(tmpDir, f)).size
        return b >= PLAN_MIN_BYTES && b < MIN_PHOTO_BYTES
      })
      const measured = await mapLimit(smalls, RESIZE_CONCURRENCY, async f => {
        const d = await imageDims(resizer, path.join(tmpDir, f))
        return { f, ok: !!d && isLikelyFloorPlanDims(d.w, d.h) }
      })
      planPool = measured.filter(m => m.ok).map(m => m.f).slice(0, PLAN_CLASSIFY_MAX)
    }
    let planSel: { master: number[]; floor: number[] } = { master: [], floor: [] }
    if (planPool.length && galleryCats.length) {
      try {
        const planCatsRaw = await classifyImages(await thumbnail(planPool))
        const planCats = planPool.map((_, i) => planCatsRaw[i] ?? 'other')
        planSel = selectPlanSection(galleryCats, planCats, MASTERPLAN_IN_PLANS, FLOORPLAN_MAX)
      } catch (e) { console.error('[pdf-images] plan classification failed; no plans this import', e) }
    }

    // ---- Write: gallery files, then plan-section files (master + floor) -----
    const galleryFiles = galleryIdx.map(i => classifiable[i] ?? galleryPool[i])
    const masterFiles = planSel.master.map(i => classifiable[i]).filter(Boolean) as string[]
    const floorFiles = planSel.floor.map(i => planPool[i]).filter(Boolean) as string[]
    const planFiles = [...masterFiles, ...floorFiles]
    const allFiles = [...galleryFiles, ...planFiles]

    const existing = fs.readdirSync(publicDir).filter(f => /^\d+\./.test(f))
    const startIdx = existing.length === 0 ? 0 : Math.max(...existing.map(f => parseInt(f.split('.')[0], 10))) + 1

    const allUrls = await mapLimit(allFiles, RESIZE_CONCURRENCY, async (f, i) => {
      const src = path.join(tmpDir, f)
      const targetIdx = startIdx + i
      if (resizer) {
        const name = `${targetIdx}.jpg`
        try {
          await execFileP(resizer, [src, '-resize', `${MAX_DIM}x${MAX_DIM}>`, '-strip', '-quality', '82', path.join(publicDir, name)], { timeout: PROC_TIMEOUT_MS })
          return `/images/properties/${id}/${name}`
        } catch (e) { console.error('[pdf-images] resize failed, copying original', e) }
      }
      const ext = path.extname(f).toLowerCase()
      const name = `${targetIdx}${ext}`
      fs.copyFileSync(src, path.join(publicDir, name))
      return `/images/properties/${id}/${name}`
    })

    return { gallery: allUrls.slice(0, galleryFiles.length), floorPlans: allUrls.slice(galleryFiles.length) }
```

(`galleryIdx` indexes `classifiable` in the success path and `galleryPool` in the fallback — `classifiable[i] ?? galleryPool[i]` covers both since `classifiable` is a prefix of `galleryPool`. `masterFiles` map through `classifiable` because `galleryCats` aligns to it; the fallback path leaves `galleryCats=[]` so `planSel.master=[]`.)

- [ ] **Step 4: Confirm the old constant exists** — ensure `const FLOORPLAN_MAX = 12` is still declared near `MAX_CANDIDATES` (Task 1 of feature D added it; if a merge removed it, re-add). The import route is unchanged (it already consumes `{ gallery, floorPlans }`).

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: `✓ Compiled successfully`.

- [ ] **Step 6: Grep for stale references**

Run: `grep -rn "partitionByCategory" worldwise/lib worldwise/app`
Expected: NO matches (it was replaced). If any remain, fix them.

- [ ] **Step 7: Commit**

```bash
git add worldwise/lib/pdf-images.ts
git commit -m "feat(plans): separate geometry-targeted pass extracts unit floor plans (Wave 3/D)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Relabel the section "Floor plans & site plans"

**Files:**
- Modify: `components/FloorPlanGate.tsx`

- [ ] **Step 1: Change the header** — in `components/FloorPlanGate.tsx`, change the line:
```tsx
      <p className="font-serif text-lg text-navy">Floor plans</p>
```
to:
```tsx
      <p className="font-serif text-lg text-navy">Floor plans & site plans</p>
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: `✓ Compiled successfully`.

- [ ] **Step 3: Commit**

```bash
git add worldwise/components/FloorPlanGate.tsx
git commit -m "feat(plans): label the gated section 'Floor plans & site plans' (Wave 3/D)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Whole-feature verification

- [ ] **Step 1: Tests + build + lint**

Run: `node --test --experimental-strip-types lib/*.test.ts` → all pass (incl. the new helpers).
Run: `npm run build` → green.
Run: `npm run lint` → no new errors.

- [ ] **Step 2: Confirm the gallery pipeline is untouched**

Run: `grep -n "MIN_PHOTO_BYTES" worldwise/lib/photo-filter.ts` → still `50 * 1024`.
Confirm `extractImagesFromPdf` still filters the gallery pool with `isLikelyPhoto` (50 KB) and only the SEPARATE plan pool uses `PLAN_MIN_BYTES`/geometry.

- [ ] **Step 3: Real re-import on the server (the decisive test)**

Deploy first (backup → rsync → server build via exit-code branch → pm2 restart), then in `/admin` re-upload `DAMAC ISLANDS 2 Brochure_DIGITAL_ENG_NOV12.pdf`. On the resulting draft (read `data/property-drafts.json` on the server):
- `fields.images` (gallery) contains exteriors/interiors (NO people, NO master-plans) — eyeball 2–3 via `/images/properties/<draftId>/<n>.jpg`.
- `fields.floorPlans` contains the page 73–78 unit layouts + up to 2 site/master plans.
- Logs show the gallery candidate count stays ~94 (NOT 232) and a separate "plan" classify pass ran.

- [ ] **Step 4: No stray data committed**

Run: `git status --short` → only the intended source files; no `data/`, no images.

---

## Self-review notes (author)

- **Spec coverage:** geometry gate (T1 `isLikelyFloorPlanDims`), gallery-without-masterplan (T1 `partitionGallery`), plan-section = 2 master + floorplans (T1 `selectPlanSection`, T2 routing), two pools + two classify passes + identify dims + fallbacks (T2), label (T3), verification incl. real re-import (T4). All covered.
- **Type consistency:** `partitionGallery(cats, cap) -> number[]`, `selectPlanSection(galleryCats, planCats, maxMaster, maxFloor) -> {master, floor}`, `isLikelyFloorPlanDims(w,h) -> boolean` used identically in tests and `pdf-images.ts`. `extractImagesFromPdf` still returns `{ gallery, floorPlans }` (import route unchanged).
- **Gallery safety:** the 50 KB gate and gallery classify path are unchanged; the plan pool is strictly the `<50 KB & ≥12 KB & geometry` set, classified in its OWN call (no effect on the gallery's 120-cap). This is the core guarantee against re-introducing the regression.
