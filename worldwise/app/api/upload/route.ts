import { NextRequest, NextResponse } from 'next/server'
import { isAuthenticated } from '@/lib/auth'
import fs from 'fs'
import path from 'path'

const PUBLIC_IMG = path.join(process.cwd(), 'public', 'images')
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const MAX_BYTES = 8 * 1024 * 1024 // 8 MB per file

const MAX_FILES = 30

function extFor(mime: string) {
  return mime === 'image/png' ? '.png'
    : mime === 'image/webp' ? '.webp'
    : mime === 'image/gif' ? '.gif'
    : '.jpg'
}

// Detect the real image type from magic bytes — never trust the client-supplied
// MIME (audit M5). Returns null for anything that isn't a known image format.
function sniffMime(buf: Buffer): string | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg'
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png'
  if (buf.length >= 6 && buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return 'image/gif'
  if (buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'image/webp'
  return null
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
  if (files.length > MAX_FILES) {
    return NextResponse.json({ error: `Too many files (max ${MAX_FILES})` }, { status: 400 })
  }

  // Read + validate every file by its real magic bytes before writing anything.
  const validated: { mime: string; buf: Buffer }[] = []
  for (const f of files) {
    if (f.size > MAX_BYTES) {
      return NextResponse.json({ error: `File too large: ${f.name}` }, { status: 400 })
    }
    const buf = Buffer.from(await f.arrayBuffer())
    const mime = sniffMime(buf)
    if (!mime || !ALLOWED.has(mime)) {
      return NextResponse.json({ error: `Unsupported or invalid image: ${f.name}` }, { status: 400 })
    }
    validated.push({ mime, buf })
  }

  if (kind === 'qr') {
    // QR is a single image stored as /images/qr/<id>.<ext>; replace any existing.
    if (validated.length !== 1) {
      return NextResponse.json({ error: 'QR upload expects exactly 1 file' }, { status: 400 })
    }
    const { mime, buf } = validated[0]
    const dir = path.join(PUBLIC_IMG, 'qr')
    fs.mkdirSync(dir, { recursive: true })
    // delete any existing QR for this property regardless of extension
    for (const e of fs.readdirSync(dir)) {
      if (e.startsWith(propertyId + '.')) fs.unlinkSync(path.join(dir, e))
    }
    const name = `${propertyId}${extFor(mime)}`
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
  for (const { mime, buf } of validated) {
    const name = `${nextIdx}${extFor(mime)}`
    fs.writeFileSync(path.join(dir, name), buf)
    saved.push(`/images/properties/${propertyId}/${name}`)
    nextIdx++
  }

  return NextResponse.json({ paths: saved })
}
