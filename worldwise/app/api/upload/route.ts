import { NextRequest, NextResponse } from 'next/server'
import { isAuthenticated } from '@/lib/auth'
import fs from 'fs'
import path from 'path'

const PUBLIC_IMG = path.join(process.cwd(), 'public', 'images')
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const MAX_BYTES = 8 * 1024 * 1024 // 8 MB per file

function extFor(mime: string) {
  return mime === 'image/png' ? '.png'
    : mime === 'image/webp' ? '.webp'
    : mime === 'image/gif' ? '.gif'
    : '.jpg'
}

export async function POST(req: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const form = await req.formData()
  const propertyId = String(form.get('propertyId') || '').trim()
  const kind = String(form.get('kind') || 'gallery')
  if (!/^\d{6,20}$/.test(propertyId)) {
    return NextResponse.json({ error: 'Invalid propertyId' }, { status: 400 })
  }
  if (kind !== 'gallery' && kind !== 'qr') {
    return NextResponse.json({ error: 'Invalid kind' }, { status: 400 })
  }

  const files = form.getAll('files').filter((f): f is File => f instanceof File)
  for (const f of files) {
    if (!ALLOWED.has(f.type)) {
      return NextResponse.json({ error: `Unsupported type: ${f.type}` }, { status: 400 })
    }
    if (f.size > MAX_BYTES) {
      return NextResponse.json({ error: `File too large: ${f.name}` }, { status: 400 })
    }
  }

  if (kind === 'qr') {
    // QR is a single image stored as /images/qr/<id>.<ext>; replace any existing.
    if (files.length !== 1) {
      return NextResponse.json({ error: 'QR upload expects exactly 1 file' }, { status: 400 })
    }
    const f = files[0]
    const dir = path.join(PUBLIC_IMG, 'qr')
    fs.mkdirSync(dir, { recursive: true })
    // delete any existing QR for this property regardless of extension
    for (const e of fs.readdirSync(dir)) {
      if (e.startsWith(propertyId + '.')) fs.unlinkSync(path.join(dir, e))
    }
    const ext = extFor(f.type)
    const name = `${propertyId}${ext}`
    const buf = Buffer.from(await f.arrayBuffer())
    fs.writeFileSync(path.join(dir, name), buf)
    return NextResponse.json({ paths: [`/images/qr/${name}?t=${Date.now()}`] })
  }

  // gallery
  const dir = path.join(PUBLIC_IMG, 'properties', propertyId)
  fs.mkdirSync(dir, { recursive: true })
  const existing = fs.readdirSync(dir).filter(f => /^\d+\./.test(f))
  let nextIdx = existing.length === 0
    ? 0
    : Math.max(...existing.map(f => parseInt(f.split('.')[0], 10))) + 1

  const saved: string[] = []
  for (const f of files) {
    const name = `${nextIdx}${extFor(f.type)}`
    const buf = Buffer.from(await f.arrayBuffer())
    fs.writeFileSync(path.join(dir, name), buf)
    saved.push(`/images/properties/${propertyId}/${name}`)
    nextIdx++
  }

  return NextResponse.json({ paths: saved })
}
