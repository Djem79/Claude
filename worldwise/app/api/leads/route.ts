import { NextRequest, NextResponse } from 'next/server'
import { saveLead, getLeads } from '@/lib/leads'
import { isAuthenticated } from '@/lib/auth'
import { notifyTelegram, notifyEmail } from '@/lib/notify'

// In-memory rate limiter (single PM2 instance — module state persists between requests)
const rateMap = new Map<string, { count: number; resetAt: number }>()

function getIp(req: NextRequest): string {
  return (
    req.headers.get('cf-connecting-ip') ??
    req.headers.get('x-real-ip') ??
    req.headers.get('x-forwarded-for')?.split(',').at(-1)?.trim() ??
    'unknown'
  )
}

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const rec = rateMap.get(ip)
  if (!rec || rec.resetAt < now) {
    rateMap.set(ip, { count: 1, resetAt: now + 3_600_000 }) // 1-hour window
    return false
  }
  if (rec.count >= 10) return true
  rec.count++
  return false
}

const FAKE_OK = NextResponse.json({ ok: true }, { status: 201 })

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { name, phone, email, budget, message, source, propertySlug, propertyTitle, _hp } = body

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
  if (isRateLimited(getIp(req))) {
    return NextResponse.json({ error: 'Too many requests. Try again later.' }, { status: 429 })
  }

  const lead = saveLead({ name, phone, email, budget, message, source, propertySlug, propertyTitle })

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? `${req.nextUrl.protocol}//${req.nextUrl.host}`
  notifyTelegram(lead, baseUrl)
  notifyEmail(lead)

  return NextResponse.json(lead, { status: 201 })
}

export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return NextResponse.json(getLeads())
}
