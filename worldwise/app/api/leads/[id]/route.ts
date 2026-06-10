import { NextRequest, NextResponse } from 'next/server'
import { updateLead, deleteLead, getLeadById } from '@/lib/leads'
import { requireSection } from '@/lib/auth'
import { Lead, LeadStatus } from '@/types'
import { LEAD_STATUSES } from '@/lib/lead-status'
import { LEAD_FILES_BASE } from '@/lib/lead-files'
import fs from 'fs'
import path from 'path'

export async function PUT(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await requireSection('leads')
  if (!session) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  // Build the patch from only the keys actually present, so a partial update
  // (e.g. notes only) never spreads `undefined` over an existing value.
  const patch: Partial<Pick<Lead, 'status' | 'notes' | 'contactedAt' | 'propertyTitle' | 'propertySlug'>> = {}
  if ('status' in body) {
    // Reject unknown statuses — an arbitrary value breaks leadStats() (NaN counts).
    if (!LEAD_STATUSES.includes(body.status as LeadStatus)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }
    patch.status = body.status as LeadStatus
  }
  if ('notes' in body) patch.notes = body.notes == null ? undefined : String(body.notes).slice(0, 5000)
  if ('contactedAt' in body) patch.contactedAt = body.contactedAt == null ? undefined : String(body.contactedAt)
  if ('propertyTitle' in body) {
    patch.propertyTitle = String(body.propertyTitle ?? '').trim().slice(0, 200) || undefined
    patch.propertySlug = undefined // editing the free text clears any stale deep-link
  }
  const updated = updateLead(
    params.id,
    patch,
    { uid: session.uid, username: session.username, name: session.name }
  )
  if (!updated) {
    return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
  }
  return NextResponse.json(updated)
}

export async function DELETE(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await requireSection('leads')
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (session.role !== 'owner') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const ok = deleteLead(params.id)
  if (ok) {
    const dir = path.join(LEAD_FILES_BASE, params.id)
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true })
  }
  return NextResponse.json({ success: ok })
}

export async function GET(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  if (!(await requireSection('leads'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const lead = getLeadById(params.id)
  if (!lead) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(lead)
}
