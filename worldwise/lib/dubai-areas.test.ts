import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DUBAI_AREAS, canonicalizeArea, _ALIAS_TARGETS } from './dubai-areas.ts'

test('canonical name returns itself (case/space-insensitive)', () => {
  assert.equal(canonicalizeArea('Dubai Marina'), 'Dubai Marina')
  assert.equal(canonicalizeArea('dubai marina'), 'Dubai Marina')
  assert.equal(canonicalizeArea('  BUSINESS   BAY '), 'Business Bay')
})

test('variant maps to canonical via alias', () => {
  assert.equal(canonicalizeArea('Jumeirah Lake Towers'), 'JLT')
  assert.equal(canonicalizeArea('Sports city'), 'Dubai Sports City')
  assert.equal(canonicalizeArea('Sport City'), 'Dubai Sports City')
  assert.equal(canonicalizeArea('Dubai Investment Park 2'), 'Dubai Investment Park')
  assert.equal(canonicalizeArea('Sobha Hartland, Mohammed Bin Rashid City (MBR City)'), 'Mohammed Bin Rashid City')
})

test('unknown area is returned unchanged (never invented)', () => {
  assert.equal(canonicalizeArea('Danube Properties'), 'Danube Properties')
  assert.equal(canonicalizeArea('Dubai'), 'Dubai')
})

test('empty/whitespace returns empty string', () => {
  assert.equal(canonicalizeArea('   '), '')
  assert.equal(canonicalizeArea(''), '')
})

test('every alias target exists in DUBAI_AREAS', () => {
  const set = new Set(DUBAI_AREAS)
  for (const v of _ALIAS_TARGETS) assert.ok(set.has(v), v)
})

test('new real communities the operator added are recognised', () => {
  assert.equal(canonicalizeArea('Damac Lagoon Views'), 'Damac Lagoons')
  assert.equal(canonicalizeArea('Jumeirah Golf'), 'Jumeirah Golf Estates')
  assert.equal(canonicalizeArea('Dubai Investments Park (DIP)'), 'Dubai Investment Park')
  assert.equal(canonicalizeArea('Damac Hills 2'), 'Damac Hills 2')
})
