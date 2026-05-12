import { NextRequest, NextResponse } from 'next/server'
import { getLeadById, updateLead } from '@/lib/leads'
import { getSession } from '@/lib/auth'
import fs from 'fs'
import path from 'path'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; fileId: string } }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const lead = getLeadById(params.id)
  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })

  const attachment = (lead.attachments ?? []).find(a => a.id === params.fileId)
  if (!attachment) return NextResponse.json({ error: 'File not found' }, { status: 404 })

  const base = path.join(process.cwd(), 'public', 'files', 'leads')
  const dir = path.resolve(base, params.id, params.fileId)
  if (!dir.startsWith(base + path.sep)) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
  }

  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true })

  const actor = { uid: session.uid, username: session.username, name: session.name }
  const updated = updateLead(params.id, {
    attachments: (lead.attachments ?? []).filter(a => a.id !== params.fileId),
  }, actor)

  if (!updated) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
  return NextResponse.json(updated)
}
