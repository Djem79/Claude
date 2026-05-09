import { Lead } from '@/types'

function leadText(lead: Lead, baseUrl: string) {
  const lines = [
    `🔔 New Lead: ${lead.name}`,
    `📞 ${lead.phone}`,
    lead.email ? `✉️ ${lead.email}` : null,
    lead.budget ? `💰 Budget: ${lead.budget}` : null,
    `📍 Source: ${lead.source}`,
    lead.propertyTitle ? `🏠 Property: ${lead.propertyTitle}` : null,
    lead.message ? `💬 ${lead.message}` : null,
    '',
    `Open in CRM: ${baseUrl}/admin/leads`,
  ]
  return lines.filter(Boolean).join('\n')
}

export async function notifyTelegram(lead: Lead, baseUrl: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (!token || !chatId) return
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: leadText(lead, baseUrl),
        disable_web_page_preview: true,
      }),
    })
  } catch {
    // notification failure must not block lead capture
  }
}

export async function notifyEmail(lead: Lead) {
  if (!process.env.SMTP_HOST) return
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
      subject: `New Lead: ${lead.name} — ${lead.source}`,
      text: leadText(lead, process.env.NEXT_PUBLIC_SITE_URL ?? ''),
    })
  } catch {
    // email failure must not block lead capture
  }
}
