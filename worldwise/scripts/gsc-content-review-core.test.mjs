// scripts/gsc-content-review-core.test.mjs
// Run: node --test scripts/gsc-content-review-core.test.mjs

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { classifyPages, formatReport } from './gsc-content-review-core.mjs'

// ---------------------------------------------------------------------------
// classifyPages — bucket membership
// ---------------------------------------------------------------------------

test('rising page goes into winners with deltaPct', () => {
  const current  = [{ page: 'https://worldwise.pro/dubai-marina', clicks: 10, impressions: 100, ctr: 0.10, position: 5.0 }]
  const previous = [{ page: 'https://worldwise.pro/dubai-marina', clicks:  5, impressions:  60, ctr: 0.08, position: 5.5 }]
  const { winners } = classifyPages(current, previous)
  assert.equal(winners.length, 1)
  assert.equal(winners[0].page, 'https://worldwise.pro/dubai-marina')
  // (100 - 60) / 60 = 66.6% → Math.round → 67
  assert.equal(winners[0].deltaPct, 67)
})

test('page that fell >= 30% from a >= 20 base goes into decaying', () => {
  const current  = [{ page: 'https://worldwise.pro/blog/some-article', clicks: 1, impressions: 10, ctr: 0.05, position: 12 }]
  const previous = [{ page: 'https://worldwise.pro/blog/some-article', clicks: 5, impressions: 50, ctr: 0.10, position:  9 }]
  const { decaying } = classifyPages(current, previous)
  assert.equal(decaying.length, 1)
  // (10 - 50) / 50 = -80% → Math.round → -80
  assert.equal(decaying[0].deltaPct, -80)
})

test('pos-12 page with >= 30 impressions goes into strikingDistance', () => {
  const current  = [{ page: 'https://worldwise.pro/downtown-dubai', clicks: 2, impressions: 40, ctr: 0.05, position: 12.3 }]
  const previous = []
  const { strikingDistance } = classifyPages(current, previous)
  assert.equal(strikingDistance.length, 1)
  assert.equal(strikingDistance[0].page, 'https://worldwise.pro/downtown-dubai')
})

test('pos-5 page with >= 50 impressions and < 1% CTR goes into lowCtr', () => {
  const current  = [{ page: 'https://worldwise.pro/mortgage-calculator', clicks: 0, impressions: 80, ctr: 0.005, position: 5.0 }]
  const previous = []
  const { lowCtr } = classifyPages(current, previous)
  assert.equal(lowCtr.length, 1)
  assert.equal(lowCtr[0].page, 'https://worldwise.pro/mortgage-calculator')
})

test('below-threshold pages are excluded', () => {
  // impressions below minWinnerImpr (20) — winner gate
  const current  = [{ page: 'https://worldwise.pro/tiny', clicks: 1, impressions: 5, ctr: 0.20, position: 3.0 }]
  const previous = [{ page: 'https://worldwise.pro/tiny', clicks: 0, impressions: 2, ctr: 0.00, position: 4.0 }]
  const { winners, decaying, strikingDistance, lowCtr } = classifyPages(current, previous)
  assert.equal(winners.length, 0)
  assert.equal(decaying.length, 0)
  assert.equal(strikingDistance.length, 0)
  assert.equal(lowCtr.length, 0)
})

test('cap is respected', () => {
  // 10 winning pages, cap defaults to 8
  const current = Array.from({ length: 10 }, (_, i) => ({
    page: `https://worldwise.pro/page-${i}`,
    clicks: i,
    impressions: 100 + i,
    ctr: 0.05,
    position: 15.0,
  }))
  const previous = Array.from({ length: 10 }, (_, i) => ({
    page: `https://worldwise.pro/page-${i}`,
    clicks: 0,
    impressions: 20,   // all rise by >=30%
    ctr: 0.02,
    position: 16.0,
  }))
  const { winners } = classifyPages(current, previous)
  assert.equal(winners.length, 8)
})

test('a page can appear in two buckets (strikingDistance + lowCtr)', () => {
  // pos 9: within strikingDistance (8–20) AND within lowCtr (<= 10); 0% CTR, 60 impressions
  const current  = [{ page: 'https://worldwise.pro/golden-visa', clicks: 0, impressions: 60, ctr: 0.000, position: 9.0 }]
  const previous = []
  const { strikingDistance, lowCtr } = classifyPages(current, previous)
  assert.equal(strikingDistance.length, 1)
  assert.equal(lowCtr.length, 1)
  assert.equal(strikingDistance[0].page, lowCtr[0].page)
})

// ---------------------------------------------------------------------------
// formatReport — output shape
// ---------------------------------------------------------------------------

test('formatReport includes correct recommendation text and item line for winners', () => {
  const buckets = {
    winners: [{ page: 'https://worldwise.pro/dubai-marina', impressions: 120, position: 4.5, ctr: 0.08, deltaPct: 50 }],
    decaying: [],
    strikingDistance: [],
    lowCtr: [],
  }
  const report = formatReport(buckets, { days: 28 })
  assert.ok(report.toLowerCase().includes('double down'), `Expected "double down" in: ${report}`)
  assert.ok(report.includes('/dubai-marina'), `Expected path in: ${report}`)
  assert.ok(report.includes('impr 120'), `Expected impression count in: ${report}`)
  assert.ok(report.includes('Δ+50%'), `Expected deltaPct in: ${report}`)
})

test('formatReport includes correct recommendation text for decaying', () => {
  const buckets = {
    winners: [],
    decaying: [{ page: 'https://worldwise.pro/blog/old', impressions: 10, position: 18.2, ctr: 0.02, deltaPct: -45 }],
    strikingDistance: [],
    lowCtr: [],
  }
  const report = formatReport(buckets, { days: 28 })
  assert.ok(report.includes('Investigate/refresh'), `Expected recommendation in: ${report}`)
  assert.ok(report.includes('Δ-45%'), `Expected deltaPct in: ${report}`)
})

test('formatReport includes correct recommendation for strikingDistance', () => {
  const buckets = {
    winners: [],
    decaying: [],
    strikingDistance: [{ page: 'https://worldwise.pro/palm-jumeirah', impressions: 45, position: 11.3, ctr: 0.04 }],
    lowCtr: [],
  }
  const report = formatReport(buckets, { days: 28 })
  assert.ok(report.includes('Push to page 1'), `Expected recommendation in: ${report}`)
  assert.ok(report.includes('/palm-jumeirah'), `Expected path in: ${report}`)
})

test('formatReport includes correct recommendation for lowCtr', () => {
  const buckets = {
    winners: [],
    decaying: [],
    strikingDistance: [],
    lowCtr: [{ page: 'https://worldwise.pro/mortgage-calculator', impressions: 200, position: 6.0, ctr: 0.003 }],
  }
  const report = formatReport(buckets, { days: 28 })
  assert.ok(report.includes('Rewrite title/meta'), `Expected recommendation in: ${report}`)
  assert.ok(report.includes('/mortgage-calculator'), `Expected path in: ${report}`)
})

test('formatReport returns empty-data message when all buckets empty', () => {
  const buckets = { winners: [], decaying: [], strikingDistance: [], lowCtr: [] }
  const report = formatReport(buckets)
  assert.ok(report.includes('No actionable content signals'), `Expected fallback message in: ${report}`)
})

test('formatReport header includes the days count', () => {
  const buckets = {
    winners: [{ page: '/x', impressions: 30, position: 3.0, ctr: 0.05, deltaPct: 40 }],
    decaying: [], strikingDistance: [], lowCtr: [],
  }
  const report = formatReport(buckets, { days: 14 })
  assert.ok(report.includes('last 14d'), `Expected days in header: ${report}`)
})
