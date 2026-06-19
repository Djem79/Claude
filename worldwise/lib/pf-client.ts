// Server-only Property Finder Enterprise API client (token cache + pfFetch).
// Imported ONLY from server routes (like lib/notify.ts / lib/properties.ts) — this
// repo doesn't use the `server-only` package, so the same convention applies here.
// NOTE: the `.mjs` subscribe script keeps its OWN token fetch — it can't import this .ts.

const BASE = 'https://atlas.propertyfinder.com'

export interface PfCreds {
  apiKey: string
  apiSecret: string
}

// Token cache keyed by apiKey, so the leads key and the listings key cache separately.
const cache = new Map<string, { token: string; expiresAt: number }>()

async function fetchToken(creds: PfCreds): Promise<{ token: string; expiresAt: number }> {
  const r = await fetch(`${BASE}/v1/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey: creds.apiKey, apiSecret: creds.apiSecret }),
  })
  if (!r.ok) throw new Error(`PF auth ${r.status}: ${await r.text()}`)
  const j = await r.json()
  // Refresh ~60s before the documented 30-min expiry so an in-flight call never 401s.
  return { token: j.accessToken, expiresAt: Date.now() + (j.expiresIn ?? 1800) * 1000 - 60_000 }
}

async function getAccessToken(creds: PfCreds): Promise<string> {
  const c = cache.get(creds.apiKey)
  if (c && Date.now() < c.expiresAt) return c.token
  const fresh = await fetchToken(creds)
  cache.set(creds.apiKey, fresh)
  return fresh.token
}

// Listings credentials (integration #2). The leads integration (#1) uses its own
// PF_API_KEY/PF_API_SECRET elsewhere — least-privilege, independently revocable.
export function listingCreds(): PfCreds {
  return { apiKey: process.env.PF_LISTINGS_API_KEY!, apiSecret: process.env.PF_LISTINGS_API_SECRET! }
}

// Authenticated fetch against the PF API. Returns the raw Response — callers decide
// how to handle non-2xx (the listing routes surface PF error bodies to the admin).
export async function pfFetch(
  path: string,
  init: RequestInit = {},
  creds: PfCreds = listingCreds(),
): Promise<Response> {
  const token = await getAccessToken(creds)
  const headers = { ...(init.headers ?? {}), Authorization: `Bearer ${token}`, Accept: 'application/json' }
  return fetch(`${BASE}${path}`, { ...init, headers })
}
