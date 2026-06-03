import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mapGeminiToProperty } from './property-map.ts'

test('keeps known string fields and trims them', () => {
  const out = mapGeminiToProperty({ title: '  Marina Vista  ', developer: 'Emaar', area: 'Dubai Marina' })
  assert.equal(out.title, 'Marina Vista')
  assert.equal(out.developer, 'Emaar')
  assert.equal(out.area, 'Dubai Marina')
})

test('coerces numeric priceAed and drops non-numbers', () => {
  assert.equal(mapGeminiToProperty({ priceAed: '2500000' }).priceAed, 2500000)
  assert.equal(mapGeminiToProperty({ priceAed: 'N/A' }).priceAed, undefined)
})

test('clamps type/status to allowed enums, ignores invalid', () => {
  assert.equal(mapGeminiToProperty({ type: 'villa' }).type, 'villa')
  assert.equal(mapGeminiToProperty({ type: 'castle' }).type, undefined)
  assert.equal(mapGeminiToProperty({ status: 'off-plan' }).status, 'off-plan')
})

test('drops null/empty values entirely (no empty keys)', () => {
  const out = mapGeminiToProperty({ title: 'X', developer: null, area: '' })
  assert.equal(out.title, 'X')
  assert.ok(!('developer' in out))
  assert.ok(!('area' in out))
})

test('cleans amenities array', () => {
  assert.deepEqual(mapGeminiToProperty({ amenities: [' Pool ', '', 'Gym', 3] }).amenities, ['Pool', 'Gym'])
})

test('returns empty object for junk input', () => {
  assert.deepEqual(mapGeminiToProperty(null), {})
  assert.deepEqual(mapGeminiToProperty('nope'), {})
})
