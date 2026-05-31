import { NextRequest, NextResponse } from 'next/server'
import { getPropertyById, updateProperty, deleteProperty, coercePropertyInput } from '@/lib/properties'
import { requireSection } from '@/lib/auth'
import { Property } from '@/types'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const property = getPropertyById(params.id)
  if (!property) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(property)
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
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
  return NextResponse.json(updated)
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  if (!(await requireSection('properties'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const ok = deleteProperty(params.id)
  if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ success: true })
}
