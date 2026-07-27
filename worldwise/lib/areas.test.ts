import { test } from 'node:test'
import assert from 'node:assert/strict'
import { areas, areaSlugs, getArea, propertyMatchesArea } from './areas.ts'

// propertyMatchesArea decides which listings show on each district landing page.
// Property.area is free text from the CRM and PDF imports, so this matcher is
// deliberately tolerant — and that tolerance is exactly what can go wrong
// (CLAUDE.md warns short alias tokens must not false-positive). Untested until
// the 2026-07-27 audit, despite the symmetric propertyMatchesDeveloper having tests.

const marina = getArea('dubai-marina')!
const hills = getArea('dubai-hills')!
const hills2 = getArea('damac-hills-2')!
const damacHills = getArea('damac-hills')!
const jlt = getArea('jlt')!

test('every area slug resolves and areaSlugs matches the data', () => {
  assert.equal(areaSlugs.length, areas.length)
  for (const slug of areaSlugs) assert.ok(getArea(slug), `missing area: ${slug}`)
  assert.equal(getArea('not-a-district'), undefined)
})

test('exact and case-insensitive area names match', () => {
  assert.ok(propertyMatchesArea('Dubai Marina', marina))
  assert.ok(propertyMatchesArea('dubai marina', marina))
  assert.ok(propertyMatchesArea('  DUBAI MARINA  ', marina))
})

test('a longer district name still matches its area', () => {
  // "Dubai Hills Estate" is how the CRM usually spells it.
  assert.ok(propertyMatchesArea('Dubai Hills Estate', hills))
})

test('missing or empty area never matches', () => {
  assert.equal(propertyMatchesArea(undefined, marina), false)
  assert.equal(propertyMatchesArea('', marina), false)
  assert.equal(propertyMatchesArea('   ', marina), false)
})

test('an unrelated district does not match', () => {
  assert.equal(propertyMatchesArea('Business Bay', marina), false)
  assert.equal(propertyMatchesArea('Palm Jumeirah', hills), false)
})

test('word-boundary guard: a substring inside another word is not a match', () => {
  // The whole point of the \b regex — "JLT" must not match "jltower".
  assert.equal(propertyMatchesArea('JLTower Residence', jlt), false)
  assert.ok(propertyMatchesArea('JLT Cluster D', jlt))
})

test('excludeAliases keeps Damac Hills 2 listings off the Damac Hills page', () => {
  // Without excludeAliases, "Damac Hills 2" contains "Damac Hills" and would
  // appear on both landing pages — the documented reason the field exists.
  assert.ok(propertyMatchesArea('Damac Hills 2', hills2))
  assert.equal(propertyMatchesArea('Damac Hills 2', damacHills), false)
  assert.ok(propertyMatchesArea('Damac Hills', damacHills))
})

test('aliases match spellings that share no substring with the area name', () => {
  // JLT ↔ "Jumeirah Lake Towers" is the canonical alias case.
  assert.ok(propertyMatchesArea('Jumeirah Lake Towers', jlt))
})

test('every area has the fields the landing page and sitemap rely on', () => {
  for (const a of areas) {
    assert.ok(a.slug && a.name, `area missing slug/name: ${JSON.stringify(a.slug)}`)
    assert.ok(a.metaDescription, `${a.slug}: missing metaDescription`)
    assert.ok(a.heroImage && a.tagline, `${a.slug}: missing heroImage/tagline`)
    // coords back the map fallback when a property has no lat/lng
    assert.equal(typeof a.coords?.lat, 'number', `${a.slug}: missing coords.lat`)
    assert.equal(typeof a.coords?.lng, 'number', `${a.slug}: missing coords.lng`)
    // metrics.roi is the single source of truth for district yields
    assert.ok(a.metrics?.roi, `${a.slug}: missing metrics.roi`)
    assert.ok(a.metrics.avgPrice && a.metrics.typicalSize && a.metrics.handover, `${a.slug}: incomplete metrics`)
    assert.ok(Array.isArray(a.faq) && a.faq.length > 0, `${a.slug}: missing faq`)
    assert.ok(a.whyInvest?.length > 0 && a.whatsNearby?.length > 0, `${a.slug}: missing copy blocks`)
  }
})

test('no two areas claim the same slug', () => {
  assert.equal(new Set(areaSlugs).size, areaSlugs.length)
})
