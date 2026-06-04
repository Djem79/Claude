import { test } from 'node:test'
import assert from 'node:assert/strict'
import { developers, developerSlugs, getDeveloper, propertyMatchesDeveloper } from './developers.ts'

test('every developer has a unique slug and ships >=12 brands', () => {
  assert.equal(new Set(developerSlugs).size, developerSlugs.length)
  assert.ok(developers.length >= 12)
})

test('matches case/spacing variants via aliases', () => {
  const sobha = getDeveloper('sobha')!
  assert.ok(propertyMatchesDeveloper('SOBHA REALTY', sobha))
  assert.ok(propertyMatchesDeveloper('Sobha', sobha))
  assert.ok(propertyMatchesDeveloper('  sobha   group ', sobha))
})

test('MAG merges its four spelling variants', () => {
  const mag = getDeveloper('mag')!
  for (const v of ['MAG Properties', 'MAG Property', 'Mag Properties', 'Mag Lifestyle']) {
    assert.ok(propertyMatchesDeveloper(v, mag), v)
  }
})

test('does NOT match a different brand (no substring false-positive)', () => {
  assert.equal(propertyMatchesDeveloper('Prestige Harbour', getDeveloper('prestige-one')!), false)
})

test('empty developer never matches', () => {
  assert.equal(propertyMatchesDeveloper('', getDeveloper('emaar')!), false)
})
