import { NextRequest, NextResponse } from 'next/server'
import { requireSection } from '@/lib/auth'
import { readStore, diskPathFor } from '@/lib/file-storage'
import fs from 'fs'

export const runtime = 'nodejs'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await requireSection('files'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const file = readStore().files.find(f => f.id === params.id)
  if (!file) return NextResponse.json({ error: 'File not found' }, { status: 404 })

  const p = diskPathFor(file)
  if (!fs.existsSync(p)) return NextResponse.json({ error: 'File missing on disk' }, { status: 404 })
  const buf = fs.readFileSync(p)

  // Always force a download as an opaque octet-stream — never inline. This is
  // what makes an uploaded HTML/SVG/script harmless (no render, no execution).
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      'Content-Length': String(buf.length),
    },
  })
}
