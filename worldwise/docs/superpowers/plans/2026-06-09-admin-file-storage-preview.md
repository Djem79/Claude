# File Manager — Preview, Thumbnails, Unicode Names, Button Visibility — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add image/PDF preview (modal lightbox + lazy thumbnails) to `/admin/files`, fix Cyrillic file names, and make the "New folder" button visible at rest.

**Architecture:** A separate inline preview route serves only whitelisted safe types (jpg/png/webp/pdf) with `nosniff` (+ `CSP: sandbox` for PDF), leaving the forced-attachment download route untouched. The file display name becomes Unicode-aware (disk path stays id-based, so widening the name charset is safe). UI gains a focus-trapped lightbox and lazy `<img>` thumbnails.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind. `node:test` for the pure helpers. Reuses `lib/useFocusTrap.ts`.

**Spec:** `docs/superpowers/specs/2026-06-09-admin-file-storage-preview-design.md`
**Base feature:** already live (`/admin/files`); this extends it.

---

## File structure

| File | Change |
| ---- | ------ |
| `lib/file-storage-core.ts` (modify) | add `PREVIEWABLE_EXT` + `isPreviewable`; rewrite `sanitizeStorageName` Unicode-aware |
| `lib/file-storage-core.test.ts` (modify) | preview-predicate tests; updated + new sanitize tests |
| `app/api/admin/files/[id]/preview/route.ts` (create) | inline preview, whitelisted types only |
| `app/api/admin/files/[id]/route.ts` (modify) | case-insensitive ext re-append on rename |
| `app/api/admin/files/[id]/download/route.ts` (modify) | `filename*=UTF-8''` Content-Disposition |
| `app/admin/files/FilesClient.tsx` (modify/replace) | visible New-folder button; thumbnails; lightbox |

---

## Task 1: Core — preview predicate + Unicode-aware sanitize (TDD)

**Files:**
- Modify: `worldwise/lib/file-storage-core.ts`
- Test: `worldwise/lib/file-storage-core.test.ts`

- [ ] **Step 1: Update the tests first**

In `lib/file-storage-core.test.ts`, add `isPreviewable`, `PREVIEWABLE_EXT` to the existing import from `./file-storage-core.ts`. **Replace** the existing test block `test('sanitizeStorageName keeps extension, removes unsafe chars', ...)` with the version below, and add the two new test blocks after it:

```ts
test('sanitizeStorageName preserves Unicode/case/spaces, strips hostile chars', () => {
  // Cyrillic + spaces + case preserved (display name only; disk path is id-based)
  assert.equal(sanitizeStorageName('Мой отчёт.pdf'), 'Мой отчёт.pdf')
  assert.equal(sanitizeStorageName('My Report (final).PDF'), 'My Report (final).PDF')
  // path separators + leading dots stripped → no traversal residue
  assert.equal(sanitizeStorageName('../../etc/passwd'), 'etcpasswd')
  assert.equal(sanitizeStorageName('../../этц/passwd'), 'этцpasswd')
  // filesystem/header-hostile chars removed
  assert.equal(sanitizeStorageName('a<b>c:"d"|e?f*g.pdf'), 'abcdefg.pdf')
  // whitespace collapsed, trimmed
  assert.equal(sanitizeStorageName('  too   many   spaces .pdf '), 'too many spaces .pdf')
  // empties → fallback
  assert.equal(sanitizeStorageName('   '), 'file')
  assert.equal(sanitizeStorageName(''), 'file')
  assert.equal(sanitizeStorageName('...'), 'file')
  // length cap (120 chars)
  assert.equal(sanitizeStorageName('x'.repeat(200)).length, 120)
  // no path separator can survive
  assert.ok(!sanitizeStorageName('a/b\\c').includes('/') && !sanitizeStorageName('a/b\\c').includes('\\'))
})

test('isPreviewable: images + pdf only', () => {
  for (const ext of ['jpg', 'jpeg', 'png', 'webp', 'pdf']) assert.equal(isPreviewable(ext), true, ext)
  for (const ext of ['doc', 'docx', 'xls', 'xlsx', 'zip', 'svg', '']) assert.equal(isPreviewable(ext), false, ext)
  assert.equal(isPreviewable('PDF'), true) // case-insensitive
})

test('PREVIEWABLE_EXT excludes svg', () => {
  assert.ok(!PREVIEWABLE_EXT.has('svg'))
})
```

- [ ] **Step 2: Run tests, verify the sanitize/preview tests FAIL**

Run: `cd /Users/dzhambulat/Projects/Claude/worldwise && export PATH="/Users/dzhambulat/.nvm/versions/node/v24.15.0/bin:$PATH" && node --test --experimental-strip-types lib/file-storage-core.test.ts`
Expected: FAIL — `isPreviewable`/`PREVIEWABLE_EXT` not exported; old `sanitizeStorageName` lowercases/dashes so the new assertions fail.

- [ ] **Step 3: Implement in `lib/file-storage-core.ts`**

Replace the existing `sanitizeStorageName` function:
```ts
/** Filename for storage/display: lowercase, safe chars only, keeps the extension. */
export function sanitizeStorageName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9.\-_]/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/\.{2,}/g, '.')
    .replace(/^[.\-_]+|[.\-_]+$/g, '')
    .slice(0, 120) || 'file'
}
```
with this Unicode-aware version (display name only; the on-disk file is always `<id>.<ext>`, so the name never touches a filesystem path — widening the charset is safe):
```ts
/**
 * Display/storage NAME for a file (the on-disk file is always `<id>.<ext>`, so
 * this never becomes a filesystem path). Unicode-aware: keeps letters of any
 * script (Cyrillic etc.), digits, spaces, and `.-_()`; preserves case. Strips
 * control chars, path separators, and filesystem/header-hostile chars, plus
 * leading/trailing dots. Caps length; falls back to 'file' when empty.
 */
export function sanitizeStorageName(name: string): string {
  return name
    .replace(/[\u0000-\u001f\u007f]/g, '') // control chars
    .replace(/[\/\\<>:"|?*]/g, '')         // path separators + filesystem/header-hostile
    .replace(/\s+/g, ' ')                  // collapse whitespace runs
    .trim()
    .replace(/^\.+/, '')                   // no leading dots (hidden/empty-base)
    .replace(/\.+$/, '')                   // no trailing dots
    .trim()
    .slice(0, 120) || 'file'
}
```

Then add, right after `MIME_FOR_EXT` (near the other allowed-type constants):
```ts
/** Types we will render inline (preview). Everything else is download-only. SVG excluded. */
export const PREVIEWABLE_EXT = new Set(['jpg', 'jpeg', 'png', 'webp', 'pdf'])
export function isPreviewable(ext: string): boolean {
  return PREVIEWABLE_EXT.has(ext.toLowerCase())
}
```

- [ ] **Step 4: Run tests, verify PASS**

Run: `cd /Users/dzhambulat/Projects/Claude/worldwise && node --test --experimental-strip-types lib/file-storage-core.test.ts`
Expected: PASS (all blocks, including the existing cleanFolderName/sniff/tree/search tests which are unaffected).

- [ ] **Step 5: Commit**

```bash
cd /Users/dzhambulat/Projects/Claude
git add worldwise/lib/file-storage-core.ts worldwise/lib/file-storage-core.test.ts
git commit -m "feat(files): Unicode-aware filenames + isPreviewable predicate"
```

---

## Task 2: Inline preview route (whitelisted)

**Files:**
- Create: `worldwise/app/api/admin/files/[id]/preview/route.ts`

- [ ] **Step 1: Create the route**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { requireSection } from '@/lib/auth'
import { readStore, diskPathFor } from '@/lib/file-storage'
import { isPreviewable, MIME_FOR_EXT } from '@/lib/file-storage-core'
import fs from 'fs'

export const runtime = 'nodejs'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await requireSection('files'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const file = readStore().files.find(f => f.id === params.id)
  if (!file) return NextResponse.json({ error: 'File not found' }, { status: 404 })

  // Inline rendering is allowed ONLY for whitelisted safe types (images + PDF).
  // Anything else must go through the forced-attachment download route — this is
  // what keeps an uploaded HTML/SVG from ever rendering in the browser.
  if (!isPreviewable(file.ext)) {
    return NextResponse.json({ error: 'Not previewable' }, { status: 404 })
  }

  const p = diskPathFor(file)
  if (!fs.existsSync(p)) return NextResponse.json({ error: 'File missing on disk' }, { status: 404 })
  const buf = fs.readFileSync(p)

  const headers: Record<string, string> = {
    'Content-Type': MIME_FOR_EXT[file.ext] ?? 'application/octet-stream',
    'Content-Disposition': 'inline',
    'X-Content-Type-Options': 'nosniff',
    'Content-Length': String(buf.length),
    'Cache-Control': 'private, no-store',
  }
  // PDFs can embed scripting/auto-navigation; sandbox neutralizes it.
  if (file.ext.toLowerCase() === 'pdf') headers['Content-Security-Policy'] = 'sandbox'

  return new NextResponse(new Uint8Array(buf), { headers })
}
```

- [ ] **Step 2: Build**

Run: `cd /Users/dzhambulat/Projects/Claude/worldwise && export PATH="/Users/dzhambulat/.nvm/versions/node/v24.15.0/bin:$PATH" && npm run build`
Expected: PASS; route list includes `/api/admin/files/[id]/preview`.

- [ ] **Step 3: Commit**

```bash
cd /Users/dzhambulat/Projects/Claude
git add "worldwise/app/api/admin/files/[id]/preview/route.ts"
git commit -m "feat(files): inline preview route (images + PDF, whitelisted, nosniff)"
```

---

## Task 3: Download UTF-8 filename + rename case-insensitive ext

**Files:**
- Modify: `worldwise/app/api/admin/files/[id]/download/route.ts`
- Modify: `worldwise/app/api/admin/files/[id]/route.ts`

- [ ] **Step 1: Download — RFC 5987 UTF-8 filename**

In `app/api/admin/files/[id]/download/route.ts`, replace this line:
```ts
      'Content-Disposition': `attachment; filename="${encodeURIComponent(file.name)}"`,
```
with:
```ts
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`,
```
(Keeps it an attachment + octet-stream; just makes a Cyrillic name download correctly instead of as a percent-littered ASCII string.)

- [ ] **Step 2: Rename — case-insensitive extension re-append**

In `app/api/admin/files/[id]/route.ts`, replace:
```ts
  // Keep the real extension; sanitize the supplied base name and re-append it.
  let name = sanitizeStorageName(body.name)
  if (!name.endsWith(`.${file.ext}`)) name = `${name.replace(/\.[^.]*$/, '')}.${file.ext}`
```
with:
```ts
  // Keep the real extension; sanitize the supplied base name and re-append it.
  // Case-insensitive check so a user typing "Отчёт.PDF" on a `pdf` file doesn't
  // get "Отчёт.PDF.pdf" — and the extension can never be changed via rename.
  let name = sanitizeStorageName(body.name)
  if (!name.toLowerCase().endsWith(`.${file.ext.toLowerCase()}`)) {
    name = `${name.replace(/\.[^.]*$/, '')}.${file.ext}`
  }
```

- [ ] **Step 3: Build**

Run: `cd /Users/dzhambulat/Projects/Claude/worldwise && export PATH="/Users/dzhambulat/.nvm/versions/node/v24.15.0/bin:$PATH" && npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
cd /Users/dzhambulat/Projects/Claude
git add "worldwise/app/api/admin/files/[id]/download/route.ts" "worldwise/app/api/admin/files/[id]/route.ts"
git commit -m "fix(files): UTF-8 download filename + case-insensitive rename ext"
```

---

## Task 4: UI — visible folder button, thumbnails, lightbox

**Files:**
- Modify (full replace): `worldwise/app/admin/files/FilesClient.tsx`

The simplest safe change is to replace the whole file. It keeps every existing
handler verbatim and adds: imports for `isPreviewable` + `useFocusTrap`, a
`preview` state, a `PreviewLightbox` sub-component, thumbnails + click-to-preview
in the file rows, and a visible New-folder button.

- [ ] **Step 1: Replace `worldwise/app/admin/files/FilesClient.tsx` with:**

```tsx
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { StorageFolder, StorageFile, Crumb, FolderSearchHit, FileSearchHit } from '@/types'
import { isPreviewable } from '@/lib/file-storage-core'
import { useFocusTrap } from '@/lib/useFocusTrap'

type FolderView = {
  mode: 'folder'
  folderId: string | null
  breadcrumb: Crumb[]
  folders: StorageFolder[]
  files: StorageFile[]
}
type SearchView = { mode: 'search'; q: string; folders: FolderSearchHit[]; files: FileSearchHit[] }
type View = FolderView | SearchView

function fmtSize(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

function PreviewLightbox({ file, onClose }: { file: StorageFile; onClose: () => void }) {
  const panelRef = useRef<HTMLDivElement>(null)
  useFocusTrap(panelRef, true, onClose)
  const src = `/api/admin/files/${file.id}/preview`
  const isPdf = file.ext.toLowerCase() === 'pdf'
  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={file.name}
        className="bg-white rounded-sm max-w-4xl w-full max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100">
          <span className="text-navy text-sm truncate">{file.name}</span>
          <div className="flex items-center gap-3 shrink-0">
            <a className="text-xs text-gray-500 hover:text-navy" href={`/api/admin/files/${file.id}/download`}>Download</a>
            <button aria-label="Close" className="text-gray-500 hover:text-navy text-lg leading-none" onClick={onClose}>✕</button>
          </div>
        </div>
        <div className="flex-1 overflow-auto bg-gray-50 flex items-center justify-center">
          {isPdf ? (
            <iframe src={src} title={file.name} className="w-full h-[80vh]" />
          ) : (
            <img src={src} alt={file.name} className="max-w-full max-h-[80vh] object-contain" />
          )}
        </div>
      </div>
    </div>
  )
}

export default function FilesClient() {
  const [folderId, setFolderId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [view, setView] = useState<View | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<StorageFile | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    const q = query.trim()
    const url = q
      ? `/api/admin/files?q=${encodeURIComponent(q)}`
      : `/api/admin/files?folder=${folderId ?? 'root'}`
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Failed to load')
      setView(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [folderId, query])

  // Debounce so typing in search doesn't hammer the API.
  useEffect(() => {
    const t = setTimeout(load, 200)
    return () => clearTimeout(t)
  }, [load])

  async function upload(files: FileList | null) {
    if (!files || files.length === 0) return
    setBusy(true)
    setError('')
    const fd = new FormData()
    fd.append('folderId', folderId ?? 'root')
    Array.from(files).forEach(f => fd.append('files', f))
    try {
      const res = await fetch('/api/admin/files', { method: 'POST', body: fd })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Upload failed')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setBusy(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  async function newFolder() {
    const name = window.prompt('New folder name')
    if (!name) return
    setBusy(true)
    try {
      const res = await fetch('/api/admin/files/folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, parentId: folderId ?? 'root' }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Failed')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setBusy(false)
    }
  }

  async function renameFolder(f: StorageFolder) {
    const name = window.prompt('Rename folder', f.name)
    if (!name || name === f.name) return
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/files/folder/${f.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Rename failed')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Rename failed')
    } finally {
      setBusy(false)
    }
  }

  async function deleteFolder(f: StorageFolder) {
    if (!window.confirm(`Delete folder "${f.name}" and everything inside it?`)) return
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/files/folder/${f.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Delete failed')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setBusy(false)
    }
  }

  async function renameFile(f: StorageFile) {
    const name = window.prompt('Rename file', f.name)
    if (!name || name === f.name) return
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/files/${f.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Rename failed')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Rename failed')
    } finally {
      setBusy(false)
    }
  }

  async function deleteFile(f: StorageFile) {
    if (!window.confirm(`Delete "${f.name}"?`)) return
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/files/${f.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Delete failed')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setBusy(false)
    }
  }

  const isSearch = view?.mode === 'search'

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <h1 className="font-serif text-2xl text-navy mb-4">Files</h1>

      {/* Toolbar */}
      <div className="flex flex-wrap gap-3 items-center mb-4">
        <input
          type="search"
          aria-label="Search files and folders"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search files and folders…"
          className="flex-1 min-w-48 border border-gray-200 px-4 py-2.5 rounded-sm text-navy text-sm focus:outline-none focus:border-gold"
        />
        <button
          onClick={newFolder}
          disabled={busy || isSearch}
          className="border border-navy/40 text-navy hover:bg-navy hover:text-white rounded-sm px-4 py-2.5 text-sm transition-colors disabled:opacity-40"
        >
          New folder
        </button>
        <button onClick={() => fileInput.current?.click()} disabled={busy || isSearch} className="btn-primary text-sm disabled:opacity-40">
          {busy ? 'Working…' : 'Upload'}
        </button>
        <input ref={fileInput} type="file" multiple hidden onChange={e => upload(e.target.files)} />
      </div>

      {/* Breadcrumb (folder mode only) */}
      {view?.mode === 'folder' && (
        <div className="text-sm text-gray-500 mb-3">
          {view.breadcrumb.map((c, i) => (
            <span key={c.id ?? 'root'}>
              {i > 0 && <span className="mx-1">/</span>}
              <button className="hover:text-navy" onClick={() => setFolderId(c.id)}>{c.name}</button>
            </span>
          ))}
        </div>
      )}

      {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
      {loading && <p className="text-gray-400 text-sm">Loading…</p>}

      {!loading && view && (
        <div className="border border-gray-200 rounded-sm divide-y divide-gray-100">
          {view.folders.length === 0 && view.files.length === 0 && (
            <p className="px-4 py-10 text-center text-gray-400 text-sm">
              {isSearch ? 'No matches.' : 'This folder is empty.'}
            </p>
          )}

          {/* Folders */}
          {view.folders.map(f => (
            <div key={f.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50">
              <button
                className="flex-1 text-left text-navy font-medium min-w-0 truncate"
                onClick={() => { setQuery(''); setFolderId(f.id) }}
              >
                <span className="mr-2">📁</span>{f.name}
                {isSearch && <span className="text-gray-400 font-normal text-xs ml-2">{(f as FolderSearchHit).pathLabel}</span>}
              </button>
              <button className="text-xs text-gray-400 hover:text-navy shrink-0" onClick={() => renameFolder(f)}>Rename</button>
              <button className="text-xs text-gray-400 hover:text-red-600 shrink-0" onClick={() => deleteFolder(f)}>Delete</button>
            </div>
          ))}

          {/* Files */}
          {view.files.map(f => {
            const previewable = isPreviewable(f.ext)
            const isImg = previewable && f.ext.toLowerCase() !== 'pdf'
            const label = (
              <>
                {isImg ? (
                  <img
                    src={`/api/admin/files/${f.id}/preview`}
                    loading="lazy"
                    alt=""
                    className="w-9 h-9 object-cover rounded-sm border border-gray-100 shrink-0"
                  />
                ) : (
                  <span className="w-9 h-9 flex items-center justify-center text-lg shrink-0">{f.ext.toLowerCase() === 'pdf' ? '📕' : '📄'}</span>
                )}
                <span className="truncate">{f.name}</span>
                {isSearch && <span className="text-gray-400 text-xs ml-2 shrink-0">{(f as FileSearchHit).pathLabel}</span>}
              </>
            )
            return (
              <div key={f.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50">
                {previewable ? (
                  <button className="flex-1 flex items-center gap-2 text-left text-navy min-w-0" onClick={() => setPreview(f)}>
                    {label}
                  </button>
                ) : (
                  <a className="flex-1 flex items-center gap-2 text-navy min-w-0" href={`/api/admin/files/${f.id}/download`}>
                    {label}
                  </a>
                )}
                <span className="text-xs text-gray-400 w-20 text-right shrink-0">{fmtSize(f.size)}</span>
                <span className="hidden sm:inline text-xs text-gray-400 w-28 truncate shrink-0">{f.uploadedBy}</span>
                <a className="text-xs text-gray-400 hover:text-navy shrink-0" href={`/api/admin/files/${f.id}/download`}>Download</a>
                <button className="text-xs text-gray-400 hover:text-navy shrink-0" onClick={() => renameFile(f)}>Rename</button>
                <button className="text-xs text-gray-400 hover:text-red-600 shrink-0" onClick={() => deleteFile(f)}>Delete</button>
              </div>
            )
          })}
        </div>
      )}

      {preview && <PreviewLightbox file={preview} onClose={() => setPreview(null)} />}
    </div>
  )
}
```

- [ ] **Step 2: Build**

Run: `cd /Users/dzhambulat/Projects/Claude/worldwise && export PATH="/Users/dzhambulat/.nvm/versions/node/v24.15.0/bin:$PATH" && npm run build`
Expected: PASS; `/admin/files` still in route list.

- [ ] **Step 3: Commit**

```bash
cd /Users/dzhambulat/Projects/Claude
git add worldwise/app/admin/files/FilesClient.tsx
git commit -m "feat(files): preview lightbox + lazy thumbnails + visible New-folder button"
```

---

## Task 5: Verify, deploy, server smoke test

- [ ] **Step 1: Full unit tests + build (local)**

```bash
cd /Users/dzhambulat/Projects/Claude/worldwise && export PATH="/Users/dzhambulat/.nvm/versions/node/v24.15.0/bin:$PATH"
node --test --experimental-strip-types lib/*.test.ts
npm run build
```
Expected: all tests pass; build passes; route list shows `/api/admin/files/[id]/preview`.

(Browser e2e is done on the server in Step 5 — running it locally would create `data/files-storage.json`, and `data/` is server-only.)

- [ ] **Step 2: Merge to main**

```bash
cd /Users/dzhambulat/Projects/Claude
git checkout main && git merge --no-ff <feature-branch> -m "Merge <feature-branch>: file preview, thumbnails, Unicode names"
git checkout <feature-branch>  # only if you need to keep iterating; otherwise stay on main
```
(If executing on a feature branch, replace `<feature-branch>` with its name. If working directly on main, skip this step.)

- [ ] **Step 3: Push**

```bash
cd /Users/dzhambulat/Projects/Claude && git push claude main
```

- [ ] **Step 4: Deploy**

```bash
# backup
ssh -i ~/.ssh/id_ed25519 root@62.238.35.20 "cp -r /var/www/worldwise/data /var/www/worldwise/data_backup_$(date +%Y%m%d_%H%M%S)"
# sync (note the file-storage/ exclude)
rsync -avz --exclude='.git' --exclude='node_modules' --exclude='.next' --exclude='data/' --exclude='public/files/' --exclude='public/images/blog/' --exclude='.env.local' --exclude='AGENTS.md' --exclude='CLAUDE.md' --exclude='ruvector.db' --exclude='file-storage/' \
  -e "ssh -i ~/.ssh/id_ed25519" worldwise/ root@62.238.35.20:/var/www/worldwise/
# marker check BEFORE rebuild
ssh -i ~/.ssh/id_ed25519 root@62.238.35.20 "cd /var/www/worldwise && ls app/api/admin/files/[id]/preview/route.ts && grep -c 'isPreviewable' lib/file-storage-core.ts && echo MARKERS_OK"
# build + restart
ssh -i ~/.ssh/id_ed25519 root@62.238.35.20 "cd /var/www/worldwise && npm install && npm run build && pm2 restart worldwise"
```

- [ ] **Step 5: Server smoke test (owner login required — user-driven)**

On `https://worldwise.pro/admin/files`:
- "New folder" button is clearly visible without hovering.
- Upload an image, a PDF, and a .docx. Image row shows a thumbnail; PDF shows 📕; docx shows 📄.
- Click the image → lightbox shows it; click the PDF → lightbox iframe renders it; docx name → downloads (no preview).
- Rename a file to a Cyrillic name (e.g. `Отчёт`) → it persists as `Отчёт.<ext>` (NOT collapsed to `file`). Download it → filename is correct.
- Unauthenticated/негативные: `curl -s -o /dev/null -w "%{http_code}" https://worldwise.pro/api/admin/files/zzz/preview` → 403 (guard) when logged out.

---

## Self-review notes

- **Spec coverage:** button visibility (Task 4), preview route + whitelist + headers (Task 2), lightbox + thumbnails (Task 4), `isPreviewable` predicate + tests (Task 1), Unicode `sanitizeStorageName` + tests (Task 1), case-insensitive rename ext (Task 3), UTF-8 download filename (Task 3). All spec items mapped.
- **Behavior-change callout:** the old slug-style `sanitizeStorageName` test is replaced (Task 1 Step 1) — intentional, documented in the spec.
- **Type consistency:** `isPreviewable(ext: string)` / `PREVIEWABLE_EXT` used identically in the route (Task 2) and UI (Task 4); `MIME_FOR_EXT` already exists from the base feature; `useFocusTrap(panelRef, true, onClose)` matches its real signature (`panelRef, active, onClose, extraDeps?`).
- **Security:** preview route re-checks `isPreviewable` server-side (not just UI), serves `inline` + `nosniff` only for raster images + PDF (sandboxed), never `text/html`/`svg`; download route stays attachment/octet-stream; display name never reaches a disk path. No `dangerouslySetInnerHTML`.
- **No placeholders.**
