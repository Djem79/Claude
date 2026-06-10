import { NextRequest, NextResponse } from 'next/server'
import { requireSection } from '@/lib/auth'
import { readStore, mutateStore, removeFileBytes } from '@/lib/file-storage'
import { sanitizeStorageName } from '@/lib/file-storage-core'

export const runtime = 'nodejs'

export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
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
  // Case-insensitive check so a user typing "Отчёт.PDF" on a `pdf` file doesn't
  // get "Отчёт.PDF.pdf" — and the extension can never be changed via rename.
  let name = sanitizeStorageName(body.name)
  if (!name.toLowerCase().endsWith(`.${file.ext.toLowerCase()}`)) {
    name = `${name.replace(/\.[^.]*$/, '')}.${file.ext}`
  }

  mutateStore(s => ({ ...s, files: s.files.map(f => (f.id === params.id ? { ...f, name } : f)) }))
  return NextResponse.json({ ok: true, name })
}

export async function DELETE(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await requireSection('files')
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const store = readStore()
  const file = store.files.find(f => f.id === params.id)
  if (!file) return NextResponse.json({ error: 'File not found' }, { status: 404 })

  removeFileBytes(file)
  mutateStore(s => ({ ...s, files: s.files.filter(f => f.id !== params.id) }))
  return NextResponse.json({ ok: true })
}
