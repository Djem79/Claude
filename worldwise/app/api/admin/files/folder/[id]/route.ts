import { NextRequest, NextResponse } from 'next/server'
import { requireSection } from '@/lib/auth'
import { readStore, mutateStore, deleteFolderRecursive } from '@/lib/file-storage'
import { cleanFolderName } from '@/lib/file-storage-core'

export const runtime = 'nodejs'

export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
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

export async function DELETE(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await requireSection('files')
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const store = readStore()
  if (!store.folders.some(f => f.id === params.id)) {
    return NextResponse.json({ error: 'Folder not found' }, { status: 404 })
  }
  deleteFolderRecursive(params.id)
  return NextResponse.json({ ok: true })
}
