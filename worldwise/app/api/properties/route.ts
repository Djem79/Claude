import { NextRequest, NextResponse } from 'next/server'
import { getProperties, createProperty, coercePropertyInput } from '@/lib/properties'
import { revalidatePropertyPages } from '@/lib/revalidate'
import { requireSection } from '@/lib/auth'
import { Property } from '@/types'

export async function GET() {
  return NextResponse.json(getProperties())
}

export async function POST(req: NextRequest) {
  if (!(await requireSection('properties'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const parsed = coercePropertyInput(body, { partial: false })
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
  // Preserve the client-supplied id (the gallery upload folder is keyed by it);
  // createProperty re-validates the id format and generates one if it's bad.
  const id = (body as Record<string, unknown>).id
  if (typeof id === 'string') parsed.value.id = id
  const property = createProperty(parsed.value as Omit<Property, 'createdAt'> & { id?: string })
  revalidatePropertyPages()
  return NextResponse.json(property, { status: 201 })
}
