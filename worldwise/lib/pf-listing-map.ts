// PURE Property → Property Finder listing mapper. The risk core of integration #2:
// fully node:test'd. NO fs/net/`@/` imports so it stays runnable under
// `node --test --experimental-strip-types` (like lib/pf-lead.ts).

// Canonical site origin for absolute media URLs (PF requires publicly reachable,
// absolute image URLs). Hardcoded to keep the mapper pure (no env access).
const SITE = 'https://worldwise.pro'

// Subset of Property the mapper reads. Declared locally so the test file needs no
// `@/types` import (which would break type-stripping resolution).
export interface PropertyLike {
  id: string
  type: string
  status: string // 'off-plan' | 'secondary' | 'rent'
  priceAed: number
  bedrooms?: string
  bathrooms?: string
  sizeSqft?: number
  furnishingType?: string
  title: string
  description: string
  permitNumber?: string
  amenities?: string[]
  images?: string[]
}

export interface PfCompliance {
  // Real GET /v1/compliances/{permit}/{license} shape (verified 2026-06-19):
  // { data: [ { property: { saleType: 'Primary'|'Secondary', locationName, value, size }, ... } ] }.
  // `saleType` (top-level) kept as a forgiving fallback.
  data?: Array<{ property?: { saleType?: string; locationName?: string; value?: number; size?: number } }>
  saleType?: string
}

// PF capitalises saleType ('Secondary'); normalise to lowercase. Reads the real
// nested path first, then the legacy top-level fallback.
function complianceSaleType(c?: PfCompliance): string | undefined {
  return (c?.data?.[0]?.property?.saleType ?? c?.saleType)?.toLowerCase()
}

export interface PfListingContext {
  publicProfileId: number | string
  locationId: number
  companyLicense: string
  compliance?: PfCompliance
}

export interface PfListingPayload {
  reference: string
  category: 'residential'
  type: string
  publicProfileId: number | string
  location: { id: number }
  bedrooms?: string
  bathrooms?: string
  furnishingType?: string
  size: number
  uaeEmirate: 'dubai'
  price: { type: 'sale' | 'yearly'; amounts: { sale?: number; yearly?: number } }
  downPayment?: number
  projectStatus?: string
  title: { en: string }
  description: { en: string }
  compliance: {
    type: 'rera'
    listingAdvertisementNumber: string
    issuingClientLicenseNumber: string
  }
  amenities: string[]
  media: { images: { original: { url: string } }[] }
}

// --- validation -------------------------------------------------------------

export function validateForPf(p: PropertyLike): { ok: boolean; missing: string[] } {
  const missing: string[] = []
  if (!p.title?.trim()) missing.push('title')
  if (!p.description?.trim()) missing.push('description')
  if (!(typeof p.priceAed === 'number' && p.priceAed > 0)) missing.push('priceAed')
  if (!p.permitNumber?.trim()) missing.push('permitNumber')
  if (!p.bathrooms?.trim()) missing.push('bathrooms')
  if (!(typeof p.sizeSqft === 'number' && p.sizeSqft > 0)) missing.push('sizeSqft')
  if (!p.furnishingType?.trim()) missing.push('furnishingType')
  if (!Array.isArray(p.images) || p.images.length < 1) missing.push('images')
  // uaeEmirate is hardcoded 'dubai' (v1) — Property has no emirate field to validate.
  return { ok: missing.length === 0, missing }
}

// --- helpers ----------------------------------------------------------------

// PF bedrooms enum: 'studio' | '1'.. . Our `bedrooms` is free text ('2 BR', 'Studio',
// '1-3 Bed'). Take 'studio' or the first integer; undefined if neither.
function normalizeBedrooms(raw?: string): string | undefined {
  if (!raw) return undefined
  if (/studio/i.test(raw)) return 'studio'
  const m = raw.match(/\d+/)
  return m ? m[0] : undefined
}

// PF rejects non-ASCII (emoji, smart quotes, middots). Replace the common
// typographic characters with ASCII, strip anything still non-ASCII, collapse space.
function asciiSanitize(s: string): string {
  return (s ?? '')
    .replace(/[‘’‚′]/g, "'") // ' ' ‚ ′ → '
    .replace(/[“”„″]/g, '"') // " " „ ″ → "
    .replace(/[–—−]/g, '-')        // – — − → -
    .replace(/[·•‣●]/g, '-')  // · • ‣ ● → -
    .replace(/…/g, '...')                     // … → ...
    .replace(/ /g, ' ')                       // nbsp → space
    .replace(/[^\x00-\x7F]/g, '')                  // strip remaining non-ASCII (emoji)
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

// PF residential amenity codes (canonical). Inputs already in this set pass through.
const PF_RESIDENTIAL_AMENITIES = new Set([
  'central-ac', 'balcony', 'shared-pool', 'private-pool', 'shared-gym', 'private-gym',
  'covered-parking', 'security', 'concierge-service', 'maids-room', 'study',
  'built-in-wardrobes', 'walk-in-closet', 'kitchen-appliances', 'view-of-water',
  'view-of-landmark', 'pets-allowed', 'shared-spa', 'childrens-play-area',
  'barbecue-area', 'lobby-in-building', 'maid-service', 'networked',
])

// Human spellings (as typed in PropertyForm's amenities textarea) → canonical codes.
const AMENITY_SYNONYMS: Record<string, string> = {
  'swimming pool': 'shared-pool', 'pool': 'shared-pool', 'shared pool': 'shared-pool',
  'private pool': 'private-pool',
  'gym': 'shared-gym', 'fitness': 'shared-gym', 'fitness center': 'shared-gym',
  'shared gym': 'shared-gym', 'private gym': 'private-gym',
  'covered parking': 'covered-parking', 'parking': 'covered-parking',
  'security': 'security', '24/7 security': 'security', '24 hour security': 'security',
  'concierge': 'concierge-service', 'concierge service': 'concierge-service',
  'maids room': 'maids-room', "maid's room": 'maids-room',
  'maid service': 'maid-service',
  'study': 'study', 'study room': 'study',
  'built-in wardrobes': 'built-in-wardrobes', 'built in wardrobes': 'built-in-wardrobes',
  'walk-in closet': 'walk-in-closet', 'walk in closet': 'walk-in-closet',
  'balcony': 'balcony', 'terrace': 'balcony',
  'central ac': 'central-ac', 'central a/c': 'central-ac', 'central air': 'central-ac',
  'kitchen appliances': 'kitchen-appliances',
  'kids play area': 'childrens-play-area', 'children play area': 'childrens-play-area',
  "children's play area": 'childrens-play-area', 'play area': 'childrens-play-area',
  'bbq area': 'barbecue-area', 'barbecue area': 'barbecue-area', 'bbq': 'barbecue-area',
  'sea view': 'view-of-water', 'water view': 'view-of-water', 'marina view': 'view-of-water',
  'landmark view': 'view-of-landmark', 'burj view': 'view-of-landmark',
  'spa': 'shared-spa', 'pets allowed': 'pets-allowed', 'pet friendly': 'pets-allowed',
  'lobby': 'lobby-in-building', 'lobby in building': 'lobby-in-building',
}

function mapAmenities(input?: string[]): string[] {
  if (!Array.isArray(input)) return []
  const out: string[] = []
  const seen = new Set<string>()
  for (const raw of input) {
    if (typeof raw !== 'string') continue
    const norm = raw.trim().toLowerCase().replace(/\s+/g, ' ')
    if (!norm) continue
    const code = PF_RESIDENTIAL_AMENITIES.has(norm) ? norm : AMENITY_SYNONYMS[norm]
    if (code && !seen.has(code)) {
      seen.add(code)
      out.push(code)
    }
  }
  return out
}

function absoluteImageUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path
  return SITE + (path.startsWith('/') ? path : '/' + path)
}

// projectStatus (sale only): completion from our status + primary/secondary from DLD.
function deriveProjectStatus(status: string, compliance?: PfCompliance): string {
  const base = status === 'off-plan' ? 'off_plan' : 'completed'
  const suffix = complianceSaleType(compliance) === 'primary' ? 'primary' : 'secondary'
  return `${base}_${suffix}`
}

// --- main mapper ------------------------------------------------------------

export function mapPropertyToPfListing(p: PropertyLike, ctx: PfListingContext): PfListingPayload {
  const isRent = p.status === 'rent'
  const bedrooms = normalizeBedrooms(p.bedrooms)

  const payload: PfListingPayload = {
    reference: p.id,
    category: 'residential',
    type: p.type,
    publicProfileId: ctx.publicProfileId,
    location: { id: ctx.locationId },
    size: typeof p.sizeSqft === 'number' ? p.sizeSqft : 0,
    uaeEmirate: 'dubai',
    price: isRent
      ? { type: 'yearly', amounts: { yearly: p.priceAed } }
      : { type: 'sale', amounts: { sale: p.priceAed } },
    title: { en: asciiSanitize(p.title) },
    description: { en: asciiSanitize(p.description) },
    compliance: {
      type: 'rera',
      listingAdvertisementNumber: p.permitNumber ?? '',
      issuingClientLicenseNumber: ctx.companyLicense,
    },
    amenities: mapAmenities(p.amenities),
    media: { images: (p.images ?? []).map((src) => ({ original: { url: absoluteImageUrl(src) } })) },
  }

  if (bedrooms) payload.bedrooms = bedrooms
  if (p.bathrooms) payload.bathrooms = p.bathrooms
  if (p.furnishingType) payload.furnishingType = p.furnishingType

  if (!isRent) {
    // TODO(pilot): confirm an acceptable downPayment — 0 may be rejected by PF for sale.
    payload.downPayment = 0
    payload.projectStatus = deriveProjectStatus(p.status, ctx.compliance)
  }

  return payload
}
