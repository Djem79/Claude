import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validateForPf, mapPropertyToPfListing } from './pf-listing-map.ts'

const complete = {
  id: '1700000000000',
  type: 'apartment',
  status: 'secondary',
  priceAed: 2_500_000,
  bedrooms: '2 BR',
  bathrooms: '2',
  sizeSqft: 1200,
  furnishingType: 'furnished',
  title: 'Luxury Apartment in Dubai Marina',
  description: 'A beautiful apartment with sea views.',
  permitNumber: '1535334714',
  amenities: ['central-ac', 'sea breeze'],
  images: [
    '/images/properties/1700000000000/1.png',
    '/images/properties/1700000000000/2.png',
  ],
}

const ctx = {
  publicProfileId: 42,
  locationId: 12345,
  companyLicense: '1265053',
  compliance: { saleType: 'secondary' },
}

test('validateForPf flags exactly the missing PF fields', () => {
  const r = validateForPf({ ...complete, bathrooms: undefined, sizeSqft: undefined, furnishingType: undefined })
  assert.equal(r.ok, false)
  assert.deepEqual(r.missing, ['bathrooms', 'sizeSqft', 'furnishingType'])
})

test('validateForPf ok:true for a complete property', () => {
  const r = validateForPf(complete)
  assert.equal(r.ok, true)
  assert.deepEqual(r.missing, [])
})

test('validateForPf lists every required field when all absent', () => {
  const r = validateForPf({ id: 'x', type: 'apartment', status: 'secondary', priceAed: 0, title: '', description: '', images: [] })
  assert.equal(r.ok, false)
  for (const f of ['title', 'description', 'priceAed', 'permitNumber', 'bathrooms', 'sizeSqft', 'furnishingType', 'images']) {
    assert.ok(r.missing.includes(f), `expected "${f}" in missing, got ${JSON.stringify(r.missing)}`)
  }
})

test('maps a sale property (secondary)', () => {
  const out = mapPropertyToPfListing(complete, ctx)
  assert.equal(out.category, 'residential')
  assert.equal(out.type, 'apartment')
  assert.equal(out.reference, complete.id)
  assert.equal(out.uaeEmirate, 'dubai')
  assert.equal(out.size, 1200)
  assert.equal(out.location.id, 12345)
  assert.equal(out.price.type, 'sale')
  assert.equal(out.price.amounts.sale, 2_500_000)
  assert.equal(out.compliance.type, 'rera')
  assert.equal(out.compliance.listingAdvertisementNumber, '1535334714')
  assert.equal(out.compliance.issuingClientLicenseNumber, '1265053')
  assert.equal(out.media.images[0].original.url, 'https://worldwise.pro/images/properties/1700000000000/1.png')
  assert.ok(out.media.images[0].original.url.startsWith('https://worldwise.pro/'))
})

test('maps a rent property to a yearly price', () => {
  const out = mapPropertyToPfListing({ ...complete, status: 'rent', priceAed: 150_000 }, ctx)
  assert.equal(out.price.type, 'yearly')
  assert.equal(out.price.amounts.yearly, 150_000)
  assert.equal(out.price.amounts.sale, undefined)
  assert.equal(out.downPayment, undefined) // no down payment on a rental
})

test('normalizes bedrooms to the PF enum', () => {
  assert.equal(mapPropertyToPfListing({ ...complete, bedrooms: '2 BR' }, ctx).bedrooms, '2')
  assert.equal(mapPropertyToPfListing({ ...complete, bedrooms: 'Studio' }, ctx).bedrooms, 'studio')
  assert.equal(mapPropertyToPfListing({ ...complete, bedrooms: '1-3 Bed' }, ctx).bedrooms, '1')
})

test('keeps only PF-valid amenities and drops unknown', () => {
  const out = mapPropertyToPfListing(complete, ctx)
  assert.deepEqual(out.amenities, ['central-ac'])
})

test('maps amenity synonyms, dedups, drops unknown', () => {
  const out = mapPropertyToPfListing({ ...complete, amenities: ['Swimming Pool', 'Gym', 'pool', 'Unobtainium'] }, ctx)
  assert.ok(out.amenities.includes('shared-pool'))
  assert.ok(out.amenities.includes('shared-gym'))
  assert.equal(out.amenities.filter((a) => a === 'shared-pool').length, 1) // deduped
  assert.ok(!out.amenities.some((a) => /unobtainium/i.test(a)))
})

test('strips non-ASCII (emoji / typographic) from title + description', () => {
  const out = mapPropertyToPfListing({ ...complete, title: 'Luxury 🏙 Apartment · Marina', description: 'Sea — view 🌊 here' }, ctx)
  assert.ok(!/[^\x00-\x7F]/.test(out.title.en), `title not ASCII: ${out.title.en}`)
  assert.ok(!/[^\x00-\x7F]/.test(out.description.en), `description not ASCII: ${out.description.en}`)
  assert.ok(!out.title.en.includes('·'))
  assert.ok(out.title.en.includes('Apartment'))
})

test('derives projectStatus from the real nested compliance shape', () => {
  // sale + DLD saleType 'Primary' (capitalised, nested under data[].property)
  const primary = mapPropertyToPfListing(
    { ...complete, status: 'off-plan' },
    { ...ctx, compliance: { data: [{ property: { saleType: 'Primary' } }] } },
  )
  assert.equal(primary.projectStatus, 'off_plan_primary')

  const secondary = mapPropertyToPfListing(
    complete,
    { ...ctx, compliance: { data: [{ property: { saleType: 'Secondary' } }] } },
  )
  assert.equal(secondary.projectStatus, 'completed_secondary')
})

test('leaves already-absolute image URLs untouched', () => {
  const out = mapPropertyToPfListing({ ...complete, images: ['https://cdn.example.com/x.jpg'] }, ctx)
  assert.equal(out.media.images[0].original.url, 'https://cdn.example.com/x.jpg')
})
