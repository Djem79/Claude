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

const FAKE_OK = NextResponse.json({ ok: true }, { status: 201 })

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { name, phone, email, budget, propertyType, area, message, source, propertySlug, propertyTitle, _hp } = body

  // Honeypot — filled by bots, empty for real users
  if (_hp) return FAKE_OK

  if (!name || !phone) {
    return NextResponse.json({ error: 'Name and phone are required' }, { status: 400 })
  }

  // Phone must have at least 7 digits
  const digits = String(phone).replace(/\D/g, '')
  if (digits.length < 7 || digits.length > 15) {
    return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 })
  }

  // Rate limit counted only after passing validation (so typos don't consume quota)
  if (isRateLimited(getClientIp(req))) {
    return NextResponse.json({ error: 'Too many requests. Try again later.' }, { status: 429 })
  }

  // Cap field lengths — unauthenticated input is persisted to leads.json, which is
  // fully read+rewritten on every operation. Prevents storage abuse (audit M4).
  const cap = (v: unknown, max: number) =>
    v == null ? undefined : String(v).slice(0, max)

  const lead = saveLead({
    name: cap(name, 120)!,
    phone: cap(phone, 40)!,
    email: cap(email, 160),
    budget: cap(budget, 60),
    propertyType: cap(propertyType, 60),
    area: cap(area, 80),
    message: cap(message, 2000),
    source: cap(source, 60) ?? 'unknown',
    propertySlug: cap(propertySlug, 160),
    propertyTitle: cap(propertyTitle, 200),
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
