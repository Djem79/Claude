import { NextRequest, NextResponse } from 'next/server'
import { getLeadById, mutateLeadAttachments } from '@/lib/leads'
import { requireSection } from '@/lib/auth'
import { resolveLeadFileDir } from '@/lib/lead-files'
import { SentEntry } from '@/types'
import fs from 'fs'
import path from 'path'

export async function POST(
  req: NextRequest,
  props: { params: Promise<{ id: string; fileId: string }> }
) {
  const params = await props.params;
  const session = await requireSection('leads')
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const lead = getLeadById(params.id)
  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
  if (!lead.email) return NextResponse.json({ error: 'Lead has no email address' }, { status: 400 })
  // Telegram-intake leads store the user's @handle in the email field; reject non-addresses
  // up front with a clear 400 instead of a confusing nodemailer 500 downstream.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email)) {
    return NextResponse.json({ error: 'Lead email is not a valid address' }, { status: 400 })
  }

  const attachment = (lead.attachments ?? []).find(a => a.id === params.fileId)
  if (!attachment) return NextResponse.json({ error: 'File not found' }, { status: 404 })

  if (!process.env.SMTP_HOST) {
    return NextResponse.json({ error: 'SMTP not configured' }, { status: 503 })
  }

  const resolvedDir = resolveLeadFileDir(params.id, params.fileId)
  if (!resolvedDir) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
  }
  const filePath = path.join(resolvedDir, attachment.name)

  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: 'File not found on disk' }, { status: 404 })
  }

  try {
    const nodemailer = await import('nodemailer')
    const port = Number(process.env.SMTP_PORT ?? 587)
    const transporter = nodemailer.default.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    })
    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: lead.email,
      subject: `${lead.name} — ${attachment.name}`,
      text: `Hello, ${lead.name}!\n\nPlease find the attached file: ${attachment.name}\n\nBest regards,\nWorldwise Real Estate\n${process.env.NEXT_PUBLIC_PHONE ?? '+971 50 696 0435'}\ninfo@worldwise.pro`,
      attachments: [{ filename: attachment.name, path: filePath }],
    })
  } catch (e) {
    console.error('[files/send] email error', e)
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
  }

  const entry: SentEntry = {
    via: 'email',
    sentAt: new Date().toISOString(),
    sentBy: session.username,
    sentByName: session.name,
  }

  const updated = mutateLeadAttachments(params.id, cur =>
    cur.map(a => (a.id === params.fileId ? { ...a, sentLog: [...a.sentLog, entry] } : a))
  )

  if (!updated) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
  return NextResponse.json(updated)
}
