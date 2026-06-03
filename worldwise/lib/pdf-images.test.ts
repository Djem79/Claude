import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isLikelyPhoto, MIN_PHOTO_BYTES } from './pdf-images.ts'

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
