import fs from 'fs'
import path from 'path'
import { Property } from '@/types'
import { writeFileAtomic } from '@/lib/atomic-write'
import { sanitizeSlug } from '@/lib/slug'

const PROPERTY_TYPES: Property['type'][] = ['apartment', 'villa', 'townhouse', 'penthouse']
const PROPERTY_STATUSES: Property['status'][] = ['off-plan', 'secondary', 'rent']

// String fields with their max length. Unlisted keys are dropped (whitelist).
const STRING_FIELDS: [keyof Property, number][] = [
  ['title', 200], ['developer', 120], ['area', 120], ['bedrooms', 60],
  ['shortDescription', 400], ['description', 8000], ['completionDate', 60],
  ['paymentPlan', 400], ['badge', 60], ['qrImage', 300],
  ['permitNumber', 120], ['projectNumber', 120],
]
const NUMBER_FIELDS: (keyof Property)[] = ['priceAed', 'pricePerSqft', 'roi', 'grossYield']
const BOOLEAN_FIELDS: (keyof Property)[] = ['featured', 'rented']
const ARRAY_FIELDS: (keyof Property)[] = ['amenities', 'images']

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
        // optional numbers: a blank/invalid value just clears the field
      } else {
        out[key] = n
      }
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

  // slug: normalize whatever was sent; fall back to a slug derived from the title.
  if (has('slug') || has('title')) {
    const slug = sanitizeSlug(String(b.slug ?? '') || String(b.title ?? ''))
    if (slug) out.slug = slug
    else if (!opts.partial) return { ok: false, error: 'Could not derive a valid slug' }
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

export function getProperties(): Property[] {
  let parsed: (Omit<Property, 'status'> & { status: string })[]
  try {
    parsed = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'))
  } catch (e) {
    // Missing or unreadable file (e.g. fresh checkout where data/ is server-only,
    // or a truncated write): degrade gracefully instead of crashing the build/render.
    console.warn(`[properties] could not read ${DATA_FILE}:`, (e as Error).message)
    return []
  }
  if (!Array.isArray(parsed)) return []
  // Legacy 'ready' status was removed — render those entries as 'secondary'.
  return parsed.map(p => ({
    ...p,
    status: (p.status === 'ready' ? 'secondary' : p.status) as Property['status'],
  }))
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

export function saveProperties(properties: Property[]): void {
  // Atomic temp-file + rename so a crash/full-disk mid-write can't truncate the
  // live catalog (the file the whole public site reads). See lib/atomic-write.ts.
  writeFileAtomic(DATA_FILE, JSON.stringify(properties, null, 2))
}

export function createProperty(data: Omit<Property, 'createdAt'> & { id?: string }): Property {
  const properties = getProperties()
  const id = data.id && /^\d{6,20}$/.test(data.id) ? data.id : String(Date.now())
  const newProperty: Property = {
    ...data,
    id,
    createdAt: new Date().toISOString(),
  }
  saveProperties([...properties, newProperty])
  return newProperty
}

export function updateProperty(id: string, data: Partial<Omit<Property, 'id' | 'createdAt'>>): Property | null {
  const properties = getProperties()
  const index = properties.findIndex(p => p.id === id)
  if (index === -1) return null
  properties[index] = { ...properties[index], ...data }
  saveProperties(properties)
  return properties[index]
}

export function deleteProperty(id: string): boolean {
  const properties = getProperties()
  const filtered = properties.filter(p => p.id !== id)
  if (filtered.length === properties.length) return false
  saveProperties(filtered)
  return true
}
