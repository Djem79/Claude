import { NextRequest, NextResponse } from 'next/server'
import { getPropertyById, updateProperty, deleteProperty } from '@/lib/properties'
import { requireSection } from '@/lib/auth'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const property = getPropertyById(params.id)
  if (!property) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(property)
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await requireSection('properties'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const body = await req.json()
  const updated = updateProperty(params.id, body)
  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(updated)
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  if (!(await requireSection('properties'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const ok = deleteProperty(params.id)
  if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ success: true })
}
