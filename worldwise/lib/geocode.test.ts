import { test } from 'node:test'
import assert from 'node:assert/strict'
import { acceptGeocode } from './geocode.ts'

test('accepts a ROOFTOP result inside Dubai for a named project', () => {
  assert.equal(acceptGeocode('Mercer House', { lat: 25.06, lng: 55.14, type: 'ROOFTOP' }), true)
})
test('accepts GEOMETRIC_CENTER inside Dubai for a named project', () => {
  assert.equal(acceptGeocode('Sobha Seahaven', { lat: 25.09, lng: 55.14, type: 'GEOMETRIC_CENTER' }), true)
})
test('rejects a generic resale title even when the point is fine', () => {
  assert.equal(acceptGeocode('3-Bedroom Apartment in Dubai Hills Estate', { lat: 25.1, lng: 55.25, type: 'ROOFTOP' }), false)
})
test('rejects APPROXIMATE results', () => {
  assert.equal(acceptGeocode('Some Tower', { lat: 25.1, lng: 55.25, type: 'APPROXIMATE' }), false)
})
test('rejects a point outside the Dubai bounding box', () => {
  assert.equal(acceptGeocode('Oman Villa', { lat: 23.6, lng: 58.5, type: 'ROOFTOP' }), false)
})
test('null result → false', () => {
  assert.equal(acceptGeocode('X', null), false)
})
