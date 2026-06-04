// Controlled vocabulary for the property `area` field, used to keep new imports and
// form submissions consistent, and to collapse spelling variants at read time
// (Popular Searches / catalog filter). Pure + dependency-free (unit-tested).
// Existing records are not rewritten — canonicalization happens at entry and on read.

export const DUBAI_AREAS: string[] = [
  'Al Furjan',
  'Al Jaddaf',
  'Arjan',
  'Business Bay',
  'Damac Hills',
  'Damac Hills 2',
  'Damac Lagoons',
  'Deira Islands',
  'Downtown Dubai',
  'Dubai Creek Harbour',
  'Dubai Design District',
  'Dubai Harbour',
  'Dubai Hills Estate',
  'Dubai Investment Park',
  'Dubai Islands',
  'Dubai Marina',
  'Dubai Maritime City',
  'Dubai Production City',
  'Dubai Science Park',
  'Dubai South',
  'Dubai Sports City',
  'Dubailand',
  'Emaar Beachfront',
  'Expo City',
  'Jebel Ali',
  'JBR',
  'JLT',
  'Jumeirah',
  'Jumeirah Golf Estates',
  'JVC',
  'JVT',
  'La Mer',
  'Majan',
  'Meydan',
  'Mina Rashid',
  'Mohammed Bin Rashid City',
  'Palm Jumeirah',
  'Sheikh Zayed Road',
  'Sobha Hartland',
  'The Oasis',
  'The Valley',
  'The Views',
]

function norm(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim()
}

// Normalized variant -> canonical name. Every target must exist in DUBAI_AREAS
// (guarded by a unit test).
const ALIAS_MAP: Record<string, string> = {
  'jumeirah lake towers': 'JLT',
  'sport city': 'Dubai Sports City',
  'sports city': 'Dubai Sports City',
  'maritime city': 'Dubai Maritime City',
  'jumeirah beach residences (jbr)': 'JBR',
  'jumeirah beach residence': 'JBR',
  'dubai investment park 2': 'Dubai Investment Park',
  'dubai investments park': 'Dubai Investment Park',
  'dubai investments park (dip)': 'Dubai Investment Park',
  'dubai expo': 'Expo City',
  'mbr city': 'Mohammed Bin Rashid City',
  'mbr city district 7': 'Mohammed Bin Rashid City',
  'meydan, district 11': 'Meydan',
  'meydan horizon': 'Meydan',
  'sobha hartland, mohammed bin rashid city (mbr city)': 'Mohammed Bin Rashid City',
  'sobha hartland, mbr city, dubai': 'Sobha Hartland',
  'arjan, dubailand': 'Arjan',
  'city of arabia, dubailand': 'Dubailand',
  'dubai land residence complex (dlrc)': 'Dubailand',
  'damac lagoon views': 'Damac Lagoons',
  'jumeirah golf': 'Jumeirah Golf Estates',
  'la mer south': 'La Mer',
  'jebel ali industrial area 2': 'Jebel Ali',
  'mosela, the views,dubai': 'The Views',
}

const CANON_BY_NORM: Record<string, string> = Object.fromEntries(
  DUBAI_AREAS.map(a => [norm(a), a])
)

/**
 * Map a raw area string to a canonical Dubai community. Exact (case-insensitive)
 * canonical match wins; else an alias match; else the trimmed raw is returned
 * unchanged (never invents, never drops — generic "Dubai" stays "Dubai").
 */
export function canonicalizeArea(raw: string): string {
  if (typeof raw !== 'string') return ''
  const trimmed = raw.replace(/\s+/g, ' ').trim()
  if (!trimmed) return ''
  const n = norm(trimmed)
  return CANON_BY_NORM[n] ?? ALIAS_MAP[n] ?? trimmed
}

// Exposed for tests: every ALIAS_MAP target must be a canonical area.
export const _ALIAS_TARGETS = Object.values(ALIAS_MAP)
