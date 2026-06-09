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
