import { test } from 'node:test'
import assert from 'node:assert/strict'
import { extractFaqItems, faqPageJsonLd } from './blog-faq.ts'

const withFaq = `Intro paragraph.

## Some Section

Body text.

## Frequently Asked Questions

### Q1: Is 2026 a good time to buy?

A1: Yes, demand is strong and payment plans help.

### Q2: What down payment do I need?

A2: Cash buyers usually put 10-20% down.

## Contact Us

Reach out for a consultation.`

test('extracts Q&A pairs, stripping Q/A prefixes', () => {
  const items = extractFaqItems(withFaq)
  assert.equal(items.length, 2)
  assert.equal(items[0].question, 'Is 2026 a good time to buy?')
  assert.equal(items[0].answer, 'Yes, demand is strong and payment plans help.')
  assert.equal(items[1].question, 'What down payment do I need?')
})

test('stops at the next same-level heading (Contact Us not included)', () => {
  const items = extractFaqItems(withFaq)
  assert.ok(!items.some(i => /contact/i.test(i.question)))
})

test('returns [] when there is no FAQ section', () => {
  assert.deepEqual(extractFaqItems('## Overview\n\nNo questions here.'), [])
})

test('handles questions without Q/A prefixes', () => {
  const c = `## FAQ

### Can foreigners buy property?

Yes, in designated freehold areas.

### Do I get a visa?

Yes, above AED 750,000.`
  const items = extractFaqItems(c)
  assert.equal(items.length, 2)
  assert.equal(items[0].question, 'Can foreigners buy property?')
  assert.equal(items[0].answer, 'Yes, in designated freehold areas.')
})

test('strips markdown links and bold from answers', () => {
  const c = `## Frequently Asked Questions

### How do I start?

Browse our [listings](/properties) and **contact us**.

### Anything else?

No.`
  const items = extractFaqItems(c)
  assert.equal(items[0].answer, 'Browse our listings and contact us.')
})

test('handles bold-line questions (static editorial format)', () => {
  const c = `## Frequently Asked Questions

**Does buying property give me residency?**
Yes, a fully owned property qualifies you for a 2-year visa.

**What is the minimum value?**
There is no fixed minimum for the 2-year visa.

## Our Recommendation

Talk to us.`
  const items = extractFaqItems(c)
  assert.equal(items.length, 2)
  assert.equal(items[0].question, 'Does buying property give me residency?')
  assert.equal(items[0].answer, 'Yes, a fully owned property qualifies you for a 2-year visa.')
  assert.ok(!items.some(i => /recommendation/i.test(i.question)))
})

test('faqPageJsonLd builds valid schema for >=2 items', () => {
  const ld = faqPageJsonLd(withFaq) as { '@type': string; mainEntity: unknown[] }
  assert.equal(ld['@type'], 'FAQPage')
  assert.equal(ld.mainEntity.length, 2)
})

test('faqPageJsonLd returns null for a single-question FAQ', () => {
  const c = `## FAQ

### Only one question?

Yes.`
  assert.equal(faqPageJsonLd(c), null)
})

test('faqPageJsonLd returns null when no FAQ section', () => {
  assert.equal(faqPageJsonLd('## Intro\n\nText.'), null)
})
