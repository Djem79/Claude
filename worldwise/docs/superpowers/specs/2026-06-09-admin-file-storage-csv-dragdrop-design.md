# Admin File Storage — CSV upload + drag-and-drop

**Date:** 2026-06-09
**Status:** approved-pending-spec-review
**Builds on:** the live `/admin/files` manager (`2026-06-09-admin-file-storage-design.md` + `…-preview-design.md`)

## Goal

1. **CSV upload** — allow `.csv` files. They currently fail because `ALLOWED_EXT` excludes `csv` AND the upload validation requires a magic-byte match, which CSV (plain text, no signature) can never satisfy.
2. **Drag-and-drop** — let staff drag files onto the file list to upload them to the current folder (today upload is only via the Upload button → OS picker; multi-select already works there).

## Non-goals (YAGNI)

- CSV table/spreadsheet preview (CSV stays download-only).
- Other signature-less text types (txt/json) — user chose CSV only.
- Drag-to-move files between folders.

## Item 1 — CSV upload (signature-less validation)

The magic-byte gate (`sniffStorageFile` + `SNIFF_OK`) exists so a file can't
masquerade as a previewable type (e.g. HTML renamed `.png`). CSV is **never
previewable** (not in `PREVIEWABLE_EXT`) and is always served as
`attachment` + `application/octet-stream` by the download route, so it cannot
render or execute. Therefore CSV can be accepted by extension + a light
"looks like text" check instead of a magic-byte signature.

### `lib/file-storage-core.ts`
- Add `'csv'` to `ALLOWED_EXT`.
- Add `MIME_FOR_EXT.csv = 'text/csv'`.
- Add `export const SNIFFLESS_EXT = new Set(['csv'])` — extensions allowed without a magic signature.
- Add a pure helper:
  ```ts
  /** True if the buffer is plausibly text (no NUL byte in the first 8 KB). */
  export function looksLikeText(buf: Buffer): boolean {
    const n = Math.min(buf.length, 8192)
    for (let i = 0; i < n; i++) if (buf[i] === 0) return false
    return true
  }
  ```
- `csv` is deliberately NOT added to `PREVIEWABLE_EXT` (stays download-only).

`node:test`: `looksLikeText(Buffer.from('a,b,c\n1,2,3'))` → true; `looksLikeText(Buffer.from([0x00,0x01]))` → false; `ALLOWED_EXT.has('csv')` → true; `isPreviewable('csv')` → false; `SNIFFLESS_EXT.has('csv')` → true.

### `app/api/admin/files/route.ts` (POST)
Replace the single validation branch:
```ts
const buf = Buffer.from(await file.arrayBuffer())
const detected = sniffStorageFile(buf)
if (!detected || !SNIFF_OK[detected]?.has(ext)) {
  return NextResponse.json({ error: `${file.name}: content does not match its type` }, { status: 400 })
}
```
with a fork: signature-less types (csv) validate via `looksLikeText`; everything
else keeps the magic-byte match:
```ts
const buf = Buffer.from(await file.arrayBuffer())
if (SNIFFLESS_EXT.has(ext)) {
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
(Add `SNIFFLESS_EXT`, `looksLikeText` to the existing import from `@/lib/file-storage-core`.)

Result: a real `.csv` uploads; a binary renamed `.csv` (has NUL bytes) is rejected.

## Item 2 — Drag-and-drop

In `app/admin/files/FilesClient.tsx`, make the file-list region a drop target.
Reuse the existing `upload(files: FileList | null)` function unchanged.

- New state `const [dragOver, setDragOver] = useState(false)`.
- A wrapper around the listing `<div>` with:
  - `onDragOver={e => { if (!isSearch && !busy) { e.preventDefault(); setDragOver(true) } }}`
  - `onDragLeave={() => setDragOver(false)}`
  - `onDrop={e => { e.preventDefault(); setDragOver(false); if (!isSearch && !busy) upload(e.dataTransfer.files) }}`
- While `dragOver`, show a visual cue: a gold dashed ring/overlay on the list area with a "Drop files here" hint.
- Drop is **disabled in search mode** (no current folder context) and while `busy`. Files land in the current `folderId` (the `upload` function already uses it).
- Keep the Upload button (picker) and `multiple` input as-is — multi-select there already works; drag-drop is an additional path. Multiple dragged files upload in one POST (the route loops over `getAll('files')`).

No new routes, types, or components.

## Security / consistency

- Drag-drop posts to the same `POST /api/admin/files` with the same guards (`requireSection('files')`), 25 MB cap, and validation (magic-byte for binary types; `looksLikeText` for csv).
- CSV is download-only (forced attachment/octet-stream); never inline; not in `PREVIEWABLE_EXT`, so the preview route returns 404 for it.
- Names sanitized via the Unicode-aware `sanitizeStorageName`.

## Files touched

| File | Change |
| ---- | ------ |
| `lib/file-storage-core.ts` | `csv` in `ALLOWED_EXT`; `MIME_FOR_EXT.csv`; `SNIFFLESS_EXT`; `looksLikeText` |
| `lib/file-storage-core.test.ts` | tests for `looksLikeText`, csv allowed, csv not previewable |
| `app/api/admin/files/route.ts` | signature-less validation fork for csv |
| `app/admin/files/FilesClient.tsx` | drag-and-drop drop target + visual cue |

## Verification

1. `node --test --experimental-strip-types lib/file-storage-core.test.ts` — pure tests.
2. `npm run build`.
3. Production server (`npm run start`, not dev) → server smoke after deploy:
   - Upload a real `.csv` (button) → succeeds, appears, downloads correctly.
   - Drag several files (incl. a .csv and an image) onto the list → all upload to the current folder; thumbnails appear for images.
   - Drag onto the list while a search is active → no upload (disabled).
   - A binary file renamed `.csv` → rejected 400.
   - `GET …/preview` for the csv → 404 (not previewable).
4. Access control: manager without `files` → upload 403 (unchanged).

## Deploy

Standard flow (backup → rsync with `--exclude='file-storage/'` → grep markers → server build → pm2 restart). No new prerequisites.
