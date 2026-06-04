import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isValidBrochureId, brochureBasename } from './brochure.ts'

test('isValidBrochureId accepts 6-20 digit numeric ids, rejects the rest', () => {
  assert.ok(isValidBrochureId('1780577951123'))
  assert.ok(isValidBrochureId('123456'))
  assert.ok(!isValidBrochureId('12345'))      // too short
  assert.ok(!isValidBrochureId('abc'))
  assert.ok(!isValidBrochureId('123/../x'))
  assert.ok(!isValidBrochureId(''))
})

test('brochureBasename returns <id>.pdf for valid ids and throws otherwise', () => {
  assert.equal(brochureBasename('1780577951123'), '1780577951123.pdf')
  assert.throws(() => brochureBasename('../etc'))
})
