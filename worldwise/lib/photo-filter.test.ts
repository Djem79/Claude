import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isLikelyPhoto, MIN_PHOTO_BYTES } from './photo-filter.ts'

test('rejects non-image extensions regardless of size', () => {
  assert.equal(isLikelyPhoto(MIN_PHOTO_BYTES + 1, 'img-000.txt'), false)
})

test('rejects tiny images (logos/icons)', () => {
  assert.equal(isLikelyPhoto(2_000, 'img-000.png'), false)
})

test('accepts large web-safe images', () => {
  assert.equal(isLikelyPhoto(MIN_PHOTO_BYTES, 'x.png'), true)
  assert.equal(isLikelyPhoto(MIN_PHOTO_BYTES + 1, 'img-000.png'), true)
  assert.equal(isLikelyPhoto(200_000, 'page-1.jpg'), true)
})

test('keeps small floor-plan JPEGs (line art compresses tiny) — regression: real DAMAC Islands 2 unit layouts were 19–45 KB and got wrongly filtered out before classification', () => {
  assert.equal(isLikelyPhoto(18_900, 'img-073.jpg'), true)
  assert.equal(isLikelyPhoto(13_000, 'img-075.jpg'), true)
  // genuine icons/dividers are still rejected
  assert.equal(isLikelyPhoto(2_000, 'logo.png'), false)
})
