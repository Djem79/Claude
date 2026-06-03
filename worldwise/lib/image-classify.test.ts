import { test } from 'node:test'
import assert from 'node:assert/strict'
import { selectByCategory, normalizeCategory, type ImgCategory } from './image-classify.ts'

test('ranks exterior, then interior, then amenity, then floorplan; drops lifestyle/mood/other', () => {
  // index:        0          1        2          3         4           5         6
  const cats: ImgCategory[] = ['mood', 'interior', 'lifestyle', 'exterior', 'floorplan', 'amenity', 'other']
  assert.deepEqual(selectByCategory(cats, 10), [3, 1, 5, 4])
})

test('preserves document order within each category', () => {
  const cats: ImgCategory[] = ['exterior', 'interior', 'exterior', 'interior']
  assert.deepEqual(selectByCategory(cats, 10), [0, 2, 1, 3])
})

test('respects the cap (keeping the highest-priority items)', () => {
  const cats: ImgCategory[] = ['exterior', 'exterior', 'interior', 'amenity']
  assert.deepEqual(selectByCategory(cats, 2), [0, 1])
})

test('returns empty when nothing is keepable', () => {
  assert.deepEqual(selectByCategory(['mood', 'lifestyle', 'other'], 5), [])
})

test('normalizeCategory lowercases/trims known values and maps unknown to other', () => {
  assert.equal(normalizeCategory(' Exterior '), 'exterior')
  assert.equal(normalizeCategory('INTERIOR'), 'interior')
  assert.equal(normalizeCategory('balcony'), 'other')
  assert.equal(normalizeCategory(null), 'other')
  assert.equal(normalizeCategory(undefined), 'other')
})
