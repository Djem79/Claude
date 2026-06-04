# Gated Brochure (Wave 3 / E) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a per-property gated brochure — a "Download brochure (PDF)" block on `/properties/[slug]` that captures a lead before revealing the PDF, with the PDF auto-saved by the import pipeline.

**Architecture:** Soft gate reusing the `/guide` pattern. New optional `Property.brochure` field flags presence. Bytes live server-only at `public/files/brochures/<id>.pdf` (rsync-excluded) and are streamed by a Node route handler that reads from disk at runtime (sidestepping the `next start` post-build 404). A pure `lib/brochure.ts` holds the id guard + basename. Population: the PDF import persists the uploaded PDF; `PropertyForm` gets a manual upload.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind, file-based JSON, `node:test` for the pure helper, `npm run build` as the primary gate.

**Testing reality:** This repo has no React/route test runner — only `node:test` for pure `lib/` helpers (run with `node --test --experimental-strip-types`). So Task 1 is true TDD; the component/route/import tasks verify via `npm run build` + explicit manual checks. That matches CLAUDE.md.

**Run all commands from `worldwise/`.** If `npm` is missing: `export PATH="/Users/dzhambulat/.nvm/versions/node/v24.15.0/bin:$PATH"`.

---

## File Structure

- Create `lib/brochure.ts` — pure id guard + on-disk basename (no fs/next imports).
- Create `lib/brochure.test.ts` — node:test for the guard.
- Modify `types/index.ts` — add `Property.brochure?: string`.
- Modify `lib/properties.ts` — whitelist `brochure` in `STRING_FIELDS`.
- Create `app/api/properties/[id]/brochure/route.ts` — Node download route (runtime disk read, soft gate).
- Create `components/BrochureGate.tsx` — inline client gate (CTA -> form -> link).
- Modify `app/properties/[slug]/page.tsx` — mount `BrochureGate` when `property.brochure` is set.
- Modify `app/api/upload/route.ts` — add `kind=brochure` (single PDF -> public/files/brochures).
- Modify `app/admin/property/PropertyForm.tsx` — optional brochure upload control + save field.
- Modify `app/api/admin/import/route.ts` — persist uploaded PDF + set `fields.brochure`.
- Modify `CLAUDE.md` — document `brochure_request` source + brochure storage location.

---

## Task 1: Pure brochure helper (TDD)

**Files:**
- Create: `lib/brochure.ts`
- Test: `lib/brochure.test.ts`

- [ ] **Step 1: Write the failing test**

`lib/brochure.test.ts`:
```ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isValidBrochureId, brochureBasename } from './brochure.ts'

test('isValidBrochureId accepts 6-20 digit numeric ids, rejects the rest', () => {
  assert.ok(isValidBrochureId('1780577951123'))
  assert.ok(isValidBrochureId('123456'))
  assert.ok(!isValidBrochureId('12345'))      // too short
  assert.ok(!isValidBrochureId('abc'))
  assert.ok(!isValidBrochureId('123/../x'))
  assert.ok(!isValidBrochureId(''))
})

test('brochureBasename returns <id>.pdf for valid ids and throws otherwise', () => {
  assert.equal(brochureBasename('1780577951123'), '1780577951123.pdf')
  assert.throws(() => brochureBasename('../etc'))
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test --experimental-strip-types lib/brochure.test.ts`
Expected: FAIL — cannot resolve `./brochure.ts` / functions not defined.

- [ ] **Step 3: Write minimal implementation**

`lib/brochure.ts`:
```ts
// Pure helpers for per-property brochure files. No fs/next imports so this stays
// node:test-able. Bytes live server-only at public/files/brochures/<id>.pdf
// (rsync-excluded) and are served by app/api/properties/[id]/brochure/route.ts.

// Property ids are String(Date.now()) — 13 numeric digits. Mirror the media-route guard.
export function isValidBrochureId(id: string): boolean {
  return /^\d{6,20}$/.test(id)
}

// Canonical on-disk basename for a property's brochure.
export function brochureBasename(id: string): string {
  if (!isValidBrochureId(id)) throw new Error(`[brochure] invalid id: ${id}`)
  return `${id}.pdf`
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test --experimental-strip-types lib/brochure.test.ts`
Expected: PASS — 2 tests.

- [ ] **Step 5: Commit**

```bash
git add worldwise/lib/brochure.ts worldwise/lib/brochure.test.ts
git commit -m "feat(brochure): pure id guard + basename helper (Wave 3/E)"
```

---

## Task 2: Property type + coerce whitelist

**Files:**
- Modify: `types/index.ts` (Property interface)
- Modify: `lib/properties.ts:11-12` (STRING_FIELDS)

- [ ] **Step 1: Add the field to the Property interface**

In `types/index.ts`, inside `export interface Property`, after the `qrImage?: string` line add:
```ts
  brochure?: string   // filename under public/files/brochures/<id>.pdf; presence => show the gate
```

- [ ] **Step 2: Whitelist it in coercePropertyInput**

In `lib/properties.ts`, `STRING_FIELDS` currently is:
```ts
const STRING_FIELDS: [keyof Property, number][] = [
  ['title', 200], ['developer', 120], ['area', 120], ['bedrooms', 60],
```
Append `['brochure', 80]` to that array (the existing list continues over the next lines — add it to the final entries, e.g. after the last existing pair, before the closing `]`). 80 chars is ample for `<13-digit-id>.pdf`.

- [ ] **Step 3: Verify it type-checks**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | head` (or rely on Step 4 build).
Expected: no new errors referencing `brochure`.

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: `✓ Compiled successfully`.

- [ ] **Step 5: Commit**

```bash
git add worldwise/types/index.ts worldwise/lib/properties.ts
git commit -m "feat(brochure): Property.brochure field + coerce whitelist (Wave 3/E)"
```

---

## Task 3: Gated download route

**Files:**
- Create: `app/api/properties/[id]/brochure/route.ts`

- [ ] **Step 1: Write the route**

`app/api/properties/[id]/brochure/route.ts`:
```ts
import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { isValidBrochureId, brochureBasename } from '@/lib/brochure'

// Soft-gated brochure download. The UI reveals the link only after a lead is
// captured (BrochureGate); this route just serves the file. Reads from disk at
// runtime because files written to public/ after `next build` 404 as static
// assets (same reason app/api/media/properties/.../route.ts exists). Node runtime
// (fs) — never Edge.
export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params
  if (!isValidBrochureId(id)) {
    return new NextResponse('Bad request', { status: 400 })
  }
  const filePath = path.join(process.cwd(), 'public', 'files', 'brochures', brochureBasename(id))
  let data: Buffer
  try {
    data = fs.readFileSync(filePath)
  } catch {
    return new NextResponse('Not found', { status: 404 })
  }
  return new NextResponse(new Uint8Array(data), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="brochure-${id}.pdf"`,
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: `✓ Compiled successfully`; route `/api/properties/[id]/brochure` appears in the route list.

- [ ] **Step 3: Manual verify (404 path, no file yet)**

Run: `npm run start &` then `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/properties/9999999999999/brochure`
Expected: `404`. Then `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/properties/abc/brochure` -> `400`. Kill the server.

- [ ] **Step 4: Commit**

```bash
git add worldwise/app/api/properties/[id]/brochure/route.ts
git commit -m "feat(brochure): soft-gated PDF download route (Wave 3/E)"
```

---

## Task 4: BrochureGate component

**Files:**
- Create: `components/BrochureGate.tsx`

- [ ] **Step 1: Write the component** (modeled on `components/GuideClient.tsx`; same honeypot, same /api/leads call, source `brochure_request`)

`components/BrochureGate.tsx`:
```tsx
'use client'

import { useState, useRef } from 'react'
import { track } from '@/lib/analytics'

export default function BrochureGate({
  propertyId,
  propertySlug,
  propertyTitle,
}: {
  propertyId: string
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
          source: 'brochure_request',
          propertySlug,
          propertyTitle,
          _hp: hpRef.current?.value ?? '',
        }),
      })
      if (!res.ok) throw new Error('Failed')
      setSuccess(true)
      track('lead_form_submit', { source: 'brochure_request', property: propertyTitle })
    } catch {
      setError('Something went wrong. Please try again or message us on WhatsApp.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="border border-gray-200 rounded-sm p-5 bg-white">
      <p className="font-serif text-lg text-navy">Project brochure</p>
      <p className="text-gray-500 text-sm mt-1 mb-4">
        Full floor plans, payment plan and finishes — PDF.
      </p>

      {success ? (
        <a
          href={`/api/properties/${propertyId}/brochure`}
          target="_blank"
          rel="noopener"
          download
          className="btn-primary w-full block text-center"
        >
          Download PDF
        </a>
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
            {loading ? 'Sending...' : 'Get brochure'}
          </button>
          <p className="text-xs text-gray-400 text-center">Your download unlocks instantly.</p>
        </form>
      ) : (
        <button onClick={() => setOpen(true)} className="btn-primary w-full">
          Download brochure (PDF)
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
git add worldwise/components/BrochureGate.tsx
git commit -m "feat(brochure): inline lead-gate component (Wave 3/E)"
```

---

## Task 5: Mount on the property page

**Files:**
- Modify: `app/properties/[slug]/page.tsx` (import + render in the right column)

- [ ] **Step 1: Add the import**

After line 11 (`import MobileCtaBar ...`) add:
```tsx
import BrochureGate from '@/components/BrochureGate'
```

- [ ] **Step 2: Render it in the right sticky column**

In the right column block, between `<PropertyEnquiryForm .../>` and the `<div className="mt-6"><SocialProofStrip /></div>`, insert:
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
```
(The surrounding JSX currently reads:)
```tsx
                <PropertyEnquiryForm
                  propertySlug={property.slug}
                  propertyTitle={property.title}
                />
                <div className="mt-6">
                  <SocialProofStrip />
                </div>
```

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: `✓ Compiled successfully`.

- [ ] **Step 4: Manual verify the gate shows only with a brochure**

Temporarily, on the server or locally with a test `data/properties.json` entry, set `brochure: "<id>.pdf"` on one property and place any PDF at `public/files/brochures/<id>.pdf`; `npm run build && npm run start`; open `/properties/<slug>` — the "Project brochure" block appears; properties without `brochure` show no block. Submit the form -> the link appears -> clicking downloads the PDF. (Do NOT commit any `data/` change — local data is server-only.)

- [ ] **Step 5: Commit**

```bash
git add worldwise/app/properties/[slug]/page.tsx
git commit -m "feat(brochure): mount BrochureGate on property page when set (Wave 3/E)"
```

---

## Task 6: Upload route — `kind=brochure`

**Files:**
- Modify: `app/api/upload/route.ts`

- [ ] **Step 1: Accept the new kind and branch BEFORE image validation**

A PDF is not an image, so the brochure branch must run before the magic-bytes image loop. Make these edits:

1. Widen the kind guard (line ~40):
```ts
  if (kind !== 'gallery' && kind !== 'qr' && kind !== 'brochure') {
    return NextResponse.json({ error: 'Invalid kind' }, { status: 400 })
  }
```

2. Immediately after that guard (before `const files = form.getAll('files')...`), add the brochure handler:
```ts
  if (kind === 'brochure') {
    const f = form.getAll('files').find((x): x is File => x instanceof File)
    if (!f) return NextResponse.json({ error: 'No file' }, { status: 400 })
    if (f.size > 25 * 1024 * 1024) return NextResponse.json({ error: 'File too large (max 25 MB)' }, { status: 400 })
    const buf = Buffer.from(await f.arrayBuffer())
    if (buf.length < 5 || buf.toString('ascii', 0, 5) !== '%PDF-') {
      return NextResponse.json({ error: 'Not a PDF file' }, { status: 400 })
    }
    const dir = path.join(process.cwd(), 'public', 'files', 'brochures')
    fs.mkdirSync(dir, { recursive: true })
    const name = `${propertyId}.pdf`
    fs.writeFileSync(path.join(dir, name), buf)
    return NextResponse.json({ brochure: name })
  }
```
(`propertyId` is already validated as `/^\d{6,20}$/` above, so `${propertyId}.pdf` is safe.)

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: `✓ Compiled successfully`.

- [ ] **Step 3: Commit**

```bash
git add worldwise/app/api/upload/route.ts
git commit -m "feat(brochure): upload kind=brochure -> public/files/brochures (Wave 3/E)"
```

---

## Task 7: PropertyForm brochure upload control

**Files:**
- Modify: `app/admin/property/PropertyForm.tsx`

- [ ] **Step 1: Add state** (near the existing `qrImage` state, ~line 44):
```tsx
  const [brochure, setBrochure] = useState(property?.brochure ?? '')
  const [uploadingBrochure, setUploadingBrochure] = useState(false)
  const brochureInputRef = useRef<HTMLInputElement>(null)
```

- [ ] **Step 2: Add the upload handler** (mirror the QR handler, ~after it):
```tsx
  async function handleBrochure(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return
    setUploadingBrochure(true)
    const fd = new FormData()
    fd.append('propertyId', propertyId)
    fd.append('kind', 'brochure')
    fd.append('files', fileList[0])
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      const json = await res.json()
      if (res.ok && json.brochure) setBrochure(json.brochure)
      else alert(json.error || 'Brochure upload failed')
    } catch {
      alert('Brochure upload failed')
    } finally {
      setUploadingBrochure(false)
      if (brochureInputRef.current) brochureInputRef.current.value = ''
    }
  }
```

- [ ] **Step 3: Include `brochure` in the saved payload** — in the object built before `fetch(url, ...)` (the one that has `id: propertyId`, `qrImage: ...`), add:
```tsx
      brochure: brochure || undefined,
```

- [ ] **Step 4: Add the UI control** — near the QR upload control, add:
```tsx
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Brochure (PDF)</label>
          <button
            type="button"
            onClick={() => brochureInputRef.current?.click()}
            className="border border-dashed border-gray-300 rounded-sm w-full py-3 text-sm text-gray-500 hover:border-gold"
          >
            {uploadingBrochure ? 'Uploading...' : brochure ? `Replace brochure (${brochure})` : 'Upload brochure PDF'}
          </button>
          <input
            ref={brochureInputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={e => handleBrochure(e.target.files)}
          />
        </div>
```

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: `✓ Compiled successfully`.

- [ ] **Step 6: Commit**

```bash
git add worldwise/app/admin/property/PropertyForm.tsx
git commit -m "feat(brochure): PropertyForm brochure upload control (Wave 3/E)"
```

---

## Task 8: Import pipeline persists the brochure

**Files:**
- Modify: `app/api/admin/import/route.ts`

- [ ] **Step 1: Persist the uploaded PDF + set the field**

After the image-extraction block (`if (imageCandidates.length) fields.images = imageCandidates`) and before `addDraft({...})`, add:
```ts
  // Persist the source brochure so the published property can gate it (Wave 3/E).
  // draftId becomes the property id on publish, so the file is already correctly named.
  try {
    const brDir = path.join(process.cwd(), 'public', 'files', 'brochures')
    fs.mkdirSync(brDir, { recursive: true })
    fs.writeFileSync(path.join(brDir, `${draftId}.pdf`), buf)
    fields.brochure = `${draftId}.pdf`
  } catch (e) {
    console.error('[import] brochure persist failed:', e) // non-fatal — fields still usable
  }
```

- [ ] **Step 2: Ensure `fs` and `path` are imported** at the top of the file. If not present, add:
```ts
import fs from 'fs'
import path from 'path'
```
(Check the existing imports first; `extractImagesFromPdf` is imported but fs/path may not be — add whichever is missing.)

- [ ] **Step 3: Confirm `PropertyDraft.fields` allows `brochure`** — `fields` is `Partial<Property>`, and Task 2 added `brochure` to `Property`, so `fields.brochure` type-checks. No change needed.

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: `✓ Compiled successfully`.

- [ ] **Step 5: Commit**

```bash
git add worldwise/app/api/admin/import/route.ts
git commit -m "feat(brochure): import persists source PDF + sets brochure field (Wave 3/E)"
```

---

## Task 9: Document the source + storage in CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Add the lead source** — in the "Lead `source` strings in use" list, append `brochure_request` to the on-site CTA group.

- [ ] **Step 2: Note the storage** — in the Developer PDF import section (or near the upload/api description), add one line:
> Brochures (gated per-property PDF) are stored server-only at `public/files/brochures/<id>.pdf` (rsync-excluded, like lead attachments) and served via `GET /api/properties/[id]/brochure` (soft gate; runtime disk read). The import persists the uploaded PDF there; `PropertyForm` can upload one via `POST /api/upload?kind=brochure`.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(brochure): document brochure_request source + storage (Wave 3/E)"
```

---

## Task 10: Whole-feature verification

- [ ] **Step 1: Full test + build**

Run: `node --test --experimental-strip-types lib/*.test.ts` -> all pass (incl. the 2 new brochure tests).
Run: `npm run build` -> `✓ Compiled successfully`; route list shows `/api/properties/[id]/brochure`.

- [ ] **Step 2: Lint**

Run: `npm run lint` -> 0 errors.

- [ ] **Step 3: End-to-end smoke (local)**

1. Add a throwaway property to a LOCAL test `data/properties.json` with `brochure: "1234567890123.pdf"` (do NOT commit data/).
2. Put any PDF at `public/files/brochures/1234567890123.pdf`.
3. `npm run build && npm run start`.
4. Open `/properties/<that-slug>`: the "Project brochure" block shows. A property without `brochure` shows nothing.
5. Submit name+phone: link appears; click downloads the PDF (`Content-Disposition: attachment`).
6. `data/leads.json` (local test) gains a lead with `source: "brochure_request"` and the property title.
7. Revert the throwaway data edits.

- [ ] **Step 4: Confirm no stray staged data files**

Run: `git status --short` -> only the intended source files across the 9 commits; NO `data/*.json`, no PDF binaries committed.

---

## Self-review notes (author)

- **Spec coverage:** field (T2), storage (T6/T8), serving route (T3), BrochureGate + states + honeypot + source (T4), mount (T5), import auto-populate (T8), PropertyForm manual (T7), source doc (T9), invariants (honeypot clip pattern T4, coerce whitelist T2, Node runtime T3, rsync-excluded public/files T6/T8). All covered.
- **Type consistency:** `isValidBrochureId`/`brochureBasename` used identically in T1/T3; `brochure` field name consistent across types, coerce, component prop wiring (`property.brochure`), upload response (`{ brochure }`), import (`fields.brochure`).
- **No data writes committed:** every task stages named source files only; the E2E uses a throwaway local data edit that is explicitly reverted.
