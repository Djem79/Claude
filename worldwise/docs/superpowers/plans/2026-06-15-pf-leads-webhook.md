# Property Finder leads → CRM webhook — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ingest Property Finder `lead.created` webhooks into the existing CRM (`data/leads.json`) with `source: property_finder`, firing the existing lead notifications — zero manual entry.

**Architecture:** A signed Node route `POST /api/pf-webhook` verifies an HMAC over the raw body, a pure mapper turns the PF payload into our `Lead` shape, an idempotent `savePfLead` inserts it inside the existing `mutateLeads` critical section (dedup on `pfLeadId`), then the existing `notifyTelegram`/`notifyEmail` fire. A one-time script subscribes the webhook.

**Tech Stack:** Next.js 16 App Router (Node runtime), TypeScript, Node `crypto` (HMAC), `node:test` for the pure mapper. PF Enterprise API base `https://atlas.propertyfinder.com`.

Spec: `docs/superpowers/specs/2026-06-15-pf-leads-webhook-design.md`.

## File structure

- Create `lib/pf-lead.ts` — pure mapper `mapPfLead(event) → PfLeadFields` (no fs/net/`@/` imports).
- Create `lib/pf-lead.test.ts` — `node:test` cases for the mapper.
- Modify `types/index.ts` — add `pfLeadId?: string` to `Lead`.
- Modify `lib/leads.ts` — add `savePfLead(...)` (idempotent insert via existing private `mutateLeads`).
- Create `app/api/pf-webhook/route.ts` — signed POST handler.
- Create `scripts/pf-subscribe-webhook.mjs` — one-time idempotent webhook subscription.
- Modify `.env.example` — document `PF_API_KEY`, `PF_API_SECRET`, `PF_WEBHOOK_SECRET`.

---

### Task 1: Pure mapper `lib/pf-lead.ts` (TDD)

**Files:**
- Create: `lib/pf-lead.ts`
- Test: `lib/pf-lead.test.ts`

- [ ] **Step 1: Write the failing test**

`lib/pf-lead.test.ts`:
```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test --experimental-strip-types lib/pf-lead.test.ts`
Expected: FAIL — `Cannot find module './pf-lead.ts'` / `mapPfLead is not a function`.

- [ ] **Step 3: Write minimal implementation**

`lib/pf-lead.ts`:
```ts
// Pure mapper: Property Finder `lead.created` webhook payload → our Lead fields.
// No fs/net/`@/` imports — keep it node:test-runnable like lib/lead-parse.ts.

export interface PfLeadFields {
  pfLeadId: string
  name: string
  phone: string
  email?: string
  message: string
  source: 'property_finder'
}

interface PfContact { type?: string; value?: string }
interface PfLeadEvent {
  entity?: { id?: string }
  payload?: {
    channel?: string
    listing?: { reference?: string }
    sender?: { name?: string; contacts?: PfContact[] }
  }
}

export function mapPfLead(event: PfLeadEvent): PfLeadFields {
  const contacts = event.payload?.sender?.contacts ?? []
  const phone = contacts.find((c) => c?.type === 'phone')?.value ?? ''
  const email = contacts.find((c) => c?.type === 'email')?.value
  const channel = event.payload?.channel ?? 'unknown'
  const ref = event.payload?.listing?.reference
  const message = `Property Finder · ${channel}` + (ref ? ` · listing ${ref}` : '')
  return {
    pfLeadId: String(event.entity?.id ?? ''),
    name: event.payload?.sender?.name?.trim() || 'Property Finder lead',
    phone: String(phone).trim(),
    email: email ? String(email).trim() : undefined,
    message,
    source: 'property_finder',
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test --experimental-strip-types lib/pf-lead.test.ts`
Expected: PASS — 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/pf-lead.ts lib/pf-lead.test.ts
git commit -m "feat(pf): pure PF lead → CRM field mapper + tests"
```

---

### Task 2: `Lead.pfLeadId` + idempotent `savePfLead`

**Files:**
- Modify: `types/index.ts` (Lead interface, after `source`)
- Modify: `lib/leads.ts` (new export `savePfLead`)

No unit test: `savePfLead` is fs-bound through `mutateJsonFile` (same as `saveLead`, which also has no unit test). It is covered by `npm run build` (types) and the live verification in Task 5.

- [ ] **Step 1: Add the type field**

In `types/index.ts`, inside `interface Lead`, add after the `source: string` line:
```ts
  pfLeadId?: string   // Property Finder lead id (dedup + provenance for portal webhook leads)
```

- [ ] **Step 2: Add `savePfLead` to `lib/leads.ts`**

Append after `saveLead` (uses the existing module-private `mutateLeads`):
```ts
/**
 * Idempotent insert for Property Finder webhook leads. PF delivers at-least-once,
 * so the dedup-by-pfLeadId check and the insert happen in ONE mutateLeads section.
 * Returns the existing lead (deduped:true) on a repeat delivery, else the new one.
 */
export function savePfLead(
  data: Omit<Lead, 'id' | 'createdAt' | 'status'> & { pfLeadId: string },
): { lead: Lead; deduped: boolean } {
  let result: { lead: Lead; deduped: boolean } | null = null
  mutateLeads((leads) => {
    const existing = leads.find((l) => l.pfLeadId === data.pfLeadId)
    if (existing) {
      result = { lead: existing, deduped: true }
      return leads
    }
    let id = Date.now()
    while (leads.some((l) => l.id === String(id))) id++
    const lead: Lead = { ...data, id: String(id), status: 'new', createdAt: new Date().toISOString() }
    result = { lead, deduped: false }
    return [lead, ...leads]
  })
  return result!
}
```

- [ ] **Step 3: Type-check**

Run: `export PATH="/Users/dzhambulat/.nvm/versions/node/v24.15.0/bin:$PATH" && npx tsc --noEmit -p tsconfig.json` (or rely on `npm run build` in Task 5)
Expected: no errors referencing `savePfLead`/`pfLeadId`.

- [ ] **Step 4: Commit**

```bash
git add types/index.ts lib/leads.ts
git commit -m "feat(pf): Lead.pfLeadId + idempotent savePfLead (dedup in mutateLeads)"
```

---

### Task 3: Route `app/api/pf-webhook/route.ts`

**Files:**
- Create: `app/api/pf-webhook/route.ts`

- [ ] **Step 1: Write the route**

```ts
import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { savePfLead } from '@/lib/leads'
import { mapPfLead } from '@/lib/pf-lead'
import { notifyTelegram, notifyEmail } from '@/lib/notify'

export const runtime = 'nodejs'

// HMAC-SHA256 over the RAW request body (PF signs the exact bytes), timing-safe.
function verifySignature(raw: string, signature: string | null, secret: string | undefined): boolean {
  if (!signature || !secret) return false
  const expected = crypto.createHmac('sha256', secret).update(raw, 'utf8').digest('hex')
  const a = Buffer.from(signature)
  const b = Buffer.from(expected)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

export async function POST(req: Request) {
  const raw = await req.text()
  if (!verifySignature(raw, req.headers.get('x-signature'), process.env.PF_WEBHOOK_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let event: unknown
  try {
    event = JSON.parse(raw)
  } catch {
    return NextResponse.json({ ok: true }) // ack malformed body so PF stops retrying
  }

  const e = event as { type?: string }
  if (e?.type !== 'lead.created') {
    return NextResponse.json({ ok: true }) // ignore other event types
  }

  const fields = mapPfLead(event as Parameters<typeof mapPfLead>[0])
  if (!fields.pfLeadId) return NextResponse.json({ ok: true })

  const { lead, deduped } = savePfLead(fields)

  if (!deduped) {
    // Lead is already persisted; notifications are best-effort and must not break the <5s ack.
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://worldwise.pro'
    await Promise.allSettled([notifyTelegram(lead, baseUrl), notifyEmail(lead)])
  }

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Verify imports resolve**

Run: `grep -nE "export (async )?function (notifyTelegram|notifyEmail)" lib/notify.ts`
Expected: both present (signatures `notifyTelegram(lead, baseUrl)`, `notifyEmail(lead)`). If a name differs, fix the import.

- [ ] **Step 3: Commit**

```bash
git add app/api/pf-webhook/route.ts
git commit -m "feat(pf): signed /api/pf-webhook ingests lead.created into CRM"
```

---

### Task 4: Subscription script + `.env.example`

**Files:**
- Create: `scripts/pf-subscribe-webhook.mjs`
- Modify: `.env.example`

- [ ] **Step 1: Write the script**

`scripts/pf-subscribe-webhook.mjs`:
```js
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
  if (list.some((w) => w.eventId === EVENT && w.url === CALLBACK)) {
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
```

- [ ] **Step 2: Document env vars**

Append to `.env.example`:
```bash
# Property Finder Enterprise API (leads → CRM webhook). Server-only.
PF_API_KEY=
PF_API_SECRET=
PF_WEBHOOK_SECRET=
```

- [ ] **Step 3: Commit**

```bash
git add scripts/pf-subscribe-webhook.mjs .env.example
git commit -m "feat(pf): webhook subscription script + .env.example entries"
```

---

### Task 5: Local verification, deploy, subscribe, live test

**Files:** none (verification + deploy)

- [ ] **Step 1: Run the mapper tests**

Run: `node --test --experimental-strip-types lib/pf-lead.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 2: Production build**

Run: `export PATH="/Users/dzhambulat/.nvm/versions/node/v24.15.0/bin:$PATH" && npm run build`
Expected: green; `/api/pf-webhook` appears in the route list.

- [ ] **Step 3: Add secrets to server `.env.local`**

Generate a webhook secret: `openssl rand -hex 16` (≤32 chars). Append to `/var/www/worldwise/.env.local` on the server:
```
PF_API_KEY=<40-char key>
PF_API_SECRET=<32-char secret>
PF_WEBHOOK_SECRET=<openssl hex>
```
(Do this over SSH; never commit these.)

- [ ] **Step 4: Deploy (standard flow)**

Back up `data/`, rsync working tree, then on server `npm run build && pm2 restart worldwise` (see `worldwise/CLAUDE.md` → Production deployment). Before the server build, `grep -q "pf-webhook" app/api/pf-webhook/route.ts` to confirm the file synced.

- [ ] **Step 5: Subscribe the webhook (one-time)**

Run: `ssh -i ~/.ssh/id_ed25519 root@62.238.35.20 "cd /var/www/worldwise && node --env-file=.env.local scripts/pf-subscribe-webhook.mjs"`
Expected: `Subscribed: lead.created → https://worldwise.pro/api/pf-webhook`

- [ ] **Step 6: Negative test (bad signature → 401)**

Run: `curl -s -o /dev/null -w "%{http_code}\n" -X POST https://worldwise.pro/api/pf-webhook -H 'X-Signature: deadbeef' -d '{"type":"lead.created"}'`
Expected: `401`.

- [ ] **Step 7: Live test**

Trigger a real inquiry on a live PF listing (or PF's webhook test if available). Confirm: the lead appears in `/admin/leads` with `source: property_finder`, and a Telegram new-lead notification fired. Re-deliver / duplicate event id → no second lead (dedup).

---

## Self-review

- **Spec coverage:** route + HMAC (Task 3) ✓; pure mapper + tests (Task 1) ✓; idempotent dedup save (Task 2) ✓; `pfLeadId` type (Task 2) ✓; subscribe script (Task 4) ✓; env vars (Task 4 + 5) ✓; notify reuse (Task 3) ✓; verification + deploy (Task 5) ✓. v1 scope (only `lead.created`, no hot-path PF call) honored in Task 3.
- **Placeholders:** none — every code step has full code.
- **Type consistency:** `mapPfLead` returns `PfLeadFields` (Task 1); `savePfLead` takes `Omit<Lead,'id'|'createdAt'|'status'> & {pfLeadId}` (Task 2) — `PfLeadFields` satisfies it (`source` is a string literal, `pfLeadId` present). Route passes `mapPfLead(...)` straight into `savePfLead(...)` (Task 3) — compatible. `X-Signature` header + `PF_WEBHOOK_SECRET` consistent across route (Task 3) and script (Task 4).
