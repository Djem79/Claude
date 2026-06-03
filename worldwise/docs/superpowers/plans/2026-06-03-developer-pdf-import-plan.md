# Developer PDF → Property Import — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an admin upload a developer's project PDF on `/admin`, have AI pre-fill a property draft (fields + photos extracted from the PDF), review/edit it, and publish it to the live catalog.

**Architecture:** A staging-then-approve pipeline. Gemini `gemini-2.5-flash` (multimodal) extracts text fields from the PDF; `poppler-utils` (`pdfimages`/`pdftoppm`) extracts embedded photos straight into `public/images/properties/<draftId>/`. Drafts live in `data/property-drafts.json`. The `draftId` is a numeric string that **becomes the property `id` on publish**, so extracted images never need to move. Publishing routes through the existing `coercePropertyInput()` + `createProperty()`.

**Tech Stack:** Next.js 14 App Router, TypeScript, Gemini REST API, poppler-utils (system binary), `node:test` for pure-helper unit tests.

---

## File Structure

**New files:**
- `lib/property-map.ts` — pure: `mapGeminiToProperty(raw) → Partial<Property>` (clamp/clean Gemini output). Dependency-free (only `import type`), unit-tested.
- `lib/property-map.test.ts` — unit tests for the mapper.
- `lib/pdf-images.ts` — `isLikelyPhoto()` (pure) + `extractImagesFromPdf()` (shells poppler). Unit-tested for the pure part.
- `lib/pdf-images.test.ts` — unit tests for `isLikelyPhoto`.
- `lib/property-extract.ts` — `extractPropertyFromPdf(buf)` Gemini multimodal call (network; build-checked only).
- `lib/property-drafts.ts` — draft store (CRUD + publish/reject) over `data/property-drafts.json`.
- `app/api/admin/import/route.ts` — `POST` (upload+extract) / `GET` (list drafts).
- `app/api/admin/import/[draftId]/route.ts` — `PUT` (update fields) / `DELETE` (reject).
- `app/api/admin/import/[draftId]/publish/route.ts` — `POST` (publish).
- `app/admin/ImportPanel.tsx` — client UI (upload control + pending-drafts list).

**Modified files:**
- `types/index.ts` — add `PropertyDraft` interface.
- `app/admin/page.tsx` — render `<ImportPanel>` above the Properties table.
- `app/admin/property/PropertyForm.tsx` — accept optional `draftId`; in draft mode submit to the publish endpoint.
- `app/admin/property/new/page.tsx` — when `?draft=<id>`, load the draft and prefill `PropertyForm`.
- `.gitignore` (repo root) — ignore `worldwise/data/property-drafts.json`.

---

### Task 1: `PropertyDraft` type + pure Gemini→Property mapper (TDD)

**Files:**
- Modify: `types/index.ts` (append after the `Property` interface)
- Create: `lib/property-map.ts`
- Test: `lib/property-map.test.ts`

- [ ] **Step 1: Add the `PropertyDraft` type**

In `types/index.ts`, after the `Property` interface, add:

```ts
export interface PropertyDraft {
  draftId: string            // numeric string; reused as the property id on publish
  fields: Partial<Property>  // AI-extracted, cleaned property fields
  imageCandidates: string[]  // /images/properties/<draftId>/<n>.png paths from the PDF
  sourcePdf: string          // original uploaded filename (for display)
  extractedAt: string        // ISO timestamp
  status: 'pending'
}
```

- [ ] **Step 2: Write the failing test**

Create `lib/property-map.test.ts`:

```ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mapGeminiToProperty } from './property-map.ts'

test('keeps known string fields and trims them', () => {
  const out = mapGeminiToProperty({ title: '  Marina Vista  ', developer: 'Emaar', area: 'Dubai Marina' })
  assert.equal(out.title, 'Marina Vista')
  assert.equal(out.developer, 'Emaar')
  assert.equal(out.area, 'Dubai Marina')
})

test('coerces numeric priceAed and drops non-numbers', () => {
  assert.equal(mapGeminiToProperty({ priceAed: '2500000' }).priceAed, 2500000)
  assert.equal(mapGeminiToProperty({ priceAed: 'N/A' }).priceAed, undefined)
})

test('clamps type/status to allowed enums, ignores invalid', () => {
  assert.equal(mapGeminiToProperty({ type: 'villa' }).type, 'villa')
  assert.equal(mapGeminiToProperty({ type: 'castle' }).type, undefined)
  assert.equal(mapGeminiToProperty({ status: 'off-plan' }).status, 'off-plan')
})

test('drops null/empty values entirely (no empty keys)', () => {
  const out = mapGeminiToProperty({ title: 'X', developer: null, area: '' })
  assert.equal(out.title, 'X')
  assert.ok(!('developer' in out))
  assert.ok(!('area' in out))
})

test('cleans amenities array', () => {
  assert.deepEqual(mapGeminiToProperty({ amenities: [' Pool ', '', 'Gym', 3] }).amenities, ['Pool', 'Gym'])
})

test('returns empty object for junk input', () => {
  assert.deepEqual(mapGeminiToProperty(null), {})
  assert.deepEqual(mapGeminiToProperty('nope'), {})
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `node --test --experimental-strip-types lib/property-map.test.ts`
Expected: FAIL — `Cannot find module './property-map.ts'`.

- [ ] **Step 4: Write the implementation**

Create `lib/property-map.ts`:

```ts
import type { Property } from '@/types'

const TYPES = ['apartment', 'villa', 'townhouse', 'penthouse'] as const
const STATUSES = ['off-plan', 'secondary', 'rent'] as const

function str(v: unknown, max: number): string | undefined {
  if (typeof v !== 'string') return undefined
  const s = v.trim().slice(0, max)
  return s || undefined
}
function num(v: unknown): number | undefined {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN
  return Number.isFinite(n) ? n : undefined
}

/**
 * Clean + clamp one Gemini-extracted object into a partial Property. Mirrors the
 * whitelist/coercion rules of coercePropertyInput so the draft is form-ready, but
 * tolerant: anything missing/invalid is simply omitted (never invented). Pure +
 * dependency-free so it's unit-testable with node:test.
 */
export function mapGeminiToProperty(raw: unknown): Partial<Property> {
  if (!raw || typeof raw !== 'object') return {}
  const r = raw as Record<string, unknown>
  const out: Partial<Property> = {}

  const strFields: [keyof Property, number][] = [
    ['title', 200], ['developer', 120], ['area', 120], ['bedrooms', 60],
    ['completionDate', 60], ['paymentPlan', 400],
    ['shortDescription', 400], ['description', 8000],
  ]
  for (const [k, max] of strFields) {
    const s = str(r[k], max)
    if (s !== undefined) (out[k] as string) = s
  }

  const price = num(r.priceAed); if (price !== undefined) out.priceAed = price
  const ppsf = num(r.pricePerSqft); if (ppsf !== undefined) out.pricePerSqft = ppsf

  if (typeof r.type === 'string' && (TYPES as readonly string[]).includes(r.type)) out.type = r.type as Property['type']
  if (typeof r.status === 'string' && (STATUSES as readonly string[]).includes(r.status)) out.status = r.status as Property['status']

  if (Array.isArray(r.amenities)) {
    out.amenities = r.amenities
      .filter((x): x is string => typeof x === 'string')
      .map(x => x.trim().slice(0, 300))
      .filter(Boolean)
      .slice(0, 100)
  }
  return out
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node --test --experimental-strip-types lib/property-map.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 6: Commit**

```bash
git add worldwise/types/index.ts worldwise/lib/property-map.ts worldwise/lib/property-map.test.ts
git commit -m "feat(import): PropertyDraft type + pure Gemini→Property mapper"
```

---

### Task 2: PDF image extraction helper (TDD for the pure filter)

**Files:**
- Create: `lib/pdf-images.ts`
- Test: `lib/pdf-images.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/pdf-images.test.ts`:

```ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isLikelyPhoto, MIN_PHOTO_BYTES } from './pdf-images.ts'

test('rejects non-image extensions regardless of size', () => {
  assert.equal(isLikelyPhoto(MIN_PHOTO_BYTES + 1, 'img-000.txt'), false)
})

test('rejects tiny images (logos/icons)', () => {
  assert.equal(isLikelyPhoto(2_000, 'img-000.png'), false)
})

test('accepts large web-safe images', () => {
  assert.equal(isLikelyPhoto(MIN_PHOTO_BYTES + 1, 'img-000.png'), true)
  assert.equal(isLikelyPhoto(200_000, 'page-1.jpg'), true)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test --experimental-strip-types lib/pdf-images.test.ts`
Expected: FAIL — `Cannot find module './pdf-images.ts'`.

- [ ] **Step 3: Write the implementation**

Create `lib/pdf-images.ts`:

```ts
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

// Below this, an extracted image is almost certainly a logo/icon/divider, not a
// render worth showing. Tuned for developer brochures (real renders are >100KB).
export const MIN_PHOTO_BYTES = 50 * 1024

export function isLikelyPhoto(bytes: number, filename: string): boolean {
  if (!/\.(jpe?g|png)$/i.test(filename)) return false
  return bytes >= MIN_PHOTO_BYTES
}

/**
 * Extract candidate photos from a PDF straight into public/images/properties/<id>/,
 * named with the gallery's numeric convention (0.png, 1.png …) so PropertyForm's
 * existing uploader appends cleanly afterwards. Returns the public URL paths.
 *
 * Primary: `pdfimages -png` (embedded rasters, forced to web-safe PNG). Fallback
 * when none survive the size filter: `pdftoppm -png` (rasterize each page). Both
 * are poppler-utils binaries invoked via child_process — no npm native addon.
 */
export function extractImagesFromPdf(pdfBuf: Buffer, id: string): string[] {
  const publicDir = path.join(process.cwd(), 'public', 'images', 'properties', id)
  fs.mkdirSync(publicDir, { recursive: true })
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pdfimg-'))
  const pdfPath = path.join(tmpDir, 'in.pdf')
  fs.writeFileSync(pdfPath, pdfBuf)

  const collect = (prefix: string) =>
    fs.readdirSync(tmpDir)
      .filter(f => f.startsWith(prefix) && /\.(png|jpe?g)$/i.test(f))
      .filter(f => isLikelyPhoto(fs.statSync(path.join(tmpDir, f)).size, f))
      .sort()

  try { execFileSync('pdfimages', ['-png', pdfPath, path.join(tmpDir, 'img')], { stdio: 'ignore' }) }
  catch (e) { console.error('[pdf-images] pdfimages failed', e) }
  let usable = collect('img')

  if (usable.length === 0) {
    try { execFileSync('pdftoppm', ['-png', '-r', '150', pdfPath, path.join(tmpDir, 'page')], { stdio: 'ignore' }) }
    catch (e) { console.error('[pdf-images] pdftoppm failed', e) }
    usable = collect('page')
  }

  // Continue the gallery's numeric naming after anything already present.
  const existing = fs.readdirSync(publicDir).filter(f => /^\d+\./.test(f))
  let idx = existing.length === 0 ? 0 : Math.max(...existing.map(f => parseInt(f, 10))) + 1

  const urls: string[] = []
  for (const f of usable) {
    const name = `${idx}.png`
    fs.copyFileSync(path.join(tmpDir, f), path.join(publicDir, name))
    urls.push(`/images/properties/${id}/${name}`)
    idx++
  }
  fs.rmSync(tmpDir, { recursive: true, force: true })
  return urls
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test --experimental-strip-types lib/pdf-images.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add worldwise/lib/pdf-images.ts worldwise/lib/pdf-images.test.ts
git commit -m "feat(import): PDF photo extraction via poppler (pdfimages + pdftoppm fallback)"
```

---

### Task 3: Gemini multimodal extraction call

**Files:**
- Create: `lib/property-extract.ts`

(No unit test — network call; verified by `npm run build` + manual run. Follows the established `scripts/generate-article.mjs` Gemini pattern.)

- [ ] **Step 1: Write the implementation**

Create `lib/property-extract.ts`:

```ts
import type { Property } from '@/types'
import { mapGeminiToProperty } from '@/lib/property-map'

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    title: { type: 'STRING' },
    developer: { type: 'STRING' },
    area: { type: 'STRING' },
    type: { type: 'STRING', enum: ['apartment', 'villa', 'townhouse', 'penthouse'] },
    status: { type: 'STRING', enum: ['off-plan', 'secondary', 'rent'] },
    priceAed: { type: 'NUMBER' },
    pricePerSqft: { type: 'NUMBER' },
    bedrooms: { type: 'STRING' },
    completionDate: { type: 'STRING' },
    paymentPlan: { type: 'STRING' },
    shortDescription: { type: 'STRING' },
    description: { type: 'STRING' },
    amenities: { type: 'ARRAY', items: { type: 'STRING' } },
  },
} as const

const SYSTEM = `You extract structured real-estate listing data from a Dubai developer project brochure (PDF). Return ONLY information actually present in the document. If a field is not in the PDF, omit it — never invent prices, sizes, names, or amenities. priceAed = the starting/from price in AED as a plain number (no currency symbol, no commas, no "from"). bedrooms = a human label like "Studio", "1-3 BR". status: "off-plan" for under-construction/launch projects, "secondary" for ready resale, "rent" only for rentals. type = the dominant unit type. description = 2-4 factual sentences. shortDescription = one sentence.`

/**
 * Send the whole PDF to Gemini multimodal and return cleaned, partial property
 * fields. Throws on missing key / API error / unparseable response — the caller
 * surfaces that to the admin.
 */
export async function extractPropertyFromPdf(pdfBuf: Buffer): Promise<Partial<Property>> {
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new Error('GEMINI_API_KEY not set')

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM }] },
        contents: [{
          parts: [
            { inlineData: { mimeType: 'application/pdf', data: pdfBuf.toString('base64') } },
            { text: 'Extract this project’s details into the schema.' },
          ],
        }],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 2048,
          thinkingConfig: { thinkingBudget: 0 },
          responseMimeType: 'application/json',
          responseSchema: SCHEMA,
        },
      }),
    }
  )
  if (!res.ok) throw new Error(`Gemini error ${res.status}: ${await res.text()}`)
  const j = await res.json()
  const text = j.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('Empty Gemini response')
  return mapGeminiToProperty(JSON.parse(text))
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `npm run build`
Expected: build succeeds (the new module compiles; no route uses it yet).

- [ ] **Step 3: Commit**

```bash
git add worldwise/lib/property-extract.ts
git commit -m "feat(import): Gemini multimodal PDF field extraction"
```

---

### Task 4: Draft store (`lib/property-drafts.ts`)

**Files:**
- Create: `lib/property-drafts.ts`
- Modify: `.gitignore` (repo root)

(No unit test — fs-backed; the pure logic it relies on, `coercePropertyInput`, is already covered. Verified via build + the API/E2E tasks.)

- [ ] **Step 1: Ignore the new data file**

In the repo-root `.gitignore`, under the lead-data section, add:

```gitignore
# Transient import staging — server-only, like other data/ stores.
worldwise/data/property-drafts.json
```

- [ ] **Step 2: Write the implementation**

Create `lib/property-drafts.ts`:

```ts
import fs from 'fs'
import path from 'path'
import { writeFileAtomic } from '@/lib/atomic-write'
import { coercePropertyInput, createProperty } from '@/lib/properties'
import { revalidatePropertyPages } from '@/lib/revalidate'
import type { Property, PropertyDraft } from '@/types'

const DRAFTS_PATH = path.join(process.cwd(), 'data', 'property-drafts.json')

function read(): PropertyDraft[] {
  try {
    if (!fs.existsSync(DRAFTS_PATH)) return []
    const parsed = JSON.parse(fs.readFileSync(DRAFTS_PATH, 'utf-8'))
    return Array.isArray(parsed) ? parsed : []
  } catch (e) {
    console.error('[property-drafts] read failed:', e)
    return []
  }
}
function write(drafts: PropertyDraft[]): void {
  writeFileAtomic(DRAFTS_PATH, JSON.stringify(drafts, null, 2))
}

export function listDrafts(): PropertyDraft[] { return read() }
export function getDraft(id: string): PropertyDraft | null { return read().find(d => d.draftId === id) ?? null }

export function addDraft(draft: PropertyDraft): void {
  const all = read()
  all.unshift(draft)
  write(all)
}

export function updateDraftFields(id: string, fields: Partial<Property>): PropertyDraft | null {
  const all = read()
  const i = all.findIndex(d => d.draftId === id)
  if (i === -1) return null
  all[i] = { ...all[i], fields: { ...all[i].fields, ...fields } }
  write(all)
  return all[i]
}

function removeRecord(id: string): void {
  write(read().filter(d => d.draftId !== id))
}

/** Reject: drop the draft record AND its extracted-image folder. */
export function rejectDraft(id: string): boolean {
  if (!getDraft(id)) return false
  removeRecord(id)
  fs.rmSync(path.join(process.cwd(), 'public', 'images', 'properties', id), { recursive: true, force: true })
  return true
}

/**
 * Publish: merge stored draft fields with any edited fields, validate via the
 * canonical coercePropertyInput, then create the property reusing draftId as its
 * id — so the already-extracted images under properties/<id>/ are correct as-is.
 * Drops only the draft RECORD (keeps the image folder, now owned by the property).
 */
export function publishDraft(
  id: string,
  edited: Partial<Property>
): { ok: true; property: Property } | { ok: false; error: string } {
  const draft = getDraft(id)
  if (!draft) return { ok: false, error: 'Draft not found' }
  const merged = { ...draft.fields, ...edited }
  const parsed = coercePropertyInput(merged, { partial: false })
  if (!parsed.ok) return { ok: false, error: parsed.error }
  parsed.value.id = id
  const property = createProperty(parsed.value as Omit<Property, 'createdAt'> & { id?: string })
  removeRecord(id)
  revalidatePropertyPages()
  return { ok: true, property }
}
```

- [ ] **Step 3: Verify it type-checks**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add worldwise/lib/property-drafts.ts .gitignore
git commit -m "feat(import): property draft store (staging + publish/reject)"
```

---

### Task 5: API routes

**Files:**
- Create: `app/api/admin/import/route.ts`
- Create: `app/api/admin/import/[draftId]/route.ts`
- Create: `app/api/admin/import/[draftId]/publish/route.ts`

(All guarded with `requireSection('properties')` → 403, on every handler — project invariant.)

- [ ] **Step 1: Create the upload + list route**

Create `app/api/admin/import/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { requireSection } from '@/lib/auth'
import { extractPropertyFromPdf } from '@/lib/property-extract'
import { extractImagesFromPdf } from '@/lib/pdf-images'
import { addDraft, listDrafts } from '@/lib/property-drafts'

export const dynamic = 'force-dynamic'
const MAX_BYTES = 25 * 1024 * 1024 // 25 MB

export async function GET() {
  if (!(await requireSection('properties'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  return NextResponse.json(listDrafts())
}

export async function POST(req: NextRequest) {
  if (!(await requireSection('properties'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const form = await req.formData()
  const file = form.get('file')
  if (!(file instanceof File)) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'File too large (max 25 MB)' }, { status: 400 })

  const buf = Buffer.from(await file.arrayBuffer())
  // Magic-bytes check — never trust the upload's declared type (mirrors /api/upload).
  if (buf.length < 5 || buf.toString('ascii', 0, 5) !== '%PDF-') {
    return NextResponse.json({ error: 'Not a PDF file' }, { status: 400 })
  }

  const draftId = String(Date.now())
  let fields
  try {
    fields = await extractPropertyFromPdf(buf)
  } catch (e) {
    return NextResponse.json({ error: `Extraction failed: ${(e as Error).message}` }, { status: 502 })
  }

  let imageCandidates: string[] = []
  try {
    imageCandidates = extractImagesFromPdf(buf, draftId)
  } catch (e) {
    console.error('[import] image extraction failed:', e) // non-fatal — fields still usable
  }
  if (imageCandidates.length) fields.images = imageCandidates

  addDraft({
    draftId,
    fields,
    imageCandidates,
    sourcePdf: file.name.slice(0, 200),
    extractedAt: new Date().toISOString(),
    status: 'pending',
  })
  return NextResponse.json({ draftId }, { status: 201 })
}
```

- [ ] **Step 2: Create the update + reject route**

Create `app/api/admin/import/[draftId]/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { requireSection } from '@/lib/auth'
import { coercePropertyInput } from '@/lib/properties'
import { updateDraftFields, rejectDraft } from '@/lib/property-drafts'
import { Property } from '@/types'

export async function PUT(req: NextRequest, { params }: { params: { draftId: string } }) {
  if (!(await requireSection('properties'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const parsed = coercePropertyInput(body, { partial: true })
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const updated = updateDraftFields(params.draftId, parsed.value as Partial<Property>)
  if (!updated) return NextResponse.json({ error: 'Draft not found' }, { status: 404 })
  return NextResponse.json(updated)
}

export async function DELETE(_req: NextRequest, { params }: { params: { draftId: string } }) {
  if (!(await requireSection('properties'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  return NextResponse.json({ ok: rejectDraft(params.draftId) })
}
```

- [ ] **Step 3: Create the publish route**

Create `app/api/admin/import/[draftId]/publish/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { requireSection } from '@/lib/auth'
import { publishDraft } from '@/lib/property-drafts'
import { Property } from '@/types'

export async function POST(req: NextRequest, { params }: { params: { draftId: string } }) {
  if (!(await requireSection('properties'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  // Body is optional: quick-publish (ImportPanel) sends nothing and publishes the
  // stored draft fields; edit-publish (PropertyForm) sends the full edited payload.
  let edited: Partial<Property> = {}
  try {
    const body = await req.json()
    if (body && typeof body === 'object') edited = body as Partial<Property>
  } catch { /* empty body → publish stored fields as-is */ }

  const result = publishDraft(params.draftId, edited)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json(result.property, { status: 201 })
}
```

- [ ] **Step 4: Verify it type-checks**

Run: `npm run build`
Expected: build succeeds; new routes listed in the build output under `/api/admin/import`.

- [ ] **Step 5: Commit**

```bash
git add worldwise/app/api/admin/import
git commit -m "feat(import): API routes — upload/extract, list, update, reject, publish"
```

---

### Task 6: PropertyForm draft-publish support

**Files:**
- Modify: `app/admin/property/PropertyForm.tsx`

- [ ] **Step 1: Add the `draftId` prop and adjust edit detection**

In `app/admin/property/PropertyForm.tsx`, change the component signature and the `isEdit` line:

Find:
```tsx
export default function PropertyForm({ property }: { property?: Property }) {
  const isEdit = !!property
```
Replace with:
```tsx
export default function PropertyForm({ property, draftId }: { property?: Property; draftId?: string }) {
  // Draft prefill is NOT an edit: there is no saved property yet, so we publish
  // (POST) rather than PUT against a non-existent id.
  const isEdit = !!property && !draftId
```

- [ ] **Step 2: Route the submit to the publish endpoint in draft mode**

In the same file, find the submit target lines:
```tsx
    const url = isEdit ? `/api/properties/${property!.id}` : '/api/properties'
    const method = isEdit ? 'PUT' : 'POST'
```
Replace with:
```tsx
    const url = draftId
      ? `/api/admin/import/${draftId}/publish`
      : isEdit ? `/api/properties/${property!.id}` : '/api/properties'
    const method = draftId ? 'POST' : isEdit ? 'PUT' : 'POST'
```

(The existing `payload` already carries `id: propertyId` (= draftId), `slug`, `images`, `amenities`, etc. The publish endpoint feeds it through `coercePropertyInput`, so no payload change is needed. On success the existing `router.push('/admin'); router.refresh()` runs.)

- [ ] **Step 3: Verify it type-checks**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add worldwise/app/admin/property/PropertyForm.tsx
git commit -m "feat(import): PropertyForm publishes drafts when ?draft is set"
```

---

### Task 7: Load draft into the New-Property page

**Files:**
- Modify: `app/admin/property/new/page.tsx`

- [ ] **Step 1: Read `?draft` and prefill the form**

Replace the entire contents of `app/admin/property/new/page.tsx` with:

```tsx
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { canAccess, landingPath } from '@/lib/permissions'
import { getDraft } from '@/lib/property-drafts'
import { Property } from '@/types'
import PropertyForm from '../PropertyForm'

export const dynamic = 'force-dynamic'

export default async function NewPropertyPage({ searchParams }: { searchParams: { draft?: string } }) {
  const session = await getSession()
  if (!session) redirect('/admin/login')
  if (!canAccess(session, 'properties')) redirect(landingPath(session) ?? '/admin')

  const draftId = typeof searchParams.draft === 'string' ? searchParams.draft : undefined
  let prefill: Property | undefined
  let activeDraftId: string | undefined

  if (draftId) {
    const d = getDraft(draftId)
    if (d) {
      activeDraftId = draftId
      // Build a full Property shape for the form: blank defaults, draft fields on
      // top, id = draftId, images = the extracted candidates.
      prefill = {
        id: draftId, slug: '', title: '', developer: '', area: '',
        type: 'apartment', status: 'off-plan', priceAed: 0,
        bedrooms: '', description: '', shortDescription: '',
        amenities: [], images: [], featured: false, createdAt: '',
        ...d.fields,
        images: d.imageCandidates.length ? d.imageCandidates : (d.fields.images ?? []),
      }
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-8 py-10">
      <PropertyForm property={prefill} draftId={activeDraftId} />
    </div>
  )
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add worldwise/app/admin/property/new/page.tsx
git commit -m "feat(import): prefill PropertyForm from a draft via ?draft"
```

---

### Task 8: ImportPanel UI wired into `/admin`

**Files:**
- Create: `app/admin/ImportPanel.tsx`
- Modify: `app/admin/page.tsx`

- [ ] **Step 1: Create the ImportPanel client component**

Create `app/admin/ImportPanel.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { PropertyDraft } from '@/types'

export default function ImportPanel({ initialDrafts }: { initialDrafts: PropertyDraft[] }) {
  const router = useRouter()
  const [drafts, setDrafts] = useState<PropertyDraft[]>(initialDrafts)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function refresh() {
    const res = await fetch('/api/admin/import')
    if (res.ok) setDrafts(await res.json())
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy(true); setError('')
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/admin/import', { method: 'POST', body: fd })
    if (!res.ok) setError((await res.json().catch(() => ({}))).error || 'Import failed')
    else await refresh()
    setBusy(false)
    e.target.value = ''
  }

  async function publish(id: string) {
    setBusy(true); setError('')
    const res = await fetch(`/api/admin/import/${id}/publish`, { method: 'POST' })
    setBusy(false)
    if (res.ok) { await refresh(); router.refresh() }
    else setError((await res.json().catch(() => ({}))).error || 'Publish failed')
  }

  async function reject(id: string) {
    if (!confirm('Reject and delete this draft?')) return
    await fetch(`/api/admin/import/${id}`, { method: 'DELETE' })
    await refresh()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="font-serif text-2xl text-navy">Import from PDF</h2>
        <label className={`btn-outline text-sm px-5 py-2.5 cursor-pointer ${busy ? 'opacity-50 pointer-events-none' : ''}`}>
          {busy ? 'Working…' : '+ Upload developer PDF'}
          <input type="file" accept="application/pdf" className="hidden" onChange={onFile} disabled={busy} />
        </label>
      </div>

      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

      {drafts.length === 0 ? (
        <p className="text-gray-400 text-sm mb-4">No pending imports. Upload a developer brochure PDF to extract a draft.</p>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
          {drafts.map(d => (
            <div key={d.draftId} className="bg-white rounded-sm shadow-sm border border-gray-100 p-4">
              {d.imageCandidates[0] && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={d.imageCandidates[0]} alt="" className="w-full h-32 object-cover rounded-sm mb-3" />
              )}
              <p className="font-medium text-navy truncate">{d.fields.title || '(untitled)'}</p>
              <p className="text-xs text-gray-500 truncate">{d.fields.developer || '—'} · {d.fields.area || '—'}</p>
              <p className="text-xs text-gray-400 mt-1">
                {d.fields.priceAed ? `AED ${d.fields.priceAed.toLocaleString()}` : 'no price'} · {d.imageCandidates.length} photo(s)
              </p>
              <p className="text-[11px] text-gray-300 truncate mt-1" title={d.sourcePdf}>{d.sourcePdf}</p>
              <div className="flex gap-3 mt-3 text-xs">
                <Link href={`/admin/property/new?draft=${d.draftId}`} className="text-gold-accessible hover:underline">Review &amp; edit</Link>
                <button onClick={() => publish(d.draftId)} disabled={busy} className="text-green-600 hover:underline">Publish</button>
                <button onClick={() => reject(d.draftId)} className="text-red-400 hover:text-red-600">Reject</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Render ImportPanel on the admin page**

In `app/admin/page.tsx`:

Add imports near the top (after the existing `import AdminPropertyActions`):
```tsx
import ImportPanel from './ImportPanel'
import { listDrafts } from '@/lib/property-drafts'
```

Add the drafts read next to the existing data reads:
```tsx
  const properties = getProperties()
  const leads = getLeads()
  const drafts = listDrafts()
```

Insert the panel between the stats row `</div>` and the `{/* Properties table */}` block:
```tsx
      {/* Import from PDF */}
      <ImportPanel initialDrafts={drafts} />

      {/* Properties table */}
```

- [ ] **Step 3: Verify build + unit tests**

Run: `npm run build`
Expected: build succeeds; `/admin` compiles.

Run: `node --test --experimental-strip-types lib/*.test.ts`
Expected: all tests pass (existing + the two new files).

- [ ] **Step 4: Commit**

```bash
git add worldwise/app/admin/ImportPanel.tsx worldwise/app/admin/page.tsx
git commit -m "feat(import): ImportPanel on /admin (upload + pending drafts queue)"
```

---

### Task 9: Server prep + end-to-end verification

**Files:** none (ops + manual verification)

- [ ] **Step 1: Install poppler-utils on the server**

```bash
ssh -i ~/.ssh/id_ed25519 root@62.238.35.20 "apt-get update && apt-get install -y poppler-utils && pdfimages -v && pdftoppm -v"
```
Expected: both commands print a version (poppler 22.x or similar).

- [ ] **Step 2: Install poppler locally (for local manual test, optional)**

```bash
brew install poppler && pdfimages -v
```

- [ ] **Step 3: Deploy** (per CLAUDE.md "Production deployment" — backup data, rsync from a working tree containing the full intended live state, then build+restart). After rsync and BEFORE the server build, grep that the new files arrived:

```bash
ssh -i ~/.ssh/id_ed25519 root@62.238.35.20 "ls /var/www/worldwise/app/api/admin/import && ls /var/www/worldwise/lib/property-drafts.ts"
```

- [ ] **Step 4: E2E smoke test (on the live admin)**

1. Log in to `/admin` as a user with the `properties` section.
2. Click **+ Upload developer PDF**, pick a real developer brochure PDF.
3. Confirm a draft card appears with a sensible title/developer/area/price and ≥1 photo thumbnail (no logos).
4. Click **Review & edit** → the form is prefilled; the extracted photos appear in the gallery; correct any field; click save.
5. Confirm the property is now in the Properties table and visible at `/properties/<slug>` with the PDF photos.
6. Upload another PDF → on its card click **Reject** → it disappears and `public/images/properties/<draftId>/` is gone on the server.

- [ ] **Step 5: Negative checks**

- Upload a non-PDF (e.g. a `.png` renamed to `.pdf`) → friendly "Not a PDF file" error, no draft created.
- Temporarily a PDF with no extractable photos → draft still created from text fields, 0 photos, operator adds photos manually in the form.

- [ ] **Step 6: Update docs**

Add a short "Developer PDF import" subsection under **Architecture** in `CLAUDE.md` (flow + the `poppler-utils` dependency + the `data/property-drafts.json` store), and note `poppler-utils` in the server-prep step of **Production deployment**.

```bash
git add CLAUDE.md
git commit -m "docs(import): document developer PDF import pipeline + poppler dependency"
```

---

## Self-Review

**Spec coverage:**
- Manual PDF upload on `/admin` → Task 8 (ImportPanel) ✓
- Gemini multimodal field extraction → Tasks 1, 3 ✓
- pdfimages + pdftoppm fallback photo extraction → Task 2 ✓
- Staging + approve (drafts → review → publish) → Tasks 4, 5, 6, 7 ✓
- Publish via coercePropertyInput/createProperty, reuse draftId as id → Task 4 ✓
- requireSection guard on every route → Task 5 ✓
- magic-bytes PDF validation → Task 5 ✓
- writeFileAtomic for the store → Task 4 ✓
- images only under public/images/ → Tasks 2, 4 ✓
- poppler-utils system dep (not npm native) → Task 9 ✓
- "1 PDF = 1 project" simplification (single-object extraction) → Task 3 ✓

**Placeholder scan:** No TBD/TODO; every code step is complete.

**Type consistency:** `PropertyDraft` (draftId/fields/imageCandidates/sourcePdf/extractedAt/status) defined in Task 1, used identically in Tasks 4, 5, 8. `mapGeminiToProperty`, `extractPropertyFromPdf`, `extractImagesFromPdf`, `isLikelyPhoto`, `publishDraft`, `rejectDraft`, `updateDraftFields`, `addDraft`, `listDrafts`, `getDraft` — names consistent across tasks. Publish endpoint accepts the exact `payload` PropertyForm already builds.
