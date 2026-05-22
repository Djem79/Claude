import { NextRequest, NextResponse } from 'next/server'
import { updateLead, deleteLead, getLeadById } from '@/lib/leads'
import { getSession, isAuthenticated } from '@/lib/auth'
import { Lead } from '@/types'
import { LEAD_FILES_BASE } from '@/lib/lead-files'
import fs from 'fs'
import path from 'path'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = await req.json()
  // Build the patch from only the keys actually present, so a partial update
  // (e.g. notes only) never spreads `undefined` over an existing value.
  const patch: Partial<Pick<Lead, 'status' | 'notes' | 'contactedAt' | 'propertyTitle' | 'propertySlug'>> = {}
  if ('status' in body) patch.status = body.status
  if ('notes' in body) patch.notes = body.notes
  if ('contactedAt' in body) patch.contactedAt = body.contactedAt
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

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.role !== 'owner') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const ok = deleteLead(params.id)
  if (ok) {
    const dir = path.join(LEAD_FILES_BASE, params.id)
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true })
  }
  return NextResponse.json({ success: ok })
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const lead = getLeadById(params.id)
  if (!lead) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(lead)
}
