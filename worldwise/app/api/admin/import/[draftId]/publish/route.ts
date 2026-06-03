import { NextRequest, NextResponse } from 'next/server'
import { requireSection } from '@/lib/auth'
import { coercePropertyInput } from '@/lib/properties'
import { publishDraft } from '@/lib/property-drafts'
import { Property } from '@/types'

export async function POST(req: NextRequest, { params }: { params: { draftId: string } }) {
  if (!(await requireSection('properties'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  // Body is optional: quick-publish (ImportPanel) sends nothing and publishes the
  // stored draft fields; edit-publish (PropertyForm) sends the full edited payload.
  // Whitelist/clean it through coercePropertyInput at the route (like PUT) so no
  // untrusted key reaches the merge in publishDraft.
  let edited: Partial<Property> = {}
  try {
    const body = await req.json()
    if (body && typeof body === 'object') {
      const parsed = coercePropertyInput(body, { partial: true })
      if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
      edited = parsed.value as Partial<Property>
    }
  } catch { /* empty body → publish stored fields as-is */ }

  const result = publishDraft(params.draftId, edited)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json(result.property, { status: 201 })
}
