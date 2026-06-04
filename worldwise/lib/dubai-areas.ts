// Controlled vocabulary for the property `area` field, used to keep new imports and
// form submissions consistent. Pure + dependency-free (unit-tested). Existing
// records are not rewritten — this only canonicalizes data at entry.

export const DUBAI_AREAS: string[] = [
  'Al Furjan',
  'Al Jaddaf',
  'Arjan',
  'Business Bay',
  'Damac Hills',
  'Damac Hills 2',
  'Downtown Dubai',
  'Dubai Creek Harbour',
  'Dubai Harbour',
  'Dubai Hills Estate',
  'Dubai Investment Park',
  'Dubai Marina',
  'Dubai Maritime City',
  'Dubai Production City',
  'Dubai Science Park',
  'Dubai South',
  'Dubai Sports City',
  'Dubailand',
  'Emaar Beachfront',
  'Expo City',
  'JBR',
  'JLT',
  'JVC',
  'Meydan',
  'Mohammed Bin Rashid City',
  'Palm Jumeirah',
  'Sobha Hartland',
  'The Oasis',
  'The Valley',
]

function norm(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim()
}

// Normalized variant -> canonical name. Every target must exist in DUBAI_AREAS.
const ALIAS_MAP: Record<string, string> = {
  'jumeirah lake towers': 'JLT',
  'sport city': 'Dubai Sports City',
  'sports city': 'Dubai Sports City',
  'maritime city': 'Dubai Maritime City',
  'jumeirah beach residences (jbr)': 'JBR',
  'jumeirah beach residence': 'JBR',
  'dubai investment park 2': 'Dubai Investment Park',
  'dubai expo': 'Expo City',
  'mbr city': 'Mohammed Bin Rashid City',
  'mbr city district 7': 'Mohammed Bin Rashid City',
  'meydan, district 11': 'Meydan',
  'sobha hartland, mohammed bin rashid city (mbr city)': 'Mohammed Bin Rashid City',
  'sobha hartland, mbr city, dubai': 'Sobha Hartland',
  'arjan, dubailand': 'Arjan',
  'city of arabia, dubailand': 'Dubailand',
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
