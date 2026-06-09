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

/**
 * Write a file's bytes to disk. Call BEFORE adding its record via mutateStore:
 * a crash leaving orphaned bytes (no index entry) is harmless, whereas an index
 * entry with no bytes would be a broken download.
 */
export function writeFileBytes(file: StorageFile, buf: Buffer): void {
  fs.mkdirSync(STORAGE_BASE, { recursive: true })
  fs.writeFileSync(diskPathFor(file), buf)
}

export function removeFileBytes(file: Pick<StorageFile, 'id' | 'ext'>): void {
  const p = diskPathFor(file)
  if (fs.existsSync(p)) fs.unlinkSync(p)
}

/**
 * Delete a folder, all descendant folders, and all their files (index + bytes).
 * The index is written FIRST (transactionally), then byte files are unlinked.
 * If an unlink fails, the bytes are orphaned but harmless — far safer than the
 * reverse, where a mid-loop failure would leave index records pointing at
 * already-deleted bytes (broken downloads).
 */
export function deleteFolderRecursive(folderId: string): FileStore {
  let removed: StorageFile[] = []
  const next = mutateStore(store => {
    const ids = new Set(collectDescendantFolderIds(store, folderId))
    removed = store.files.filter(f => f.folderId && ids.has(f.folderId))
    return {
      folders: store.folders.filter(fo => !ids.has(fo.id)),
      files: store.files.filter(f => !(f.folderId && ids.has(f.folderId))),
    }
  })
  for (const f of removed) {
    try {
      removeFileBytes(f)
    } catch (e) {
      console.error('[file-storage] orphaned bytes after folder delete', f.id, e)
    }
  }
  return next
}
