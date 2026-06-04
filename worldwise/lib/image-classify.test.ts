import { test } from 'node:test'
import assert from 'node:assert/strict'
import { selectByCategory, normalizeCategory, partitionByCategory, type ImgCategory } from './image-classify.ts'

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

test('partitionByCategory splits gallery (exterior→interior→amenity) from floorplans', () => {
  const cats: ImgCategory[] = ['mood', 'floorplan', 'interior', 'exterior', 'amenity', 'floorplan', 'lifestyle']
  const { gallery, floorPlans } = partitionByCategory(cats, 24, 12)
  assert.deepEqual(gallery, [3, 2, 4]) // exterior(3) → interior(2) → amenity(4)
  assert.deepEqual(floorPlans, [1, 5]) // floorplans in document order
})

test('partitionByCategory respects both caps', () => {
  const cats: ImgCategory[] = ['exterior', 'exterior', 'exterior', 'floorplan', 'floorplan', 'floorplan']
  const r = partitionByCategory(cats, 2, 1)
  assert.deepEqual(r.gallery, [0, 1])
  assert.deepEqual(r.floorPlans, [3])
})

test('partitionByCategory routes masterplan to the gallery (after amenity), only unit floorplans to floorPlans', () => {
  // Regression: community master-plan / cluster maps must NOT land in the gated
  // floor-plan section — only individual-unit layouts belong there.
  const cats: ImgCategory[] = ['floorplan', 'masterplan', 'exterior', 'amenity', 'masterplan']
  const { gallery, floorPlans } = partitionByCategory(cats, 24, 12)
  assert.deepEqual(gallery, [2, 3, 1, 4]) // exterior(2) → amenity(3) → masterplan(1,4)
  assert.deepEqual(floorPlans, [0])
})
