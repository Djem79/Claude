// First-touch UTM / click-id attribution capture for lead forms.
//
// `parseUtmParams` is a PURE function (node:test'd in lib/utm.test.ts) — keep it
// import-free so `node --test --experimental-strip-types` can run this module.
// The storage helpers below are client-only (guarded by `typeof window`).

export const UTM_KEYS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'gclid',
  'fbclid',
] as const

export type UtmKey = (typeof UTM_KEYS)[number]
export type UtmParams = Partial<Record<UtmKey, string>>
export type Attribution = UtmParams & { attributionCapturedAt?: string }

const MAX_LEN = 200
const STORAGE_KEY = 'ww_attribution'

// Pure: extract known attribution params from a URL query string.
// Trims, length-caps, and drops empty/unknown keys. Safe to unit-test.
export function parseUtmParams(search: string): UtmParams {
  const out: UtmParams = {}
  if (!search) return out
  const sp = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  for (const key of UTM_KEYS) {
    const raw = sp.get(key)
    if (raw == null) continue
    const v = raw.trim().slice(0, MAX_LEN)
    if (v) out[key] = v
  }
  return out
}

// Client-only. First-touch: store the campaign params once and never overwrite,
// so a later organic visit can't erase where the lead originally came from. Only
// writes when the current URL actually carries attribution params.
export function captureUtmOnFirstTouch(): void {
  if (typeof window === 'undefined') return
  try {
    if (window.localStorage.getItem(STORAGE_KEY)) return // first touch wins
    const params = parseUtmParams(window.location.search)
    if (Object.keys(params).length === 0) return
    const record: Attribution = { ...params, attributionCapturedAt: new Date().toISOString() }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(record))
  } catch {
    // localStorage can throw (private mode / disabled) — attribution is best-effort.
  }
}

// Client-only. Returns the stored attribution to merge into a lead POST body.
// Returns {} on the server or when nothing was captured.
export function getStoredAttribution(): Attribution {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const obj = JSON.parse(raw) as Record<string, unknown>
    const out: Attribution = {}
    for (const key of UTM_KEYS) {
      const v = obj[key]
      if (typeof v === 'string' && v) out[key] = v
    }
    if (typeof obj.attributionCapturedAt === 'string') out.attributionCapturedAt = obj.attributionCapturedAt
    return out
  } catch {
    return {}
  }
}
