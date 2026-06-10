// Small shared helpers for the leads CRM client components
// (LeadsClient, FilesSection, KanbanCard).

export function fmt(iso?: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    timeZone: 'Asia/Dubai',
  })
}

export function digitsOnly(s: string) {
  return s.replace(/\D/g, '')
}

// Leads created by the Telegram CTA-keyword handler have phone="tg_{chatId}"
// (not a real number) and email="@username" — give them a Telegram link instead
// of WhatsApp/Call/mailto buttons that would all be broken.
export function isTgLead(phone: string) {
  return phone.startsWith('tg_')
}

export function tgHandle(email: string | undefined | null): string | null {
  if (!email) return null
  const m = email.match(/^@([A-Za-z0-9_]{4,32})$/)
  return m ? m[1] : null
}
