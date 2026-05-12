import { NextRequest, NextResponse } from 'next/server'
import { getLeadById, updateLead } from '@/lib/leads'
import { getSession } from '@/lib/auth'
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

function sanitizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9.\-_]/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 100) || 'file'
}

function makeId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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

  const fileId = makeId()
  const safeName = sanitizeName(file.name)
  const dir = path.join(process.cwd(), 'public', 'files', 'leads', params.id, fileId)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, safeName), Buffer.from(await file.arrayBuffer()))

  const attachment: FileAttachment = {
    id: fileId,
    name: safeName,
    size: file.size,
    url: `/files/leads/${params.id}/${fileId}/${safeName}`,
    uploadedAt: new Date().toISOString(),
    uploadedBy: session.username,
    sentLog: [],
  }

  const updated = updateLead(params.id, {
    attachments: [...(lead.attachments ?? []), attachment],
  })

  return NextResponse.json(updated, { status: 201 })
}
