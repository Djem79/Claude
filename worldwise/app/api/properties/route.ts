import { NextRequest, NextResponse } from 'next/server'
import { getProperties, createProperty } from '@/lib/properties'
import { isAuthenticated } from '@/lib/auth'

export async function GET() {
  return NextResponse.json(getProperties())
}

export async function POST(req: NextRequest) {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = await req.json()
  const property = createProperty(body)
  return NextResponse.json(property, { status: 201 })
}
