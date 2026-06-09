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
