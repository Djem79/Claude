// scripts/competitor-gap-core.test.mjs
// Unit tests for competitor-gap-core.mjs — run with: node --test scripts/competitor-gap-core.test.mjs

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  computeGap,
  isWinnable,
  scoreGap,
  selectGap,
  formatGapReport,
} from './competitor-gap-core.mjs'

// ---------------------------------------------------------------------------
// computeGap
// ---------------------------------------------------------------------------

test('computeGap: merges same keyword from two competitors into one entry with both sources', () => {
  const rows = [
    { keyword: 'Dubai marina apartment', domain: 'bayut.com', rank: 3, search_volume: 1200, keyword_difficulty: 35, cpc: 2.5, competition: 0.8 },
    { keyword: 'dubai marina apartment', domain: 'propertyfinder.ae', rank: 5, search_volume: 1000, keyword_difficulty: 30, cpc: 2.0, competition: 0.7 },
  ]
  const ourSet = new Set()
  const gap = computeGap(rows, ourSet)

  assert.equal(gap.length, 1, 'should be merged into one entry')
  const entry = gap[0]
  assert.equal(entry.keyword, 'Dubai marina apartment', 'should keep casing of first row')
  assert.equal(entry.sources.length, 2, 'should have two sources')
  assert.ok(entry.sources.some(s => s.domain === 'bayut.com'), 'should include bayut source')
  assert.ok(entry.sources.some(s => s.domain === 'propertyfinder.ae'), 'should include pf source')
  assert.equal(entry.search_volume, 1200, 'search_volume should be max')
  assert.equal(entry.keyword_difficulty, 30, 'keyword_difficulty should be min')
})

test('computeGap: excludes keyword present in ourSet (case-insensitive)', () => {
  const rows = [
    { keyword: 'Buy apartment Dubai', domain: 'bayut.com', rank: 2, search_volume: 500, keyword_difficulty: 40, cpc: 3.0, competition: 0.9 },
    { keyword: 'Dubai marina property', domain: 'bayut.com', rank: 4, search_volume: 800, keyword_difficulty: 25, cpc: 1.5, competition: 0.6 },
  ]
  const ourSet = new Set(['buy apartment dubai'])
  const gap = computeGap(rows, ourSet)

  assert.equal(gap.length, 1, 'should exclude keyword in ourSet')
  assert.equal(gap[0].keyword, 'Dubai marina property')
})

test('computeGap: cpc and competition come from highest-volume row', () => {
  const rows = [
    { keyword: 'invest in dubai', domain: 'a.com', rank: 1, search_volume: 500, keyword_difficulty: 20, cpc: 1.0, competition: 0.3 },
    { keyword: 'invest in dubai', domain: 'b.com', rank: 2, search_volume: 2000, keyword_difficulty: 25, cpc: 4.0, competition: 0.9 },
  ]
  const gap = computeGap(rows, new Set())
  assert.equal(gap[0].cpc, 4.0, 'cpc from highest-volume row')
  assert.equal(gap[0].competition, 0.9, 'competition from highest-volume row')
})

test('computeGap: treats null keyword_difficulty as not-present (real number wins)', () => {
  const rows = [
    { keyword: 'dubai villa buy', domain: 'x.com', rank: 1, search_volume: 300, keyword_difficulty: null, cpc: 1.0, competition: 0.5 },
    { keyword: 'Dubai Villa Buy', domain: 'y.com', rank: 2, search_volume: 200, keyword_difficulty: 28, cpc: 1.2, competition: 0.4 },
  ]
  const gap = computeGap(rows, new Set())
  assert.equal(gap[0].keyword_difficulty, 28, 'real KD wins over null')
})

test('computeGap: all-null keyword_difficulty stays null', () => {
  const rows = [
    { keyword: 'dubai property investment', domain: 'x.com', rank: 1, search_volume: 300, keyword_difficulty: null, cpc: 1.0, competition: 0.5 },
    { keyword: 'Dubai Property Investment', domain: 'y.com', rank: 2, search_volume: 200, keyword_difficulty: null, cpc: 1.2, competition: 0.4 },
  ]
  const gap = computeGap(rows, new Set())
  assert.equal(gap[0].keyword_difficulty, null, 'all-null stays null')
})

// ---------------------------------------------------------------------------
// isWinnable
// ---------------------------------------------------------------------------

test('isWinnable: accepts an in-range candidate', () => {
  const cand = { search_volume: 500, keyword_difficulty: 35 }
  assert.ok(isWinnable(cand, { maxDifficulty: 40, minVolume: 100, maxVolume: 20000 }))
})

test('isWinnable: rejects KD > maxDifficulty', () => {
  const cand = { search_volume: 500, keyword_difficulty: 55 }
  assert.ok(!isWinnable(cand, { maxDifficulty: 40, minVolume: 100, maxVolume: 20000 }))
})

test('isWinnable: rejects vol < minVolume', () => {
  const cand = { search_volume: 50, keyword_difficulty: 30 }
  assert.ok(!isWinnable(cand, { maxDifficulty: 40, minVolume: 100, maxVolume: 20000 }))
})

test('isWinnable: rejects vol > maxVolume', () => {
  const cand = { search_volume: 50000, keyword_difficulty: 30 }
  assert.ok(!isWinnable(cand, { maxDifficulty: 40, minVolume: 100, maxVolume: 20000 }))
})

test('isWinnable: rejects null KD (treated as 100)', () => {
  const cand = { search_volume: 500, keyword_difficulty: null }
  assert.ok(!isWinnable(cand, { maxDifficulty: 40, minVolume: 100, maxVolume: 20000 }))
})

// ---------------------------------------------------------------------------
// scoreGap
// ---------------------------------------------------------------------------

test('scoreGap: higher score for higher volume', () => {
  const lowVol  = { keyword: 'dubai property investment', search_volume: 200, keyword_difficulty: 30 }
  const highVol = { keyword: 'dubai property investment', search_volume: 1000, keyword_difficulty: 30 }
  assert.ok(scoreGap(highVol) > scoreGap(lowVol), 'higher volume → higher score')
})

test('scoreGap: lower score for higher difficulty', () => {
  const lowKd  = { keyword: 'dubai property investment', search_volume: 500, keyword_difficulty: 10 }
  const highKd = { keyword: 'dubai property investment', search_volume: 500, keyword_difficulty: 80 }
  assert.ok(scoreGap(lowKd) > scoreGap(highKd), 'lower KD → higher score')
})

test('scoreGap: null KD treated as 100', () => {
  const nullKd = { keyword: 'dubai apartment buy', search_volume: 500, keyword_difficulty: null }
  const kd100  = { keyword: 'dubai apartment buy', search_volume: 500, keyword_difficulty: 100 }
  assert.equal(scoreGap(nullKd), scoreGap(kd100))
})

// ---------------------------------------------------------------------------
// selectGap
// ---------------------------------------------------------------------------

test('selectGap: end-to-end pipeline', () => {
  // Build a varied set of input rows:
  const rows = [
    // Should appear: in-niche, winnable, good score
    { keyword: 'dubai investment property guide', domain: 'betterhomes.ae', rank: 4, search_volume: 500,   keyword_difficulty: 30, cpc: 2.0, competition: 0.5 },
    { keyword: 'off plan property dubai investor', domain: 'famproperties.com', rank: 3, search_volume: 800, keyword_difficulty: 25, cpc: 2.5, competition: 0.6 },
    { keyword: 'dubai apartment buy mortgage',    domain: 'metropolitan.realestate', rank: 5, search_volume: 600, keyword_difficulty: 28, cpc: 1.8, competition: 0.4 },
    // Excluded: in ourSet
    { keyword: 'dubai marina apartment',          domain: 'bayut.com', rank: 2, search_volume: 700, keyword_difficulty: 20, cpc: 3.0, competition: 0.7 },
    // Excluded: in bankSeen
    { keyword: 'best area dubai invest',          domain: 'propertyfinder.ae', rank: 6, search_volume: 400, keyword_difficulty: 22, cpc: 1.2, competition: 0.3 },
    // Excluded: other emirate (no Dubai mention)
    { keyword: 'abu dhabi property investment',   domain: 'drivenproperties.com', rank: 5, search_volume: 500, keyword_difficulty: 30, cpc: 1.5, competition: 0.5 },
    // Excluded: non-winnable (too high difficulty)
    { keyword: 'dubai real estate property buy',  domain: 'dubizzle.com', rank: 1, search_volume: 18000, keyword_difficulty: 90, cpc: 5.0, competition: 0.95 },
    // Excluded: too high volume (head term giant portals own)
    { keyword: 'dubai villa freehold roi',        domain: 'bayut.com', rank: 1, search_volume: 25000, keyword_difficulty: 35, cpc: 4.0, competition: 0.85 },
  ]

  const ourSet = new Set(['dubai marina apartment'])
  const bankSeen = new Set(['best area dubai invest'])

  const opts = {
    bankSeen,
    maxDifficulty: 40,
    minVolume: 100,
    maxVolume: 20000,
    n: 10,
    maxPerTheme: 2,
  }

  const result = selectGap(rows, ourSet, opts)

  // Must exclude ourSet entry
  assert.ok(!result.some(r => r.keyword.toLowerCase() === 'dubai marina apartment'), 'ourSet excluded')
  // Must exclude bankSeen entry
  assert.ok(!result.some(r => r.keyword.toLowerCase() === 'best area dubai invest'), 'bankSeen excluded')
  // Must exclude other-emirate keyword
  assert.ok(!result.some(r => r.keyword.toLowerCase().includes('abu dhabi')), 'other emirate excluded')
  // Must exclude over-difficult entry
  assert.ok(!result.some(r => r.keyword_difficulty > 40), 'over-difficult excluded')
  // Must exclude over-volume head term
  assert.ok(!result.some(r => (r.search_volume || 0) > 20000), 'too-high volume excluded')
  // Results should be sorted by score descending
  for (let i = 1; i < result.length; i++) {
    assert.ok(result[i - 1].score >= result[i].score, `sorted desc at index ${i}`)
  }
  // Each result has a score
  for (const r of result) {
    assert.ok(typeof r.score === 'number', 'has numeric score')
  }
})

test('selectGap: caps theme to maxPerTheme', () => {
  // Three keywords sharing the same first significant token "apartment"
  const rows = [
    { keyword: 'dubai apartment buy guide',       domain: 'a.com', rank: 1, search_volume: 800, keyword_difficulty: 25, cpc: 2.0, competition: 0.5 },
    { keyword: 'dubai apartment investment tips',  domain: 'b.com', rank: 2, search_volume: 700, keyword_difficulty: 22, cpc: 1.8, competition: 0.4 },
    { keyword: 'dubai apartment mortgage roi',     domain: 'c.com', rank: 3, search_volume: 600, keyword_difficulty: 20, cpc: 1.5, competition: 0.3 },
  ]
  const result = selectGap(rows, new Set(), {
    maxDifficulty: 40, minVolume: 100, maxVolume: 20000, n: 10, maxPerTheme: 2,
  })
  // At most 2 from the same theme
  const themeHits = result.filter(r => r.keyword.toLowerCase().includes('apartment'))
  assert.ok(themeHits.length <= 2, `theme capped to 2, got ${themeHits.length}`)
})

test('selectGap: respects n limit', () => {
  const rows = Array.from({ length: 20 }, (_, i) => ({
    keyword: `dubai property investment tip ${i}`,
    domain: 'a.com',
    rank: i + 1,
    search_volume: 500 - i * 10,
    keyword_difficulty: 20,
    cpc: 1.0,
    competition: 0.4,
  }))
  const result = selectGap(rows, new Set(), {
    maxDifficulty: 40, minVolume: 100, maxVolume: 20000, n: 5, maxPerTheme: 10,
  })
  assert.ok(result.length <= 5, `n respected, got ${result.length}`)
})

test('selectGap: returns highest-score first', () => {
  const rows = [
    { keyword: 'dubai villa buy freehold',         domain: 'a.com', rank: 1, search_volume: 1000, keyword_difficulty: 15, cpc: 3.0, competition: 0.6 },
    { keyword: 'dubai apartment investment guide',  domain: 'b.com', rank: 2, search_volume: 200,  keyword_difficulty: 38, cpc: 1.0, competition: 0.2 },
  ]
  const result = selectGap(rows, new Set(), {
    maxDifficulty: 40, minVolume: 100, maxVolume: 20000, n: 5, maxPerTheme: 5,
  })
  if (result.length >= 2) {
    assert.ok(result[0].score >= result[1].score, 'highest score first')
  }
})

// ---------------------------------------------------------------------------
// formatGapReport
// ---------------------------------------------------------------------------

test('formatGapReport: returns empty message when items is empty', () => {
  const msg = formatGapReport([])
  assert.equal(msg, 'No new competitor-gap keywords this month.')
})

test('formatGapReport: includes keyword, vol, KD, cpc, and sources in output', () => {
  const items = [
    {
      keyword: 'dubai investment property',
      search_volume: 800,
      keyword_difficulty: 32,
      cpc: 2.75,
      competition: 0.6,
      sources: [
        { domain: 'bayut.com', rank: 3 },
        { domain: 'betterhomes.ae', rank: 7 },
      ],
    },
  ]
  const msg = formatGapReport(items)
  assert.ok(msg.includes('dubai investment property'), 'includes keyword')
  assert.ok(msg.includes('800'), 'includes volume')
  assert.ok(msg.includes('32'), 'includes KD')
  assert.ok(msg.includes('2.75'), 'includes cpc')
  assert.ok(msg.includes('bayut.com #3'), 'includes first source')
  assert.ok(msg.includes('betterhomes.ae #7'), 'includes second source')
  assert.ok(msg.includes('1 opportunities'), 'includes count in header')
})

test('formatGapReport: caps sources to first 3', () => {
  const items = [
    {
      keyword: 'dubai property roi',
      search_volume: 500,
      keyword_difficulty: 28,
      cpc: 1.5,
      competition: 0.5,
      sources: [
        { domain: 'a.com', rank: 1 },
        { domain: 'b.com', rank: 2 },
        { domain: 'c.com', rank: 3 },
        { domain: 'd.com', rank: 4 },
      ],
    },
  ]
  const msg = formatGapReport(items)
  assert.ok(!msg.includes('d.com'), '4th source capped out')
  assert.ok(msg.includes('a.com'), '1st source present')
  assert.ok(msg.includes('b.com'), '2nd source present')
  assert.ok(msg.includes('c.com'), '3rd source present')
})

test('formatGapReport: handles null/undefined vol and KD gracefully', () => {
  const items = [
    {
      keyword: 'golden visa dubai property',
      search_volume: null,
      keyword_difficulty: undefined,
      cpc: null,
      competition: null,
      sources: [{ domain: 'x.com', rank: 5 }],
    },
  ]
  const msg = formatGapReport(items)
  assert.ok(msg.includes('golden visa dubai property'), 'keyword present')
  assert.ok(msg.includes('n/a'), 'n/a for nulls')
})
