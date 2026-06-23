// scripts/ads-feed-core.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  adsVol, adsCpc, adsCompetition,
  adGroupBucket, matchType,
  buildAddSuggestions, buildNegatives,
  formatClaudeChromePrompt,
} from './ads-feed-core.mjs'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal enriched candidate. */
const mkC = (keyword, perGeo) => ({ keyword, perGeo })

// ---------------------------------------------------------------------------
// adGroupBucket
// ---------------------------------------------------------------------------

test('adGroupBucket: golden visa → investor', () => {
  assert.equal(adGroupBucket('dubai golden visa property investment'), 'investor')
})

test('adGroupBucket: residence visa → investor', () => {
  assert.equal(adGroupBucket('residence visa dubai property'), 'investor')
})

test('adGroupBucket: residency keyword → investor', () => {
  assert.equal(adGroupBucket('Dubai residency by real estate'), 'investor')
})

test('adGroupBucket: damac → developer', () => {
  assert.equal(adGroupBucket('damac lagoons payment plan'), 'developer')
})

test('adGroupBucket: off-plan → developer', () => {
  assert.equal(adGroupBucket('best off plan projects in dubai 2024'), 'developer')
})

test('adGroupBucket: off plan (with space) → developer', () => {
  assert.equal(adGroupBucket('dubai off plan apartments'), 'developer')
})

test('adGroupBucket: roi/yield → investor (not developer)', () => {
  assert.equal(adGroupBucket('dubai rental yield by area'), 'investor')
})

test('adGroupBucket: generic buyer query → buyer', () => {
  assert.equal(adGroupBucket('dubai property prices 2024'), 'buyer')
})

test('adGroupBucket: case-insensitive check', () => {
  assert.equal(adGroupBucket('Emaar Hills Development'), 'developer')
})

// Visa/residency check has priority over developer tokens
test('adGroupBucket: golden visa beats developer tokens', () => {
  assert.equal(adGroupBucket('emaar golden visa dubai'), 'investor')
})

// ---------------------------------------------------------------------------
// matchType
// ---------------------------------------------------------------------------

test('matchType: 2-word phrase → exact', () => {
  assert.equal(matchType('dubai property'), 'exact')
})

test('matchType: 3-word phrase → exact', () => {
  assert.equal(matchType('dubai off plan'), 'exact')
})

test('matchType: 4-word phrase → phrase', () => {
  assert.equal(matchType('buy off plan apartment in dubai'), 'phrase')
})

test('matchType: 1-word → exact', () => {
  assert.equal(matchType('dubai'), 'exact')
})

test('matchType: trims leading/trailing whitespace before counting', () => {
  assert.equal(matchType('  dubai property  '), 'exact')
})

// ---------------------------------------------------------------------------
// adsVol: India excluded
// ---------------------------------------------------------------------------

test('adsVol: sums uk + ae, ignores in', () => {
  const c = mkC('x', { uk: { vol: 300 }, ae: { vol: 200 }, in: { vol: 100000 } })
  assert.equal(adsVol(c), 500)
})

test('adsVol: missing geos default to 0', () => {
  const c = mkC('x', { uk: { vol: 400 } })
  assert.equal(adsVol(c), 400)
})

test('adsVol: no perGeo → 0', () => {
  assert.equal(adsVol({ keyword: 'x' }), 0)
})

// ---------------------------------------------------------------------------
// adsCpc / adsCompetition
// ---------------------------------------------------------------------------

test('adsCpc: returns max of uk/ae cpc', () => {
  const c = mkC('x', { uk: { cpc: 1.5 }, ae: { cpc: 3.2 } })
  assert.equal(adsCpc(c), 3.2)
})

test('adsCompetition: prefers uk, falls back to ae', () => {
  assert.equal(adsCompetition(mkC('x', { uk: { competition: 'HIGH' }, ae: { competition: 'LOW' } })), 'HIGH')
  assert.equal(adsCompetition(mkC('x', { ae: { competition: 'MEDIUM' } })), 'MEDIUM')
  assert.equal(adsCompetition(mkC('x', {})), null)
})

// ---------------------------------------------------------------------------
// buildAddSuggestions
// ---------------------------------------------------------------------------

/** Build a passing Dubai investment candidate with given uk+ae vols. */
const goodC = (keyword, ukVol, aeVol = 0, extras = {}) => mkC(keyword, {
  uk: { vol: ukVol, cpc: 1.2, competition: 'MEDIUM', ...extras },
  ...(aeVol ? { ae: { vol: aeVol, cpc: 0.8, competition: 'LOW' } } : {}),
})

test('buildAddSuggestions: excludes below minAdsVol', () => {
  const enriched = [
    goodC('dubai property investment guide', 50, 20),  // adsVol = 70, below 100
    goodC('dubai off plan apartments', 200, 50),        // adsVol = 250, passes
  ]
  const out = buildAddSuggestions(enriched, { minAdsVol: 100, n: 10, seen: new Set() })
  assert.equal(out.length, 1)
  assert.equal(out[0].keyword, 'dubai off plan apartments')
})

test('buildAddSuggestions: excludes keywords in seen set', () => {
  const enriched = [goodC('dubai off plan apartments', 500)]
  const seen = new Set(['dubai off plan apartments'])
  const out = buildAddSuggestions(enriched, { minAdsVol: 0, n: 10, seen })
  assert.equal(out.length, 0)
})

test('buildAddSuggestions: seen comparison is case-insensitive', () => {
  const enriched = [goodC('Dubai Off Plan Apartments', 500)]
  const seen = new Set(['dubai off plan apartments'])
  const out = buildAddSuggestions(enriched, { minAdsVol: 0, n: 10, seen })
  assert.equal(out.length, 0)
})

test('buildAddSuggestions: excludes other-emirate candidate', () => {
  const otherEmirate = mkC('abu dhabi property investment', { uk: { vol: 1000, cpc: 2.0 } })
  const good = goodC('dubai property investment guide', 500)
  const out = buildAddSuggestions([otherEmirate, good], { minAdsVol: 0, n: 10, seen: new Set() })
  const kws = out.map(o => o.keyword)
  assert.ok(!kws.includes('abu dhabi property investment'))
  assert.ok(kws.includes('dubai property investment guide'))
})

test('buildAddSuggestions: excludes listing-intent (for sale) candidate', () => {
  const listing = mkC('studio for sale in dubai marina', { uk: { vol: 800, cpc: 2.0 } })
  const good = goodC('dubai property investment guide', 400)
  const out = buildAddSuggestions([listing, good], { minAdsVol: 0, n: 10, seen: new Set() })
  assert.ok(!out.map(o => o.keyword).includes('studio for sale in dubai marina'))
})

test('buildAddSuggestions: ranks by adsVol × intent, higher intent wins tie', () => {
  const highIntent = goodC('dubai golden visa investment', 200)    // intentWeight > 1
  const noIntent = goodC('dubai real estate market news', 250)     // intentWeight = 1
  // adsVol scores: highIntent = 200 * 1.3 = 260, noIntent = 250 * 1.0 = 250 → highIntent wins
  const out = buildAddSuggestions([noIntent, highIntent], { minAdsVol: 0, n: 10, seen: new Set() })
  assert.equal(out[0].keyword, 'dubai golden visa investment')
})

test('buildAddSuggestions: India-only volume excluded from ranking', () => {
  const indiaOnly = mkC('dubai property investment guide', { in: { vol: 100000 } })
  const ukGood = goodC('dubai off plan apartments', 500)
  // indiaOnly has adsVol=0 (India excluded) → should be filtered out at minAdsVol=100
  const out = buildAddSuggestions([indiaOnly, ukGood], { minAdsVol: 100, n: 10, seen: new Set() })
  assert.ok(!out.map(o => o.keyword).includes('dubai property investment guide'))
})

test('buildAddSuggestions: respects n', () => {
  const enriched = [
    goodC('dubai property investment guide', 500),
    goodC('dubai off plan apartments', 400),
    goodC('dubai rental yield areas', 300),
    goodC('emaar payment plan 2024', 600),
  ]
  const out = buildAddSuggestions(enriched, { minAdsVol: 0, n: 2, seen: new Set() })
  assert.equal(out.length, 2)
})

test('buildAddSuggestions: output has correct shape with bucket + matchType', () => {
  // 'emaar dubai invest' = 3 words → exact; emaar → developer bucket
  const enriched = [goodC('emaar dubai invest', 300)]
  const out = buildAddSuggestions(enriched, { minAdsVol: 0, n: 10, seen: new Set() })
  assert.equal(out.length, 1)
  const item = out[0]
  assert.equal(item.bucket, 'developer')              // emaar → developer
  assert.equal(item.matchType, 'exact')               // 3 words → exact
  assert.ok(typeof item.adsVol === 'number')
  assert.ok(typeof item.cpc === 'number')
})

test('buildAddSuggestions: phrase matchType for long keyword', () => {
  const enriched = [goodC('buy off plan apartment in dubai marina', 300)]
  const out = buildAddSuggestions(enriched, { minAdsVol: 0, n: 10, seen: new Set() })
  assert.equal(out[0].matchType, 'phrase')
})

// ---------------------------------------------------------------------------
// buildNegatives
// ---------------------------------------------------------------------------

test('buildNegatives: catches other-emirate term', () => {
  const enriched = [
    mkC('sharjah property for sale', { uk: { vol: 500 } }),
    goodC('dubai property investment guide', 400),
  ]
  const out = buildNegatives(enriched, { seen: new Set(), minNegVol: 0 })
  assert.ok(out.includes('sharjah property for sale'))
  assert.ok(!out.includes('dubai property investment guide'))
})

test('buildNegatives: catches waste-token "cheap"', () => {
  const enriched = [
    mkC('cheap dubai apartments for rent', { uk: { vol: 300 } }),
    goodC('dubai off plan investment', 400),
  ]
  const out = buildNegatives(enriched, { seen: new Set(), minNegVol: 0 })
  assert.ok(out.includes('cheap dubai apartments for rent'))
  assert.ok(!out.includes('dubai off plan investment'))
})

test('buildNegatives: catches waste-token "rent" and "for rent"', () => {
  const enriched = [
    mkC('dubai apartments for rent', { uk: { vol: 200 } }),
    mkC('rent studio dubai marina', { uk: { vol: 150 } }),
  ]
  const out = buildNegatives(enriched, { seen: new Set(), minNegVol: 0 })
  assert.ok(out.includes('dubai apartments for rent'))
  assert.ok(out.includes('rent studio dubai marina'))
})

test('buildNegatives: respects minNegVol', () => {
  const enriched = [
    mkC('cheap dubai flats', { uk: { vol: 30 } }),  // adsVol = 30 < 50
    mkC('jobs in dubai real estate', { uk: { vol: 100 } }),  // adsVol = 100 >= 50
  ]
  const out = buildNegatives(enriched, { seen: new Set(), minNegVol: 50 })
  assert.ok(!out.includes('cheap dubai flats'))
  assert.ok(out.includes('jobs in dubai real estate'))
})

test('buildNegatives: deduplicates against seen set', () => {
  const enriched = [mkC('abu dhabi luxury villas', { uk: { vol: 200 } })]
  const seen = new Set(['abu dhabi luxury villas'])
  const out = buildNegatives(enriched, { seen, minNegVol: 0 })
  assert.equal(out.length, 0)
})

test('buildNegatives: deduplicates within returned list', () => {
  // Same keyword reached via two different paths (waste token + other-emirate both match)
  const enriched = [
    mkC('abu dhabi cheap apartments', { uk: { vol: 200 } }),
  ]
  const out = buildNegatives(enriched, { seen: new Set(), minNegVol: 0 })
  assert.equal(out.length, 1)
})

test('buildNegatives: sorted by adsVol desc', () => {
  const enriched = [
    mkC('cheap apartments dubai', { uk: { vol: 100 }, ae: { vol: 50 } }),  // adsVol 150
    mkC('rent villa dubai marina', { uk: { vol: 400 } }),                  // adsVol 400
    mkC('abu dhabi investment',    { uk: { vol: 250 } }),                  // adsVol 250
  ]
  const out = buildNegatives(enriched, { seen: new Set(), minNegVol: 0 })
  const vols = out.map(kw => {
    const c = enriched.find(e => e.keyword === kw)
    return adsVol(c)
  })
  for (let i = 1; i < vols.length; i++) {
    assert.ok(vols[i - 1] >= vols[i], `Not sorted at index ${i}`)
  }
})

// ---------------------------------------------------------------------------
// formatClaudeChromePrompt
// ---------------------------------------------------------------------------

const sampleAdds = [
  { keyword: 'dubai property investment guide', adsVol: 500, cpc: 1.2, competition: 'MEDIUM', bucket: 'buyer', matchType: 'phrase' },
  { keyword: 'emaar off plan dubai', adsVol: 400, cpc: 2.1, competition: 'HIGH', bucket: 'developer', matchType: 'exact' },
  { keyword: 'dubai golden visa', adsVol: 350, cpc: 3.0, competition: 'HIGH', bucket: 'investor', matchType: 'exact' },
]
const sampleNegatives = ['cheap dubai apartments for rent', 'abu dhabi property for sale']

test('formatClaudeChromePrompt: phrase uses "keyword" syntax', () => {
  const prompt = formatClaudeChromePrompt(sampleAdds, [])
  assert.ok(prompt.includes('"dubai property investment guide"'),
    'Phrase keyword must be wrapped in double quotes')
})

test('formatClaudeChromePrompt: exact uses [keyword] syntax', () => {
  const prompt = formatClaudeChromePrompt(sampleAdds, [])
  assert.ok(prompt.includes('[emaar off plan dubai]'), 'Exact keyword must be wrapped in square brackets')
  assert.ok(prompt.includes('[dubai golden visa]'), 'Exact keyword must be wrapped in square brackets')
})

test('formatClaudeChromePrompt: negatives section present when negatives provided', () => {
  const prompt = formatClaudeChromePrompt(sampleAdds, sampleNegatives)
  assert.ok(prompt.includes('Negative keywords'), 'Must include a negatives section')
  assert.ok(prompt.includes('cheap dubai apartments for rent'))
  assert.ok(prompt.includes('abu dhabi property for sale'))
})

test('formatClaudeChromePrompt: negatives section omitted when empty', () => {
  const prompt = formatClaudeChromePrompt(sampleAdds, [])
  assert.ok(!prompt.includes('Negative keywords'), 'Negatives section must be absent when list is empty')
})

test('formatClaudeChromePrompt: guardrail line present', () => {
  const prompt = formatClaudeChromePrompt(sampleAdds, sampleNegatives)
  assert.ok(prompt.includes('Change History'), 'Guardrail mentioning Change History must be present')
  assert.ok(prompt.includes('reversible'), 'Guardrail must say reversible')
})

test('formatClaudeChromePrompt: empty adds returns "No new keywords" message', () => {
  const prompt = formatClaudeChromePrompt([], sampleNegatives)
  assert.ok(prompt.includes('No new keywords to add this week.'))
})

test('formatClaudeChromePrompt: groups by bucket', () => {
  const prompt = formatClaudeChromePrompt(sampleAdds, [])
  // All three buckets represented
  assert.ok(prompt.includes('Buyer') || prompt.includes('buyer'))
  assert.ok(prompt.includes('Developer') || prompt.includes('developer'))
  assert.ok(prompt.includes('Investor') || prompt.includes('investor'))
})

test('formatClaudeChromePrompt: step-by-step instructions present', () => {
  const prompt = formatClaudeChromePrompt(sampleAdds, sampleNegatives)
  assert.ok(prompt.includes('Search campaign'), 'Must mention Search campaign')
  assert.ok(prompt.includes('Keywords'), 'Must mention Keywords')
})
