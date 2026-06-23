// scripts/keyword-discovery-core.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { trendRiseFactor } from './keyword-discovery-core.mjs'

const mk = (...vals) => vals.map((value, i) => ({ month: String(i), year: 2026, value }))

test('trendRiseFactor: flat trend ~= 1', () => {
  const f = trendRiseFactor(mk(100,100,100,100,100,100,100,100,100,100,100,100))
  assert.ok(Math.abs(f - 1) < 0.01, `expected ~1, got ${f}`)
})

test('trendRiseFactor: rising trend > 1', () => {
  const f = trendRiseFactor(mk(100,100,100,100,100,100,100,100,100,300,300,300))
  assert.ok(f > 1.5, `expected >1.5, got ${f}`)
})

test('trendRiseFactor: declining trend < 1', () => {
  const f = trendRiseFactor(mk(300,300,300,100,100,100,100,100,100,100,100,100))
  assert.ok(f < 1, `expected <1, got ${f}`)
})

test('trendRiseFactor: clamps to [0.5, 3]', () => {
  assert.equal(trendRiseFactor(mk(10,10,10,0,0,0,0,0,0,1000,1000,1000)), 3)
  assert.equal(trendRiseFactor(mk(1000,1000,1000,0,0,0,0,0,0,1,1,1)), 0.5)
})

test('trendRiseFactor: empty/short trend = 1', () => {
  assert.equal(trendRiseFactor([]), 1)
  assert.equal(trendRiseFactor(undefined), 1)
  assert.equal(trendRiseFactor(mk(100,100)), 1)
})

test('trendRiseFactor: zero baseline does not divide-by-zero', () => {
  const f = trendRiseFactor(mk(0,0,0,0,0,0,0,0,0,100,100,100))
  assert.equal(f, 3)
})
