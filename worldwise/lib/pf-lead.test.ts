import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mapPfLead } from './pf-lead.ts'

const base = {
  type: 'lead.created',
  entity: { id: 'lead-created-123', type: 'lead' },
  payload: {
    channel: 'whatsapp',
    status: 'sent',
    entityType: 'listing',
    publicProfile: { id: 42 },
    listing: { id: 'L1', reference: 'PF-REF-9' },
    sender: { name: 'Jane Doe', contacts: [
      { type: 'phone', value: '+971555555555' },
      { type: 'email', value: 'jane@example.com' },
    ] },
  },
}

test('maps a full phone+email listing lead', () => {
  const f = mapPfLead(base)
  assert.equal(f.pfLeadId, 'lead-created-123')
  assert.equal(f.name, 'Jane Doe')
  assert.equal(f.phone, '+971555555555')
  assert.equal(f.email, 'jane@example.com')
  assert.equal(f.source, 'property_finder')
  assert.equal(f.message, 'Property Finder · whatsapp · listing PF-REF-9')
})

test('email-only lead → phone is empty string', () => {
  const f = mapPfLead({ ...base, payload: { ...base.payload, channel: 'email',
    sender: { name: 'No Phone', contacts: [{ type: 'email', value: 'a@b.com' }] } } })
  assert.equal(f.phone, '')
  assert.equal(f.email, 'a@b.com')
  assert.equal(f.message, 'Property Finder · email · listing PF-REF-9')
})

test('call lead with no listing → message has no listing suffix', () => {
  const f = mapPfLead({ entity: { id: 'x' }, payload: { channel: 'call',
    sender: { name: 'Caller', contacts: [{ type: 'phone', value: '050' }] } } })
  assert.equal(f.message, 'Property Finder · call')
  assert.equal(f.phone, '050')
})

test('missing sender name → fallback', () => {
  const f = mapPfLead({ entity: { id: 'y' }, payload: { channel: 'call', sender: { contacts: [] } } })
  assert.equal(f.name, 'Property Finder lead')
  assert.equal(f.phone, '')
  assert.equal(f.email, undefined)
})
