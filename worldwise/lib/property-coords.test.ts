import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolvePropertyCoords } from './property-coords.ts'

const AREA = { lat: 25.08, lng: 55.14 }

test('building coords win → zoom 16, level building', () => {
  const r = resolvePropertyCoords({ lat: 25.2, lng: 55.27 }, AREA)
  assert.deepEqual(r, { lat: 25.2, lng: 55.27, zoom: 16, level: 'building' })
})

test('no property coords → area centroid, zoom 13, level area', () => {
  const r = resolvePropertyCoords({}, AREA)
  assert.deepEqual(r, { lat: 25.08, lng: 55.14, zoom: 13, level: 'area' })
})

test('neither → null (no map)', () => {
  assert.equal(resolvePropertyCoords({}, undefined), null)
})

test('partial property coords (lat only) → ignored, falls back to area', () => {
  const r = resolvePropertyCoords({ lat: 25.2 }, AREA)
  assert.equal(r?.level, 'area')
})
