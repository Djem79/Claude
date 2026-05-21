import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sanitizeSlug, isValidSlug } from './slug.ts'

test('sanitizeSlug keeps kebab-case, strips the rest, lowercases, caps length', () => {
  assert.equal(sanitizeSlug('Dubai Marina 2BR!'), 'dubai-marina-2br')
  assert.equal(sanitizeSlug('Already-good-slug'), 'already-good-slug')
  assert.equal(sanitizeSlug('  spaces  and__under '), 'spaces-and-under')
  assert.equal(sanitizeSlug('a'.repeat(120)).length, 80)
})

test('isValidSlug accepts only kebab-case within length', () => {
  assert.equal(isValidSlug('dubai-marina'), true)
  assert.equal(isValidSlug('Bad Slug'), false)
  assert.equal(isValidSlug(''), false)
  assert.equal(isValidSlug('a'.repeat(81)), false)
})
