import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

// Runtime file server for DLD/RERA QR images (public/images/qr/<propertyId>.<ext>),
// uploaded via POST /api/upload?kind=qr. Same reason as the property-image media
// route: `next start` only serves public/ files that existed at BUILD time, so a QR
// uploaded after the build 404s as a static asset until the next rebuild. A
// next.config afterFiles rewrite sends /images/qr/:file here only when no static
// file matched, so build-time QRs keep their fast static path.
export const dynamic = 'force-dynamic'

const TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.webp': 'image/webp', '.gif': 'image/gif',
}

export async function GET(_req: NextRequest, props: { params: Promise<{ file: string }> }) {
  const params = await props.params;
  const { file } = params
  // Strict whitelist — file is "<propertyId>.<ext>"; reject anything that could
  // traverse out of the qr folder.
  if (!/^\d{6,20}\.(jpe?g|png|webp|gif)$/i.test(file)) {
    return new NextResponse('Bad request', { status: 400 })
  }
  const filePath = path.join(process.cwd(), 'public', 'images', 'qr', file)
  let data: Buffer
  try {
    data = fs.readFileSync(filePath)
  } catch {
    return new NextResponse('Not found', { status: 404 })
  }
  const type = TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream'
  return new NextResponse(new Uint8Array(data), {
    status: 200,
    // QR files ARE replaced in place (re-upload keeps the same name; the form busts
    // with ?t=) — 1 day matches the general /images rule in next.config.mjs.
    headers: { 'Content-Type': type, 'Cache-Control': 'public, max-age=86400' },
  })
}
