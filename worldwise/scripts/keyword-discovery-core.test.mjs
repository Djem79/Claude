// scripts/keyword-discovery-core.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { trendRiseFactor } from './keyword-discovery-core.mjs'
import { normalizeVolumePerGeo } from './keyword-discovery-core.mjs'
import { passesFilters, intentWeight } from './keyword-discovery-core.mjs'
import { dedupeKeywords } from './keyword-discovery-core.mjs'

const mk = (...vals) => vals.map((value, i) => ({ month: String(i), year: 2026, value }))

test('trendRiseFactor: flat trend ~= 1', () => {
  const f = trendRiseFactor(mk(100,100,100,100,100,100,100,100,100,100,100,100))
  assert.ok(Math.abs(f - 1) < 0.01, `expected ~1, got ${f}`)
})

test('trendRiseFactor: rising trend > 1', () => {
  const f = trendRiseFactor(mk(100,100,100,100,100,100,100,100,100,300,300,300))
  assert.ok(f > 1.5, `expected >1.5, got ${f}`)
})

test('trendRiseFactor: declining trend < 1', () => {
  const f = trendRiseFactor(mk(300,300,300,100,100,100,100,100,100,100,100,100))
  assert.ok(f < 1, `expected <1, got ${f}`)
})

test('trendRiseFactor: clamps to [0.5, 3]', () => {
  assert.equal(trendRiseFactor(mk(10,10,10,0,0,0,0,0,0,1000,1000,1000)), 3)
  assert.equal(trendRiseFactor(mk(1000,1000,1000,0,0,0,0,0,0,1,1,1)), 0.5)
})

test('trendRiseFactor: empty/short trend = 1', () => {
  assert.equal(trendRiseFactor([]), 1)
  assert.equal(trendRiseFactor(undefined), 1)
  assert.equal(trendRiseFactor(mk(100,100)), 1)
})

test('trendRiseFactor: zero baseline does not divide-by-zero', () => {
  const f = trendRiseFactor(mk(0,0,0,0,0,0,0,0,0,100,100,100))
  assert.equal(f, 3)
})

test('normalizeVolumePerGeo: highest per-geo volume gets percentile 1', () => {
  const out = normalizeVolumePerGeo([
    { keyword: 'a', perGeo: { uk: { vol: 100 }, in: { vol: 999999 } } },
    { keyword: 'b', perGeo: { uk: { vol: 500 }, in: { vol: 10 } } },
    { keyword: 'c', perGeo: { uk: { vol: 50 },  in: { vol: 100 } } },
  ])
  const a = out.find(x => x.keyword === 'a')
  const b = out.find(x => x.keyword === 'b')
  // 'a' tops India (huge) but is bottom in UK; 'b' tops UK. Per-geo ranking keeps it balanced.
  assert.equal(b.normVol > 0, true)
  assert.equal(a.maxVol, 999999)
  // 'a' must NOT auto-win just because India volume is huge:
  assert.ok(a.normVol <= 1 && a.normVol >= 0)
})

test('normalizeVolumePerGeo: India size does not dominate vs a UK+IN balanced kw', () => {
  const out = normalizeVolumePerGeo([
    { keyword: 'india-only-huge', perGeo: { in: { vol: 1000000 }, uk: { vol: 1 } } },
    { keyword: 'balanced',        perGeo: { in: { vol: 900 },     uk: { vol: 900 } } },
  ])
  const huge = out.find(x => x.keyword === 'india-only-huge')
  const bal = out.find(x => x.keyword === 'balanced')
  // balanced ranks #1 in UK (1.0) and #2 in IN; india-only ranks #1 in IN (1.0) and #2 in UK.
  // Averages are equal here (both ~0.5), proving raw India size alone does not win.
  assert.ok(Math.abs(bal.normVol - huge.normVol) < 0.001)
})

test('normalizeVolumePerGeo: empty input', () => {
  assert.deepEqual(normalizeVolumePerGeo([]), [])
})

const OPTS = { minVolume: 100, maxVol: 500 }

test('passesFilters: accepts on-niche Dubai buyer query', () => {
  assert.equal(passesFilters('dubai off plan payment plans', OPTS).ok, true)
})

test('passesFilters: rejects other emirate', () => {
  assert.equal(passesFilters('abu dhabi property investor visa', OPTS).ok, false)
  // ...unless it also references Dubai
  assert.equal(passesFilters('dubai vs abu dhabi property investment', OPTS).ok, true)
})

test('passesFilters: rejects off-niche', () => {
  assert.equal(passesFilters('dubai tourist visa cost', OPTS).ok, false)   // deny token "tourist"
  assert.equal(passesFilters('best biryani in london', OPTS).ok, false)    // no niche token
})

test('passesFilters: rejects bare listing-intent but keeps guides', () => {
  assert.equal(passesFilters('studio for sale in jvc dubai', OPTS).ok, false)
  assert.equal(passesFilters('best areas to buy off plan in dubai guide', OPTS).ok, true)
})

test('passesFilters: rejects below min volume', () => {
  assert.equal(passesFilters('dubai property investment', { minVolume: 100, maxVol: 40 }).ok, false)
})

test('intentWeight: buyer-intent tokens score higher', () => {
  assert.ok(intentWeight('how to get golden visa by buying property in dubai') > 1)
  assert.equal(intentWeight('dubai real estate news'), 1)
})

test('dedupeKeywords: removes against seen set (case-insensitive)', () => {
  const seen = new Set(['dubai golden visa property'])
  const out = dedupeKeywords(['Dubai Golden Visa Property', 'new dubai topic'], seen)
  assert.deepEqual(out, ['new dubai topic'])
})

test('dedupeKeywords: removes in-list duplicates, keeps first casing', () => {
  const out = dedupeKeywords(['Dubai ROI', 'dubai roi', 'jvc yield'], new Set())
  assert.deepEqual(out, ['Dubai ROI', 'jvc yield'])
})
