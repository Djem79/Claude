import { NextRequest, NextResponse } from 'next/server'
import { requireSection } from '@/lib/auth'
import { publishDraft } from '@/lib/property-drafts'
import { Property } from '@/types'

export async function POST(req: NextRequest, { params }: { params: { draftId: string } }) {
  if (!(await requireSection('properties'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  // Body is optional: quick-publish (ImportPanel) sends nothing and publishes the
  // stored draft fields; edit-publish (PropertyForm) sends the full edited payload.
  let edited: Partial<Property> = {}
  try {
    const body = await req.json()
    if (body && typeof body === 'object') edited = body as Partial<Property>
  } catch { /* empty body → publish stored fields as-is */ }

  const result = publishDraft(params.draftId, edited)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json(result.property, { status: 201 })
}
