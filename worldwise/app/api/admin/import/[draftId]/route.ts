import { NextRequest, NextResponse } from 'next/server'
import { requireSection } from '@/lib/auth'
import { coercePropertyInput } from '@/lib/properties'
import { updateDraftFields, rejectDraft } from '@/lib/property-drafts'
import { Property } from '@/types'

export async function PUT(req: NextRequest, { params }: { params: { draftId: string } }) {
  if (!(await requireSection('properties'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const parsed = coercePropertyInput(body, { partial: true })
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const updated = updateDraftFields(params.draftId, parsed.value as Partial<Property>)
  if (!updated) return NextResponse.json({ error: 'Draft not found' }, { status: 404 })
  return NextResponse.json(updated)
}

export async function DELETE(_req: NextRequest, { params }: { params: { draftId: string } }) {
  if (!(await requireSection('properties'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const ok = rejectDraft(params.draftId)
  if (!ok) return NextResponse.json({ error: 'Draft not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
