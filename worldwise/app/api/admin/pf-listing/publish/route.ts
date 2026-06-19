import { NextRequest, NextResponse } from 'next/server'
import { requireSection } from '@/lib/auth'
import { getPropertyById, setPfListingState } from '@/lib/properties'
import { pfFetch } from '@/lib/pf-client'

export const runtime = 'nodejs'

// POST { propertyId } — PUBLISH a previously-created PF draft (THIS spends credits).
// Async on PF's side: status flips to 'live' only when the listing.published webhook
// arrives, so we set 'pending' here.
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
  if (!property.pfListingId) return NextResponse.json({ error: 'No PF draft for this property' }, { status: 409 })
  if (property.pfListingStatus !== 'draft') {
    return NextResponse.json({ error: `Listing is not in draft state (${property.pfListingStatus})` }, { status: 409 })
  }

  try {
    const r = await pfFetch(`/v1/listings/${encodeURIComponent(property.pfListingId)}/publish`, { method: 'POST' })
    if (!r.ok) {
      return NextResponse.json({ error: `PF publish failed (${r.status})`, detail: await r.text() }, { status: r.status >= 500 ? 502 : 422 })
    }
  } catch (e) {
    return NextResponse.json({ error: 'PF publish error', detail: String(e) }, { status: 502 })
  }

  setPfListingState(propertyId, { pfListingStatus: 'pending' })
  return NextResponse.json({ ok: true, pfListingStatus: 'pending' })
}
