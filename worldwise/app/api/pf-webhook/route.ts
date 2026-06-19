import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { savePfLead } from '@/lib/leads'
import { mapPfLead } from '@/lib/pf-lead'
import { setPfStatusByListingId } from '@/lib/properties'
import { notifyTelegram, notifyEmail } from '@/lib/notify'

export const runtime = 'nodejs'

// HMAC-SHA256 over the RAW request body (PF signs the exact bytes), timing-safe.
function verifySignature(raw: string, signature: string | null, secret: string | undefined): boolean {
  if (!signature || !secret) return false
  const expected = crypto.createHmac('sha256', secret).update(raw, 'utf8').digest('hex')
  // Both are lowercase hex of equal length; encode explicitly and length-guard before compare.
  const a = Buffer.from(signature, 'utf8')
  const b = Buffer.from(expected, 'utf8')
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

export async function POST(req: Request) {
  const raw = await req.text()
  if (!verifySignature(raw, req.headers.get('x-signature'), process.env.PF_WEBHOOK_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let event: unknown
  try {
    event = JSON.parse(raw)
  } catch (err) {
    console.error('[pf-webhook] malformed JSON after valid signature', err)
    return NextResponse.json({ ok: true }) // ack so PF stops retrying an unparseable body
  }

  const e = event as { type?: string }

  // Listing events (integration #2) — flip the property's PF status, located by its
  // PF listing id. Same signed endpoint + secret as the leads webhook. Idempotent:
  // setPfStatusByListingId is a no-op when no property carries that listing id.
  const listingId = (event as { entity?: { id?: string } }).entity?.id
  if (listingId && (e.type === 'listing.published' || e.type === 'listing.unpublished' || e.type === 'listing.action')) {
    const id = String(listingId)
    if (e.type === 'listing.published') {
      setPfStatusByListingId(id, { pfListingStatus: 'live', pfPublishedAt: new Date().toISOString() })
    } else if (e.type === 'listing.unpublished') {
      setPfStatusByListingId(id, { pfListingStatus: 'unpublished' })
    } else {
      // listing.action = a compliance issue the admin must resolve, else PF auto-unpublishes.
      const action = (event as { payload?: { actionType?: string } }).payload?.actionType
      console.warn('[pf-webhook] listing.action', id, action ?? '')
      setPfStatusByListingId(id, { pfListingStatus: 'action_required' })
    }
    return NextResponse.json({ ok: true })
  }

  if (e?.type !== 'lead.created') {
    return NextResponse.json({ ok: true }) // ignore other event types
  }

  const fields = mapPfLead(event as Parameters<typeof mapPfLead>[0])
  if (!fields.pfLeadId) {
    console.warn('[pf-webhook] lead.created with no entity.id — skipping')
    return NextResponse.json({ ok: true })
  }

  const { lead, deduped } = savePfLead(fields)

  if (!deduped) {
    // Lead is already persisted; notifications are best-effort and must not break the <5s ack.
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://worldwise.pro'
    await Promise.allSettled([notifyTelegram(lead, baseUrl), notifyEmail(lead)])
  }

  return NextResponse.json({ ok: true })
}
