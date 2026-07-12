import { NextRequest, NextResponse } from 'next/server'
import { saveLead, getLeads } from '@/lib/leads'
import { requireSection } from '@/lib/auth'
import { notifyTelegram, notifyEmail } from '@/lib/notify'
import { getClientIp } from '@/lib/ip'

// In-memory rate limiter (single PM2 instance — module state persists between requests)
const WINDOW_MS = 3_600_000 // 1-hour window
const rateMap = new Map<string, { count: number; resetAt: number }>()
let lastSweep = 0

// Drop expired entries at most once per window so the map can't grow unbounded
// (one entry per distinct IP that ever submits, never reclaimed). O(n) once/hour.
function sweepExpired(now: number): void {
  if (now - lastSweep < WINDOW_MS) return
  lastSweep = now
  rateMap.forEach((rec, ip) => {
    if (rec.resetAt < now) rateMap.delete(ip)
  })
}

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  sweepExpired(now)
  const rec = rateMap.get(ip)
  if (!rec || rec.resetAt < now) {
    rateMap.set(ip, { count: 1, resetAt: now + WINDOW_MS })
    return false
  }
  if (rec.count >= 10) return true
  rec.count++
  return false
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const { name, phone, email, budget, propertyType, area, message, source, propertySlug, propertyTitle, utm_source, utm_medium, utm_campaign, utm_term, utm_content, gclid, fbclid, attributionCapturedAt, _hp } = body

  // Honeypot — a filled hidden field is supposed to mean "bot". It ALSO gets filled
  // for real people by browser autofill / password managers, and the old code answered
  // a fake 201 and threw the submission away — unlogged, while the visitor saw
  // "thanks, we'll be in touch". GA4 caught it: 2 successful /guide submits (the
  // event only fires on a 2xx) with ZERO matching leads in the CRM, ever.
  //
  // A discarded lead is a lost client, so we never discard one that looks human:
  // a payload that passes the same name/phone validation as a normal lead is stored
  // (flagged `suspectedSpam`) and notified. Only a payload with no usable contact
  // data is dropped — and now it is logged, so this failure mode is never invisible
  // again. Bots still get the same 201 either way, so the trap is not revealed.
  const trippedHoneypot = Boolean(_hp)
  const honeypotIp = trippedHoneypot ? getClientIp(req) : ''

  if (!name || !phone) {
    if (trippedHoneypot) {
      console.warn(`[leads] honeypot: dropped (no usable name/phone) source=${String(source)} ip=${honeypotIp}`)
      return NextResponse.json({ ok: true }, { status: 201 })
    }
    return NextResponse.json({ error: 'Name and phone are required' }, { status: 400 })
  }

  // Phone must have at least 7 digits
  const digits = String(phone).replace(/\D/g, '')
  if (digits.length < 7 || digits.length > 15) {
    if (trippedHoneypot) {
      console.warn(`[leads] honeypot: dropped (invalid phone) source=${String(source)} ip=${honeypotIp}`)
      return NextResponse.json({ ok: true }, { status: 201 })
    }
    return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 })
  }

  if (trippedHoneypot) {
    console.warn(`[leads] honeypot tripped but payload looks HUMAN (likely autofill) — saving as suspectedSpam. source=${String(source)} ip=${honeypotIp}`)
  }

  // Rate limit counted only after passing validation (so typos don't consume quota)
  if (isRateLimited(getClientIp(req))) {
    return NextResponse.json({ error: 'Too many requests. Try again later.' }, { status: 429 })
  }

  // Cap field lengths — unauthenticated input is persisted to leads.json, which is
  // fully read+rewritten on every operation. Prevents storage abuse (audit M4).
  const cap = (v: unknown, max: number) =>
    v == null ? undefined : String(v).slice(0, max)

  // Keep the lead even if the email is malformed — just drop the bad value so it
  // never becomes a "send file to lead" target downstream (audit Low).
  const cleanEmail = cap(email, 160)
  const validEmail = cleanEmail && EMAIL_RE.test(cleanEmail) ? cleanEmail : undefined

  const lead = saveLead({
    name: cap(name, 120)!,
    phone: cap(phone, 40)!,
    email: validEmail,
    budget: cap(budget, 60),
    propertyType: cap(propertyType, 60),
    area: cap(area, 80),
    message: cap(message, 2000),
    source: cap(source, 60) ?? 'unknown',
    // Flagged, never dropped — a false-positive honeypot hit is a real client.
    suspectedSpam: trippedHoneypot || undefined,
    propertySlug: cap(propertySlug, 160),
    propertyTitle: cap(propertyTitle, 200),
    // Marketing attribution — whitelisted utm_*/click-ids from the form body (lib/utm.ts)
    utm_source: cap(utm_source, 100),
    utm_medium: cap(utm_medium, 60),
    utm_campaign: cap(utm_campaign, 120),
    utm_term: cap(utm_term, 120),
    utm_content: cap(utm_content, 120),
    gclid: cap(gclid, 200),
    fbclid: cap(fbclid, 200),
    attributionCapturedAt: cap(attributionCapturedAt, 40),
  })

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? `${req.nextUrl.protocol}//${req.nextUrl.host}`
  notifyTelegram(lead, baseUrl)
  notifyEmail(lead)

  return NextResponse.json(lead, { status: 201 })
}

export async function GET() {
  if (!(await requireSection('leads'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  return NextResponse.json(getLeads())
}
