import { test } from 'node:test'
import assert from 'node:assert/strict'
import { selectByCategory, normalizeCategory, isLikelyFloorPlanDims, partitionGallery, selectPlanSection, type ImgCategory } from './image-classify.ts'

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

test('isLikelyFloorPlanDims: accepts floor-plan-sized images, rejects icons/banners/thumbs', () => {
  assert.equal(isLikelyFloorPlanDims(487, 618), true)   // real plan
  assert.equal(isLikelyFloorPlanDims(318, 1022), true)  // tall plan
  assert.equal(isLikelyFloorPlanDims(200, 200), false)  // icon (area 40k)
  assert.equal(isLikelyFloorPlanDims(1000, 80), false)  // thin banner (min side 80)
  assert.equal(isLikelyFloorPlanDims(400, 300), false)  // small thumb (area 120k)
})

test('partitionGallery ranks exterior -> interior -> amenity, drops everything else (incl. masterplan)', () => {
  const cats: ImgCategory[] = ['masterplan', 'interior', 'mood', 'exterior', 'amenity', 'floorplan']
  assert.deepEqual(partitionGallery(cats, 24), [3, 1, 4]) // exterior(3) interior(1) amenity(4)
})

test('partitionGallery respects the cap', () => {
  const cats: ImgCategory[] = ['exterior', 'exterior', 'interior']
  assert.deepEqual(partitionGallery(cats, 2), [0, 1])
})

test('selectPlanSection takes up to maxMaster masterplans (from gallery cats) + floorplans (from plan cats)', () => {
  const galleryCats: ImgCategory[] = ['exterior', 'masterplan', 'masterplan', 'masterplan']
  const planCats: ImgCategory[]    = ['other', 'floorplan', 'floorplan', 'mood']
  const r = selectPlanSection(galleryCats, planCats, 2, 12)
  assert.deepEqual(r.master, [1, 2]) // first 2 masterplan indices, document order
  assert.deepEqual(r.floor, [1, 2])  // floorplan indices from plan cats
})

test('selectPlanSection caps floorplans and tolerates no masterplans', () => {
  const galleryCats: ImgCategory[] = ['exterior', 'interior']
  const planCats: ImgCategory[]    = ['floorplan', 'floorplan', 'floorplan']
  const r = selectPlanSection(galleryCats, planCats, 2, 2)
  assert.deepEqual(r.master, [])
  assert.deepEqual(r.floor, [0, 1])
})
