import { NextRequest, NextResponse } from 'next/server'
import { saveLead, getLeads } from '@/lib/leads'
import { isAuthenticated } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { name, phone, email, budget, message, source, propertySlug, propertyTitle } = body

  if (!name || !phone) {
    return NextResponse.json({ error: 'Name and phone are required' }, { status: 400 })
  }

  const lead = saveLead({ name, phone, email, budget, message, source, propertySlug, propertyTitle })

  // Optional: send email notification
  if (process.env.SMTP_HOST) {
    try {
      const nodemailer = await import('nodemailer')
      const transporter = nodemailer.default.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT ?? 587),
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      })
      await transporter.sendMail({
        from: process.env.SMTP_USER,
        to: process.env.NOTIFY_EMAIL ?? 'info@worldwise.pro',
        subject: `New Lead: ${name} — ${source}`,
        text: `Name: ${name}\nPhone: ${phone}\nEmail: ${email ?? '—'}\nBudget: ${budget ?? '—'}\nSource: ${source}\nProperty: ${propertyTitle ?? '—'}\nMessage: ${message ?? '—'}`,
      })
    } catch {
      // Email failure doesn't block the response
    }
  }

  return NextResponse.json(lead, { status: 201 })
}

export async function GET() {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return NextResponse.json(getLeads())
}
