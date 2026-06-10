import { NextRequest, NextResponse } from 'next/server'
import { requireSection } from '@/lib/auth'
import { readStore, diskPathFor } from '@/lib/file-storage'
import { isPreviewable, MIME_FOR_EXT } from '@/lib/file-storage-core'
import fs from 'fs'

export const runtime = 'nodejs'

export async function GET(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  if (!(await requireSection('files'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const file = readStore().files.find(f => f.id === params.id)
  if (!file) return NextResponse.json({ error: 'File not found' }, { status: 404 })

  // Inline rendering is allowed ONLY for whitelisted safe types (images + PDF).
  // Anything else must go through the forced-attachment download route — this is
  // what keeps an uploaded HTML/SVG from ever rendering in the browser.
  if (!isPreviewable(file.ext)) {
    return NextResponse.json({ error: 'Not previewable' }, { status: 404 })
  }

  const p = diskPathFor(file)
  if (!fs.existsSync(p)) return NextResponse.json({ error: 'File missing on disk' }, { status: 404 })
  const buf = fs.readFileSync(p)

  const headers: Record<string, string> = {
    'Content-Type': MIME_FOR_EXT[file.ext] ?? 'application/octet-stream',
    'Content-Disposition': 'inline',
    'X-Content-Type-Options': 'nosniff',
    'Content-Length': String(buf.length),
    'Cache-Control': 'private, no-store',
  }
  // NOTE: do NOT set `Content-Security-Policy: sandbox` here. WebKit/Safari
  // refuses to render a PDF inside a sandboxed <iframe> (even with
  // allow-same-origin allow-scripts) — the lightbox shows blank. Verified
  // across header variants: only "no sandbox" renders in Safari (Chrome
  // renders either way). Safety is preserved without it: the route is auth-gated
  // (requireSection), only whitelisted types are served inline (isPreviewable —
  // never HTML/SVG), `nosniff` blocks MIME reinterpretation, the global CSP
  // (default-src 'self', object-src 'none') still applies, and the browser's
  // own PDF viewer isolates any PDF-embedded scripting.

  return new NextResponse(new Uint8Array(buf), { headers })
}
