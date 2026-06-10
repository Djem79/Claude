import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildOciCsv, formatDubaiTime, OCI_ACTIONS } from './oci-export.ts'

// Fixed "now" for deterministic tests: 2026-06-10 12:00 UTC
const NOW = new Date('2026-06-10T12:00:00.000Z')

const HEADER = [
  'Parameters:TimeZone=+0400',
  'Google Click ID,Conversion Name,Conversion Time,Conversion Value,Conversion Currency',
]

function lines(csv: string): string[] {
  return csv.trimEnd().split('\n')
}

test('formatDubaiTime converts UTC ISO to +04:00 wall clock', () => {
  assert.equal(formatDubaiTime('2026-06-09T22:30:00.000Z'), '2026-06-10 02:30:00')
  assert.equal(formatDubaiTime('2026-01-05T10:05:09.000Z'), '2026-01-05 14:05:09')
})

test('emits header lines even when there are no rows', () => {
  const { csv, counts } = buildOciCsv([], NOW)
  assert.deepEqual(lines(csv), HEADER)
  assert.deepEqual(counts, { lead: 0, qualified: 0, deal: 0 })
})

test('skips leads without gclid and outside the 90-day window', () => {
  const { counts } = buildOciCsv(
    [
      { createdAt: '2026-06-01T00:00:00.000Z' }, // no gclid
      { gclid: 'g1', createdAt: '2026-03-01T00:00:00.000Z' }, // 101 days old
      { gclid: 'g2', createdAt: 'garbage' }, // unparseable date
      { gclid: 'g3', createdAt: '2026-07-01T00:00:00.000Z' }, // in the future
    ],
    NOW
  )
  assert.deepEqual(counts, { lead: 0, qualified: 0, deal: 0 })
})

test('a fresh new-status lead produces exactly one CRM Lead row', () => {
  const { csv, counts } = buildOciCsv(
    [{ gclid: 'Cj0Kabc', createdAt: '2026-06-09T22:30:00.000Z', status: 'new' }],
    NOW
  )
  assert.deepEqual(lines(csv), [
    ...HEADER,
    'Cj0Kabc,CRM Lead,2026-06-10 02:30:00,0,AED',
  ])
  assert.deepEqual(counts, { lead: 1, qualified: 0, deal: 0 })
})

test('in-progress lead adds CRM Qualified with the activityLog transition time', () => {
  const { csv, counts } = buildOciCsv(
    [{
      gclid: 'g1',
      createdAt: '2026-06-01T08:00:00.000Z',
      status: 'in-progress',
      updatedAt: '2026-06-05T00:00:00.000Z',
      activityLog: [
        { at: '2026-06-02T10:00:00.000Z', action: 'Status: new → contacted' },
        { at: '2026-06-03T10:00:00.000Z', action: 'Status: contacted → in-progress, Notes updated' },
      ],
    }],
    NOW
  )
  const rows = lines(csv).slice(2)
  assert.deepEqual(rows, [
    'g1,CRM Lead,2026-06-01 12:00:00,0,AED',
    'g1,CRM Qualified,2026-06-03 14:00:00,0,AED',
  ])
  assert.deepEqual(counts, { lead: 1, qualified: 1, deal: 0 })
})

test('won lead emits all three rows; deal time from the → won entry', () => {
  const { csv, counts } = buildOciCsv(
    [{
      gclid: 'g1',
      createdAt: '2026-06-01T08:00:00.000Z',
      status: 'won',
      activityLog: [
        { at: '2026-06-02T10:00:00.000Z', action: 'Status: new → in-progress' },
        { at: '2026-06-08T09:00:00.000Z', action: 'Status: in-progress → won' },
      ],
    }],
    NOW
  )
  const rows = lines(csv).slice(2)
  assert.deepEqual(rows, [
    'g1,CRM Lead,2026-06-01 12:00:00,0,AED',
    'g1,CRM Qualified,2026-06-02 14:00:00,0,AED',
    'g1,CRM Deal,2026-06-08 13:00:00,0,AED',
  ])
  assert.deepEqual(counts, { lead: 1, qualified: 1, deal: 1 })
})

test('won lead that skipped in-progress still qualifies (won time used)', () => {
  const { csv } = buildOciCsv(
    [{
      gclid: 'g1',
      createdAt: '2026-06-01T08:00:00.000Z',
      status: 'won',
      activityLog: [{ at: '2026-06-04T09:00:00.000Z', action: 'Status: contacted → won' }],
    }],
    NOW
  )
  const rows = lines(csv).slice(2)
  assert.equal(rows.length, 3)
  assert.ok(rows[1].startsWith('g1,CRM Qualified,2026-06-04 13:00:00'))
  assert.ok(rows[2].startsWith('g1,CRM Deal,2026-06-04 13:00:00'))
})

test('lead that reached in-progress then lost still counts as qualified (history)', () => {
  const { counts } = buildOciCsv(
    [{
      gclid: 'g1',
      createdAt: '2026-06-01T08:00:00.000Z',
      status: 'lost',
      activityLog: [{ at: '2026-06-02T09:00:00.000Z', action: 'Status: new → in-progress' }],
    }],
    NOW
  )
  assert.deepEqual(counts, { lead: 1, qualified: 1, deal: 0 })
})

test('won lead with no activityLog falls back to updatedAt, clamped to ≥ createdAt', () => {
  const { csv } = buildOciCsv(
    [
      // updatedAt present and after createdAt → used as-is
      { gclid: 'g1', createdAt: '2026-06-01T08:00:00.000Z', status: 'won', updatedAt: '2026-06-05T08:00:00.000Z' },
      // updatedAt BEFORE createdAt (corrupt) → clamped to createdAt
      { gclid: 'g2', createdAt: '2026-06-01T08:00:00.000Z', status: 'won', updatedAt: '2026-05-20T08:00:00.000Z' },
    ],
    NOW
  )
  const rows = lines(csv).slice(2)
  assert.ok(rows.includes('g1,CRM Deal,2026-06-05 12:00:00,0,AED'))
  assert.ok(rows.includes('g2,CRM Deal,2026-06-01 12:00:00,0,AED'))
})

test('strips commas from a hostile gclid so CSV columns cannot shift', () => {
  const { csv } = buildOciCsv(
    [{ gclid: 'abc,def', createdAt: '2026-06-09T08:00:00.000Z' }],
    NOW
  )
  assert.ok(lines(csv)[2].startsWith('abcdef,CRM Lead,'))
})

test('OCI_ACTIONS names are the exact Google Ads conversion action names', () => {
  assert.deepEqual(OCI_ACTIONS, { lead: 'CRM Lead', qualified: 'CRM Qualified', deal: 'CRM Deal' })
})
