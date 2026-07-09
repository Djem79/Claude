// node --test scripts/backlink-monitor-core.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { summarizeProfile, buildDomainsState, computeDomainDeltas, formatBacklinkReport } from './backlink-monitor-core.mjs'

test('summarizeProfile picks fields and coerces missing to 0', () => {
  const s = summarizeProfile({ rank: 12, backlinks: 34, referring_domains: 9, referring_main_domains: 8 })
  assert.equal(s.rank, 12)
  assert.equal(s.backlinks, 34)
  assert.equal(s.referringDomains, 9)
  assert.equal(s.referringDomainsNofollow, 0)
  assert.equal(s.brokenBacklinks, 0)
  const empty = summarizeProfile(undefined)
  assert.equal(empty.rank, 0)
  assert.equal(empty.backlinks, 0)
})

test('buildDomainsState maps items and derives the dofollow flag', () => {
  const state = buildDomainsState([
    { domain: 'expat.com', rank: 45, backlinks: 2, referring_pages: 2, referring_pages_nofollow: 0, first_seen: '2026-07-01 00:00:00 +00:00' },
    { domain: 'hidubai.com', rank: 30, backlinks: 1, referring_pages: 1, referring_pages_nofollow: 1 },
    { notdomain: true },
  ])
  assert.deepEqual(Object.keys(state).sort(), ['expat.com', 'hidubai.com'])
  assert.equal(state['expat.com'].dofollow, true)
  assert.equal(state['hidubai.com'].dofollow, false)
  assert.equal(state['expat.com'].firstSeen, '2026-07-01 00:00:00 +00:00')
})

test('computeDomainDeltas: first run yields no deltas', () => {
  const { added, lost } = computeDomainDeltas({ 'a.com': { rank: 1 } }, null)
  assert.equal(added.length, 0)
  assert.equal(lost.length, 0)
})

test('computeDomainDeltas finds added and lost, sorted by rank desc', () => {
  const prev = { 'old.com': { rank: 10 }, 'kept.com': { rank: 5 } }
  const cur = { 'kept.com': { rank: 6 }, 'new-hi.com': { rank: 50 }, 'new-lo.com': { rank: 2 } }
  const { added, lost } = computeDomainDeltas(cur, prev)
  assert.deepEqual(added.map(d => d.domain), ['new-hi.com', 'new-lo.com'])
  assert.deepEqual(lost.map(d => d.domain), ['old.com'])
})

test('formatBacklinkReport: baseline run mentions the baseline, no delta suffixes', () => {
  const summary = { rank: 3, backlinks: 9, referringDomains: 8, referringMainDomains: 8, referringDomainsNofollow: 8, brokenBacklinks: 0 }
  const r = formatBacklinkReport({ summary, prevSummary: null, added: [], lost: [], totalDomains: 8, cost: 0.052, firstRun: true })
  assert.match(r, /Первый прогон/)
  assert.match(r, /Реф\. домены: 8 · ссылки: 9/)
  assert.match(r, /\$0\.052/)
})

test('formatBacklinkReport: deltas render with signs, added/lost listed', () => {
  const summary = { rank: 5, backlinks: 12, referringDomains: 10, referringMainDomains: 9, referringDomainsNofollow: 7, brokenBacklinks: 1 }
  const prevSummary = { rank: 3, backlinks: 13, referringDomains: 8, referringMainDomains: 8, referringDomainsNofollow: 8, brokenBacklinks: 0 }
  const r = formatBacklinkReport({
    summary,
    prevSummary,
    added: [{ domain: 'expat.com', rank: 45, dofollow: true }],
    lost: [{ domain: 'gone.com', rank: 7 }],
    totalDomains: 10,
    cost: 0.0516,
    firstRun: false,
  })
  assert.match(r, /Реф\. домены: 10 \(\+2\)/)
  assert.match(r, /ссылки: 12 \(−1\)/)
  assert.match(r, /🆕 Новые домены \(1\)/)
  assert.match(r, /expat\.com — rank 45 · dofollow/)
  assert.match(r, /❌ Потерянные домены \(1\)/)
  assert.match(r, /gone\.com — был rank 7/)
})

test('formatBacklinkReport: no changes message when composition is stable', () => {
  const summary = { rank: 3, backlinks: 9, referringDomains: 8, referringMainDomains: 8, referringDomainsNofollow: 8, brokenBacklinks: 0 }
  const r = formatBacklinkReport({ summary, prevSummary: summary, added: [], lost: [], totalDomains: 8, cost: 0.05, firstRun: false })
  assert.match(r, /без изменений/)
})
