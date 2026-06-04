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

test('rejects small images below the gate (incl. tiny floor-plan line art) — keeping this gate high is what stops the candidate set exploding and burying the real renders', () => {
  assert.equal(isLikelyPhoto(18_900, 'img-073.jpg'), false)
  assert.equal(isLikelyPhoto(40_000, 'img-077.jpg'), false)
})
