import { NextRequest, NextResponse } from 'next/server'
import { getLeadById, mutateLeadAttachments } from '@/lib/leads'
import { requireSection } from '@/lib/auth'
import { resolveLeadFileDir } from '@/lib/lead-files'
import fs from 'fs'

export async function DELETE(
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
  if (!dir) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
  }

  try {
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true })
  } catch (e) {
    console.error('[files/delete] fs error', e)
    return NextResponse.json({ error: 'Failed to delete file' }, { status: 500 })
  }

  const actor = { uid: session.uid, username: session.username, name: session.name }
  const updated = mutateLeadAttachments(
    params.id,
    cur => cur.filter(a => a.id !== params.fileId),
    actor
  )

  if (!updated) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
  return NextResponse.json(updated)
}
