import { NextRequest, NextResponse } from 'next/server'
import { getLeadById, updateLead } from '@/lib/leads'
import { requireSection } from '@/lib/auth'
import { SentEntry } from '@/types'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; fileId: string } }
) {
  const session = await requireSection('leads')
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

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

  const updated = updateLead(params.id, {
    attachments: (lead.attachments ?? []).map(a =>
      a.id === params.fileId ? { ...a, sentLog: [...a.sentLog, entry] } : a
    ),
  })

  if (!updated) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
  return NextResponse.json(updated)
}
