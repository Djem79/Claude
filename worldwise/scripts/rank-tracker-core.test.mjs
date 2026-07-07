// node --test scripts/rank-tracker-core.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { mergeTrackedKeywords, parseSerp, computeDeltas, formatRankReport } from './rank-tracker-core.mjs'

// ── mergeTrackedKeywords ─────────────────────────────────────────────────────

test('merge: core terms first, GSC fills by impressions, dedup + cap', () => {
  const gsc = [
    { key: 'dubai visa', impressions: 50 },
    { key: 'Buy Apartment in Dubai', impressions: 900 }, // dup of core (case)
    { key: 'dubai marina flats', impressions: 700 },
  ]
  const out = mergeTrackedKeywords(gsc, ['buy apartment in dubai'], 3)
  assert.deepEqual(out, ['buy apartment in dubai', 'dubai marina flats', 'dubai visa'])
})

test('merge: cap respected, short/empty keys skipped', () => {
  const gsc = [{ key: 'ok', impressions: 10 }, { key: '', impressions: 9 }, { key: 'long keyword', impressions: 1 }]
  const out = mergeTrackedKeywords(gsc, ['a'], 1)
  assert.deepEqual(out, ['long keyword'])
})

// ── parseSerp ────────────────────────────────────────────────────────────────

const serpItems = [
  { type: 'ai_overview' },
  { type: 'organic', rank_group: 1, domain: 'bayut.com', url: 'https://bayut.com/x' },
  { type: 'organic', rank_group: 2, domain: 'propertyfinder.ae', url: 'https://pf.ae/y' },
  { type: 'people_also_ask' },
  { type: 'organic', rank_group: 3, domain: 'bayut.com', url: 'https://bayut.com/z' },
  { type: 'organic', rank_group: 4, domain: 'worldwise.pro', url: 'https://worldwise.pro/blog/a' },
  { type: 'organic', rank_group: 5, domain: 'metropolitan.realestate', url: 'https://m.re/b' },
]

test('parseSerp: finds our position, distinct outrankers, AI Overview flag', () => {
  const r = parseSerp(serpItems, 'worldwise.pro')
  assert.equal(r.ourPos, 4)
  assert.equal(r.ourUrl, 'https://worldwise.pro/blog/a')
  assert.deepEqual(r.above, ['bayut.com', 'propertyfinder.ae'])
  assert.equal(r.aiOverview, true)
})

test('parseSerp: absent domain → null pos, top-3 overall as above', () => {
  const r = parseSerp(serpItems, 'nope.com')
  assert.equal(r.ourPos, null)
  assert.deepEqual(r.above, ['bayut.com', 'propertyfinder.ae', 'worldwise.pro'])
})

test('parseSerp: subdomain counts as ours; empty items safe', () => {
  const items = [{ type: 'organic', rank_group: 7, domain: 'www.worldwise.pro', url: 'u' }]
  assert.equal(parseSerp(items, 'worldwise.pro').ourPos, 7)
  assert.equal(parseSerp(undefined, 'worldwise.pro').ourPos, null)
  assert.equal(parseSerp([], 'worldwise.pro').aiOverview, false)
})

// ── computeDeltas ────────────────────────────────────────────────────────────

test('deltas: up/down honour MIN_DELTA, entered/dropped on null transitions', () => {
  const prev = { a: { pos: 12 }, b: { pos: 5 }, c: { pos: null }, d: { pos: 8 }, e: { pos: 9 } }
  const cur = { a: { pos: 6 }, b: { pos: 9 }, c: { pos: 15 }, d: { pos: null }, e: { pos: 10 } }
  const d = computeDeltas(cur, prev)
  assert.deepEqual(d.up, [{ kw: 'a', from: 12, to: 6 }])
  assert.deepEqual(d.down, [{ kw: 'b', from: 5, to: 9 }])
  assert.deepEqual(d.entered, [{ kw: 'c', to: 15 }])
  assert.deepEqual(d.dropped, [{ kw: 'd', from: 8 }])
})

test('deltas: keyword newly tracked with a position counts as entered', () => {
  const d = computeDeltas({ fresh: { pos: 3 } }, {})
  assert.deepEqual(d.entered, [{ kw: 'fresh', to: 3 }])
})

test('deltas: first run (previous null) → empty; errored keywords omitted from current are ignored', () => {
  const d = computeDeltas({ a: { pos: 1 } }, null)
  assert.deepEqual(d, { up: [], down: [], entered: [], dropped: [] })
  // 'gone' present in prev but absent (errored) in current → must NOT appear as dropped
  const d2 = computeDeltas({ a: { pos: 1 } }, { a: { pos: 1 }, gone: { pos: 2 } })
  assert.deepEqual(d2.dropped, [])
})

// ── formatRankReport ─────────────────────────────────────────────────────────

test('report: first run prints baseline, no deltas section', () => {
  const txt = formatRankReport({
    tracked: 10,
    results: { 'buy apartment in dubai': { pos: 8, url: 'u', above: [], aiOverview: true } },
    deltas: { up: [], down: [], entered: [], dropped: [] },
    cost: 0.31,
    firstRun: true,
  })
  assert.match(txt, /Первый прогон/)
  assert.match(txt, /#8 buy apartment in dubai/)
  assert.match(txt, /\$0\.31/)
})

test('report: AI Overview section lists only ranked (top-20) keywords carrying an AIO', () => {
  const txt = formatRankReport({
    tracked: 3,
    results: {
      hit: { pos: 6, above: [], aiOverview: true },     // ranked + AIO → listed
      noai: { pos: 8, above: [], aiOverview: false },    // ranked, no AIO → not listed
      deep: { pos: null, above: [], aiOverview: true },  // AIO but not ranked → not listed
    },
    deltas: { up: [], down: [], entered: [], dropped: [] },
    cost: 0.3,
    firstRun: false,
  })
  assert.match(txt, /🤖 AI Overview на наших топ-20 \(1\)/)
  assert.match(txt, /#6 hit/)
  assert.doesNotMatch(txt, /noai/)
  assert.doesNotMatch(txt, /deep/)
})

test('report: movers with outrankers on the down side', () => {
  const txt = formatRankReport({
    tracked: 2,
    results: { kwa: { pos: 9, above: ['bayut.com'], aiOverview: false }, kwb: { pos: 4, above: [], aiOverview: false } },
    deltas: { up: [{ kw: 'kwb', from: 9, to: 4 }], down: [{ kw: 'kwa', from: 5, to: 9 }], entered: [], dropped: [] },
    cost: 0.2,
    firstRun: false,
  })
  assert.match(txt, /▲ Рост \(1\)/)
  assert.match(txt, /kwb: 9 → 4/)
  assert.match(txt, /kwa: 5 → 9 \(выше: bayut\.com\)/)
})
