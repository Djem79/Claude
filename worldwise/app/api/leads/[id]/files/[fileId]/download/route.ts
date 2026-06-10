import { NextRequest, NextResponse } from 'next/server'
import { getLeadById } from '@/lib/leads'
import { requireSection } from '@/lib/auth'
import { resolveLeadFileDir, ATTACHMENT_CONTENT_TYPE } from '@/lib/lead-files'
import fs from 'fs'
import path from 'path'

// Authenticated download of a lead attachment. Files live outside public/
// (audit P3), so this route is the only way to read them — admin session required.
export async function GET(
  _req: NextRequest,
  props: { params: Promise<{ id: string; fileId: string }> }
) {
  const params = await props.params;
  const session = await requireSection('leads')
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const lead = getLeadById(params.id)
  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })

  const attachment = (lead.attachments ?? []).find(a => a.id === params.fileId)
  if (!attachment) return NextResponse.json({ error: 'File not found' }, { status: 404 })

  const dir = resolveLeadFileDir(params.id, params.fileId)
  if (!dir) return NextResponse.json({ error: 'Invalid path' }, { status: 400 })

  const filePath = path.join(dir, attachment.name)
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: 'File not found on disk' }, { status: 404 })
  }

  const buf = fs.readFileSync(filePath)
  const ext = attachment.name.split('.').pop()?.toLowerCase() ?? ''
  // Inline rendering only for types the browser handles safely (CRM preview);
  // everything else is forced to download as an inert attachment — same threat
  // model as the admin file manager's download route.
  const INLINE_OK = new Set(['jpg', 'jpeg', 'png', 'webp', 'pdf'])
  const disposition = INLINE_OK.has(ext) ? 'inline' : 'attachment'
  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      'Content-Type': INLINE_OK.has(ext)
        ? ATTACHMENT_CONTENT_TYPE[ext] ?? 'application/octet-stream'
        : 'application/octet-stream',
      'Content-Disposition': `${disposition}; filename="${attachment.name}"`,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-store',
    },
  })
}
