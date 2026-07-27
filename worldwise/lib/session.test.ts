import { test } from 'node:test'
import assert from 'node:assert/strict'

// SESSION_SECRET must exist before the module is used — getSecret() throws without it.
process.env.SESSION_SECRET = 'test-secret-not-a-real-key-0123456789'

const { createSessionToken, verifySessionToken, SESSION_COOKIE } = await import('./session.ts')

// The token format is declared untouchable in CLAUDE.md: the HMAC signs the exact
// payload shape, so changing it silently invalidates every live admin session.
// These tests pin the contract (round-trip, tamper rejection, expiry, shape).

const payload = {
  uid: 'u_123',
  username: 'admin',
  name: 'Test Owner',
  role: 'owner' as const,
}

test('a freshly issued token round-trips back to the same payload', async () => {
  const token = await createSessionToken(payload)
  const out = await verifySessionToken(token)
  assert.deepEqual(out, payload)
})

test('the payload carries no iat/exp — they are stripped on verify', async () => {
  const out = await verifySessionToken(await createSessionToken(payload))
  assert.ok(out)
  assert.equal('iat' in out, false)
  assert.equal('exp' in out, false)
  // Adding a field here means every existing session breaks — see CLAUDE.md.
  assert.deepEqual(Object.keys(out).sort(), ['name', 'role', 'uid', 'username'])
})

test('token shape stays base64url(payload).signature', async () => {
  const token = await createSessionToken(payload)
  const dot = token.lastIndexOf('.')
  assert.ok(dot > 0, 'token must contain a separator')
  // base64url only — no +, /, or = padding, so it is cookie-safe.
  assert.match(token.slice(0, dot), /^[A-Za-z0-9_-]+$/)
  assert.match(token.slice(dot + 1), /^[A-Za-z0-9_-]+$/)
})

test('a tampered payload is rejected', async () => {
  const token = await createSessionToken(payload)
  const dot = token.lastIndexOf('.')
  // Re-encode the payload with role escalated to owner-of-another-uid, keep the old signature.
  const forged = btoa(JSON.stringify({ ...payload, uid: 'u_evil', iat: Date.now(), exp: Date.now() + 1000 }))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
  assert.equal(await verifySessionToken(`${forged}.${token.slice(dot + 1)}`), null)
})

test('a tampered signature is rejected', async () => {
  const token = await createSessionToken(payload)
  const dot = token.lastIndexOf('.')
  const sig = token.slice(dot + 1)
  const flipped = (sig[0] === 'A' ? 'B' : 'A') + sig.slice(1)
  assert.equal(await verifySessionToken(`${token.slice(0, dot)}.${flipped}`), null)
})

test('a token signed with a different secret is rejected', async () => {
  const token = await createSessionToken(payload)
  const original = process.env.SESSION_SECRET
  process.env.SESSION_SECRET = 'a-completely-different-secret-value'
  const out = await verifySessionToken(token)
  process.env.SESSION_SECRET = original
  assert.equal(out, null, 'rotating SESSION_SECRET must invalidate existing sessions')
})

test('malformed tokens are rejected, never thrown', async () => {
  for (const bad of ['', 'no-dot-at-all', '.', 'a.', '.b', 'not-base64!!.sig', 'a.b.c']) {
    assert.equal(await verifySessionToken(bad), null, `should reject: ${JSON.stringify(bad)}`)
  }
})

test('an expired token is rejected even with a valid signature', async () => {
  // Issue a token, then move "now" past its 7-day TTL.
  const token = await createSessionToken(payload)
  const realNow = Date.now
  Date.now = () => realNow() + 8 * 24 * 60 * 60 * 1000
  try {
    assert.equal(await verifySessionToken(token), null)
  } finally {
    Date.now = realNow
  }
})

test('the cookie name is stable', () => {
  // proxy.ts, the login route and the Cloudflare cache-rule exclusion all key on it.
  assert.equal(SESSION_COOKIE, 'ww_admin_session')
})
