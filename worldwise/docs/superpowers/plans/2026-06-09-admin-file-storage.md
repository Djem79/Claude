# Admin File Storage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an admin **Files** tab — a shared, folder-organised file manager (upload / download / rename / delete + global name search) gated by a new per-section permission.

**Architecture:** Virtual folders — file bytes stored flat on disk keyed by a server-generated id (`file-storage/<id>.<ext>`, outside `public/`, served only via an authenticated route), the folder tree + membership held as metadata in `data/files-storage.json`. No user string ever reaches a filesystem path → path-traversal is structurally impossible. Logic splits into a **pure core** (`lib/file-storage-core.ts`, unit-tested with `node:test`) and a thin **fs layer** (`lib/file-storage.ts`, atomic writes + a synchronous re-read critical section against the lost-update race).

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind. Node `node:test` for pure helpers. Magic-byte validation mirrors `lib/lead-files.ts`. Atomic writes via `lib/atomic-write.ts`.

**Spec:** `docs/superpowers/specs/2026-06-09-admin-file-storage-design.md`

**Reference files to imitate:** `lib/lead-files.ts` (sniff/sanitize), `lib/leads.ts` (`mutateLeadAttachments`), `lib/atomic-write.ts`, `app/api/leads/[id]/files/route.ts` (upload), `app/api/properties/[id]/route.ts` (route param signature), `app/admin/users/UsersClient.tsx` (section checkboxes).

---

## File structure

| File | Responsibility |
| ---- | -------------- |
| `types/index.ts` (modify) | Add `'files'` to `AdminSection`; add `StorageFolder`, `StorageFile`, `FileStore`, `Crumb`, search-result types. |
| `lib/permissions.ts` (modify) | `ALL_SECTIONS` += `'files'` (appended); `SECTION_PATH.files`. |
| `app/admin/users/UsersClient.tsx` (modify) | `SECTION_LABEL.files = 'Files'` (TS exhaustiveness). |
| `.gitignore` (repo root, modify) | Ignore `worldwise/file-storage/`. |
| `lib/file-storage-core.ts` (create) | PURE: sniff, sanitize, allowed-type maps, `breadcrumb`, `subfoldersOf`, `filesInFolder`, `searchStore`, `collectDescendantFolderIds`, `cleanFolderName`. No fs, no `@/`. |
| `lib/file-storage-core.test.ts` (create) | `node:test` for the pure core. |
| `lib/file-storage.ts` (create) | fs layer: `readStore`, `mutateStore`, `makeId`, `STORAGE_BASE`, `diskPathFor`, `writeFileBytes`, `removeFileBytes`, `deleteFolderRecursive`. |
| `app/api/admin/files/route.ts` (create) | `GET` (list folder / search) + `POST` (multi-upload). |
| `app/api/admin/files/folder/route.ts` (create) | `POST` create folder. |
| `app/api/admin/files/folder/[id]/route.ts` (create) | `PATCH` rename / `DELETE` recursive. |
| `app/api/admin/files/[id]/route.ts` (create) | `PATCH` rename file / `DELETE` file. |
| `app/api/admin/files/[id]/download/route.ts` (create) | `GET` stream as attachment. |
| `app/admin/AdminNav.tsx` (modify) | Add the Files nav link. |
| `app/admin/files/page.tsx` (create) | Server guard + render `FilesClient`. |
| `app/admin/files/FilesClient.tsx` (create) | The file-manager UI. |

---

## Task 1: Types, permissions, gitignore, Users label

**Files:**
- Modify: `worldwise/types/index.ts`
- Modify: `worldwise/lib/permissions.ts`
- Modify: `worldwise/app/admin/users/UsersClient.tsx:9-13`
- Modify: `.gitignore` (repo root, NOT `worldwise/.gitignore`)

- [ ] **Step 1: Add `'files'` to `AdminSection` and the storage types**

In `types/index.ts`, change the `AdminSection` line:

```ts
export type AdminSection = 'properties' | 'leads' | 'dashboard' | 'files'
```

Then append these types at the end of the file:

```ts
export interface StorageFolder {
  id: string
  name: string
  parentId: string | null   // null = root
  createdAt: string
  createdBy: string          // username
}

export interface StorageFile {
  id: string
  name: string               // sanitized original filename, with extension
  ext: string                // lowercase, no dot, e.g. "pdf"
  mime: string
  size: number               // bytes
  folderId: string | null    // null = root
  uploadedAt: string
  uploadedBy: string         // username
}

export interface FileStore {
  folders: StorageFolder[]
  files: StorageFile[]
}

export interface Crumb {
  id: string | null          // null = Root
  name: string
}

export interface FolderSearchHit extends StorageFolder { pathLabel: string }
export interface FileSearchHit extends StorageFile { pathLabel: string }
```

- [ ] **Step 2: Wire the section into permissions**

In `lib/permissions.ts`:

```ts
export const ALL_SECTIONS: AdminSection[] = ['properties', 'leads', 'dashboard', 'files']
```

and add the path to the `SECTION_PATH` object:

```ts
export const SECTION_PATH: Record<AdminSection, string> = {
  properties: '/admin',
  leads: '/admin/leads',
  dashboard: '/admin/dashboard',
  files: '/admin/files',
}
```

(`'files'` is appended last so `landingPath` ordering for existing users is unchanged. `DEFAULT_SECTIONS` stays `['properties']`.)

- [ ] **Step 3: Add the Users section label**

In `app/admin/users/UsersClient.tsx`, the `SECTION_LABEL` object (around line 9):

```ts
const SECTION_LABEL: Record<AdminSection, string> = {
  properties: 'Properties',
  leads: 'Leads',
  dashboard: 'Dashboard',
  files: 'Files',
}
```

(The checkbox grid already maps `ALL_SECTIONS`, so the Files checkbox appears automatically. `sanitizeSections` in `app/api/admin/users/route.ts` filters against `ALL_SECTIONS`, so `'files'` is accepted with no change there.)

- [ ] **Step 4: Gitignore the byte store**

In the repo-root `.gitignore`, right after the `worldwise/lead-files/` block (line ~22), add:

```gitignore
# Shared admin file storage — staff documents, stored outside public/ (served
# only via authenticated route). Server-only; survives deploys (rsync has no --delete).
worldwise/file-storage/
```

- [ ] **Step 5: Verify build**

Run: `cd worldwise && export PATH="/Users/dzhambulat/.nvm/versions/node/v24.15.0/bin:$PATH" && npm run build`
Expected: PASS. (If `SECTION_LABEL` is missing the `files` key, TS fails here — that's the wiring guardrail.)

- [ ] **Step 6: Commit**

```bash
git add worldwise/types/index.ts worldwise/lib/permissions.ts worldwise/app/admin/users/UsersClient.tsx .gitignore
git commit -m "feat(files): wire new 'files' admin section + storage types"
```

---

## Task 2: Pure core (`lib/file-storage-core.ts`) — TDD

**Files:**
- Create: `worldwise/lib/file-storage-core.ts`
- Test: `worldwise/lib/file-storage-core.test.ts`

This module has NO `fs` and NO `@/` value imports, so it runs under `node --test --experimental-strip-types`. Types are imported with `import type` (erased before resolution).

- [ ] **Step 1: Write the failing test**

Create `lib/file-storage-core.test.ts`:

```ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  cleanFolderName,
  sanitizeStorageName,
  sniffStorageFile,
  ALLOWED_EXT,
  SNIFF_OK,
  breadcrumb,
  subfoldersOf,
  filesInFolder,
  collectDescendantFolderIds,
  searchStore,
} from './file-storage-core.ts'
import type { FileStore } from '../types'

const store: FileStore = {
  folders: [
    { id: 'a', name: 'Contracts', parentId: null, createdAt: '', createdBy: 'u' },
    { id: 'b', name: 'NDAs', parentId: 'a', createdAt: '', createdBy: 'u' },
    { id: 'c', name: 'Marketing', parentId: null, createdAt: '', createdBy: 'u' },
  ],
  files: [
    { id: 'f1', name: 'deal.pdf', ext: 'pdf', mime: 'application/pdf', size: 1, folderId: 'b', uploadedAt: '', uploadedBy: 'u' },
    { id: 'f2', name: 'logo.png', ext: 'png', mime: 'image/png', size: 1, folderId: null, uploadedAt: '', uploadedBy: 'u' },
    { id: 'f3', name: 'nda-template.pdf', ext: 'pdf', mime: 'application/pdf', size: 1, folderId: 'a', uploadedAt: '', uploadedBy: 'u' },
  ],
}

test('cleanFolderName trims, collapses, strips slashes, caps length', () => {
  assert.equal(cleanFolderName('  My  Folder  '), 'My Folder')
  assert.equal(cleanFolderName('a/b\\c'), 'a b c')
  assert.equal(cleanFolderName(123 as unknown), '')
  assert.equal(cleanFolderName('x'.repeat(80)).length, 60)
})

test('sanitizeStorageName keeps extension, removes unsafe chars', () => {
  assert.equal(sanitizeStorageName('My Report (final).PDF'), 'my-report-final.pdf')
  assert.equal(sanitizeStorageName('../../etc/passwd'), 'etcpasswd')
  assert.equal(sanitizeStorageName(''), 'file')
})

test('sniffStorageFile detects allowed magic bytes', () => {
  assert.equal(sniffStorageFile(Buffer.from('%PDF-1.7')), 'pdf')
  assert.equal(sniffStorageFile(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0])), 'png')
  assert.equal(sniffStorageFile(Buffer.from([0x50, 0x4b, 0x03, 0x04])), 'zip')
  assert.equal(sniffStorageFile(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0, 0, 0, 0])), 'ole')
  assert.equal(sniffStorageFile(Buffer.from('<svg></svg>')), null)
})

test('SNIFF_OK maps detected type to legitimate extensions', () => {
  assert.ok(SNIFF_OK.zip.has('docx') && SNIFF_OK.zip.has('xlsx') && SNIFF_OK.zip.has('zip'))
  assert.ok(SNIFF_OK.ole.has('doc') && SNIFF_OK.ole.has('xls'))
  assert.ok(ALLOWED_EXT.has('pdf') && !ALLOWED_EXT.has('svg'))
})

test('breadcrumb walks root → leaf', () => {
  assert.deepEqual(breadcrumb(store, null), [{ id: null, name: 'Root' }])
  assert.deepEqual(breadcrumb(store, 'b'), [
    { id: null, name: 'Root' },
    { id: 'a', name: 'Contracts' },
    { id: 'b', name: 'NDAs' },
  ])
})

test('subfoldersOf / filesInFolder scope by folderId', () => {
  assert.deepEqual(subfoldersOf(store, null).map(f => f.id), ['a', 'c'])
  assert.deepEqual(subfoldersOf(store, 'a').map(f => f.id), ['b'])
  assert.deepEqual(filesInFolder(store, null).map(f => f.id), ['f2'])
  assert.deepEqual(filesInFolder(store, 'b').map(f => f.id), ['f1'])
})

test('collectDescendantFolderIds includes self + all descendants', () => {
  assert.deepEqual(new Set(collectDescendantFolderIds(store, 'a')), new Set(['a', 'b']))
  assert.deepEqual(collectDescendantFolderIds(store, 'c'), ['c'])
})

test('searchStore matches files & folders by name with path labels', () => {
  const res = searchStore(store, 'nda')
  assert.deepEqual(res.folders.map(f => f.id), ['b'])
  assert.deepEqual(res.files.map(f => f.id), ['f3'])
  assert.equal(res.files[0].pathLabel, 'Root / Contracts')
  const empty = searchStore(store, '   ')
  assert.deepEqual(empty, { folders: [], files: [] })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd worldwise && node --test --experimental-strip-types lib/file-storage-core.test.ts`
Expected: FAIL — `Cannot find module './file-storage-core.ts'`.

- [ ] **Step 3: Write the implementation**

Create `lib/file-storage-core.ts`:

```ts
import type { FileStore, StorageFolder, StorageFile, Crumb, FolderSearchHit, FileSearchHit } from '../types'

// --- Allowed types (documents + images). SVG intentionally excluded. ---------
export const ALLOWED_EXT = new Set([
  'pdf', 'jpg', 'jpeg', 'png', 'webp',
  'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'zip',
])

// Detected magic-byte family → the extensions it may legitimately back.
// Legacy Office (doc/xls/ppt) are OLE compound files; OOXML (docx/xlsx/pptx)
// and plain zip are all ZIP containers.
export const SNIFF_OK: Record<string, Set<string>> = {
  pdf: new Set(['pdf']),
  jpeg: new Set(['jpg', 'jpeg']),
  png: new Set(['png']),
  webp: new Set(['webp']),
  ole: new Set(['doc', 'xls', 'ppt']),
  zip: new Set(['docx', 'xlsx', 'pptx', 'zip']),
}

export const MIME_FOR_EXT: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  zip: 'application/zip',
}

/** Magic-byte sniff — never trust the client MIME/extension alone (audit P7). */
export function sniffStorageFile(buf: Buffer): 'pdf' | 'jpeg' | 'png' | 'webp' | 'ole' | 'zip' | null {
  if (buf.length >= 4 && buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46) return 'pdf'
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpeg'
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'png'
  if (buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'webp'
  if (buf.length >= 4 && buf[0] === 0xd0 && buf[1] === 0xcf && buf[2] === 0x11 && buf[3] === 0xe0) return 'ole'
  if (buf.length >= 4 && buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04) return 'zip'
  return null
}

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

/** Folder display name: human-friendly but no path separators/control chars. */
export function cleanFolderName(name: unknown): string {
  if (typeof name !== 'string') return ''
  return name
    .replace(/[\u0000-\u001f]/g, '') // strip control chars
    .replace(/[\/\\]/g, ' ')          // path separators -> space (name is display-only)
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60)
}

/** Crumbs from Root down to AND INCLUDING folderId (null = just Root). */
export function breadcrumb(store: FileStore, folderId: string | null): Crumb[] {
  const out: Crumb[] = []
  let cur = folderId
  let guard = 0
  while (cur && guard++ < 1000) {
    const f = store.folders.find(x => x.id === cur)
    if (!f) break
    out.unshift({ id: f.id, name: f.name })
    cur = f.parentId
  }
  out.unshift({ id: null, name: 'Root' })
  return out
}

function pathLabel(store: FileStore, folderId: string | null): string {
  return breadcrumb(store, folderId).map(c => c.name).join(' / ')
}

export function subfoldersOf(store: FileStore, parentId: string | null): StorageFolder[] {
  return store.folders
    .filter(f => f.parentId === parentId)
    .sort((a, b) => a.name.localeCompare(b.name))
}

export function filesInFolder(store: FileStore, folderId: string | null): StorageFile[] {
  return store.files
    .filter(f => f.folderId === folderId)
    .sort((a, b) => a.name.localeCompare(b.name))
}

/** The folder id plus every descendant folder id (for recursive delete). */
export function collectDescendantFolderIds(store: FileStore, folderId: string): string[] {
  const ids = [folderId]
  let i = 0
  while (i < ids.length) {
    const parent = ids[i++]
    for (const f of store.folders) {
      if (f.parentId === parent && !ids.includes(f.id)) ids.push(f.id)
    }
  }
  return ids
}

/** Global name search across the whole store; empty term → empty result. */
export function searchStore(store: FileStore, term: string): { folders: FolderSearchHit[]; files: FileSearchHit[] } {
  const q = term.trim().toLowerCase()
  if (!q) return { folders: [], files: [] }
  const folders = store.folders
    .filter(f => f.name.toLowerCase().includes(q))
    .map(f => ({ ...f, pathLabel: pathLabel(store, f.parentId) }))
  const files = store.files
    .filter(f => f.name.toLowerCase().includes(q))
    .map(f => ({ ...f, pathLabel: pathLabel(store, f.folderId) }))
  return { folders, files }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd worldwise && node --test --experimental-strip-types lib/file-storage-core.test.ts`
Expected: PASS — all tests green.

- [ ] **Step 5: Commit**

```bash
git add worldwise/lib/file-storage-core.ts worldwise/lib/file-storage-core.test.ts
git commit -m "feat(files): pure core (sniff, search, tree helpers) + node:test"
```

---

## Task 3: fs data layer (`lib/file-storage.ts`)

**Files:**
- Create: `worldwise/lib/file-storage.ts`

No unit test (touches disk); verified by an ad-hoc `tsx` run and later by Playwright.

- [ ] **Step 1: Write the implementation**

Create `lib/file-storage.ts`:

```ts
import fs from 'fs'
import path from 'path'
import { writeFileAtomic } from '@/lib/atomic-write'
import { collectDescendantFolderIds } from '@/lib/file-storage-core'
import type { FileStore, StorageFile } from '@/types'

const INDEX_PATH = path.join(process.cwd(), 'data', 'files-storage.json')
export const STORAGE_BASE = path.join(process.cwd(), 'file-storage')

const EMPTY: FileStore = { folders: [], files: [] }

/** ENOENT → empty store. A present-but-corrupt file THROWS (never mask a bad read). */
export function readStore(): FileStore {
  try {
    const parsed = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf-8'))
    return { folders: parsed.folders ?? [], files: parsed.files ?? [] }
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return { ...EMPTY }
    throw e
  }
}

function writeStore(store: FileStore): void {
  fs.mkdirSync(path.dirname(INDEX_PATH), { recursive: true })
  writeFileAtomic(INDEX_PATH, JSON.stringify(store, null, 2))
}

/**
 * Re-read fresh, transform, atomic-write — all synchronous, so it is a true
 * critical section under the single PM2 instance (no lost-update race). The
 * transform MUST be pure except for the deliberate fs side-effects in
 * deleteFolderRecursive (sync, no await inside).
 */
export function mutateStore(fn: (s: FileStore) => FileStore): FileStore {
  const next = fn(readStore())
  writeStore(next)
  return next
}

export function makeId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

export function diskPathFor(file: Pick<StorageFile, 'id' | 'ext'>): string {
  return path.join(STORAGE_BASE, `${file.id}.${file.ext}`)
}

export function writeFileBytes(file: StorageFile, buf: Buffer): void {
  fs.mkdirSync(STORAGE_BASE, { recursive: true })
  fs.writeFileSync(diskPathFor(file), buf)
}

export function removeFileBytes(file: Pick<StorageFile, 'id' | 'ext'>): void {
  const p = diskPathFor(file)
  if (fs.existsSync(p)) fs.unlinkSync(p)
}

/** Delete a folder, all descendant folders, and all their files (bytes + index). */
export function deleteFolderRecursive(folderId: string): FileStore {
  return mutateStore(store => {
    const ids = new Set(collectDescendantFolderIds(store, folderId))
    for (const f of store.files) {
      if (f.folderId && ids.has(f.folderId)) removeFileBytes(f)
    }
    return {
      folders: store.folders.filter(fo => !ids.has(fo.id)),
      files: store.files.filter(f => !(f.folderId && ids.has(f.folderId))),
    }
  })
}
```

- [ ] **Step 2: Ad-hoc verify the round-trip**

Run (from `worldwise/`):

```bash
export PATH="/Users/dzhambulat/.nvm/versions/node/v24.15.0/bin:$PATH"
npx tsx -e "
import { readStore } from './lib/file-storage.ts'
const s = readStore()
console.log('folders', s.folders.length, 'files', s.files.length)
"
```

Expected: prints `folders 0 files 0` (no index file yet → empty store, no throw).

- [ ] **Step 3: Commit**

```bash
git add worldwise/lib/file-storage.ts
git commit -m "feat(files): fs data layer (atomic index + recursive delete)"
```

---

## Task 4: List + search + upload route (`/api/admin/files`)

**Files:**
- Create: `worldwise/app/api/admin/files/route.ts`

- [ ] **Step 1: Write the implementation**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { requireSection } from '@/lib/auth'
import { readStore, mutateStore, makeId, writeFileBytes } from '@/lib/file-storage'
import {
  breadcrumb, subfoldersOf, filesInFolder, searchStore,
  sanitizeStorageName, sniffStorageFile, ALLOWED_EXT, SNIFF_OK, MIME_FOR_EXT,
} from '@/lib/file-storage-core'
import type { StorageFile } from '@/types'

export const runtime = 'nodejs'
const MAX_BYTES = 25 * 1024 * 1024

function normFolderId(raw: string | null): string | null {
  return raw && raw !== 'root' ? raw : null
}

export async function GET(req: NextRequest) {
  if (!(await requireSection('files'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const store = readStore()
  const q = (req.nextUrl.searchParams.get('q') ?? '').trim()
  if (q) {
    return NextResponse.json({ mode: 'search', q, ...searchStore(store, q) })
  }
  const folderId = normFolderId(req.nextUrl.searchParams.get('folder'))
  if (folderId && !store.folders.some(f => f.id === folderId)) {
    return NextResponse.json({ error: 'Folder not found' }, { status: 404 })
  }
  return NextResponse.json({
    mode: 'folder',
    folderId,
    breadcrumb: breadcrumb(store, folderId),
    folders: subfoldersOf(store, folderId),
    files: filesInFolder(store, folderId),
  })
}

export async function POST(req: NextRequest) {
  const session = await requireSection('files')
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const form = await req.formData()
  const folderId = normFolderId(String(form.get('folderId') ?? '') || null)
  const store = readStore()
  if (folderId && !store.folders.some(f => f.id === folderId)) {
    return NextResponse.json({ error: 'Folder not found' }, { status: 404 })
  }

  const files = form.getAll('files').filter((x): x is File => x instanceof File)
  if (files.length === 0) return NextResponse.json({ error: 'No files provided' }, { status: 400 })

  const saved: StorageFile[] = []
  for (const file of files) {
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: `${file.name}: exceeds 25 MB limit` }, { status: 400 })
    }
    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
    if (!ALLOWED_EXT.has(ext)) {
      return NextResponse.json({ error: `${file.name}: unsupported file type` }, { status: 400 })
    }
    const buf = Buffer.from(await file.arrayBuffer())
    const detected = sniffStorageFile(buf)
    if (!detected || !SNIFF_OK[detected]?.has(ext)) {
      return NextResponse.json({ error: `${file.name}: content does not match its type` }, { status: 400 })
    }
    const id = makeId()
    const sf: StorageFile = {
      id,
      ext,
      name: sanitizeStorageName(file.name),
      mime: MIME_FOR_EXT[ext] ?? 'application/octet-stream',
      size: file.size,
      folderId,
      uploadedAt: new Date().toISOString(),
      uploadedBy: session.username,
    }
    try {
      writeFileBytes(sf, buf)
    } catch (e) {
      console.error('[files/upload] fs error', e)
      return NextResponse.json({ error: 'Failed to save file' }, { status: 500 })
    }
    saved.push(sf)
  }

  // Re-reads fresh inside mutateStore → concurrent uploads don't lose each other.
  mutateStore(s => ({ ...s, files: [...s.files, ...saved] }))
  return NextResponse.json({ uploaded: saved.length }, { status: 201 })
}
```

- [ ] **Step 2: Verify build**

Run: `cd worldwise && npm run build`
Expected: PASS (route compiles).

- [ ] **Step 3: Commit**

```bash
git add worldwise/app/api/admin/files/route.ts
git commit -m "feat(files): GET list/search + POST multi-upload route"
```

---

## Task 5: Folder routes (create / rename / delete)

**Files:**
- Create: `worldwise/app/api/admin/files/folder/route.ts`
- Create: `worldwise/app/api/admin/files/folder/[id]/route.ts`

- [ ] **Step 1: Create-folder route**

`app/api/admin/files/folder/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { requireSection } from '@/lib/auth'
import { readStore, mutateStore, makeId } from '@/lib/file-storage'
import { cleanFolderName } from '@/lib/file-storage-core'
import type { StorageFolder } from '@/types'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const session = await requireSection('files')
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: { name?: unknown; parentId?: unknown }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const name = cleanFolderName(body.name)
  if (!name) return NextResponse.json({ error: 'Folder name required' }, { status: 400 })
  const parentId = typeof body.parentId === 'string' && body.parentId && body.parentId !== 'root' ? body.parentId : null

  const store = readStore()
  if (parentId && !store.folders.some(f => f.id === parentId)) {
    return NextResponse.json({ error: 'Parent folder not found' }, { status: 404 })
  }
  if (store.folders.some(f => f.parentId === parentId && f.name.toLowerCase() === name.toLowerCase())) {
    return NextResponse.json({ error: 'A folder with that name already exists here' }, { status: 409 })
  }

  const folder: StorageFolder = {
    id: makeId(), name, parentId,
    createdAt: new Date().toISOString(), createdBy: session.username,
  }
  mutateStore(s => ({ ...s, folders: [...s.folders, folder] }))
  return NextResponse.json(folder, { status: 201 })
}
```

- [ ] **Step 2: Rename / delete-folder route**

`app/api/admin/files/folder/[id]/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { requireSection } from '@/lib/auth'
import { readStore, mutateStore, deleteFolderRecursive } from '@/lib/file-storage'
import { cleanFolderName } from '@/lib/file-storage-core'

export const runtime = 'nodejs'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireSection('files')
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: { name?: unknown }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const name = cleanFolderName(body.name)
  if (!name) return NextResponse.json({ error: 'Folder name required' }, { status: 400 })

  const store = readStore()
  const folder = store.folders.find(f => f.id === params.id)
  if (!folder) return NextResponse.json({ error: 'Folder not found' }, { status: 404 })
  if (store.folders.some(f => f.id !== folder.id && f.parentId === folder.parentId && f.name.toLowerCase() === name.toLowerCase())) {
    return NextResponse.json({ error: 'A folder with that name already exists here' }, { status: 409 })
  }

  mutateStore(s => ({ ...s, folders: s.folders.map(f => (f.id === params.id ? { ...f, name } : f)) }))
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireSection('files')
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const store = readStore()
  if (!store.folders.some(f => f.id === params.id)) {
    return NextResponse.json({ error: 'Folder not found' }, { status: 404 })
  }
  deleteFolderRecursive(params.id)
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: Verify build**

Run: `cd worldwise && npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add worldwise/app/api/admin/files/folder/
git commit -m "feat(files): folder create/rename/delete routes"
```

---

## Task 6: File routes (rename / delete / download)

**Files:**
- Create: `worldwise/app/api/admin/files/[id]/route.ts`
- Create: `worldwise/app/api/admin/files/[id]/download/route.ts`

- [ ] **Step 1: Rename / delete-file route**

`app/api/admin/files/[id]/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { requireSection } from '@/lib/auth'
import { readStore, mutateStore, removeFileBytes } from '@/lib/file-storage'
import { sanitizeStorageName } from '@/lib/file-storage-core'

export const runtime = 'nodejs'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireSection('files')
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: { name?: unknown }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  if (typeof body.name !== 'string' || !body.name.trim()) {
    return NextResponse.json({ error: 'Name required' }, { status: 400 })
  }

  const store = readStore()
  const file = store.files.find(f => f.id === params.id)
  if (!file) return NextResponse.json({ error: 'File not found' }, { status: 404 })

  // Keep the real extension; sanitize the supplied base name and re-append it.
  let name = sanitizeStorageName(body.name)
  if (!name.endsWith(`.${file.ext}`)) name = `${name.replace(/\.[^.]*$/, '')}.${file.ext}`

  mutateStore(s => ({ ...s, files: s.files.map(f => (f.id === params.id ? { ...f, name } : f)) }))
  return NextResponse.json({ ok: true, name })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireSection('files')
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const store = readStore()
  const file = store.files.find(f => f.id === params.id)
  if (!file) return NextResponse.json({ error: 'File not found' }, { status: 404 })

  removeFileBytes(file)
  mutateStore(s => ({ ...s, files: s.files.filter(f => f.id !== params.id) }))
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Download route**

`app/api/admin/files/[id]/download/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { requireSection } from '@/lib/auth'
import { readStore, diskPathFor } from '@/lib/file-storage'
import fs from 'fs'

export const runtime = 'nodejs'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await requireSection('files'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const file = readStore().files.find(f => f.id === params.id)
  if (!file) return NextResponse.json({ error: 'File not found' }, { status: 404 })

  const p = diskPathFor(file)
  if (!fs.existsSync(p)) return NextResponse.json({ error: 'File missing on disk' }, { status: 404 })
  const buf = fs.readFileSync(p)

  // Always force a download as an opaque octet-stream — never inline. This is
  // what makes an uploaded HTML/SVG/script harmless (no render, no execution).
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(file.name)}"`,
      'Content-Length': String(buf.length),
    },
  })
}
```

- [ ] **Step 3: Verify build**

Run: `cd worldwise && npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add worldwise/app/api/admin/files/[id]/
git commit -m "feat(files): file rename/delete + forced-attachment download routes"
```

---

## Task 7: Nav link, page guard, and the UI

**Files:**
- Modify: `worldwise/app/admin/AdminNav.tsx` (the `NAV_LINKS` array)
- Create: `worldwise/app/admin/files/page.tsx`
- Create: `worldwise/app/admin/files/FilesClient.tsx`

- [ ] **Step 1: Add the nav link**

In `app/admin/AdminNav.tsx`, append to the `NAV_LINKS` array (after the Properties entry):

```ts
  {
    href: '/admin/files',
    label: 'Files',
    section: 'files',
    active: (p: string) => p.startsWith('/admin/files'),
  },
```

- [ ] **Step 2: Server page guard**

Create `app/admin/files/page.tsx`:

```tsx
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { canAccess, landingPath } from '@/lib/permissions'
import FilesClient from './FilesClient'

export const dynamic = 'force-dynamic'

export default async function FilesPage() {
  const session = await getSession()
  if (!session) redirect('/admin/login')
  if (!canAccess(session, 'files')) redirect(landingPath(session) ?? '/admin')
  return <FilesClient />
}
```

- [ ] **Step 3: The file-manager client**

Create `app/admin/files/FilesClient.tsx`:

```tsx
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { StorageFolder, StorageFile, Crumb, FolderSearchHit, FileSearchHit } from '@/types'

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

export default function FilesClient() {
  const [folderId, setFolderId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [view, setView] = useState<View | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
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
    await fetch(`/api/admin/files/folder/${f.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }),
    })
    await load()
  }

  async function deleteFolder(f: StorageFolder) {
    if (!window.confirm(`Delete folder "${f.name}" and everything inside it?`)) return
    await fetch(`/api/admin/files/folder/${f.id}`, { method: 'DELETE' })
    await load()
  }

  async function renameFile(f: StorageFile) {
    const name = window.prompt('Rename file', f.name)
    if (!name || name === f.name) return
    await fetch(`/api/admin/files/${f.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }),
    })
    await load()
  }

  async function deleteFile(f: StorageFile) {
    if (!window.confirm(`Delete "${f.name}"?`)) return
    await fetch(`/api/admin/files/${f.id}`, { method: 'DELETE' })
    await load()
  }

  const isSearch = view?.mode === 'search'

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <h1 className="font-serif text-2xl text-navy mb-4">Files</h1>

      {/* Toolbar */}
      <div className="flex flex-wrap gap-3 items-center mb-4">
        <input
          type="search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search files and folders…"
          className="flex-1 min-w-48 border border-gray-200 px-4 py-2.5 rounded-sm text-navy text-sm focus:outline-none focus:border-gold"
        />
        <button onClick={newFolder} disabled={busy || isSearch} className="btn-outline text-sm disabled:opacity-40">
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
                className="flex-1 text-left text-navy font-medium"
                onClick={() => { if (!isSearch) { setQuery(''); setFolderId(f.id) } else { setQuery(''); setFolderId(f.id) } }}
              >
                <span className="mr-2">📁</span>{f.name}
                {isSearch && <span className="text-gray-400 font-normal text-xs ml-2">{(f as FolderSearchHit).pathLabel}</span>}
              </button>
              <button className="text-xs text-gray-400 hover:text-navy" onClick={() => renameFolder(f)}>Rename</button>
              <button className="text-xs text-gray-400 hover:text-red-600" onClick={() => deleteFolder(f)}>Delete</button>
            </div>
          ))}

          {/* Files */}
          {view.files.map(f => (
            <div key={f.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50">
              <a className="flex-1 text-navy" href={`/api/admin/files/${f.id}/download`}>
                <span className="mr-2">📄</span>{f.name}
                {isSearch && <span className="text-gray-400 text-xs ml-2">{(f as FileSearchHit).pathLabel}</span>}
              </a>
              <span className="text-xs text-gray-400 w-20 text-right">{fmtSize(f.size)}</span>
              <span className="hidden sm:inline text-xs text-gray-400 w-28 truncate">{f.uploadedBy}</span>
              <a className="text-xs text-gray-400 hover:text-navy" href={`/api/admin/files/${f.id}/download`}>Download</a>
              <button className="text-xs text-gray-400 hover:text-navy" onClick={() => renameFile(f)}>Rename</button>
              <button className="text-xs text-gray-400 hover:text-red-600" onClick={() => deleteFile(f)}>Delete</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

(Folder/file glyphs `📁`/`📄` are fine here — this is the back-office admin, not a public page. The no-emoji rule applies only to public-facing pages.)

- [ ] **Step 4: Verify build**

Run: `cd worldwise && npm run build`
Expected: PASS. Confirm `/admin/files` appears in the route list.

- [ ] **Step 5: Commit**

```bash
git add worldwise/app/admin/AdminNav.tsx worldwise/app/admin/files/
git commit -m "feat(files): admin Files tab — nav, guarded page, file-manager UI"
```

---

## Task 8: End-to-end verification (production build + Playwright)

**No new files.** This proves the feature works before deploy. Use the **production** server — `npm run dev` is NOT interactive on this site (CSP blocks `unsafe-eval` that dev HMR needs).

- [ ] **Step 1: Build and start production**

```bash
cd worldwise && export PATH="/Users/dzhambulat/.nvm/versions/node/v24.15.0/bin:$PATH"
npm run build && (npm run start > /tmp/ww-files.log 2>&1 &)
# wait until /admin/login returns 200
for i in $(seq 1 40); do curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/admin/login | grep -q 200 && break; sleep 1; done
```

- [ ] **Step 2: Log in as owner via Playwright, then exercise the manager**

Drive with Playwright (owner credentials from the local `.env.local` `ADMIN_PASSWORD`; the owner account must already exist locally — if not, note that `data/` is server-only and test the API directly with a forged session is NOT possible, so verify on the server post-deploy instead). Steps:
1. Navigate `http://localhost:3000/admin/login`, log in.
2. Navigate `/admin/files`. Assert the "Files" heading + Upload button render.
3. Click "New folder", enter `QA Folder` (handle the `window.prompt` dialog). Assert it appears.
4. Enter the folder; upload a small PDF (`browser_file_upload`). Assert the row appears with a size.
5. Type `qa` in search. Assert the folder/file appear with a path label.
6. Click Download on the file; assert the response is `200` with `Content-Disposition: attachment`.
7. Delete the file, then the folder; assert they disappear.

- [ ] **Step 3: Negative checks (via curl with the session cookie)**

Grab the `ww_admin_session` cookie from the Playwright context and:
- `POST /api/admin/files` with a `.svg` file → expect `400` (unsupported type).
- `POST` a >25 MB file → expect `400`.

- [ ] **Step 4: Access-control check**

If a manager account without the `files` section exists locally, log in as them and confirm:
- `/admin/files` redirects away (to their landing path).
- `GET /api/admin/files` returns `403`.
- The "Files" tab is absent from the nav.

(If no such account exists locally, record this as a must-run check on the server after deploy, using `/admin/users` to create a manager without `files`.)

- [ ] **Step 5: Stop the server**

```bash
pkill -f "next start"; pkill -f "next-server"
```

- [ ] **Step 6: Commit (if any fixes were needed)**

```bash
git add -- <only the files you changed>
git commit -m "fix(files): <describe>"
```

---

## Task 9: Deploy

- [ ] **Step 1: Backup server data**

```bash
ssh -i ~/.ssh/id_ed25519 root@62.238.35.20 \
  "cp -r /var/www/worldwise/data /var/www/worldwise/data_backup_$(date +%Y%m%d_%H%M%S)"
```

- [ ] **Step 2: Rsync the working tree**

```bash
rsync -avz --exclude='.git' --exclude='node_modules' --exclude='.next' --exclude='data/' --exclude='public/files/' --exclude='public/images/blog/' --exclude='.env.local' --exclude='AGENTS.md' --exclude='CLAUDE.md' --exclude='ruvector.db' --exclude='file-storage/' \
  -e "ssh -i ~/.ssh/id_ed25519" worldwise/ root@62.238.35.20:/var/www/worldwise/
```

(Added `--exclude='file-storage/'` so a future local test store never overwrites the server's.)

- [ ] **Step 3: Verify markers on the server BEFORE rebuild**

```bash
ssh -i ~/.ssh/id_ed25519 root@62.238.35.20 "cd /var/www/worldwise && \
  grep -c \"'files'\" lib/permissions.ts && \
  ls app/admin/files/page.tsx && \
  grep -rl 'getStoredAttribution' components/ | wc -l && echo markers_ok"
```

Expected: permissions hit, page present, recent features intact.

- [ ] **Step 4: Build + restart**

```bash
ssh -i ~/.ssh/id_ed25519 root@62.238.35.20 \
  "cd /var/www/worldwise && npm install && npm run build && pm2 restart worldwise"
```

- [ ] **Step 5: Live smoke test + on-server access-control check**

- `curl -s https://worldwise.pro/admin/login` → 200.
- Log in as owner → `/admin/files` works; create folder, upload, download, delete.
- In `/admin/users`, create a manager WITHOUT `files`, log in as them → `/admin/files` redirects, `GET /api/admin/files` → 403, no Files tab.

- [ ] **Step 6: Push**

```bash
git push claude main
```

---

## Self-review notes

- **Spec coverage:** folders (Tasks 2–7), documents+images whitelist (Task 2 `ALLOWED_EXT`/`SNIFF_OK`, SVG excluded), 25 MB (Task 4), search (Task 2 `searchStore` + Task 4 `?q` + Task 7 UI), new `files` section + Users checkbox (Task 1), guarded routes + page (Tasks 4–7), forced-attachment download (Task 6), atomic index + recursive delete + lost-update guard (Task 3), gitignore + rsync exclude (Tasks 1, 9). Move-between-folders is correctly absent (v2 non-goal).
- **Type consistency:** `StorageFolder`/`StorageFile`/`FileStore`/`Crumb`/`FolderSearchHit`/`FileSearchHit` defined once in Task 1 and used verbatim everywhere; `normFolderId`/`folderId` semantics (`null` = root, `'root'` sentinel on the wire) consistent across GET/POST/UI; `diskPathFor` shape (`{id, ext}`) matches every caller.
- **No placeholders:** every step has full code or an exact command + expected output.
- **TDD where the toolchain supports it:** the logic-heavy pure core is `node:test`-driven (Task 2); routes/UI follow the project norm of build + production-server + Playwright verification (Task 8).
