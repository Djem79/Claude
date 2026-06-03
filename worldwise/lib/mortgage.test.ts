import { test } from 'node:test'
import assert from 'node:assert/strict'
import { estimateMonthly, MORTGAGE_DEFAULTS } from './mortgage.ts'

test('defaults are 25% down, 4.5%, 25 years', () => {
  assert.deepEqual(MORTGAGE_DEFAULTS, { downPct: 0.25, ratePct: 4.5, years: 25 })
})

test('AED 2,000,000 at defaults ≈ 8,337/mo', () => {
  const m = estimateMonthly(2_000_000)
  assert.ok(Math.round(m) >= 8335 && Math.round(m) <= 8339, `got ${Math.round(m)}`)
})

test('zero interest splits the financed amount evenly', () => {
  assert.equal(estimateMonthly(1_200_000, { downPct: 0.25, ratePct: 0, years: 25 }), 900_000 / 300)
})

test('100% down (no loan) returns 0', () => {
  assert.equal(estimateMonthly(1_000_000, { downPct: 1 }), 0)
})

test('overriding opts changes the payment', () => {
  assert.ok(estimateMonthly(2_000_000, { downPct: 0.5 }) < estimateMonthly(2_000_000))
})
