import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseLeadText, normalizePhone } from './lead-parse.ts'

test('normalizePhone strips non-digits', () => {
  assert.equal(normalizePhone('+971 50 (123)-45-67'), '971501234567')
})

test('parses a labelled Property Finder block', () => {
  const r = parseLeadText(
    'Name: John Smith\nPhone: +971 50 123 4567\nEmail: john@example.com\nProperty: Marina Apt'
  )
  assert.equal(r.name, 'John Smith')
  assert.equal(r.phone, '+971 50 123 4567')
  assert.equal(r.email, 'john@example.com')
  assert.ok(r.note.includes('Marina Apt'))
})

test('parses an unlabelled paste (name / phone / email lines)', () => {
  const r = parseLeadText('Jane Doe\n+971501112233\njane@mail.ae')
  assert.equal(r.name, 'Jane Doe')
  assert.equal(r.phone, '+971501112233')
  assert.equal(r.email, 'jane@mail.ae')
})

test('returns no phone when none is valid', () => {
  const r = parseLeadText('Hi, please call me back, John')
  assert.equal(r.phone, undefined)
  assert.ok(r.note.length > 0)
})

test('takes the first valid phone and email when several exist', () => {
  const r = parseLeadText('Ali\n+97150 000 1111\nalt: +97152 222 3333\nali@x.com, ali2@y.com')
  assert.equal(normalizePhone(r.phone ?? ''), '971500001111')
  assert.equal(r.email, 'ali@x.com')
})

test('Russian labels are recognised', () => {
  const r = parseLeadText('Имя: Пётр\nТелефон: 8 916 123 45 67\nБюджет: 2M AED')
  assert.equal(r.name, 'Пётр')
  assert.equal(normalizePhone(r.phone ?? ''), '89161234567')
})

test('ignores date token before the real phone', () => {
  const r = parseLeadText('John\n15.01.2024\n+971501234567\njohn@x.com')
  assert.equal(normalizePhone(r.phone ?? ''), '971501234567')
})
