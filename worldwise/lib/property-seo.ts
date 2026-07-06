// lib/property-seo.ts
// Pure SEO helpers for the property detail page: search-pattern <title>, meta
// description, and a data-driven FAQ (rendered + FAQPage JSON-LD). Project-name
// queries follow stable patterns — "<project> price", "<project> payment plan",
// "<project> handover" — so the tags and questions mirror them token-for-token.
//
// PURE module (node:test'd in property-seo.test.ts): no fs/next imports, no
// value-imports from other lib modules (see the canonicalizeArea lesson).
// Golden-visa eligibility is therefore passed IN by the call site, which owns
// lib/golden-visa.ts.

import type { Property } from '@/types'

export interface FaqItem {
  q: string
  a: string
}

// Local mirror of lib/format.ts formatAedCompact (pure-module no-value-import
// rule) — "AED 2.45M" / "AED 850K". Keep rounding in sync if format.ts changes.
function aedCompact(aed: number): string {
  if (aed >= 1_000_000) {
    const m = aed / 1_000_000
    return `AED ${m % 1 === 0 ? m.toFixed(0) : m.toFixed(2)}M`
  }
  if (aed >= 1_000) return `AED ${Math.round(aed / 1_000)}K`
  return `AED ${aed}`
}

/**
 * <title> matching how buyers search a specific project.
 * Off-plan queries carry "price" / "payment plan"; resale queries are
 * price-led; rent listings are rent-led. Developer name stays in — project
 * queries very often include it ("mercer house ellington").
 */
export function propertyTitleTag(p: Property, year: number): string {
  const by = p.developer ? ` by ${p.developer}` : ''
  if (p.status === 'off-plan') return `${p.title}${by} — Price & Payment Plan ${year}`
  if (p.status === 'rent') return `${p.title}${by} — for Rent in ${p.area}, Dubai`
  return `${p.title}${by} — ${aedCompact(p.priceAed)} in ${p.area}, Dubai`
}

/**
 * Meta description: hard facts first (price, payment plan, handover — the
 * tokens project-name searchers scan for), then the listing's own short
 * description, capped so Google doesn't mid-word truncate.
 */
export function propertyMetaDescription(p: Property): string {
  const facts: string[] = []
  if (p.priceAed > 0) {
    facts.push(p.status === 'off-plan' ? `From ${aedCompact(p.priceAed)}` : aedCompact(p.priceAed))
  }
  if (p.status === 'off-plan' && p.paymentPlan && p.paymentPlan.length <= 30) {
    facts.push(`${p.paymentPlan} payment plan`)
  }
  if (p.completionDate) facts.push(`handover ${p.completionDate}`)

  const lead = facts.length
    ? `${p.title} in ${p.area}, Dubai: ${facts.join(', ')}.`
    : `${p.title} in ${p.area}, Dubai.`
  const rest = ` ${p.shortDescription ?? ''} RERA-certified listing.`
  return (lead + rest).replace(/\s+/g, ' ').trim().slice(0, 300)
}

/**
 * Data-driven FAQ. Every entry requires its source field — never fabricated.
 * `goldenVisa` comes from the call site (qualifiesForGoldenVisa(priceAed)).
 * The page renders the section only when ≥2 questions survive.
 */
export function buildPropertyFaq(p: Property, opts: { goldenVisa: boolean }): FaqItem[] {
  const faq: FaqItem[] = []
  const price = aedCompact(p.priceAed)

  if (p.priceAed > 0) {
    if (p.status === 'off-plan') {
      faq.push({
        q: `What is the starting price of ${p.title}?`,
        a: `Prices start from ${price}${p.pricePerSqft ? ` (around AED ${p.pricePerSqft.toLocaleString('en-US')} per sq ft)` : ''}. Contact us for current unit availability and exact prices.`,
      })
    } else if (p.status === 'rent') {
      faq.push({
        q: `What is the rent for ${p.title}?`,
        a: `${p.title} is listed at ${price}. Contact us to confirm availability and viewing times.`,
      })
    } else {
      faq.push({
        q: `How much does ${p.title} cost?`,
        a: `This ${p.type} is listed at ${price}${p.pricePerSqft ? ` (around AED ${p.pricePerSqft.toLocaleString('en-US')} per sq ft)` : ''}.`,
      })
    }
  }

  if (p.status === 'off-plan' && p.paymentPlan) {
    const short = p.paymentPlan.length <= 40
    faq.push({
      q: `What is the payment plan for ${p.title}?`,
      a: short
        ? `${p.developer || 'The developer'} offers a ${p.paymentPlan} payment plan${p.completionDate ? `, with handover expected ${p.completionDate}` : ''}.`
        : p.paymentPlan,
    })
  }

  if (p.status === 'off-plan' && p.completionDate) {
    faq.push({
      q: `When is the handover of ${p.title}?`,
      a: `Completion is expected ${p.completionDate}. Off-plan timelines are set by the developer and tracked under DLD escrow rules.`,
    })
  }

  if (opts.goldenVisa && p.status !== 'rent') {
    faq.push({
      q: `Does buying ${p.title} qualify for the UAE Golden Visa?`,
      a: `Yes — at ${price} this property meets the AED 2M threshold for the 10-year UAE Golden Visa. We assist buyers with the full application.`,
    })
  }

  if (p.grossYield && p.status !== 'rent') {
    faq.push({
      q: `What rental yield can ${p.title} generate?`,
      a: `Comparable properties in ${p.area} achieve gross rental yields of around ${p.grossYield}% per year.`,
    })
  }

  if (p.area) {
    faq.push({
      q: `Where is ${p.title} located?`,
      a: `${p.title} is located in ${p.area}, Dubai, United Arab Emirates.`,
    })
  }

  return faq
}
