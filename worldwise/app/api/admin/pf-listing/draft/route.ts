import { NextRequest, NextResponse } from 'next/server'
import { requireSection } from '@/lib/auth'
import { getPropertyById, setPfListingState } from '@/lib/properties'
import { pfFetch } from '@/lib/pf-client'
import { validateForPf, mapPropertyToPfListing } from '@/lib/pf-listing-map'
import type { PfCompliance } from '@/lib/pf-listing-map'

export const runtime = 'nodejs'

interface PfLocationNode { id?: number; name?: string; type?: string }
interface PfLocation { id?: number; name?: string; tree?: PfLocationNode[] }

// Resolve a PF location-tree id from our free-text area. Hardened from live probing
// (2026-06-19): PF multi-word `search` misses, so use the longest single token; a
// 2nd query param is required (a bare `?search=` misroutes to a 404); and the
// endpoint intermittently 404s upstream, so retry with backoff. Among results,
// prefer a node whose tree sits under Dubai, then an exact name match.
// pilot: re-verify match quality once the PF locations service is reliably up.
async function resolvePfLocationId(area: string): Promise<number | undefined> {
  const token = area.trim().split(/\s+/).sort((a, b) => b.length - a.length)[0] || area.trim()
  if (token.length < 2) return undefined
  for (let attempt = 0; attempt < 4; attempt++) {
    const r = await pfFetch(`/v1/locations?search=${encodeURIComponent(token)}&type=community&language=en`)
    if (r.ok) {
      const j = (await r.json()) as { data?: PfLocation[] }
      const all = j.data ?? []
      const dubai = all.filter((l) => (l.tree ?? []).some((n) => /dubai/i.test(n.name ?? '')))
      const pool = dubai.length ? dubai : all
      const exact = pool.find((l) => (l.name ?? '').toLowerCase() === area.trim().toLowerCase())
      return (exact ?? pool[0])?.id
    }
    await new Promise((res) => setTimeout(res, 300 * (attempt + 1)))
  }
  return undefined
}

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
      locationId = await resolvePfLocationId(property.area)
    } catch (e) {
      return NextResponse.json({ error: 'PF location lookup error', detail: String(e) }, { status: 502 })
    }
    if (!locationId) {
      return NextResponse.json(
        { error: `Could not resolve a Property Finder location for area "${property.area}". The PF locations service may be temporarily unavailable — try again shortly.` },
        { status: 422 },
      )
    }
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
