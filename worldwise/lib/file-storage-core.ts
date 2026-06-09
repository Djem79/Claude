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
    .replace(/[\x00-\x1f\x7f]/g, '') // strip control chars (not spaces)
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
  const seen = new Set<string>([folderId])
  const ids = [folderId]
  let i = 0
  while (i < ids.length) {
    const parent = ids[i++]
    for (const f of store.folders) {
      if (f.parentId === parent && !seen.has(f.id)) {
        seen.add(f.id)
        ids.push(f.id)
      }
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
    .sort((a, b) => a.name.localeCompare(b.name))
  const files = store.files
    .filter(f => f.name.toLowerCase().includes(q))
    .map(f => ({ ...f, pathLabel: pathLabel(store, f.folderId) }))
    .sort((a, b) => a.name.localeCompare(b.name))
  return { folders, files }
}
