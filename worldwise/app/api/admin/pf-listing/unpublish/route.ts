import { NextRequest, NextResponse } from 'next/server'
import { requireSection } from '@/lib/auth'
import { getPropertyById, setPfListingState } from '@/lib/properties'
import { pfFetch } from '@/lib/pf-client'

export const runtime = 'nodejs'

// POST { propertyId } — UNPUBLISH a live PF listing (no credit cost). The
// listing.unpublished webhook will also set this status; doing it here keeps the
// admin UI immediately consistent.
export async function POST(req: NextRequest) {
  if (!(await requireSection('properties'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: { propertyId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const propertyId = body?.propertyId
  if (!propertyId) return NextResponse.json({ error: 'propertyId required' }, { status: 400 })

  const property = getPropertyById(propertyId)
  if (!property) return NextResponse.json({ error: 'Property not found' }, { status: 404 })
  if (!property.pfListingId) return NextResponse.json({ error: 'No PF listing for this property' }, { status: 409 })

  try {
    const r = await pfFetch(`/v1/listings/${encodeURIComponent(property.pfListingId)}/unpublish`, { method: 'POST' })
    if (!r.ok) {
      return NextResponse.json({ error: `PF unpublish failed (${r.status})`, detail: await r.text() }, { status: r.status >= 500 ? 502 : 422 })
    }
  } catch (e) {
    return NextResponse.json({ error: 'PF unpublish error', detail: String(e) }, { status: 502 })
  }

  setPfListingState(propertyId, { pfListingStatus: 'unpublished' })
  return NextResponse.json({ ok: true, pfListingStatus: 'unpublished' })
}
