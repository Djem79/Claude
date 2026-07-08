import { test } from 'node:test'
import assert from 'node:assert/strict'
import { okSignature, okSessionSecret, formatFanOutSummary, socialNetworksConfigured, vkConfig } from './social-post.ts'

test('vkConfig: wall.post uses VK_WALL_TOKEN when set, falls back to VK_ACCESS_TOKEN', () => {
  const saved = { ...process.env }
  try {
    process.env.VK_ACCESS_TOKEN = 'user-token'
    process.env.VK_GROUP_ID = '123'
    delete process.env.VK_WALL_TOKEN
    assert.equal(vkConfig()?.wallToken, 'user-token') // legacy single-token setups keep working

    process.env.VK_WALL_TOKEN = 'community-key'
    const cfg = vkConfig()
    assert.equal(cfg?.token, 'user-token')      // photo upload path
    assert.equal(cfg?.wallToken, 'community-key') // wall.post path
  } finally {
    process.env = saved
  }
})

test('okSignature: sorted params + session secret, access_token excluded', () => {
  const sig = okSignature(
    { application_key: 'CAAB', format: 'json', method: 'mediatopic.post' },
    okSessionSecret('tok123', 'sec456'),
  )
  // Vector computed independently: md5('application_key=CAABformat=jsonmethod=mediatopic.post' + md5('tok123sec456'))
  assert.equal(sig, '84e72cd678699b1401ef84d625d3fdc9')
})

test('okSignature: param order does not matter', () => {
  const a = okSignature({ b: '2', a: '1' }, okSessionSecret('t', 's'))
  const b = okSignature({ a: '1', b: '2' }, okSessionSecret('t', 's'))
  assert.equal(a, b)
})

test('formatFanOutSummary: empty when nothing configured', () => {
  assert.equal(formatFanOutSummary([]), '')
})

test('formatFanOutSummary: marks success and failure per network, failure carries the error', () => {
  const s = formatFanOutSummary([
    { network: 'vk', ok: true },
    { network: 'ok', ok: false, error: 'boom' },
  ])
  assert.equal(s, ' · VK ✓ · OK ⚠️ (boom)')
})

test('formatFanOutSummary: failure without error text stays bare', () => {
  assert.equal(formatFanOutSummary([{ network: 'vk', ok: false }]), ' · VK ⚠️')
})

test('formatFanOutSummary: long errors are truncated with an ellipsis', () => {
  const s = formatFanOutSummary([{ network: 'vk', ok: false, error: 'x'.repeat(200) }])
  assert.equal(s, ` · VK ⚠️ (${'x'.repeat(60)}…)`)
})

test('socialNetworksConfigured: reflects env vars', () => {
  const saved = { ...process.env }
  try {
    delete process.env.VK_ACCESS_TOKEN
    delete process.env.VK_GROUP_ID
    delete process.env.OK_ACCESS_TOKEN
    delete process.env.OK_APP_KEY
    delete process.env.OK_APP_SECRET
    delete process.env.OK_SESSION_SECRET
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
