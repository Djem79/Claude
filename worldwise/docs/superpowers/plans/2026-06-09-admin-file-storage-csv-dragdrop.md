# File Manager — CSV upload + drag-and-drop — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow `.csv` uploads (signature-less text validation) and let staff drag files onto the `/admin/files` list to upload to the current folder.

**Architecture:** CSV has no magic bytes, so it's validated by a "looks like text" check (no NUL byte) instead of the magic-byte gate — safe because CSV is never previewable and always downloads as an attachment. Drag-and-drop reuses the existing `upload()` POST path; only the UI gains drop handlers.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind. `node:test` for pure helpers.

**Spec:** `docs/superpowers/specs/2026-06-09-admin-file-storage-csv-dragdrop-design.md`

---

## File structure

| File | Change |
| ---- | ------ |
| `lib/file-storage-core.ts` (modify) | `csv` in `ALLOWED_EXT`; `MIME_FOR_EXT.csv`; `SNIFFLESS_EXT`; `looksLikeText` |
| `lib/file-storage-core.test.ts` (modify) | tests: `looksLikeText`, csv allowed, csv not previewable, csv signature-less |
| `app/api/admin/files/route.ts` (modify) | validation fork: csv → `looksLikeText`, else magic-byte |
| `app/admin/files/FilesClient.tsx` (modify) | drag-and-drop drop target on the list |

---

## Task 1: Core — CSV allowance + looksLikeText (TDD)

**Files:**
- Modify: `worldwise/lib/file-storage-core.ts`
- Test: `worldwise/lib/file-storage-core.test.ts`

- [ ] **Step 1: Add the tests first**

In `lib/file-storage-core.test.ts`, add `SNIFFLESS_EXT` and `looksLikeText` to the existing import from `./file-storage-core.ts` (alongside `ALLOWED_EXT`, `isPreviewable`, etc.). Then add these test blocks at the end of the file:

```ts
test('looksLikeText: text yes, binary (NUL byte) no', () => {
  assert.equal(looksLikeText(Buffer.from('a,b,c\n1,2,3\n')), true)
  assert.equal(looksLikeText(Buffer.from('строка,значение\nдом,100\n', 'utf-8')), true)
  assert.equal(looksLikeText(Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00])), false) // zip w/ NUL
  assert.equal(looksLikeText(Buffer.from('')), true)
})

test('csv is an allowed, signature-less, non-previewable type', () => {
  assert.ok(ALLOWED_EXT.has('csv'))
  assert.ok(SNIFFLESS_EXT.has('csv'))
  assert.equal(isPreviewable('csv'), false)
})
```

- [ ] **Step 2: Run tests, verify FAIL**

Run: `cd /Users/dzhambulat/Projects/Claude/worldwise && export PATH="/Users/dzhambulat/.nvm/versions/node/v24.15.0/bin:$PATH" && node --test --experimental-strip-types lib/file-storage-core.test.ts`
Expected: FAIL — `SNIFFLESS_EXT`/`looksLikeText` not exported; `ALLOWED_EXT` lacks `csv`.

- [ ] **Step 3: Implement in `lib/file-storage-core.ts`**

(a) Add `'csv'` to the `ALLOWED_EXT` set. The current line is:
```ts
export const ALLOWED_EXT = new Set([
  'pdf', 'jpg', 'jpeg', 'png', 'webp',
  'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'zip',
])
```
Change it to (note the added `'csv'`):
```ts
export const ALLOWED_EXT = new Set([
  'pdf', 'jpg', 'jpeg', 'png', 'webp',
  'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'zip', 'csv',
])
```

(b) In the `MIME_FOR_EXT` object, add a `csv` entry (e.g. after the `zip` line):
```ts
  zip: 'application/zip',
  csv: 'text/csv',
```

(c) Add these after `MIME_FOR_EXT` (near `SNIFF_OK`):
```ts
/** Allowed types that have NO magic-byte signature (plain text); validated by content shape, not a sniff. */
export const SNIFFLESS_EXT = new Set(['csv'])

/** True if the buffer is plausibly text (no NUL byte in the first 8 KB). */
export function looksLikeText(buf: Buffer): boolean {
  const n = Math.min(buf.length, 8192)
  for (let i = 0; i < n; i++) if (buf[i] === 0) return false
  return true
}
```

(d) Do NOT add `csv` to `PREVIEWABLE_EXT` — CSV stays download-only.

- [ ] **Step 4: Run tests, verify PASS**

Run: `cd /Users/dzhambulat/Projects/Claude/worldwise && node --test --experimental-strip-types lib/file-storage-core.test.ts`
Expected: PASS — all blocks (the existing sniff test still passes; csv isn't in `SNIFF_OK`, which is fine because csv goes through the signature-less path).

- [ ] **Step 5: Commit**

```bash
cd /Users/dzhambulat/Projects/Claude
git add worldwise/lib/file-storage-core.ts worldwise/lib/file-storage-core.test.ts
git commit -m "feat(files): allow CSV (signature-less text) uploads"
```

---

## Task 2: Upload route — signature-less validation fork

**Files:**
- Modify: `worldwise/app/api/admin/files/route.ts`

- [ ] **Step 1: Extend the core import**

The current import block (lines 4-7) is:
```ts
import {
  breadcrumb, subfoldersOf, filesInFolder, searchStore,
  sanitizeStorageName, sniffStorageFile, ALLOWED_EXT, SNIFF_OK, MIME_FOR_EXT,
} from '@/lib/file-storage-core'
```
Replace it with (adds `SNIFFLESS_EXT, looksLikeText`):
```ts
import {
  breadcrumb, subfoldersOf, filesInFolder, searchStore,
  sanitizeStorageName, sniffStorageFile, ALLOWED_EXT, SNIFF_OK, MIME_FOR_EXT,
  SNIFFLESS_EXT, looksLikeText,
} from '@/lib/file-storage-core'
```

- [ ] **Step 2: Fork the per-file validation**

Find this exact block inside the `for (const file of files)` loop:
```ts
    const buf = Buffer.from(await file.arrayBuffer())
    const detected = sniffStorageFile(buf)
    if (!detected || !SNIFF_OK[detected]?.has(ext)) {
      return NextResponse.json({ error: `${file.name}: content does not match its type` }, { status: 400 })
    }
```
Replace it with:
```ts
    const buf = Buffer.from(await file.arrayBuffer())
    if (SNIFFLESS_EXT.has(ext)) {
      // Plain-text types (csv) have no magic signature — validate shape, not bytes.
      // Safe: never previewable, always served as an attachment (octet-stream).
      if (!looksLikeText(buf)) {
        return NextResponse.json({ error: `${file.name}: not a valid text/CSV file` }, { status: 400 })
      }
    } else {
      const detected = sniffStorageFile(buf)
      if (!detected || !SNIFF_OK[detected]?.has(ext)) {
        return NextResponse.json({ error: `${file.name}: content does not match its type` }, { status: 400 })
      }
    }
```

- [ ] **Step 3: Build**

Run: `cd /Users/dzhambulat/Projects/Claude/worldwise && export PATH="/Users/dzhambulat/.nvm/versions/node/v24.15.0/bin:$PATH" && npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
cd /Users/dzhambulat/Projects/Claude
git add worldwise/app/api/admin/files/route.ts
git commit -m "feat(files): accept CSV via signature-less text validation in upload"
```

---

## Task 3: Drag-and-drop on the file list

**Files:**
- Modify: `worldwise/app/admin/files/FilesClient.tsx`

- [ ] **Step 1: Add drag state**

Find:
```tsx
  const [preview, setPreview] = useState<StorageFile | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
```
Replace with (adds `dragOver`):
```tsx
  const [preview, setPreview] = useState<StorageFile | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
```

- [ ] **Step 2: Make the list a drop target**

Find this exact opening of the results container:
```tsx
      {!loading && view && (
        <div className="border border-gray-200 rounded-sm divide-y divide-gray-100">
```
Replace it with:
```tsx
      {view?.mode === 'folder' && (
        <p className="text-xs text-gray-400 mb-2">Drag files onto the list below to upload to this folder.</p>
      )}

      {!loading && view && (
        <div
          onDragOver={e => { if (view.mode === 'folder' && !busy) { e.preventDefault(); setDragOver(true) } }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => {
            e.preventDefault()
            setDragOver(false)
            if (view.mode === 'folder' && !busy) upload(e.dataTransfer.files)
          }}
          className={`border rounded-sm divide-y divide-gray-100 transition-colors ${dragOver ? 'border-gold border-2 bg-gold/5' : 'border-gray-200'}`}
        >
```
(The closing `</div>` and `)}` for this block are unchanged. Only the opening `<div …>` and the new hint `<p>` above it are added. `upload(e.dataTransfer.files)` reuses the existing handler, which already targets the current `folderId`, validates, and reloads. Drop is ignored in search mode and while busy.)

- [ ] **Step 3: Build**

Run: `cd /Users/dzhambulat/Projects/Claude/worldwise && export PATH="/Users/dzhambulat/.nvm/versions/node/v24.15.0/bin:$PATH" && npm run build`
Expected: PASS; `/admin/files` still in route list.

- [ ] **Step 4: Commit**

```bash
cd /Users/dzhambulat/Projects/Claude
git add worldwise/app/admin/files/FilesClient.tsx
git commit -m "feat(files): drag-and-drop upload onto the file list"
```

---

## Task 4: Verify + deploy

- [ ] **Step 1: Tests + build (local)**

```bash
cd /Users/dzhambulat/Projects/Claude/worldwise && export PATH="/Users/dzhambulat/.nvm/versions/node/v24.15.0/bin:$PATH"
node --test --experimental-strip-types lib/*.test.ts
npm run build
```
Expected: all tests pass; build passes.

(Browser/drag e2e runs on the server after deploy — local upload would write to `data/`, which is server-only.)

- [ ] **Step 2: Merge to main + push (if on a feature branch)**

```bash
cd /Users/dzhambulat/Projects/Claude
git checkout main && git merge --no-ff <feature-branch> -m "Merge <feature-branch>: CSV upload + drag-and-drop"
git branch -d <feature-branch>
git push claude main
```

- [ ] **Step 3: Deploy**

```bash
ssh -i ~/.ssh/id_ed25519 root@62.238.35.20 "cp -r /var/www/worldwise/data /var/www/worldwise/data_backup_$(date +%Y%m%d_%H%M%S)"
rsync -avz --exclude='.git' --exclude='node_modules' --exclude='.next' --exclude='data/' --exclude='public/files/' --exclude='public/images/blog/' --exclude='.env.local' --exclude='AGENTS.md' --exclude='CLAUDE.md' --exclude='ruvector.db' --exclude='file-storage/' \
  -e "ssh -i ~/.ssh/id_ed25519" worldwise/ root@62.238.35.20:/var/www/worldwise/
ssh -i ~/.ssh/id_ed25519 root@62.238.35.20 "cd /var/www/worldwise && grep -c 'looksLikeText' lib/file-storage-core.ts && grep -c 'onDrop' app/admin/files/FilesClient.tsx && echo MARKERS_OK"
ssh -i ~/.ssh/id_ed25519 root@62.238.35.20 "cd /var/www/worldwise && npm install && npm run build && pm2 restart worldwise"
```

- [ ] **Step 4: Server smoke (owner login — user-driven)**

- Upload a real `.csv` via the button → succeeds; download returns it intact.
- Drag several files (incl. a `.csv` and an image) onto the list → all upload to the current folder; image thumbnails appear.
- Drag onto the list while a search query is active → nothing uploads (disabled).
- Rename a binary file to `.csv` and upload → rejected (400, "not a valid text/CSV file").
- `GET /api/admin/files/<csv-id>/preview` → 404 (csv not previewable).

---

## Self-review notes

- **Spec coverage:** csv allowed + mime + signature-less set + looksLikeText (Task 1); upload validation fork (Task 2); drag-and-drop reusing `upload()`, folder-only, busy-guarded, with a discoverability hint + drop highlight (Task 3); verification incl. binary-renamed-csv rejection and csv-not-previewable (Task 4). All mapped.
- **Type/name consistency:** `SNIFFLESS_EXT`, `looksLikeText` defined in Task 1 and imported verbatim in Task 2; `upload(files: FileList | null)` already accepts `e.dataTransfer.files` (a `FileList`); `view.mode === 'folder'` guards the drop (search has no target folder).
- **Security:** drag-drop posts to the same guarded route + validation; csv is download-only (not in `PREVIEWABLE_EXT`), so the preview route 404s it and the download route serves it as an attachment; `looksLikeText` rejects binaries masquerading as csv.
- **No placeholders.**
