// node --test --experimental-strip-types lib/property-seo.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { propertyTitleTag, propertyMetaDescription, buildPropertyFaq } from './property-seo.ts'
import type { Property } from '@/types'

const base = {
  id: '1', slug: 'mercer-house', title: 'Mercer House', developer: 'Ellington',
  area: 'JLT', type: 'apartment', status: 'off-plan', priceAed: 3_730_000,
  pricePerSqft: 2450, paymentPlan: '60/40', completionDate: 'Q4 2027',
  grossYield: 7.5, bedrooms: '1-3 Bed', description: '', shortDescription: 'Waterfront living with panoramic views.',
  amenities: [], images: [], featured: false, createdAt: '2026-07-01',
} as unknown as Property

// ── propertyTitleTag ─────────────────────────────────────────────────────────

test('title: off-plan carries Price & Payment Plan pattern + developer', () => {
  assert.equal(propertyTitleTag(base, 2026), 'Mercer House by Ellington — Price & Payment Plan 2026')
})

test('title: secondary is price-led, rent is rent-led, empty developer drops "by"', () => {
  const sec = { ...base, status: 'secondary', developer: '' } as Property
  assert.equal(propertyTitleTag(sec, 2026), 'Mercer House — AED 3.73M in JLT, Dubai')
  const rent = { ...base, status: 'rent' } as Property
  assert.equal(propertyTitleTag(rent, 2026), 'Mercer House by Ellington — for Rent in JLT, Dubai')
})

// ── propertyMetaDescription ─────────────────────────────────────────────────

test('description: facts first (price, plan, handover), capped at 300', () => {
  const d = propertyMetaDescription(base)
  assert.ok(d.startsWith('Mercer House in JLT, Dubai: From AED 3.73M, 60/40 payment plan, handover Q4 2027.'), d)
  assert.ok(d.includes('Waterfront living'))
  assert.ok(d.length <= 300)
})

test('description: long payment plan text stays out of the facts lead', () => {
  const p = { ...base, paymentPlan: 'x'.repeat(50) } as Property
  const d = propertyMetaDescription(p)
  assert.ok(!d.includes('x'.repeat(50)))
  assert.ok(d.includes('From AED 3.73M, handover Q4 2027.'))
})

// ── buildPropertyFaq ─────────────────────────────────────────────────────────

test('faq: off-plan with full data yields price/plan/handover/visa/yield/location', () => {
  const faq = buildPropertyFaq(base, { goldenVisa: true })
  const qs = faq.map(f => f.q)
  assert.deepEqual(qs, [
    'What is the starting price of Mercer House?',
    'What is the payment plan for Mercer House?',
    'When is the handover of Mercer House?',
    'Does buying Mercer House qualify for the UAE Golden Visa?',
    'What rental yield can Mercer House generate?',
    'Where is Mercer House located?',
  ])
  assert.ok(faq[0].a.includes('AED 3.73M'))
  assert.ok(faq[0].a.includes('2,450 per sq ft'))
  assert.ok(faq[1].a.includes('60/40'))
  assert.ok(faq[1].a.includes('Q4 2027'))
})

test('faq: never fabricates — missing fields drop their questions', () => {
  const thin = { ...base, paymentPlan: undefined, completionDate: undefined, grossYield: undefined, pricePerSqft: undefined } as Property
  const faq = buildPropertyFaq(thin, { goldenVisa: false })
  assert.deepEqual(faq.map(f => f.q), [
    'What is the starting price of Mercer House?',
    'Where is Mercer House located?',
  ])
  assert.ok(!faq[0].a.includes('per sq ft'))
})

test('faq: long payment plan becomes the answer verbatim', () => {
  const p = { ...base, paymentPlan: '20% on booking, 40% during construction, 40% on handover' } as Property
  const faq = buildPropertyFaq(p, { goldenVisa: false })
  const plan = faq.find(f => f.q.includes('payment plan'))
  assert.equal(plan?.a, '20% on booking, 40% during construction, 40% on handover')
})

test('faq: rent listings skip visa/yield, use rent phrasing', () => {
  const rent = { ...base, status: 'rent', priceAed: 120_000 } as Property
  const faq = buildPropertyFaq(rent, { goldenVisa: false })
  assert.ok(faq[0].q.startsWith('What is the rent'))
  assert.ok(faq[0].a.includes('AED 120K'))
  assert.ok(!faq.some(f => f.q.includes('Golden Visa')))
  assert.ok(!faq.some(f => f.q.includes('yield')))
})
