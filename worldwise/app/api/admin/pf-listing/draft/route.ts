import { NextRequest, NextResponse } from 'next/server'
import { requireSection } from '@/lib/auth'
import { getPropertyById, setPfListingState } from '@/lib/properties'
import { pfFetch } from '@/lib/pf-client'
import { validateForPf, mapPropertyToPfListing } from '@/lib/pf-listing-map'
import type { PfCompliance } from '@/lib/pf-listing-map'

export const runtime = 'nodejs'

// POST { propertyId } — create a PF DRAFT listing (no credits spent) and return its
// id + the publish credit price. The admin confirms before /publish actually spends.
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

  const v = validateForPf(property)
  if (!v.ok) return NextResponse.json({ error: 'Missing required fields', missing: v.missing }, { status: 422 })

  const publicProfileId = process.env.PF_PUBLIC_PROFILE_ID
  const companyLicense = process.env.PF_COMPANY_LICENSE
  if (!publicProfileId || !companyLicense) {
    return NextResponse.json(
      { error: 'PF listing config missing (PF_PUBLIC_PROFILE_ID / PF_COMPANY_LICENSE)' },
      { status: 500 },
    )
  }

  // 1. Resolve the PF location-tree id: cached on the property, else search by area.
  let locationId = property.pfLocationId
  if (!locationId) {
    try {
      const r = await pfFetch(`/v1/locations?search=${encodeURIComponent(property.area)}`)
      if (!r.ok) {
        return NextResponse.json({ error: `PF locations lookup failed (${r.status})`, detail: await r.text() }, { status: 422 })
      }
      const j = await r.json()
      // pilot: confirm the locations response shape (data[] vs locations[]) + best-match logic.
      const first = (j.data ?? j.locations ?? [])[0]
      locationId = first?.id
    } catch (e) {
      return NextResponse.json({ error: 'PF location lookup error', detail: String(e) }, { status: 502 })
    }
    if (!locationId) return NextResponse.json({ error: `No PF location found for area "${property.area}"` }, { status: 422 })
  }

  // 2. Pull DLD compliance for the permit + company license (price/type cross-check).
  let compliance: PfCompliance | undefined
  try {
    // pilot: confirm permitType values (project for off-plan, property for ready resale).
    const permitType = property.status === 'off-plan' ? 'project' : 'property'
    const cr = await pfFetch(
      `/v1/compliances/${encodeURIComponent(property.permitNumber!)}/${encodeURIComponent(companyLicense)}?permitType=${permitType}`,
    )
    if (!cr.ok) {
      return NextResponse.json({ error: `PF compliance check failed (${cr.status})`, detail: await cr.text() }, { status: 422 })
    }
    compliance = (await cr.json()) as PfCompliance
  } catch (e) {
    return NextResponse.json({ error: 'PF compliance lookup error', detail: String(e) }, { status: 502 })
  }

  // 3. Map → create the DRAFT listing (drafts never spend credits).
  const payload = mapPropertyToPfListing(property, { publicProfileId, locationId, companyLicense, compliance })
  let pfListingId = ''
  try {
    const lr = await pfFetch('/v1/listings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!lr.ok) {
      return NextResponse.json({ error: `PF listing create failed (${lr.status})`, detail: await lr.text() }, { status: lr.status >= 500 ? 502 : 422 })
    }
    const created = await lr.json()
    pfListingId = String(created.id ?? created.data?.id ?? '')
  } catch (e) {
    return NextResponse.json({ error: 'PF listing create error', detail: String(e) }, { status: 502 })
  }
  if (!pfListingId) return NextResponse.json({ error: 'PF returned no listing id' }, { status: 502 })

  setPfListingState(propertyId, { pfListingId, pfListingStatus: 'draft', pfLocationId: locationId })

  // 4. Quote the publish credit price (non-fatal if it fails — publish can still proceed).
  let priceCredits: number | null = null
  try {
    const pr = await pfFetch(`/v1/listings/${encodeURIComponent(pfListingId)}/publish/prices`)
    if (pr.ok) {
      const pj = await pr.json()
      // pilot: confirm the credit-price field name.
      priceCredits = pj.priceCredits ?? pj.credits ?? pj.data?.credits ?? null
    }
  } catch {
    /* non-fatal */
  }

  return NextResponse.json({ pfListingId, priceCredits, pfListingStatus: 'draft' })
}
