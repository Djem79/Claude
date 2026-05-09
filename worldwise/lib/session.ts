// Edge-compatible signed session tokens (uses Web Crypto — no Node.js Buffer)
export interface SessionPayload {
  uid: string
  username: string
  name: string
  role: 'owner' | 'manager'
}

export const SESSION_COOKIE = 'ww_admin_session'

function b64url(bytes: ArrayBuffer): string {
  return btoa(String.fromCharCode(...Array.from(new Uint8Array(bytes))))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function encodePayload(payload: SessionPayload): string {
  const json = JSON.stringify(payload)
  const bytes = new TextEncoder().encode(json)
  return btoa(String.fromCharCode(...Array.from(bytes)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function decodePayload(encoded: string): SessionPayload {
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

export async function createSessionToken(payload: SessionPayload): Promise<string> {
  const secret = process.env.ADMIN_PASSWORD ?? 'worldwise2026'
  const encoded = encodePayload(payload)
  const sig = await sign(encoded, secret)
  return `${encoded}.${sig}`
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const dot = token.lastIndexOf('.')
    if (dot === -1) return null
    const encoded = token.slice(0, dot)
    const sig = token.slice(dot + 1)
    const secret = process.env.ADMIN_PASSWORD ?? 'worldwise2026'
    const expected = await sign(encoded, secret)
    if (sig !== expected) return null
    return decodePayload(encoded)
  } catch {
    return null
  }
}
