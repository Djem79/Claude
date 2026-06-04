export type ResolvedCoords = {
  lat: number
  lng: number
  zoom: number
  level: 'building' | 'area'
}

type LatLng = { lat?: number; lng?: number }

/**
 * Decide the map centre for a property.
 *  - property has BOTH lat & lng → building-level pin (zoom 16)
 *  - else areaCoords present     → district-level pin (zoom 13)
 *  - else                        → null (render no map, text block only)
 * Pure: takes the area centroid as an argument so this module stays free of the
 * `lib/areas.ts` value-import that would break `node --test` resolution.
 */
export function resolvePropertyCoords(
  property: LatLng,
  areaCoords: { lat: number; lng: number } | undefined
): ResolvedCoords | null {
  if (typeof property.lat === 'number' && typeof property.lng === 'number') {
    return { lat: property.lat, lng: property.lng, zoom: 16, level: 'building' }
  }
  if (areaCoords) {
    return { lat: areaCoords.lat, lng: areaCoords.lng, zoom: 13, level: 'area' }
  }
  return null
}
