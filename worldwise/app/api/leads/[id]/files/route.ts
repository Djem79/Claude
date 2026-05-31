import { NextRequest, NextResponse } from 'next/server'
import { getLeadById, mutateLeadAttachments } from '@/lib/leads'
import { requireSection } from '@/lib/auth'
import { resolveLeadFileDir, sniffAttachment } from '@/lib/lead-files'
import { FileAttachment } from '@/types'
import fs from 'fs'
import path from 'path'

const MAX_BYTES = 10 * 1024 * 1024
const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
])
const ALLOWED_EXTENSIONS = new Set(['pdf', 'jpg', 'jpeg', 'png', 'webp', 'doc', 'docx'])
// A docx is a ZIP and a doc is an OLE file — both sniff to a single key; map the
// detected magic-byte type to the extensions it legitimately backs.
const SNIFF_OK: Record<string, Set<string>> = {
  pdf: new Set(['pdf']),
  jpeg: new Set(['jpg', 'jpeg']),
  png: new Set(['png']),
  webp: new Set(['webp']),
  doc: new Set(['doc']),
  docx: new Set(['docx']),
}

function sanitizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9.\-_]/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/\.{2,}/g, '.')
    .replace(/^[.\-_]+|[.\-_]+$/g, '')
    .slice(0, 100) || 'file'
}

function makeId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await requireSection('leads')
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const lead = getLeadById(params.id)
  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })

  const form = await req.formData()
  const file = form.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }
  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json({ error: `Unsupported file type: ${file.type}` }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'File exceeds 10 MB limit' }, { status: 400 })
  }
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return NextResponse.json({ error: 'Unsupported file extension' }, { status: 400 })
  }

  // Validate by magic bytes, not the client-supplied MIME/extension (audit P7)
  const buf = Buffer.from(await file.arrayBuffer())
  const detected = sniffAttachment(buf)
  if (!detected || !SNIFF_OK[detected]?.has(ext)) {
    return NextResponse.json({ error: 'File content does not match its type' }, { status: 400 })
  }

  const fileId = makeId()
  const safeName = sanitizeName(file.name)

  const dir = resolveLeadFileDir(params.id, fileId)
  if (!dir) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
  }

  try {
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, safeName), buf)
  } catch (e) {
    console.error('[files/upload] fs error', e)
    return NextResponse.json({ error: 'Failed to save file' }, { status: 500 })
  }

  const attachment: FileAttachment = {
    id: fileId,
    name: safeName,
    size: file.size,
    url: `/api/leads/${params.id}/files/${fileId}/download`,
    uploadedAt: new Date().toISOString(),
    uploadedBy: session.username,
    sentLog: [],
  }

  const actor = { uid: session.uid, username: session.username, name: session.name }
  const updated = mutateLeadAttachments(params.id, cur => [...cur, attachment], actor)
  if (!updated) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })

  return NextResponse.json(updated, { status: 201 })
}
