# Gated Floor Plans (Wave 3 / D) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a per-property gated "Floor plans" section — a blurred thumbnail grid on `/properties/[slug]` that reveals full floor-plan images after a lead form, with floor plans auto-split out of the gallery by the PDF import.

**Architecture:** A new optional `Property.floorPlans` field holds image URLs in the existing property image folder (no new storage). A pure `partitionByCategory` helper splits classified import images into gallery vs floor plans; `extractImagesFromPdf` returns both. `FloorPlanGate` (modeled on the shipped `BrochureGate`) shows blurred previews → name+phone form → un-blurred reveal, `source: floor_plan`. Reuses the E gate + import-persistence patterns.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind, file-based JSON, `node:test` for pure helpers, `npm run build` as the gate.

**Repo paths:** git root `/Users/dzhambulat/Projects/Claude`; app in `worldwise/` (run all commands there). If `npm` missing: `export PATH="/Users/dzhambulat/.nvm/versions/node/v24.15.0/bin:$PATH"`. The NBSP path bug is fixed (repo on ASCII path) — Edit/Write work normally.

**Testing reality:** only `node:test` for pure `lib/` helpers; component/route/import tasks verify via `npm run build` + explicit checks (matches CLAUDE.md). Task 1 is true TDD.

---

## File Structure

- Modify `lib/image-classify.ts` — add pure `partitionByCategory` (gallery vs floorplan split).
- Modify `lib/image-classify.test.ts` — tests for it.
- Modify `types/index.ts` — `Property.floorPlans?: string[]`.
- Modify `lib/properties.ts` — `floorPlans` in `ARRAY_FIELDS`.
- Modify `lib/pdf-images.ts` — `extractImagesFromPdf` returns `{ gallery, floorPlans }`.
- Modify `app/api/admin/import/route.ts` — set `fields.images` + `fields.floorPlans` from the split.
- Create `components/FloorPlanGate.tsx` — blurred-grid gate (client).
- Modify `app/properties/[slug]/page.tsx` — mount `FloorPlanGate` when `floorPlans.length`.
- Modify `app/admin/property/PropertyForm.tsx` — floor-plans upload/manage control.
- Modify `CLAUDE.md` — document `floor_plan` source + the field.

---

## Task 1: `partitionByCategory` helper (TDD)

**Files:**
- Modify: `lib/image-classify.ts`
- Test: `lib/image-classify.test.ts`

- [ ] **Step 1: Add failing tests** — append to `lib/image-classify.test.ts`:

```ts
test('partitionByCategory splits gallery (exterior→interior→amenity) from floorplans', () => {
  const cats: ImgCategory[] = ['mood', 'floorplan', 'interior', 'exterior', 'amenity', 'floorplan', 'lifestyle']
  const { gallery, floorPlans } = partitionByCategory(cats, 24, 12)
  assert.deepEqual(gallery, [3, 2, 4]) // exterior(3) → interior(2) → amenity(4)
  assert.deepEqual(floorPlans, [1, 5]) // floorplans in document order
})

test('partitionByCategory respects both caps', () => {
  const cats: ImgCategory[] = ['exterior', 'exterior', 'exterior', 'floorplan', 'floorplan', 'floorplan']
  const r = partitionByCategory(cats, 2, 1)
  assert.deepEqual(r.gallery, [0, 1])
  assert.deepEqual(r.floorPlans, [3])
})
```

Ensure the test file imports `partitionByCategory` and the `ImgCategory` type. The existing import line is:
```ts
import { selectByCategory, normalizeCategory, type ImgCategory } from './image-classify.ts'
```
Add `partitionByCategory` to it (keep whatever names are already imported):
```ts
import { selectByCategory, normalizeCategory, partitionByCategory, type ImgCategory } from './image-classify.ts'
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test --experimental-strip-types lib/image-classify.test.ts`
Expected: FAIL — `partitionByCategory` is not exported.

- [ ] **Step 3: Implement** — in `lib/image-classify.ts`, after `selectByCategory`, add:

```ts
// Split classified candidates into the photo gallery (exterior → interior → amenity,
// ranked, capped at galleryCap) and floor plans (document order, capped at floorPlanCap).
// Floor plans are surfaced separately (gated section) instead of polluting the gallery.
// Pure (no I/O) — unit-tested.
export function partitionByCategory(
  cats: ImgCategory[],
  galleryCap: number,
  floorPlanCap: number,
): { gallery: number[]; floorPlans: number[] } {
  const GALLERY_ORDER: ImgCategory[] = ['exterior', 'interior', 'amenity']
  const gallery: number[] = []
  for (const cat of GALLERY_ORDER) {
    for (let i = 0; i < cats.length; i++) if (cats[i] === cat) gallery.push(i)
  }
  const floorPlans: number[] = []
  for (let i = 0; i < cats.length; i++) if (cats[i] === 'floorplan') floorPlans.push(i)
  return { gallery: gallery.slice(0, galleryCap), floorPlans: floorPlans.slice(0, floorPlanCap) }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test --experimental-strip-types lib/image-classify.test.ts`
Expected: PASS (new + existing `selectByCategory` tests).

- [ ] **Step 5: Commit**

```bash
git add worldwise/lib/image-classify.ts worldwise/lib/image-classify.test.ts
git commit -m "feat(floorplans): partitionByCategory — split gallery vs floor plans (Wave 3/D)"
```

---

## Task 2: `Property.floorPlans` field + coerce whitelist

**Files:**
- Modify: `types/index.ts`
- Modify: `lib/properties.ts:19` (ARRAY_FIELDS)

- [ ] **Step 1: Add the field** — in `types/index.ts`, in `interface Property`, after the `brochure?: string` line add:
```ts
  floorPlans?: string[]   // floor-plan image URLs under /images/properties/<id>/; shown gated, separate from `images`
```

- [ ] **Step 2: Whitelist it** — in `lib/properties.ts`, `ARRAY_FIELDS` is:
```ts
const ARRAY_FIELDS: (keyof Property)[] = ['amenities', 'images']
```
Change to:
```ts
const ARRAY_FIELDS: (keyof Property)[] = ['amenities', 'images', 'floorPlans']
```

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: `✓ Compiled successfully`.

- [ ] **Step 4: Commit**

```bash
git add worldwise/types/index.ts worldwise/lib/properties.ts
git commit -m "feat(floorplans): Property.floorPlans field + coerce whitelist (Wave 3/D)"
```

---

## Task 3: Import splits floor plans out of the gallery

**Files:**
- Modify: `lib/pdf-images.ts`
- Modify: `app/api/admin/import/route.ts`

- [ ] **Step 1: Add a floor-plan cap constant** — in `lib/pdf-images.ts`, after `const MAX_CANDIDATES = 24`, add:
```ts
// Floor plans are surfaced in their own gated section; cap them separately from the gallery.
const FLOORPLAN_MAX = 12
```

- [ ] **Step 2: Switch the import to `partitionByCategory`** — in `lib/pdf-images.ts`, change the import on line 6 from:
```ts
import { classifyImages, selectByCategory, type ImgCategory } from '@/lib/image-classify'
```
to:
```ts
import { classifyImages, partitionByCategory, type ImgCategory } from '@/lib/image-classify'
```

- [ ] **Step 3: Change `extractImagesFromPdf` to return `{ gallery, floorPlans }`** — replace the function signature and the keep/write section. The new signature:
```ts
export async function extractImagesFromPdf(pdfBuf: Buffer, id: string): Promise<{ gallery: string[]; floorPlans: string[] }> {
```
Replace the empty-return on the no-candidates branch (`if (usable.length === 0) return []`) with:
```ts
    if (usable.length === 0) return { gallery: [], floorPlans: [] }
```
Then replace everything from `let keepIdx: number[]` (currently ~line 98) through the `return urls` (currently ~line 139) with:
```ts
    let galleryIdx: number[]
    let floorIdx: number[]
    try {
      if (!resizer) throw new Error('no ImageMagick for thumbnails')
      const thumbs = await mapLimit(classifiable, RESIZE_CONCURRENCY, async (f, i) => {
        const thumbPath = path.join(tmpDir, `thumb-${i}.jpg`)
        await execFileP(resizer, [path.join(tmpDir, f), '-thumbnail', '320x320', '-background', 'white', '-flatten', '-strip', '-quality', '70', thumbPath], { timeout: PROC_TIMEOUT_MS })
        return { b64: fs.readFileSync(thumbPath).toString('base64'), mime: 'image/jpeg' }
      })
      const cats = await classifyImages(thumbs)
      const full: ImgCategory[] = classifiable.map((_, i) => cats[i] ?? 'other')
      const part = partitionByCategory(full, MAX_CANDIDATES, FLOORPLAN_MAX)
      galleryIdx = part.gallery
      floorIdx = part.floorPlans
      if (galleryIdx.length === 0 && floorIdx.length === 0) {
        console.warn('[pdf-images] classifier kept nothing; falling back to document order')
        galleryIdx = classifiable.map((_, i) => i).slice(0, MAX_CANDIDATES)
        floorIdx = []
      }
    } catch (e) {
      console.error('[pdf-images] classification failed; using document order', e)
      galleryIdx = usable.map((_, i) => i).slice(0, MAX_CANDIDATES)
      floorIdx = []
    }

    // Write gallery files first, then floor plans, with continuous numbering, then
    // split the resulting URLs back into the two groups by count.
    const galleryFiles = galleryIdx.map(i => usable[i])
    const floorFiles = floorIdx.map(i => usable[i])
    const allFiles = [...galleryFiles, ...floorFiles]

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

- [ ] **Step 4: Update the import route** — in `app/api/admin/import/route.ts`, the current block is:
```ts
  let imageCandidates: string[] = []
  try {
    imageCandidates = await extractImagesFromPdf(buf, draftId)
  } catch (e) {
    console.error('[import] image extraction failed:', e) // non-fatal — fields still usable
  }
  if (imageCandidates.length) fields.images = imageCandidates
```
Replace it with:
```ts
  let imageCandidates: string[] = []
  try {
    const extracted = await extractImagesFromPdf(buf, draftId)
    if (extracted.gallery.length) fields.images = extracted.gallery
    if (extracted.floorPlans.length) fields.floorPlans = extracted.floorPlans
    imageCandidates = [...extracted.gallery, ...extracted.floorPlans]
  } catch (e) {
    console.error('[import] image extraction failed:', e) // non-fatal — fields still usable
  }
```
(`imageCandidates` is still passed to `addDraft({ imageCandidates, ... })` below — leave that untouched; it now holds both sets for the draft review panel.)

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: `✓ Compiled successfully` (no type error from the changed return type — the import route is the only caller).

- [ ] **Step 6: Verify the only caller was updated**

Run: `grep -rn "extractImagesFromPdf" worldwise/app worldwise/lib`
Expected: definition in `lib/pdf-images.ts` + exactly one call in `app/api/admin/import/route.ts` (now using `.gallery`/`.floorPlans`).

- [ ] **Step 7: Commit**

```bash
git add worldwise/lib/pdf-images.ts worldwise/app/api/admin/import/route.ts
git commit -m "feat(floorplans): import splits floor plans out of the gallery (Wave 3/D)"
```

---

## Task 4: `FloorPlanGate` component

**Files:**
- Create: `components/FloorPlanGate.tsx`

- [ ] **Step 1: Write the component** (modeled on `components/BrochureGate.tsx`; blurred grid → form → reveal)

`components/FloorPlanGate.tsx`:
```tsx
'use client'

import { useState, useRef } from 'react'
import { track } from '@/lib/analytics'

export default function FloorPlanGate({
  floorPlans,
  propertySlug,
  propertyTitle,
}: {
  floorPlans: string[]
  propertySlug: string
  propertyTitle: string
}) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const hpRef = useRef<HTMLInputElement>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !phone.trim()) {
      setError('Please fill in your name and phone number.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          phone,
          source: 'floor_plan',
          propertySlug,
          propertyTitle,
          _hp: hpRef.current?.value ?? '',
        }),
      })
      if (!res.ok) throw new Error('Failed')
      setSuccess(true)
      track('lead_form_submit', { source: 'floor_plan', property: propertyTitle })
    } catch {
      setError('Something went wrong. Please try again or message us on WhatsApp.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="border border-gray-200 rounded-sm p-5 bg-white">
      <p className="font-serif text-lg text-navy">Floor plans</p>
      <p className="text-gray-500 text-sm mt-1 mb-4">
        {floorPlans.length} layout{floorPlans.length > 1 ? 's' : ''} available — enter your details to view.
      </p>

      <div className="grid grid-cols-3 gap-2 mb-4">
        {floorPlans.map((src, i) => (
          success ? (
            <a key={i} href={src} target="_blank" rel="noopener" className="block aspect-square overflow-hidden rounded-sm border border-gray-100">
              <img src={src} alt={`Floor plan ${i + 1}`} className="w-full h-full object-cover" />
            </a>
          ) : (
            <div key={i} className="aspect-square overflow-hidden rounded-sm border border-gray-100 bg-gray-50">
              <img
                src={src}
                alt=""
                aria-hidden="true"
                draggable={false}
                className="w-full h-full object-cover select-none"
                style={{ filter: 'blur(8px)', pointerEvents: 'none', transform: 'scale(1.1)' }}
              />
            </div>
          )
        ))}
      </div>

      {success ? (
        <p className="text-sm text-green-700">Layouts unlocked — tap any plan to open full size.</p>
      ) : open ? (
        <form onSubmit={handleSubmit} className="space-y-3">
          <input ref={hpRef} type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position: 'absolute', width: '1px', height: '1px', margin: '-1px', padding: 0, overflow: 'hidden', clip: 'rect(0,0,0,0)', border: 0 }} />
          <input
            className="input-field"
            placeholder="Full Name *"
            value={name}
            onChange={e => setName(e.target.value)}
            required
          />
          <input
            className="input-field"
            placeholder="WhatsApp / Phone *"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            required
          />
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button type="submit" disabled={loading} className="btn-primary w-full disabled:opacity-60">
            {loading ? 'Sending...' : 'View floor plans'}
          </button>
          <p className="text-xs text-gray-400 text-center">Your layouts unlock instantly.</p>
        </form>
      ) : (
        <button onClick={() => setOpen(true)} className="btn-primary w-full">
          Request layout (free)
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: `✓ Compiled successfully`.

- [ ] **Step 3: Commit**

```bash
git add worldwise/components/FloorPlanGate.tsx
git commit -m "feat(floorplans): blurred-grid lead-gate component (Wave 3/D)"
```

---

## Task 5: Mount on the property page

**Files:**
- Modify: `app/properties/[slug]/page.tsx`

- [ ] **Step 1: Add the import** — after the existing `import BrochureGate from '@/components/BrochureGate'` line add:
```tsx
import FloorPlanGate from '@/components/FloorPlanGate'
```

- [ ] **Step 2: Render it** — in the right sticky column, the current block (after Task 5 of feature E) reads:
```tsx
                {property.brochure && (
                  <div className="mt-6">
                    <BrochureGate
                      propertyId={property.id}
                      propertySlug={property.slug}
                      propertyTitle={property.title}
                    />
                  </div>
                )}
                <div className="mt-6">
                  <SocialProofStrip />
                </div>
```
Insert the floor-plan gate between the brochure block and the `SocialProofStrip` block:
```tsx
                {property.floorPlans && property.floorPlans.length > 0 && (
                  <div className="mt-6">
                    <FloorPlanGate
                      floorPlans={property.floorPlans}
                      propertySlug={property.slug}
                      propertyTitle={property.title}
                    />
                  </div>
                )}
```

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: `✓ Compiled successfully`.

- [ ] **Step 4: Commit**

```bash
git add "worldwise/app/properties/[slug]/page.tsx"
git commit -m "feat(floorplans): mount FloorPlanGate on property page when set (Wave 3/D)"
```

---

## Task 6: PropertyForm floor-plans control

**Files:**
- Modify: `app/admin/property/PropertyForm.tsx`

- [ ] **Step 1: Add state** — next to the `brochure` state added in feature E (near the other `useState`/`useRef` lines), add:
```tsx
  const [floorPlans, setFloorPlans] = useState<string[]>(property?.floorPlans ?? [])
  const [uploadingFloorPlans, setUploadingFloorPlans] = useState(false)
  const floorPlanInputRef = useRef<HTMLInputElement>(null)
```

- [ ] **Step 2: Add the upload + remove handlers** — after the existing `handleBrochureFile` function add:
```tsx
  async function handleFloorPlanFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return
    setUploadingFloorPlans(true)
    setError('')
    const fd = new FormData()
    fd.append('propertyId', propertyId)
    fd.append('kind', 'gallery') // floor plans are images written to the same property folder
    Array.from(fileList).forEach(f => fd.append('files', f))
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      const data = await res.json()
      if (res.ok && data.paths) {
        setFloorPlans(prev => [...prev, ...data.paths])
      } else {
        setError(data.error || 'Floor plan upload failed.')
      }
    } catch {
      setError('Floor plan upload failed.')
    }
    setUploadingFloorPlans(false)
    if (floorPlanInputRef.current) floorPlanInputRef.current.value = ''
  }

  function removeFloorPlan(idx: number) {
    setFloorPlans(prev => prev.filter((_, i) => i !== idx))
  }
```

- [ ] **Step 3: Include in the saved payload** — in the `payload` object (the one with `id: propertyId`, `brochure: brochure || undefined`), add:
```tsx
      floorPlans,
```

- [ ] **Step 4: Add the UI control** — directly after the brochure control block added in feature E (the `{brochure && (...Remove brochure...)}` block), add:
```tsx
        <label className="block text-xs font-medium text-gray-500 mb-1.5 mt-5">Floor plans (gated on the property page)</label>
        <div
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); handleFloorPlanFiles(e.dataTransfer.files) }}
          onClick={() => floorPlanInputRef.current?.click()}
          className="border-2 border-dashed border-gray-200 rounded-sm p-5 text-center hover:border-gold transition-colors cursor-pointer"
        >
          <input
            ref={floorPlanInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="hidden"
            onChange={e => handleFloorPlanFiles(e.target.files)}
          />
          <p className="text-sm text-gray-500">
            {uploadingFloorPlans ? 'Uploading...' : 'Drop floor-plan images here or click to choose'}
          </p>
          <p className="text-xs text-gray-400 mt-1">JPG / PNG / WebP · shown blurred until a visitor submits the lead form</p>
        </div>
        {floorPlans.length > 0 && (
          <div className="grid grid-cols-4 gap-2 mt-2">
            {floorPlans.map((src, idx) => (
              <div key={idx} className="relative group border border-gray-100 rounded-sm overflow-hidden bg-white">
                <img src={src} alt={`Floor plan ${idx + 1}`} className="w-full h-20 object-cover" />
                <button
                  type="button"
                  onClick={() => removeFloorPlan(idx)}
                  className="absolute top-0.5 right-0.5 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-sm opacity-0 group-hover:opacity-100"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
```

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: `✓ Compiled successfully`.

- [ ] **Step 6: Commit**

```bash
git add worldwise/app/admin/property/PropertyForm.tsx
git commit -m "feat(floorplans): PropertyForm floor-plans upload/manage control (Wave 3/D)"
```

---

## Task 7: Document the source + field in CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Add the lead source** — in the "Lead `source` strings in use" list, append `floor_plan` next to `brochure_request`:
```
`golden_visa`, `lead_magnet_guide`, `brochure_request`, `floor_plan`, `property_card`, `mobile_bar`,
```

- [ ] **Step 2: Add a one-line note** — directly after the "Per-property brochure (Wave 3/E)" bullet added in feature E, add:
```
- **Per-property floor plans** (Wave 3/D) — `FloorPlanGate` on `/properties/[slug]` (shown only when `Property.floorPlans` is non-empty) shows blurred thumbnails, then reveals the full images after a name+phone form, `source: floor_plan`. Floor-plan images live in the existing `public/images/properties/<id>/` folder (served by the media route); the PDF import splits `floorplan`-classified images into `floorPlans` (out of the gallery) via `partitionByCategory`, and `PropertyForm` can upload more.
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(floorplans): document floor_plan source + floorPlans field (Wave 3/D)"
```

---

## Task 8: Whole-feature verification

- [ ] **Step 1: Full test + build**

Run: `node --test --experimental-strip-types lib/*.test.ts` → all pass (incl. new `partitionByCategory` tests).
Run: `npm run build` → `✓ Compiled successfully`.

- [ ] **Step 2: Lint**

Run: `npm run lint` → no new errors (a pre-existing `no-img-element` warning in `Navigation.tsx` is unrelated; `FloorPlanGate`/`PropertyForm` use `<img>` deliberately for gated/admin thumbnails).

- [ ] **Step 3: Confirm the gallery/floorplan split is wired**

Run: `grep -n "floorPlans" worldwise/lib/pdf-images.ts worldwise/app/api/admin/import/route.ts worldwise/types/index.ts worldwise/lib/properties.ts`
Expected: field defined (types), whitelisted (properties), produced by `extractImagesFromPdf`, and set on `fields.floorPlans` in the import route.

- [ ] **Step 4: No stray data committed**

Run: `git status --short` → only intended source files across the task commits; no `data/*.json`, no images.

---

## Self-review notes (author)

- **Spec coverage:** field (T2), import split via pure helper (T1+T3), gallery removal (T3 sets `images=gallery`, `floorPlans=floorPlans`), gated blurred-grid component + honeypot + source (T4), mount (T5), PropertyForm manual (T6), source doc (T7). All covered.
- **Type consistency:** `partitionByCategory(cats, galleryCap, floorPlanCap) → { gallery, floorPlans }` used identically in T1/T3; `floorPlans` field name consistent across types, coerce, extract return, import, component prop, PropertyForm state, payload.
- **Only-caller check (T3/Step 6):** `extractImagesFromPdf` return-type change is safe because the import route is its sole caller.
- **No new storage / no data writes committed:** floor plans reuse the property image folder; every task stages named source files only.
