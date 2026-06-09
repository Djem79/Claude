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
