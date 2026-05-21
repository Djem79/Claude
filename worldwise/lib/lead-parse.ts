export interface ParsedLead {
  name?: string
  phone?: string
  email?: string
  note: string
}

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/
const PHONE_RE = /[+\d][\d\s().-]{6,}/g

const NAME_LABELS = ['name', 'имя', 'client', 'клиент', 'contact', 'фио']
const PHONE_LABELS = ['phone', 'tel', 'telephone', 'mobile', 'тел', 'телефон', 'номер']
const EMAIL_LABELS = ['email', 'e-mail', 'почта', 'mail']

export function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, '')
}

function isValidPhone(raw: string): boolean {
  const d = normalizePhone(raw)
  return d.length >= 7 && d.length <= 15
}

function firstValidPhone(text: string): string | undefined {
  for (const c of text.match(PHONE_RE) ?? []) {
    if (isValidPhone(c)) return c.trim()
  }
  return undefined
}

function labelValue(text: string, labels: string[]): string | undefined {
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*([^:]{1,30}):\s*(.+?)\s*$/)
    if (!m) continue
    if (labels.includes(m[1].trim().toLowerCase())) {
      const v = m[2].trim()
      if (v) return v
    }
  }
  return undefined
}

export function parseLeadText(text: string): ParsedLead {
  const note = text.trim()

  const labelEmail = labelValue(text, EMAIL_LABELS)
  const email = labelEmail?.match(EMAIL_RE)?.[0] ?? text.match(EMAIL_RE)?.[0]

  const labelPhone = labelValue(text, PHONE_LABELS)
  let phone: string | undefined
  if (labelPhone && isValidPhone(labelPhone)) phone = labelPhone.trim()
  if (!phone) phone = firstValidPhone(text)

  let name = labelValue(text, NAME_LABELS)
  if (!name) {
    for (const line of text.split('\n')) {
      const t = line.trim()
      if (!t) continue
      if (email && t.includes(email)) continue
      if (phone && t.includes(phone)) continue
      if (EMAIL_RE.test(t)) continue
      if (/^[\d\s+().-]+$/.test(t) && isValidPhone(t)) continue
      name = t
      break
    }
  }

  return {
    name: name?.slice(0, 120),
    phone,
    email: email?.slice(0, 160),
    note,
  }
}
