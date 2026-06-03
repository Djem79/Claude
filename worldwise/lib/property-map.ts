import type { Property } from '@/types'

const TYPES = ['apartment', 'villa', 'townhouse', 'penthouse'] as const
const STATUSES = ['off-plan', 'secondary', 'rent'] as const

function cleanString(v: unknown, max: number): string | undefined {
  if (typeof v !== 'string') return undefined
  const s = v.trim().slice(0, max)
  return s || undefined
}
function cleanNumber(v: unknown): number | undefined {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN
  return Number.isFinite(n) ? n : undefined
}

// Intentionally NOT mapped from AI output: slug/id/createdAt (derived), images
// (extracted separately from the PDF), featured/rented/badge/qrImage/permit/project
// numbers (set by the operator during review). Keep this mapper to factual,
// AI-extractable listing fields only.

/**
 * Clean + clamp one Gemini-extracted object into a partial Property. Mirrors the
 * whitelist/coercion rules of coercePropertyInput so the draft is form-ready, but
 * tolerant: anything missing/invalid is simply omitted (never invented). Pure +
 * dependency-free so it's unit-testable with node:test.
 */
export function mapGeminiToProperty(raw: unknown): Partial<Property> {
  if (!raw || typeof raw !== 'object') return {}
  const r = raw as Record<string, unknown>
  const out: Partial<Property> = {}

  const strFields: [keyof Property, number][] = [
    ['title', 200], ['developer', 120], ['area', 120], ['bedrooms', 60],
    ['completionDate', 60], ['paymentPlan', 400],
    ['shortDescription', 400], ['description', 8000],
  ]
  for (const [k, max] of strFields) {
    const s = cleanString(r[k], max)
    if (s !== undefined) (out[k] as string) = s
  }

  const numFields: (keyof Property)[] = ['priceAed', 'pricePerSqft', 'roi', 'grossYield']
  for (const k of numFields) {
    const n = cleanNumber(r[k])
    if (n !== undefined) (out[k] as number) = n
  }

  if (typeof r.type === 'string' && (TYPES as readonly string[]).includes(r.type)) out.type = r.type as Property['type']
  if (typeof r.status === 'string' && (STATUSES as readonly string[]).includes(r.status)) out.status = r.status as Property['status']

  if (Array.isArray(r.amenities)) {
    const cleaned = r.amenities
      .filter((x): x is string => typeof x === 'string')
      .map(x => x.trim().slice(0, 300))
      .filter(Boolean)
      .slice(0, 100)
    if (cleaned.length > 0) out.amenities = cleaned
  }
  return out
}
