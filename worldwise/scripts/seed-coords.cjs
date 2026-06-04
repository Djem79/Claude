#!/usr/bin/env node
/*
 * seed-coords.cjs — populate Property.lat/lng via the Google Geocoding API.
 * Server-only (reads/writes data/properties.json). Run from /var/www/worldwise.
 *
 *   node --env-file=.env.local scripts/seed-coords.cjs            # dry-run (prints plan)
 *   node --env-file=.env.local scripts/seed-coords.cjs --apply    # write
 *   node --env-file=.env.local scripts/seed-coords.cjs --apply --force  # write AND re-geocode props that already have coords (--force alone only previews)
 *   then: npm run build && pm2 restart worldwise   (SSG pages are prerendered)
 *
 * Confidence gate: a result is accepted only when location_type is ROOFTOP or
 * GEOMETRIC_CENTER AND the point falls inside the Dubai bounding box. Anything
 * else (APPROXIMATE, or a pin outside Dubai from a mis-resolved project name) is
 * left unset → the site falls back to the district centre. Never fabricate.
 */
const fs = require('fs')
const path = require('path')

const PROPERTIES = path.join(process.cwd(), 'data', 'properties.json')
const APPLY = process.argv.includes('--apply')
const FORCE = process.argv.includes('--force')
const KEY = process.env.GOOGLE_GEOCODING_API_KEY
if (!KEY) { console.error('GOOGLE_GEOCODING_API_KEY missing (load with --env-file=.env.local)'); process.exit(1) }

// Dubai bounding box (generous): lat 24.7–25.4 N, lng 54.8–55.7 E.
const inDubai = (lat, lng) => lat >= 24.7 && lat <= 25.4 && lng >= 54.8 && lng <= 55.7
const GOOD_TYPES = new Set(['ROOFTOP', 'GEOMETRIC_CENTER'])
const sleep = ms => new Promise(r => setTimeout(r, ms))

async function geocode(q) {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(q)}&region=ae&key=${KEY}`
  const res = await fetch(url)
  const data = await res.json()
  if (data.status === 'OVER_QUERY_LIMIT' || data.status === 'REQUEST_DENIED') {
    throw new Error(`Geocoding API ${data.status}: ${data.error_message || ''}`)
  }
  const top = data.results && data.results[0]
  if (!top) return null
  const { lat, lng } = top.geometry.location
  const type = top.geometry.location_type
  const ok = GOOD_TYPES.has(type) && inDubai(lat, lng)
  return { lat, lng, type, ok, formatted: top.formatted_address }
}

;(async () => {
  const arr = JSON.parse(fs.readFileSync(PROPERTIES, 'utf8'))
  let accepted = 0, rejected = 0, skipped = 0
  for (const p of arr) {
    if (!FORCE && typeof p.lat === 'number' && typeof p.lng === 'number') { skipped++; continue }
    const q = `${p.title}, ${p.area}, Dubai, United Arab Emirates`
    let r
    try { r = await geocode(q) } catch (e) { console.error('ABORT:', e.message); break }
    await sleep(120) // gentle pacing
    if (r && r.ok) {
      accepted++
      if (APPLY) { p.lat = Number(r.lat.toFixed(6)); p.lng = Number(r.lng.toFixed(6)) }
      console.log(`OK   ${p.title} → ${r.lat.toFixed(5)},${r.lng.toFixed(5)} [${r.type}] (${r.formatted})`)
    } else {
      rejected++
      console.log(`SKIP ${p.title} [${p.area}] → ${r ? `${r.type} ${r.lat.toFixed(4)},${r.lng.toFixed(4)} (out of box/approx)` : 'no result'}`)
    }
  }
  console.log(`\ntotal ${arr.length} | accepted ${accepted} | rejected ${rejected} | already-set ${skipped} | ${APPLY ? 'APPLIED' : 'DRY-RUN'}`)
  if (APPLY) {
    fs.writeFileSync(PROPERTIES + '.tmp', JSON.stringify(arr, null, 2))
    fs.renameSync(PROPERTIES + '.tmp', PROPERTIES)
    console.log('WRITTEN OK')
  }
})()
