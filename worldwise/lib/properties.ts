import path from 'path'
import { Property } from '@/types'
import { readJsonFile, mutateJsonFile } from '@/lib/json-store'
import { sanitizeSlug, uniqueSlug } from '@/lib/slug'

const PROPERTY_TYPES: Property['type'][] = ['apartment', 'villa', 'townhouse', 'penthouse']
const PROPERTY_STATUSES: Property['status'][] = ['off-plan', 'secondary', 'rent']

// String fields with their max length. Unlisted keys are dropped (whitelist).
const STRING_FIELDS: [keyof Property, number][] = [
  ['title', 200], ['developer', 120], ['area', 120], ['bedrooms', 60],
  ['shortDescription', 400], ['description', 8000], ['completionDate', 60],
  ['paymentPlan', 400], ['badge', 60], ['qrImage', 300],
  ['permitNumber', 120], ['projectNumber', 120], ['brochure', 80],
  // PF listing admin-entered fields (the pf* STATE fields are written only by the
  // pf-listing routes/webhook, never whitelisted here):
  ['bathrooms', 16], ['furnishingType', 32],
]
// Plain finite-number fields (no range check). lat/lng are NOT here — they get
// dedicated range-gated handling in coercePropertyInput below.
const NUMBER_FIELDS: (keyof Property)[] = ['priceAed', 'pricePerSqft', 'roi', 'grossYield', 'sizeSqft']
const BOOLEAN_FIELDS: (keyof Property)[] = ['featured', 'rented']
const ARRAY_FIELDS: (keyof Property)[] = ['amenities', 'images', 'floorPlans']

function cleanString(v: unknown, max: number): string | undefined {
  if (typeof v !== 'string') return undefined
  return v.trim().slice(0, max)
}
function cleanNumber(v: unknown): number | undefined {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN
  return Number.isFinite(n) ? n : undefined
}
function cleanStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v.filter((x): x is string => typeof x === 'string').map(x => x.trim().slice(0, 300)).filter(Boolean).slice(0, 100)
}

/**
 * Validate + coerce an untrusted request body into a clean property shape.
 * Whitelists known keys (drops unknown keys and never trusts id/createdAt from the
 * body), coerces types so a bad priceAed can't propagate as NaN to the UI, clamps
 * enums, and normalizes the slug. Returns an error string instead of throwing.
 * `partial: true` (PUT) includes only the keys present in the body.
 */
export function coercePropertyInput(
  body: unknown,
  opts: { partial: boolean }
): { ok: true; value: Record<string, unknown> } | { ok: false; error: string } {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Invalid body' }
  const b = body as Record<string, unknown>
  const has = (k: string) => Object.prototype.hasOwnProperty.call(b, k)
  const out: Record<string, unknown> = {}

  for (const [key, max] of STRING_FIELDS) {
    if (has(key)) { const s = cleanString(b[key], max); if (s !== undefined) out[key] = s }
  }
  for (const key of NUMBER_FIELDS) {
    if (has(key)) {
      const n = cleanNumber(b[key])
      if (n === undefined) {
        if (key === 'priceAed') return { ok: false, error: 'priceAed must be a number' }
        // Optional numbers: a blank/invalid value clears the field. The explicit
        // undefined is required — an absent key would survive the {...existing, ...out}
        // spread in updateProperty, keeping the stale value forever.
        out[key] = undefined
      } else {
        out[key] = n
      }
    }
  }
  // lat/lng: validated as a pair with range gates (a swapped or typo'd coordinate
  // must be dropped, not stored — it would drop a map pin in the wrong place).
  // Out-of-range or NaN → silently cleared (optional fields). Dubai is ~25N, 55E
  // but we accept any globally valid coordinate; the geocoder applies the tighter box.
  for (const key of ['lat', 'lng'] as const) {
    if (has(key)) {
      const n = cleanNumber(b[key])
      const limit = key === 'lat' ? 90 : 180
      out[key] = n !== undefined && Math.abs(n) <= limit ? n : undefined
    }
  }
  for (const key of BOOLEAN_FIELDS) { if (has(key)) out[key] = Boolean(b[key]) }
  for (const key of ARRAY_FIELDS) { if (has(key)) out[key] = cleanStringArray(b[key]) }

  if (has('type')) {
    if (!PROPERTY_TYPES.includes(b.type as Property['type'])) return { ok: false, error: 'Invalid type' }
    out.type = b.type
  }
  if (has('status')) {
    if (!PROPERTY_STATUSES.includes(b.status as Property['status'])) return { ok: false, error: 'Invalid status' }
    out.status = b.status
  }

  // slug: only change it when explicitly sent — on a partial PUT we must NOT silently
  // regenerate the slug from a new title (that would break the property's public URL,
  // sitemap entry, and inbound links). On create, fall back to a title-derived slug.
  if (has('slug')) {
    const slug = sanitizeSlug(String(b.slug ?? ''))
    if (slug) out.slug = slug
  }
  if (!opts.partial && !out.slug) {
    const slug = sanitizeSlug(String(b.title ?? ''))
    if (slug) out.slug = slug
    else return { ok: false, error: 'Could not derive a valid slug' }
  }

  if (!opts.partial) {
    if (!out.title) return { ok: false, error: 'title is required' }
    if (out.priceAed === undefined) return { ok: false, error: 'priceAed is required' }
    if (!out.type) out.type = 'apartment'
    if (!out.status) out.status = 'off-plan'
  }

  return { ok: true, value: out }
}

const DATA_FILE = path.join(process.cwd(), 'data', 'properties.json')

type RawProperty = Omit<Property, 'status'> & { status: string }

// Shared by reads AND the mutation critical section: array-shape check (a
// present-but-unparseable/truncated file must NOT be masked as "no properties",
// or the next mutation would overwrite the whole catalog with near-empty data —
// readJsonFile already throws on parse errors; this guards the root shape) plus
// the legacy 'ready' → 'secondary' status mapping.
function normalizeProperties(parsed: RawProperty[]): Property[] {
  if (!Array.isArray(parsed)) {
    throw new Error(`[properties] ${DATA_FILE} is not a JSON array`)
  }
  return parsed.map(p => ({
    ...p,
    status: (p.status === 'ready' ? 'secondary' : p.status) as Property['status'],
  }))
}

export function getProperties(): Property[] {
  // ENOENT → [] (fresh checkout where data/ is server-only); corrupt → throw.
  return normalizeProperties(readJsonFile<RawProperty[]>(DATA_FILE, []))
}

export function getPropertyBySlug(slug: string): Property | null {
  return getProperties().find(p => p.slug === slug) ?? null
}

export function getPropertyById(id: string): Property | null {
  return getProperties().find(p => p.id === id) ?? null
}

export function getFeaturedProperties(): Property[] {
  return getProperties().filter(p => p.featured)
}

// All catalog mutations run inside mutateJsonFile's synchronous critical
// section (fresh read + sync transform + atomic temp-file/rename write).
function mutateProperties(mutate: (current: Property[]) => Property[]): void {
  mutateJsonFile<RawProperty[]>(DATA_FILE, [], raw => mutate(normalizeProperties(raw)))
}

export function createProperty(data: Omit<Property, 'createdAt'> & { id?: string }): Property {
  let created: Property | null = null
  mutateProperties(properties => {
    // Honor a client-supplied id (the gallery upload folder is keyed by it) only if it's
    // well-formed AND not already taken — a duplicate id would shadow an existing record
    // in every find/findIndex lookup. Otherwise generate a fresh one.
    const id = data.id && /^\d{6,20}$/.test(data.id) && !properties.some(p => p.id === data.id)
      ? data.id
      : String(Date.now())
    // Guarantee slug uniqueness — two listings sharing a slug would leave the second
    // unreachable (getPropertyBySlug resolves the first). Suffix -2/-3 on collision.
    const slug = data.slug ? uniqueSlug(data.slug, properties.map(p => p.slug)) : data.slug
    created = {
      ...data,
      id,
      slug,
      createdAt: new Date().toISOString(),
    }
    return [...properties, created]
  })
  return created!
}

export function updateProperty(id: string, data: Partial<Omit<Property, 'id' | 'createdAt'>>): Property | null {
  let updated: Property | null = null
  mutateProperties(properties => {
    const index = properties.findIndex(p => p.id === id)
    if (index === -1) return properties
    updated = { ...properties[index], ...data }
    return properties.map((p, i) => (i === index ? updated! : p))
  })
  return updated
}

export function deleteProperty(id: string): boolean {
  let removed = false
  mutateProperties(properties => {
    const filtered = properties.filter(p => p.id !== id)
    removed = filtered.length !== properties.length
    return filtered
  })
  return removed
}

// --- Property Finder listing state (#2) -------------------------------------
// These write ONLY the pf* state fields and run inside the same mutateProperties
// critical section. Kept out of coercePropertyInput so the form body can never
// forge listing state — it is set exclusively by the pf-listing routes/webhook.

// Set listing state by property id (used by the draft/publish/unpublish routes).
export function setPfListingState(id: string, patch: Partial<Pick<Property,
  'pfListingId' | 'pfListingStatus' | 'pfLocationId' | 'pfPublishedAt'>>): Property | null {
  let updated: Property | null = null
  mutateProperties(list => list.map(p => {
    if (p.id !== id) return p
    updated = { ...p, ...patch }
    return updated
  }))
  return updated
}

// Idempotent: locate the property by its PF listing id (the webhook path, where we
// only know the PF id, not our property id). No-op (returns null) if none matches.
export function setPfStatusByListingId(pfListingId: string, patch: Partial<Pick<Property,
  'pfListingStatus' | 'pfPublishedAt'>>): Property | null {
  let updated: Property | null = null
  mutateProperties(list => list.map(p => {
    if (p.pfListingId !== pfListingId) return p
    updated = { ...p, ...patch }
    return updated
  }))
  return updated
}
