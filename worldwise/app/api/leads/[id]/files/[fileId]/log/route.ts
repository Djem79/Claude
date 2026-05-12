import { NextRequest, NextResponse } from 'next/server'
import { getLeadById, updateLead } from '@/lib/leads'
import { getSession } from '@/lib/auth'
import { SentEntry } from '@/types'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; fileId: string } }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const lead = getLeadById(params.id)
  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })

  const attachment = (lead.attachments ?? []).find(a => a.id === params.fileId)
  if (!attachment) return NextResponse.json({ error: 'File not found' }, { status: 404 })

  const body = await req.json()
  const via = body.via === 'email' ? 'email' : 'whatsapp'

  const entry: SentEntry = {
    via,
    sentAt: new Date().toISOString(),
    sentBy: session.username,
    sentByName: session.name,
  }

  const actor = { uid: session.uid, username: session.username, name: session.name }
  const updated = updateLead(params.id, {
    attachments: (lead.attachments ?? []).map(a =>
      a.id === params.fileId ? { ...a, sentLog: [...a.sentLog, entry] } : a
    ),
  }, actor)

  if (!updated) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
  return NextResponse.json(updated)
}
