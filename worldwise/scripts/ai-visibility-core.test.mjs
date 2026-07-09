// node --test scripts/ai-visibility-core.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  extractAnswer, detectMention, detectBrands, tallyBrands,
  computeVisibilityDeltas, formatAiReport,
} from './ai-visibility-core.mjs'

const ITEMS = [
  { type: 'reasoning', sections: [{ type: 'summary_text', text: 'thinking…' }] },
  {
    type: 'message',
    sections: [
      { type: 'text', text: 'Top agencies include Bayut and Worldwise Real Estate.', annotations: [{ title: 'worldwise.pro', url: 'https://worldwise.pro/blog/x' }] },
      { type: 'text', text: 'Also consider Property Finder.', annotations: null },
    ],
  },
]

test('extractAnswer concatenates message text and dedupes citations', () => {
  const { text, citations } = extractAnswer(ITEMS)
  assert.match(text, /Bayut and Worldwise/)
  assert.match(text, /Property Finder/)
  assert.ok(!text.includes('thinking'))
  assert.deepEqual(citations, ['https://worldwise.pro/blog/x'])
})

test('extractAnswer tolerates empty/malformed payloads', () => {
  assert.deepEqual(extractAnswer(undefined), { text: '', citations: [] })
  assert.deepEqual(extractAnswer([{ type: 'message' }]), { text: '', citations: [] })
})

test('detectMention flags text mention and our-domain citation', () => {
  const ans = extractAnswer(ITEMS)
  const m = detectMention(ans, 'worldwise.pro')
  assert.equal(m.mentioned, true)
  assert.equal(m.cited, true)
})

test('detectMention: no false positive on other domains', () => {
  const m = detectMention({ text: 'Bayut is popular.', citations: ['https://bayut.com/a'] }, 'worldwise.pro')
  assert.equal(m.mentioned, false)
  assert.equal(m.cited, false)
  // substring domain must not match (notworldwise.pro ≠ worldwise.pro)
  const m2 = detectMention({ text: '', citations: ['https://notworldwise.pro/'] }, 'worldwise.pro')
  assert.equal(m2.cited, false)
})

test('detectBrands matches text and citation hosts', () => {
  const competitors = [
    { name: 'Bayut', re: /bayut/i },
    { name: 'Property Finder', re: /property\s?finder|propertyfinder/i },
    { name: 'Betterhomes', re: /betterhomes|bhomes/i },
  ]
  const brands = detectBrands(
    { text: 'Bayut is big.', citations: ['https://www.propertyfinder.ae/x'] },
    competitors,
  )
  assert.deepEqual(brands, ['Bayut', 'Property Finder'])
})

test('tallyBrands aggregates across prompts sorted desc', () => {
  const t = tallyBrands({
    a: { brands: ['Bayut', 'Betterhomes'] },
    b: { brands: ['Bayut'] },
  })
  assert.deepEqual(t, [['Bayut', 2], ['Betterhomes', 1]])
})

test('computeVisibilityDeltas: first run and errored prompts are safe', () => {
  assert.deepEqual(computeVisibilityDeltas({ a: { mentioned: true } }, null), { gained: [], lostMention: [] })
  // prompt "b" errored this run (absent from current) — must not appear as lost
  const d = computeVisibilityDeltas(
    { a: { mentioned: true } },
    { a: { mentioned: false }, b: { mentioned: true } },
  )
  assert.deepEqual(d.gained, ['a'])
  assert.deepEqual(d.lostMention, [])
})

test('formatAiReport: probe excluded from share, sections render', () => {
  const results = {
    agency: { label: 'лучшие агентства', mentioned: true, cited: true, probe: false, brands: ['Bayut'] },
    yields: { label: 'доходность районов', mentioned: false, cited: false, probe: false, brands: ['Bayut'] },
    probe: { label: 'бренд-проба', mentioned: true, cited: false, probe: true, brands: [] },
  }
  const r = formatAiReport({
    results,
    deltas: { gained: ['agency'], lostMention: [] },
    cost: 0.123,
    firstRun: false,
    model: 'gpt-4o',
    probeSnippet: 'Worldwise Real Estate is a Dubai advisory…',
  })
  assert.match(r, /Упоминание бренда: 1\/2/)
  assert.match(r, /цитирование сайта: 1\/2/)
  assert.match(r, /лучшие агентства \(с цитатой\)/)
  assert.match(r, /▲ Появилось упоминание/)
  assert.match(r, /Bayut ×2/)
  assert.match(r, /Что модель знает о Worldwise/)
  assert.match(r, /\$0\.123/)
})

test('formatAiReport: first run message', () => {
  const r = formatAiReport({
    results: { a: { label: 'x', mentioned: false, cited: false, probe: false, brands: [] } },
    deltas: { gained: [], lostMention: [] },
    cost: 0.1,
    firstRun: true,
    model: 'gpt-4o',
    probeSnippet: null,
  })
  assert.match(r, /Первый прогон/)
})
