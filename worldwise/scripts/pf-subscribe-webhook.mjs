// One-time, idempotent: subscribe the PF `lead.created` webhook to our endpoint.
// Run on the server: node --env-file=.env.local scripts/pf-subscribe-webhook.mjs
const BASE = 'https://atlas.propertyfinder.com'
const EVENT = 'lead.created'
const CALLBACK = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://worldwise.pro').replace(/\/$/, '') + '/api/pf-webhook'

async function getToken() {
  const r = await fetch(`${BASE}/v1/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey: process.env.PF_API_KEY, apiSecret: process.env.PF_API_SECRET }),
  })
  if (!r.ok) throw new Error(`auth ${r.status}: ${await r.text()}`)
  return (await r.json()).accessToken
}

async function main() {
  for (const k of ['PF_API_KEY', 'PF_API_SECRET', 'PF_WEBHOOK_SECRET']) {
    if (!process.env[k]) throw new Error(`missing env ${k}`)
  }
  const token = await getToken()
  const auth = { Authorization: `Bearer ${token}`, Accept: 'application/json' }

  const listRes = await fetch(`${BASE}/v1/webhooks?eventType=${EVENT}`, { headers: auth })
  const list = listRes.ok ? ((await listRes.json()).data ?? []) : []
  // GET /v1/webhooks returns WebhookItem { eventId, url, createdAt }; accept callbackUrl too (schema drift).
  if (list.some((w) => w.eventId === EVENT && (w.url === CALLBACK || w.callbackUrl === CALLBACK))) {
    console.log('Already subscribed:', EVENT, '→', CALLBACK)
    return
  }

  const res = await fetch(`${BASE}/v1/webhooks`, {
    method: 'POST',
    headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ eventId: EVENT, callbackUrl: CALLBACK, secret: process.env.PF_WEBHOOK_SECRET }),
  })
  if (!res.ok) throw new Error(`subscribe ${res.status}: ${await res.text()}`)
  console.log('Subscribed:', EVENT, '→', CALLBACK)
}

main().catch((e) => {
  console.error(e.message)
  process.exit(1)
})
