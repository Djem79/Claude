import { NextRequest, NextResponse } from 'next/server'
import { getPropertyById, updateProperty, deleteProperty, coercePropertyInput } from '@/lib/properties'
import { revalidatePropertyPages } from '@/lib/revalidate'
import { requireSection } from '@/lib/auth'
import { Property } from '@/types'

// Section-gated: this returns the RAW Property, including PF-integration fields
// (pfListingId/pfListingStatus/pfLocationId/pfPublishedAt) that never appear in
// public UI — the sibling list route projects to CardProperty for exactly that
// reason. No client calls this GET (only PUT/DELETE are used), so gating is safe
// (audit 2026-07-27).
export async function GET(_: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  if (!(await requireSection('properties'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const property = getPropertyById(params.id)
  if (!property) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(property)
}

export async function PUT(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  if (!(await requireSection('properties'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const parsed = coercePropertyInput(body, { partial: true })
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const updated = updateProperty(params.id, parsed.value as Partial<Omit<Property, 'id' | 'createdAt'>>)
  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  revalidatePropertyPages()
  return NextResponse.json(updated)
}

export async function DELETE(_: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  if (!(await requireSection('properties'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const ok = deleteProperty(params.id)
  if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  revalidatePropertyPages()
  return NextResponse.json({ success: true })
}
