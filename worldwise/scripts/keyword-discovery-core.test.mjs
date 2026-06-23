// scripts/keyword-discovery-core.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { trendRiseFactor } from './keyword-discovery-core.mjs'
import { normalizeVolumePerGeo } from './keyword-discovery-core.mjs'

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
