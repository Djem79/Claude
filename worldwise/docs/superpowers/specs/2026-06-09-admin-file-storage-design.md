# Admin File Storage — design

**Date:** 2026-06-09
**Status:** approved-pending-spec-review
**Author:** Claude (brainstorming session)

## Goal

A file manager in the admin panel where staff can store and share arbitrary
work documents (PDFs, Office docs, images). New top-level admin tab **Files**,
gated by a new per-section permission (`files`) like the existing
`properties` / `leads` / `dashboard` sections. Supports nested **folders**,
upload, download, rename, delete, and **search by name** across the whole store.

## Non-goals (v1 — YAGNI)

- Moving files/folders between folders (cheap to add later in the virtual model — defer to v2).
- Per-user private spaces (this is a shared team store; everyone with the `files` section sees the same tree).
- Disk quota / total-size cap, file versioning, in-browser preview/thumbnails.

## Decisions (from brainstorming)

| Question | Decision |
| -------- | -------- |
| Structure | **Folders (hierarchy)**, shared across all `files`-section users |
| File types | **Documents + images**: PDF, Word, Excel, PowerPoint, jpg/png/webp, zip |
| Per-file size limit | **25 MB** |
| Search | **Yes** — global, by file & folder name, results show folder path |
| Storage model | **Approach A — virtual folders** (see below) |

## Architecture — Approach A: virtual folders

Folders are **metadata only**. Physical bytes are stored flat on disk keyed by
a server-generated id, so no user-controlled string ever reaches a filesystem
path → **path-traversal is structurally impossible**. The folder tree,
file→folder membership, rename and (future) move are all JSON edits.

This mirrors the project's established pattern (server-only JSON index +
server-only file bytes + `writeFileAtomic` + a synchronous `mutate*` critical
section to avoid the read-modify-write lost-update race documented in
CLAUDE.md / the `project_json_mutation_race` memory).

### Storage locations (both server-only)

- **Bytes:** `public/files/storage/<fileId>.<ext>` — `public/files/` is already
  rsync-excluded, so the store persists on the server across deploys and is
  never committed to git or rsynced from local (same as lead attachments &
  brochures).
- **Index:** `data/files-storage.json` — `data/` is server-only and excluded
  from rsync. Created lazily (missing file → empty store `{folders:[],files:[]}`).

### Data model (`types/index.ts`)

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
  name: string               // sanitized original filename (with extension)
  ext: string                // e.g. "pdf"
  mime: string               // detected (magic-byte) mime
  size: number               // bytes
  folderId: string | null    // null = root
  uploadedAt: string
  uploadedBy: string         // username
}

export interface FileStore {
  folders: StorageFolder[]
  files: StorageFile[]
}
```

### Permissions (`lib/permissions.ts` + `types`)

- `AdminSection` gains `'files'`.
- `ALL_SECTIONS` → append `'files'` **at the end** (so `landingPath` ordering
  for existing users is unchanged).
- `SECTION_PATH.files = '/admin/files'`.
- `DEFAULT_SECTIONS` unchanged (`['properties']`).
- `UsersClient` `SECTION_LABEL: Record<AdminSection,string>` MUST gain a `files`
  entry (TS exhaustiveness will otherwise fail the build). Checkboxes appear
  automatically via `ALL_SECTIONS.map`.
- Backward-compat rule is preserved: legacy users with absent `sections` keep
  full access (including `files`); managers with explicit sections only get
  `files` when an owner ticks the box.
- `POST/PUT /api/admin/users` already validate `sections` against the section
  set — confirm it derives from `ALL_SECTIONS` so `files` is accepted.

## lib/file-storage.ts (server-only)

Pure-ish data layer, no `next` imports beyond fs. Mirrors `lib/leads.ts`.

- `readStore(): FileStore` — read + parse; `ENOENT` → empty store; **throws** on
  a present-but-corrupt file (never mask a bad read as "empty", same rule as
  `getProperties`).
- `mutateStore(fn: (s: FileStore) => FileStore): FileStore` — re-reads fresh
  inside a synchronous critical section, applies `fn`, `writeFileAtomic`s the
  result. All mutations (createFolder/rename/delete/addFile/deleteFile) go
  through this — no snapshot-before-await writes.
- Helpers: `listFolder(folderId)` → `{folder, breadcrumb[], subfolders[], files[]}`;
  `search(term)` → files+folders whose name contains term (case-insensitive),
  each with its computed breadcrumb path; `folderPath(folderId)` → breadcrumb.
- `storagePathFor(file)` → absolute disk path; used by download + delete.
- `deleteFolderRecursive(id)` — collect descendant folder ids + their files,
  unlink the file bytes from disk, then drop all from the index in one
  `mutateStore`.

### Validation helpers (reuse / extend `lib/lead-files.ts`)

- `sniffStorageFile(buf)` magic-byte detection extended to cover the allowed
  set: pdf, jpeg, png, webp, doc (OLE), docx/xlsx/pptx/zip (all ZIP →
  `application/zip`-family). **SVG is NOT allowed.**
- `ALLOWED_EXT` / `ALLOWED_MIME` whitelists + `SNIFF_OK` ext↔magic map, same
  shape as the lead-files route.
- `sanitizeName()` reused (lowercase, strip unsafe chars, cap length).

## API routes (`app/api/admin/files/**`)

**Every** handler starts with `requireSection('files')` → 403 on null
(per the "guard every sibling route" lesson). All are Node runtime (disk I/O).

| Route | Method | Purpose |
| ----- | ------ | ------- |
| `/api/admin/files` | `GET ?folder=<id>` | List a folder's subfolders + files + breadcrumb. `folder` omitted/`root` → root. |
| `/api/admin/files` | `GET ?q=<term>` | Global search by name (ignores folder); returns files+folders with paths. `q` takes precedence over `folder`. |
| `/api/admin/files` | `POST` | Multipart upload: `files[]` + `folderId`. Validate type (magic bytes), ext, 25 MB each. |
| `/api/admin/files/folder` | `POST` | Create folder `{name, parentId}`. Reject blank/duplicate-sibling name. |
| `/api/admin/files/folder/[id]` | `PATCH` | Rename folder `{name}`. |
| `/api/admin/files/folder/[id]` | `DELETE` | Delete folder recursively (bytes + index). |
| `/api/admin/files/[id]` | `PATCH` | Rename file `{name}` (keep extension). |
| `/api/admin/files/[id]` | `DELETE` | Delete file (unlink bytes + index). |
| `/api/admin/files/[id]/download` | `GET` | Stream bytes. **Always** `Content-Disposition: attachment; filename="..."` — never inline (prevents HTML/SVG XSS); `Content-Type: application/octet-stream` to be safe. |

Validation/error contract: 403 (no section), 404 (missing file/folder), 400
(bad input / oversize / type mismatch / dup name), 500 (fs error, logged).
File & folder ids are server-generated (`Date.now().toString(36)+rand`).

## UI

### Routing & guard (mirrors other admin sections)

- `app/admin/files/page.tsx` — server component: `getSession()`; if
  `!canAccess(session,'files')` → `redirect(landingPath(session) ?? '/admin')`.
  Renders `<FilesClient />`.
- `app/admin/AdminNav.tsx` — add `{href:'/admin/files', label:'Files', section:'files', active: p => p.startsWith('/admin/files')}` to `NAV_LINKS` (auto-hidden via `canAccess`).

### `app/admin/files/FilesClient.tsx` (client)

- **Breadcrumb** (Root / Folder / Subfolder) for navigation; click a crumb to jump up.
- **Search box** at the top — debounced; non-empty switches the view to flat
  search results (name + path + actions); clearing returns to folder view.
  (Honors the project pattern; same UX spirit as the `/properties` search just shipped.)
- **Toolbar:** "New folder" (prompt/inline input) + upload dropzone (drag-drop +
  file picker, multi-file). Upload progress/disabled state while posting.
- **Listing table:** folders first (open on click), then files
  (name, size, uploaded-by, uploaded-at) with row actions: Download, Rename, Delete.
  Delete asks for confirm; folder delete warns it removes contents.
- Styling: reuse admin table/button conventions (`btn-primary`, navy/gold).
  Back-office surface — admin glyphs allowed, but keep it clean.

## Security summary

- No user string in a disk path (id-keyed bytes) → no path traversal.
- Magic-byte content validation; SVG excluded; downloads forced as attachments
  with `application/octet-stream` → uploaded files can't execute or render.
- Every API route + the page guarded by `requireSection('files')` / `canAccess`.
- 25 MB per-file cap; server-generated ids; `writeFileAtomic` + `mutateStore`
  critical section against the JSON lost-update race.
- Storage + index both server-only (rsync/git excluded).

## Verification plan

1. `npm run build` passes (TS exhaustiveness on `SECTION_LABEL` proves the
   section wiring is complete).
2. Run **production** server (`npm run start`, NOT `npm run dev` — the site CSP
   blocks `unsafe-eval`, which dev HMR needs, so dev clients aren't interactive;
   documented this session).
3. Playwright as owner: create folder → enter it → upload a PDF → it appears →
   download returns the bytes → rename → search finds it from root with its path
   → delete file → delete folder.
4. Negative: upload an SVG / a >25 MB file → rejected with 400.
5. Access control: a manager **without** the `files` section is redirected away
   from `/admin/files` and gets 403 from `GET /api/admin/files`; owner ticks the
   box in `/admin/users` → access granted.

## Deploy notes

- Standard flow (backup data → rsync → grep markers → server build → pm2 restart).
- First deploy: `public/files/storage/` and `data/files-storage.json` are created
  lazily on first use on the server; nothing to seed.
- Both paths are rsync-excluded — confirm they are NOT accidentally added to git.
