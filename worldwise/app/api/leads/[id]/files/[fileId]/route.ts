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

  // Remove the index entry FIRST, then unlink bytes: an orphaned byte file is harmless
  // (unreferenced), whereas a listed attachment whose bytes are gone is a broken
  // download. Matches the admin file-manager's documented safe order.
  const actor = { uid: session.uid, username: session.username, name: session.name }
  const updated = mutateLeadAttachments(
    params.id,
    cur => cur.filter(a => a.id !== params.fileId),
    actor
  )
  if (!updated) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })

  try {
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true })
  } catch (e) {
    // Index already updated — the attachment is gone from the CRM and the leftover
    // bytes are unreferenced. Don't resurrect a deleted entry with a 500.
    console.error('[files/delete] fs cleanup failed (orphaned bytes)', e)
  }

  return NextResponse.json(updated)
}
