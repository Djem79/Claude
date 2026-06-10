#!/usr/bin/env node
/*
 * seed-price-per-sqft.cjs — compute Property.pricePerSqft from unit sizes
 * mentioned in the listing's own description text. Server-only (reads
 * data/properties.json). Mirrors seed-gross-yield.cjs (dry-run by default).
 *
 * HOW IT DECIDES (never fabricates):
 *   - skips properties that already have pricePerSqft (PDF import fills it
 *     for new listings when the brochure states it);
 *   - scans description + shortDescription for "N sq.ft / sqft / ft²";
 *   - a size counts only if it looks like a UNIT size (250–30,000 sqft) AND
 *     priceAed / size lands in Dubai's plausible band (400–8,000 AED/sqft) —
 *     this automatically rejects amenity decks ("45,000 sq ft of amenities")
 *     and whole-project areas ("390,000 sq ft development");
 *   - several distinct plausible sizes in one listing = "from"-style range →
 *     takes the SMALLEST (a "from" price corresponds to the smallest unit);
 *     review such rows in the dry-run before applying;
 *   - no plausible size → property left untouched (the card simply doesn't
 *     render the chip).
 *
 * USAGE (on the server):
 *   cd /var/www/worldwise
 *   node scripts/seed-price-per-sqft.cjs            # dry-run (prints plan)
 *   node scripts/seed-price-per-sqft.cjs --apply    # write
 *   npm run build && pm2 restart worldwise          # SSG pages are prerendered
 *   Back up data/ first.
 */
const fs = require('fs')
const path = require('path')
const PROPERTIES = path.join(process.cwd(), 'data', 'properties.json')
const APPLY = process.argv.includes('--apply')

const SIZE_RE = /([\d][\d,]*(?:\.\d+)?)\s*(?:sq\.?\s?ft\.?|sqft|square\s+f(?:ee|oo)t|ft²)/gi
const MIN_UNIT_SQFT = 250
const MAX_UNIT_SQFT = 30000
const MIN_PPSF = 400
const MAX_PPSF = 8000

const props = JSON.parse(fs.readFileSync(PROPERTIES, 'utf-8'))

let set = 0
let skippedHas = 0
let skippedNoText = 0
let skippedImplausible = 0
const plan = []

for (const p of props) {
  if (p.pricePerSqft) { skippedHas++; continue }
  const text = `${p.description ?? ''} ${p.shortDescription ?? ''}`
  const sizes = []
  for (const m of text.matchAll(SIZE_RE)) {
    const n = parseFloat(m[1].replace(/,/g, ''))
    if (Number.isFinite(n)) sizes.push(n)
  }
  if (sizes.length === 0) { skippedNoText++; continue }

  const plausible = [...new Set(sizes)]
    .filter(s => s >= MIN_UNIT_SQFT && s <= MAX_UNIT_SQFT)
    .filter(s => {
      const ppsf = p.priceAed / s
      return ppsf >= MIN_PPSF && ppsf <= MAX_PPSF
    })
    .sort((a, b) => a - b)

  if (plausible.length === 0) { skippedImplausible++; continue }

  const size = plausible[0] // smallest unit ↔ "from" price
  const ppsf = Math.round(p.priceAed / size)
  plan.push({ p, size, ppsf, multi: plausible.length > 1 })
  if (APPLY) p.pricePerSqft = ppsf
  set++
}

console.log(`${APPLY ? 'APPLY' : 'DRY-RUN'} — pricePerSqft seeding`)
console.log(`total: ${props.length} · will set: ${set} · already set: ${skippedHas} · no size in text: ${skippedNoText} · only implausible sizes: ${skippedImplausible}\n`)
for (const { p, size, ppsf, multi } of plan) {
  const flag = multi ? '  [several sizes — took smallest]' : ''
  console.log(`AED ${String(ppsf).padStart(5)}/sqft  =  ${String(p.priceAed).padStart(9)} / ${String(size).padStart(7)}  ·  ${p.title.slice(0, 55)}${flag}`)
}

if (APPLY) {
  // Atomic write: temp file + rename (same pattern as lib/json-store.ts).
  fs.writeFileSync(PROPERTIES + '.tmp', JSON.stringify(props, null, 2))
  fs.renameSync(PROPERTIES + '.tmp', PROPERTIES)
  console.log(`\nWrote ${set} pricePerSqft values. Now: npm run build && pm2 restart worldwise`)
} else {
  console.log('\nDry-run only. Re-run with --apply to write.')
}
