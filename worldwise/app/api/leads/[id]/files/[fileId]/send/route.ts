import { NextRequest, NextResponse } from 'next/server'
import { getLeadById, updateLead } from '@/lib/leads'
import { getSession } from '@/lib/auth'
import { SentEntry } from '@/types'
import fs from 'fs'
import path from 'path'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; fileId: string } }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const lead = getLeadById(params.id)
  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
  if (!lead.email) return NextResponse.json({ error: 'Lead has no email address' }, { status: 400 })

  const attachment = (lead.attachments ?? []).find(a => a.id === params.fileId)
  if (!attachment) return NextResponse.json({ error: 'File not found' }, { status: 404 })

  if (!process.env.SMTP_HOST) {
    return NextResponse.json({ error: 'SMTP not configured' }, { status: 503 })
  }

  const filePath = path.join(
    process.cwd(), 'public', 'files', 'leads', params.id, params.fileId, attachment.name
  )
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: 'File not found on disk' }, { status: 404 })
  }

  try {
    const nodemailer = await import('nodemailer')
    const transporter = nodemailer.default.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    })
    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: lead.email,
      subject: `${lead.name} — ${attachment.name}`,
      text: `Здравствуйте, ${lead.name}!\n\nПожалуйста, найдите прикреплённый файл: ${attachment.name}\n\nС уважением,\nWorldwise Real Estate\n+971 50 696 0435\ninfo@worldwise.pro`,
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

  const updated = updateLead(params.id, {
    attachments: (lead.attachments ?? []).map(a =>
      a.id === params.fileId ? { ...a, sentLog: [...a.sentLog, entry] } : a
    ),
  })

  return NextResponse.json(updated)
}
