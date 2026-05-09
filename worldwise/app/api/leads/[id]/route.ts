import { NextRequest, NextResponse } from 'next/server'
import { updateLead, deleteLead, getLeadById } from '@/lib/leads'
import { isAuthenticated } from '@/lib/auth'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = await req.json()
  const updated = updateLead(params.id, {
    status: body.status,
    notes: body.notes,
    contactedAt: body.contactedAt,
  })
  if (!updated) {
    return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
  }
  return NextResponse.json(updated)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const ok = deleteLead(params.id)
  return NextResponse.json({ success: ok })
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const lead = getLeadById(params.id)
  if (!lead) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(lead)
}
