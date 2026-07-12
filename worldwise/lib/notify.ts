import { Lead } from '@/types'

// Build a wa.me deep link to message the LEAD back, prefilled with an agent
// greeting. Enables one-tap "reply within 5 minutes" speed-to-lead from the
// Telegram notification. Returns null if the phone has too few digits to dial.
export function waReplyLink(lead: Lead): string | null {
  const digits = lead.phone.replace(/\D/g, '')
  if (digits.length < 7) return null
  const first = lead.name.trim().split(/\s+/)[0] ?? ''
  const interest = lead.propertyTitle
    ? ` about ${lead.propertyTitle}`
    : lead.area
    ? ` about ${lead.area}`
    : ''
  const msg = `Hello ${first}, this is Worldwise Real Estate. Thank you for your enquiry${interest} — when is a good time for a quick call?`
  return `https://wa.me/${digits}?text=${encodeURIComponent(msg)}`
}

// A lead carrying ad attribution (utm_source or gclid) came from paid spend —
// flag it so the operator prioritises the reply.
function isPaidLead(lead: Lead): boolean {
  return Boolean(lead.utm_source || lead.gclid)
}

export function leadText(lead: Lead, baseUrl: string) {
  const paidTag = isPaidLead(lead)
    ? `⚡️ PAID LEAD — ${lead.utm_source ?? 'ads'}${lead.utm_campaign ? ` / ${lead.utm_campaign}` : ''}${lead.gclid ? ' (gclid)' : ''}`
    : null
  // Honeypot tripped but the payload looked human — almost always browser autofill.
  // Surfaced instead of silently dropped: treat as a real lead unless it's obvious junk.
  const spamTag = lead.suspectedSpam
    ? '⚠️ HONEYPOT TRIPPED (likely autofill — verify, do NOT ignore)'
    : null
  const lines = [
    spamTag,
    paidTag,
    `🔔 New Lead: ${lead.name}`,
    `📞 ${lead.phone}`,
    lead.email ? `✉️ ${lead.email}` : null,
    lead.budget ? `💰 Budget: ${lead.budget}` : null,
    `📍 Source: ${lead.source}`,
    lead.propertyTitle ? `🏠 Property: ${lead.propertyTitle}` : null,
    lead.area ? `📌 Area: ${lead.area}` : null,
    lead.message ? `💬 ${lead.message}` : null,
    '',
    `Open in CRM: ${baseUrl}/admin/leads`,
  ]
  return lines.filter(Boolean).join('\n')
}

export async function notifyTelegram(lead: Lead, baseUrl: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const ids = (process.env.TELEGRAM_CHAT_ID ?? '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
  if (!token || ids.length === 0) return
  const text = leadText(lead, baseUrl)
  const wa = waReplyLink(lead)
  // One-tap actions on the notification: WhatsApp the lead back (speed-to-lead)
  // and open the CRM. URL buttons require https, which both links are.
  const reply_markup = {
    inline_keyboard: [
      [
        ...(wa ? [{ text: '💬 Reply on WhatsApp', url: wa }] : []),
        { text: '🗂 Open in CRM', url: `${baseUrl}/admin/leads` },
      ],
    ],
  }
  await Promise.all(
    ids.map(chatId =>
      fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          disable_web_page_preview: true,
          reply_markup,
        }),
      }).catch(() => undefined)
    )
  )
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
    const wa = waReplyLink(lead)
    const body = leadText(lead, process.env.NEXT_PUBLIC_SITE_URL ?? '') + (wa ? `\n\nReply on WhatsApp: ${wa}` : '')
    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: process.env.NOTIFY_EMAIL ?? 'info@worldwise.pro',
      subject: `${isPaidLead(lead) ? '⚡️ ' : ''}New Lead: ${lead.name} — ${lead.source}`,
      text: body,
    })
  } catch {
    // email failure must not block lead capture
  }
}
