import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

// node --test strips types; @/ aliases don't resolve in node:test, so use relative paths.
import { landings, landingSlugs, getLanding, propertiesForLanding } from './landings.ts'
import type { Property } from '../types/index.ts'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeProperty(overrides: Partial<Property> = {}): Property {
  return {
    id: 'test-1',
    slug: 'test-property',
    title: 'Test Property',
    developer: 'Test Dev',
    area: 'Dubai Marina',
    type: 'apartment',
    status: 'secondary',
    priceAed: 1_000_000,
    bedrooms: '1',
    description: 'desc',
    shortDescription: 'short',
    amenities: [],
    images: [],
    featured: false,
    createdAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// landingSlugs uniqueness
// ---------------------------------------------------------------------------

describe('landingSlugs', () => {
  it('are unique', () => {
    const set = new Set(landingSlugs)
    assert.equal(set.size, landingSlugs.length, 'Duplicate slug found in landings')
  })
})

// ---------------------------------------------------------------------------
// Required fields on every landing
// ---------------------------------------------------------------------------

describe('landings data integrity', () => {
  for (const l of landings) {
    it(`landing "${l.slug}" has required fields`, () => {
      assert.ok(l.slug, 'Missing slug')
      assert.ok(l.h1, 'Missing h1')
      assert.ok(l.metaTitle, 'Missing metaTitle')
      assert.ok(l.metaDescription, 'Missing metaDescription')
      assert.ok(l.intro, 'Missing intro')
      assert.ok(l.gridHeading, 'Missing gridHeading')
      assert.ok(l.leadSource, 'Missing leadSource')
    })

    it(`landing "${l.slug}" has non-empty faq`, () => {
      assert.ok(Array.isArray(l.faq) && l.faq.length > 0, 'faq must be non-empty')
      for (const item of l.faq) {
        assert.ok(item.q, 'FAQ item missing question')
        assert.ok(item.a, 'FAQ item missing answer')
      }
    })

    it(`landing "${l.slug}" has non-empty sections`, () => {
      assert.ok(Array.isArray(l.sections) && l.sections.length > 0, 'sections must be non-empty')
    })
  }
})

// ---------------------------------------------------------------------------
// getLanding
// ---------------------------------------------------------------------------

describe('getLanding', () => {
  it('returns the landing for a known slug', () => {
    const l = getLanding('buy-apartment-in-dubai')
    assert.ok(l)
    assert.equal(l.slug, 'buy-apartment-in-dubai')
  })

  it('returns undefined for an unknown slug', () => {
    assert.equal(getLanding('unknown-slug'), undefined)
  })
})

// ---------------------------------------------------------------------------
// propertiesForLanding
// ---------------------------------------------------------------------------

describe('propertiesForLanding', () => {
  const landing = getLanding('buy-apartment-in-dubai')!

  it('filters by type: only apartments pass', () => {
    const properties = [
      makeProperty({ id: '1', type: 'apartment' }),
      makeProperty({ id: '2', type: 'villa' }),
      makeProperty({ id: '3', type: 'apartment' }),
    ]
    const result = propertiesForLanding(landing, properties)
    assert.equal(result.length, 2)
    assert.ok(result.every(p => p.type === 'apartment'))
  })

  it('filters by maxPriceAed when set', () => {
    // Build a landing with a price cap
    const cappedLanding = {
      ...landing,
      propertyFilter: { ...landing.propertyFilter, maxPriceAed: 1_000_000 },
    }
    const properties = [
      makeProperty({ id: '1', type: 'apartment', priceAed: 800_000 }),
      makeProperty({ id: '2', type: 'apartment', priceAed: 1_000_000 }),
      makeProperty({ id: '3', type: 'apartment', priceAed: 1_500_000 }),
    ]
    const result = propertiesForLanding(cappedLanding, properties)
    assert.equal(result.length, 2)
    assert.ok(result.every(p => p.priceAed <= 1_000_000))
  })

  it('filters by area substring (case-insensitive)', () => {
    const areaLanding = {
      ...landing,
      propertyFilter: { type: 'apartment' as const, area: 'Marina' },
    }
    const properties = [
      makeProperty({ id: '1', type: 'apartment', area: 'Dubai Marina' }),
      makeProperty({ id: '2', type: 'apartment', area: 'Downtown Dubai' }),
      makeProperty({ id: '3', type: 'apartment', area: 'dubai marina estates' }),
    ]
    const result = propertiesForLanding(areaLanding, properties)
    assert.equal(result.length, 2)
  })

  it('caps results at 6', () => {
    const properties = Array.from({ length: 10 }, (_, i) =>
      makeProperty({ id: String(i), type: 'apartment' }),
    )
    const result = propertiesForLanding(landing, properties)
    assert.equal(result.length, 6)
  })

  it('returns [] when no properties match', () => {
    const properties = [makeProperty({ id: '1', type: 'villa' })]
    const result = propertiesForLanding(landing, properties)
    assert.equal(result.length, 0)
  })
})
