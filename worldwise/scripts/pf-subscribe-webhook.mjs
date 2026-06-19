// One-time, idempotent: subscribe the PF webhooks to our single signed endpoint.
// Run on the server: node --env-file=.env.local scripts/pf-subscribe-webhook.mjs
//
// Two integrations, two keys, ONE endpoint + ONE secret:
//   - leads (#1):    lead.created                            with PF_API_KEY/PF_API_SECRET (leads:read)
//   - listings (#2): listing.published/unpublished/action    with PF_LISTINGS_API_KEY/PF_LISTINGS_API_SECRET (listings:read)
// All subscriptions share PF_WEBHOOK_SECRET so /api/pf-webhook verifies them all.
const BASE = 'https://atlas.propertyfinder.com'
const CALLBACK = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://worldwise.pro').replace(/\/$/, '') + '/api/pf-webhook'

const LEAD_EVENTS = ['lead.created']
const LISTING_EVENTS = ['listing.published', 'listing.unpublished', 'listing.action']

async function getToken(apiKey, apiSecret) {
  const r = await fetch(`${BASE}/v1/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey, apiSecret }),
  })
  if (!r.ok) throw new Error(`auth ${r.status}: ${await r.text()}`)
  return (await r.json()).accessToken
}

// Subscribe one event idempotently with the given bearer token.
async function subscribeEvent(token, eventId) {
  const auth = { Authorization: `Bearer ${token}`, Accept: 'application/json' }
  const listRes = await fetch(`${BASE}/v1/webhooks?eventType=${eventId}`, { headers: auth })
  const list = listRes.ok ? ((await listRes.json()).data ?? []) : []
  // GET /v1/webhooks returns WebhookItem { eventId, url, createdAt }; accept callbackUrl too (schema drift).
  if (list.some((w) => w.eventId === eventId && (w.url === CALLBACK || w.callbackUrl === CALLBACK))) {
    console.log('Already subscribed:', eventId, '→', CALLBACK)
    return
  }
  const res = await fetch(`${BASE}/v1/webhooks`, {
    method: 'POST',
    headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ eventId, callbackUrl: CALLBACK, secret: process.env.PF_WEBHOOK_SECRET }),
  })
  if (!res.ok) throw new Error(`subscribe ${eventId} ${res.status}: ${await res.text()}`)
  console.log('Subscribed:', eventId, '→', CALLBACK)
}

async function subscribeWithKey(apiKey, apiSecret, events) {
  const token = await getToken(apiKey, apiSecret)
  for (const ev of events) await subscribeEvent(token, ev)
}

async function main() {
  for (const k of ['PF_API_KEY', 'PF_API_SECRET', 'PF_WEBHOOK_SECRET']) {
    if (!process.env[k]) throw new Error(`missing env ${k}`)
  }
  // Leads (integration #1) — always.
  await subscribeWithKey(process.env.PF_API_KEY, process.env.PF_API_SECRET, LEAD_EVENTS)

  // Listings (integration #2) — only if the separate listings key is configured.
  if (process.env.PF_LISTINGS_API_KEY && process.env.PF_LISTINGS_API_SECRET) {
    await subscribeWithKey(process.env.PF_LISTINGS_API_KEY, process.env.PF_LISTINGS_API_SECRET, LISTING_EVENTS)
  } else {
    console.warn('PF_LISTINGS_API_KEY/SECRET not set — skipping listing.* subscriptions (integration #2).')
  }
}

main().catch((e) => {
  console.error(e.message)
  process.exit(1)
})
