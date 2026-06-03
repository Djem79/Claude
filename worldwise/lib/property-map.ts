import type { Property } from '@/types'

const TYPES = ['apartment', 'villa', 'townhouse', 'penthouse'] as const
const STATUSES = ['off-plan', 'secondary', 'rent'] as const

function str(v: unknown, max: number): string | undefined {
  if (typeof v !== 'string') return undefined
  const s = v.trim().slice(0, max)
  return s || undefined
}
function num(v: unknown): number | undefined {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN
  return Number.isFinite(n) ? n : undefined
}

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
    const s = str(r[k], max)
    if (s !== undefined) (out[k] as string) = s
  }

  const price = num(r.priceAed); if (price !== undefined) out.priceAed = price
  const ppsf = num(r.pricePerSqft); if (ppsf !== undefined) out.pricePerSqft = ppsf

  if (typeof r.type === 'string' && (TYPES as readonly string[]).includes(r.type)) out.type = r.type as Property['type']
  if (typeof r.status === 'string' && (STATUSES as readonly string[]).includes(r.status)) out.status = r.status as Property['status']

  if (Array.isArray(r.amenities)) {
    out.amenities = r.amenities
      .filter((x): x is string => typeof x === 'string')
      .map(x => x.trim().slice(0, 300))
      .filter(Boolean)
      .slice(0, 100)
  }
  return out
}
