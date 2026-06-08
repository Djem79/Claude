import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseUtmParams, UTM_KEYS } from './utm.ts'

test('extracts all known utm + click-id params', () => {
  const search = '?utm_source=google&utm_medium=cpc&utm_campaign=dubai_offplan&utm_term=buy+apartment&utm_content=ad1&gclid=abc123&fbclid=xyz789'
  assert.deepEqual(parseUtmParams(search), {
    utm_source: 'google',
    utm_medium: 'cpc',
    utm_campaign: 'dubai_offplan',
    utm_term: 'buy apartment',
    utm_content: 'ad1',
    gclid: 'abc123',
    fbclid: 'xyz789',
  })
})

test('works with or without leading "?"', () => {
  assert.deepEqual(parseUtmParams('utm_source=bayut'), { utm_source: 'bayut' })
  assert.deepEqual(parseUtmParams('?utm_source=bayut'), { utm_source: 'bayut' })
})

test('ignores unknown params and empty/whitespace values', () => {
  assert.deepEqual(parseUtmParams('?foo=bar&utm_source=&utm_medium=%20%20&utm_campaign=x'), {
    utm_campaign: 'x',
  })
})

test('returns empty object for empty / no-attribution search', () => {
  assert.deepEqual(parseUtmParams(''), {})
  assert.deepEqual(parseUtmParams('?ref=newsletter&page=2'), {})
})

test('trims surrounding whitespace and length-caps to 200 chars', () => {
  const long = 'a'.repeat(500)
  const out = parseUtmParams(`?utm_campaign=${long}&utm_source=%20google%20`)
  assert.equal(out.utm_source, 'google')
  assert.equal(out.utm_campaign?.length, 200)
})

test('UTM_KEYS covers exactly the supported attribution fields', () => {
  assert.deepEqual([...UTM_KEYS], [
    'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'fbclid',
  ])
})
