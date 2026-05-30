#!/usr/bin/env node
/*
 * seed-gross-yield.cjs — set Property.grossYield from researched per-district
 * 2026 gross rental yields. Server-only (reads data/properties.json).
 *
 * MONTHLY REVIEW PROCESS (rental yield re-check):
 *   1. Re-verify the per-district yields below against current sources:
 *      Engel & Völkers per-community table, DLD via DXB Interact, Bayut /
 *      dubizzle area guides & yield reports, Property Monitor, Metropolitan
 *      factsheets. Update the `y` values here if the market has moved.
 *   2. Mirror the 8 LANDING-PAGE districts (Marina, Downtown, Palm, Business
 *      Bay, Dubai Hills, JLT, Creek Harbour, Emaar Beachfront) in
 *      `lib/areas.ts` metrics.roi + prose + FAQ + metaDescription, and deploy.
 *   3. Re-seed: on the server, `cd /var/www/worldwise` then
 *        node scripts/seed-gross-yield.cjs            # dry-run (prints plan)
 *        node scripts/seed-gross-yield.cjs --apply    # write
 *      then `npm run build && pm2 restart worldwise` so SSG pages refresh.
 *      Back up data/ first (the deploy step already does this).
 *
 * Order matters: more-specific tokens (e.g. "Damac Hills 2") MUST precede
 * general ones ("Damac Hills") — first match wins. Properties in areas with no
 * researched figure (generic "Dubai"/"Jumeirah", non-Dubai, one-offs) are left
 * untouched — never fabricate a yield. Last reviewed: 2026-05-30.
 */
const fs = require('fs')
const path = require('path')
const PROPERTIES = path.join(process.cwd(), 'data', 'properties.json')
const APPLY = process.argv.includes('--apply')

const AREAS = [
  // 8 landing-page districts (keep in sync with lib/areas.ts)
  { name: 'Dubai Marina',     y: 6.5, t: ['Dubai Marina'] },
  { name: 'Downtown Dubai',   y: 5.5, t: ['Downtown Dubai'] },
  { name: 'Palm Jumeirah',    y: 5.5, t: ['Palm Jumeirah'] },
  { name: 'Business Bay',     y: 7.5, t: ['Business Bay'] },
  { name: 'Dubai Hills',      y: 6.5, t: ['Dubai Hills'] },
  { name: 'JLT',              y: 7.5, t: ['JLT', 'Jumeirah Lake Towers', 'Jumeirah Lakes Towers'] },
  { name: 'Creek Harbour',    y: 6.5, t: ['Creek Harbour', 'Dubai Creek Harbour'] },
  { name: 'Emaar Beachfront', y: 6.5, t: ['Emaar Beachfront'] },
  // expansion (per-property only; no landing pages) — SPECIFIC BEFORE GENERAL
  { name: 'Damac Hills 2',    y: 6.5, t: ['Damac Hills 2'] },
  { name: 'Damac Hills',      y: 6.0, t: ['Damac Hills'] },
  { name: 'MBR City/Sobha Hartland/Meydan', y: 6.5, t: ['Sobha Hartland', 'MBR City', 'Mohammed Bin Rashid', 'Meydan'] },
  { name: 'Dubailand/Arjan/Majan', y: 7.5, t: ['Dubailand', 'Arjan', 'Majan'] },
  { name: 'The Valley',       y: 6.5, t: ['The Valley'] },
  { name: 'Expo City',        y: 7.0, t: ['Expo'] },
  { name: 'Dubai Investment Park', y: 8.0, t: ['Investment Park'] },
  { name: 'Dubai Harbour',    y: 6.0, t: ['Dubai Harbour'] },
  { name: 'Dubai South',      y: 7.5, t: ['Dubai South'] },
  { name: 'Al Furjan',        y: 7.5, t: ['Al Furjan'] },
  { name: 'Maritime City',    y: 6.5, t: ['Maritime City'] },
  { name: 'Dubai Sports City', y: 7.0, t: ['Sports City', 'Sport City'] },
  { name: 'JBR',              y: 6.2, t: ['JBR', 'Jumeirah Beach Residence'] },
  { name: 'Al Jaddaf',        y: 6.5, t: ['Al Jaddaf'] },
]
const norm = s => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
function match(area) {
  const n = norm(area)
  if (!n) return null
  for (const a of AREAS) if (a.t.map(norm).some(c => c && n.includes(c))) return a
  return null
}

const arr = JSON.parse(fs.readFileSync(PROPERTIES, 'utf8'))
const counts = {}
const skippedAreas = {}
let seeded = 0, skipped = 0
for (const p of arr) {
  const m = match(p.area)
  if (m) { if (APPLY) p.grossYield = m.y; counts[m.name] = (counts[m.name] || 0) + 1; seeded++ }
  else { skipped++; skippedAreas[p.area] = (skippedAreas[p.area] || 0) + 1 }
}
console.log('total', arr.length, '| seeded', seeded, '| skipped', skipped, '|', APPLY ? 'APPLIED' : 'DRY-RUN')
console.log('SEEDED:', JSON.stringify(counts, null, 1))
console.log('SKIPPED:', JSON.stringify(skippedAreas, null, 1))
if (APPLY) {
  fs.writeFileSync(PROPERTIES + '.tmp', JSON.stringify(arr, null, 2))
  fs.renameSync(PROPERTIES + '.tmp', PROPERTIES)
  console.log('WRITTEN OK')
}
