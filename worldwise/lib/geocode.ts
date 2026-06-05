// Resolve a Dubai property's building coordinates by NAME, for PDF imports that
// carry no geolocation. Shares the confidence policy of scripts/seed-coords.cjs:
//   - accept only ROOFTOP / GEOMETRIC_CENTER results inside the Dubai bbox
//   - never trust a generic resale title ("3-Bedroom Apartment in X") — those
//     geocode to the wrong district.
// KEEP THIS POLICY IN SYNC with scripts/seed-coords.cjs (a .cjs cron can't import
// this .ts module). No `@/` / `next` / `fs` imports so the pure gate is node:test-able.

export type GeocodeResult = { lat: number; lng: number; type: string }

const DUBAI = { latMin: 24.7, latMax: 25.4, lngMin: 54.8, lngMax: 55.7 }
const GOOD_TYPES = new Set(['ROOFTOP', 'GEOMETRIC_CENTER'])
const GENERIC_TITLE = /^\s*(\d+\s*-?\s*bed\w*|studio|apartment|retail|duplex|plot)\b/i

/** Pure: is this geocode result trustworthy as a building pin for `title`? */
export function acceptGeocode(title: string, r: GeocodeResult | null): boolean {
  if (!r) return false
  if (GENERIC_TITLE.test(title || '')) return false
  if (!GOOD_TYPES.has(r.type)) return false
  return r.lat >= DUBAI.latMin && r.lat <= DUBAI.latMax && r.lng >= DUBAI.lngMin && r.lng <= DUBAI.lngMax
}

/**
 * Look up building coordinates for a property by name. Returns {lat,lng} only on
 * a confident in-Dubai match, else null (caller falls back to the area centroid).
 * Never throws — missing key, generic title, network/parse error → null.
 */
export async function geocodeDubaiProperty(
  title: string,
  area: string
): Promise<{ lat: number; lng: number } | null> {
  const key = process.env.GOOGLE_GEOCODING_API_KEY
  if (!key || !title || GENERIC_TITLE.test(title)) return null
  const q = `${title}, ${area || ''}, Dubai, United Arab Emirates`
  try {
    const url =
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(q)}&region=ae&key=${key}`
    const res = await fetch(url)
    const data = await res.json()
    const top = data?.results?.[0]
    if (!top) return null
    const r: GeocodeResult = {
      lat: top.geometry.location.lat,
      lng: top.geometry.location.lng,
      type: top.geometry.location_type,
    }
    if (!acceptGeocode(title, r)) return null
    return { lat: Number(r.lat.toFixed(6)), lng: Number(r.lng.toFixed(6)) }
  } catch {
    return null
  }
}
