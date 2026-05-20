// Edge-compatible signed session tokens (uses Web Crypto — no Node.js Buffer)
export interface SessionPayload {
  uid: string
  username: string
  name: string
  role: 'owner' | 'manager'
}

interface TokenData extends SessionPayload {
  iat: number
  exp: number
}

export const SESSION_COOKIE = 'ww_admin_session'

const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

function getSecret(): string {
  // Dedicated high-entropy signing key — must NOT be the human ADMIN_PASSWORD,
  // otherwise a captured token can be brute-forced offline. See security-audit H1.
  const secret = process.env.SESSION_SECRET
  if (!secret) throw new Error('SESSION_SECRET env var is required')
  return secret
}

function b64url(bytes: ArrayBuffer): string {
  return btoa(String.fromCharCode(...Array.from(new Uint8Array(bytes))))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function encodePayload(data: TokenData): string {
  const json = JSON.stringify(data)
  const bytes = new TextEncoder().encode(json)
  return btoa(String.fromCharCode(...Array.from(bytes)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function decodePayload(encoded: string): TokenData {
  const binary = atob(encoded.replace(/-/g, '+').replace(/_/g, '/'))
  const bytes = Uint8Array.from(binary, c => c.charCodeAt(0))
  return JSON.parse(new TextDecoder().decode(bytes))
}

async function sign(message: string, secret: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message))
  return b64url(sig)
}

function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder()
  const aBytes = enc.encode(a)
  const bBytes = enc.encode(b)
  if (aBytes.length !== bBytes.length) return false
  let result = 0
  for (let i = 0; i < aBytes.length; i++) result |= aBytes[i] ^ bBytes[i]
  return result === 0
}

export async function createSessionToken(payload: SessionPayload): Promise<string> {
  const secret = getSecret()
  const now = Date.now()
  const data: TokenData = { ...payload, iat: now, exp: now + TOKEN_TTL_MS }
  const encoded = encodePayload(data)
  const sig = await sign(encoded, secret)
  return `${encoded}.${sig}`
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const secret = getSecret()
    const dot = token.lastIndexOf('.')
    if (dot === -1) return null
    const encoded = token.slice(0, dot)
    const sig = token.slice(dot + 1)
    const expected = await sign(encoded, secret)
    if (!timingSafeEqual(sig, expected)) return null
    const data = decodePayload(encoded)
    if (data.exp < Date.now()) return null
    const { iat: _iat, exp: _exp, ...sessionPayload } = data
    return sessionPayload
  } catch {
    return null
  }
}
