import { NextRequest, NextResponse } from 'next/server'
import { saveLead, getLeads } from '@/lib/leads'
import { isAuthenticated } from '@/lib/auth'
import { notifyTelegram, notifyEmail } from '@/lib/notify'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { name, phone, email, budget, message, source, propertySlug, propertyTitle } = body

  if (!name || !phone) {
    return NextResponse.json({ error: 'Name and phone are required' }, { status: 400 })
  }

  const lead = saveLead({ name, phone, email, budget, message, source, propertySlug, propertyTitle })

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? `${req.nextUrl.protocol}//${req.nextUrl.host}`
  // Fire-and-forget; do not block the response
  notifyTelegram(lead, baseUrl)
  notifyEmail(lead)

  return NextResponse.json(lead, { status: 201 })
}

export async function GET() {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return NextResponse.json(getLeads())
}
