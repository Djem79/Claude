import { test } from 'node:test'
import assert from 'node:assert/strict'
import { okSignature, formatFanOutSummary, socialNetworksConfigured } from './social-post.ts'

test('okSignature: sorted params + md5(token+secret), access_token excluded', () => {
  const sig = okSignature(
    { application_key: 'CAAB', format: 'json', method: 'mediatopic.post' },
    'tok123',
    'sec456',
  )
  // Vector computed independently: md5('application_key=CAABformat=jsonmethod=mediatopic.post' + md5('tok123sec456'))
  assert.equal(sig, '84e72cd678699b1401ef84d625d3fdc9')
})

test('okSignature: param order does not matter', () => {
  const a = okSignature({ b: '2', a: '1' }, 't', 's')
  const b = okSignature({ a: '1', b: '2' }, 't', 's')
  assert.equal(a, b)
})

test('formatFanOutSummary: empty when nothing configured', () => {
  assert.equal(formatFanOutSummary([]), '')
})

test('formatFanOutSummary: marks success and failure per network', () => {
  const s = formatFanOutSummary([
    { network: 'vk', ok: true },
    { network: 'ok', ok: false, error: 'boom' },
  ])
  assert.equal(s, ' · VK ✓ · OK ⚠️')
})

test('socialNetworksConfigured: reflects env vars', () => {
  const saved = { ...process.env }
  try {
    delete process.env.VK_ACCESS_TOKEN
    delete process.env.VK_GROUP_ID
    delete process.env.OK_ACCESS_TOKEN
    delete process.env.OK_APP_KEY
    delete process.env.OK_APP_SECRET
    delete process.env.OK_GROUP_ID
    assert.deepEqual(socialNetworksConfigured(), [])

    process.env.VK_ACCESS_TOKEN = 't'
    process.env.VK_GROUP_ID = '123'
    assert.deepEqual(socialNetworksConfigured(), ['vk'])

    process.env.OK_ACCESS_TOKEN = 't'
    process.env.OK_APP_KEY = 'k'
    process.env.OK_APP_SECRET = 's'
    process.env.OK_GROUP_ID = '456'
    assert.deepEqual(socialNetworksConfigured(), ['vk', 'ok'])
  } finally {
    process.env = saved
  }
})
