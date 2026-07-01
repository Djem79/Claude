import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

// Runtime file server for property/import images. Next's `next start` only serves
// files from public/ that existed at BUILD time, so images written after the build
// (PDF-import extraction, fresh gallery uploads) 404 as static assets. A next.config
// rewrite sends /images/properties/:id/:file here ONLY when no static file matched
// (afterFiles), so existing build-time images keep their fast static path and only
// post-build files fall through to this handler, which reads them from disk live.
export const dynamic = 'force-dynamic'

const TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.webp': 'image/webp', '.gif': 'image/gif',
}

export async function GET(
  _req: NextRequest,
  props: { params: Promise<{ id: string; file: string }> }
) {
  const params = await props.params;
  const { id, file } = params
  // Strict whitelist — id and file are path segments; reject anything that could
  // traverse out of the property image folder.
  if (!/^\d{6,20}$/.test(id) || !/^\d+\.(jpe?g|png|webp|gif)$/i.test(file)) {
    return new NextResponse('Bad request', { status: 400 })
  }
  const filePath = path.join(process.cwd(), 'public', 'images', 'properties', id, file)
  let data: Buffer
  try {
    data = fs.readFileSync(filePath)
  } catch {
    return new NextResponse('Not found', { status: 404 })
  }
  const type = TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream'
  return new NextResponse(new Uint8Array(data), {
    status: 200,
    // Gallery filenames are append-only (never overwritten in place) — matches the
    // immutable rule for /images/properties/** in next.config.mjs headers().
    headers: { 'Content-Type': type, 'Cache-Control': 'public, max-age=31536000, immutable' },
  })
}
