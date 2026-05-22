import { NextRequest, NextResponse } from 'next/server'
import { getProperties, createProperty } from '@/lib/properties'
import { requireSection } from '@/lib/auth'

export async function GET() {
  return NextResponse.json(getProperties())
}

export async function POST(req: NextRequest) {
  if (!(await requireSection('properties'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const body = await req.json()
  const property = createProperty(body)
  return NextResponse.json(property, { status: 201 })
}
