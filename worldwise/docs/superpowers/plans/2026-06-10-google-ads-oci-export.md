# Google Ads OCI Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An "Export Google Ads" button in `/admin/leads` that downloads a ready-to-upload Offline Conversion Import file (gclid-based, 3 funnel stages: CRM Lead / CRM Qualified / CRM Deal).

**Architecture:** One pure module `lib/oci-export.ts` (own local types, NO `@/` or fs/next imports — `node --test --experimental-strip-types` compatible, mirroring `lib/lead-parse.ts`) does all the work; `LeadsClient.tsx` adds a thin button that calls it and downloads a Blob, mirroring the existing `exportCsv`.

**Tech Stack:** TypeScript strict, node:test, Next.js 14 client component (existing CRM page).

**Spec:** `docs/superpowers/specs/2026-06-10-google-ads-oci-export-design.md`

**Working directory:** repo root `/Users/dzhambulat/Projects/Claude` for git; run node/npm from `worldwise/` (`export PATH="/Users/dzhambulat/.nvm/versions/node/v24.15.0/bin:$PATH"` if npm missing).

---

### Task 1: Pure module `lib/oci-export.ts` (TDD)

**Files:**
- Create: `worldwise/lib/oci-export.test.ts`
- Create: `worldwise/lib/oci-export.ts`

- [ ] **Step 1: Write the failing tests**

Create `worldwise/lib/oci-export.test.ts` with exactly:

```ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildOciCsv, formatDubaiTime, OCI_ACTIONS } from './oci-export.ts'

// Fixed "now" for deterministic tests: 2026-06-10 12:00 UTC
const NOW = new Date('2026-06-10T12:00:00.000Z')

const HEADER = [
  'Parameters:TimeZone=+0400',
  'Google Click ID,Conversion Name,Conversion Time,Conversion Value,Conversion Currency',
]

function lines(csv: string): string[] {
  return csv.trimEnd().split('\n')
}

test('formatDubaiTime converts UTC ISO to +04:00 wall clock', () => {
  assert.equal(formatDubaiTime('2026-06-09T22:30:00.000Z'), '2026-06-10 02:30:00')
  // midnight rollover backwards is impossible for +04, but check a plain case
  assert.equal(formatDubaiTime('2026-01-05T10:05:09.000Z'), '2026-01-05 14:05:09')
})

test('emits header lines even when there are no rows', () => {
  const { csv, counts } = buildOciCsv([], NOW)
  assert.deepEqual(lines(csv), HEADER)
  assert.deepEqual(counts, { lead: 0, qualified: 0, deal: 0 })
})

test('skips leads without gclid and outside the 90-day window', () => {
  const { counts } = buildOciCsv(
    [
      { createdAt: '2026-06-01T00:00:00.000Z' }, // no gclid
      { gclid: 'g1', createdAt: '2026-03-01T00:00:00.000Z' }, // 101 days old
      { gclid: 'g2', createdAt: 'garbage' }, // unparseable date
      { gclid: 'g3', createdAt: '2026-07-01T00:00:00.000Z' }, // in the future
    ],
    NOW
  )
  assert.deepEqual(counts, { lead: 0, qualified: 0, deal: 0 })
})

test('a fresh new-status lead produces exactly one CRM Lead row', () => {
  const { csv, counts } = buildOciCsv(
    [{ gclid: 'Cj0Kabc', createdAt: '2026-06-09T22:30:00.000Z', status: 'new' }],
    NOW
  )
  assert.deepEqual(lines(csv), [
    ...HEADER,
    'Cj0Kabc,CRM Lead,2026-06-10 02:30:00,0,AED',
  ])
  assert.deepEqual(counts, { lead: 1, qualified: 0, deal: 0 })
})

test('in-progress lead adds CRM Qualified with the activityLog transition time', () => {
  const { csv, counts } = buildOciCsv(
    [{
      gclid: 'g1',
      createdAt: '2026-06-01T08:00:00.000Z',
      status: 'in-progress',
      updatedAt: '2026-06-05T00:00:00.000Z',
      activityLog: [
        { at: '2026-06-02T10:00:00.000Z', action: 'Status: new → contacted' },
        { at: '2026-06-03T10:00:00.000Z', action: 'Status: contacted → in-progress, Notes updated' },
      ],
    }],
    NOW
  )
  const rows = lines(csv).slice(2)
  assert.deepEqual(rows, [
    'g1,CRM Lead,2026-06-01 12:00:00,0,AED',
    'g1,CRM Qualified,2026-06-03 14:00:00,0,AED',
  ])
  assert.deepEqual(counts, { lead: 1, qualified: 1, deal: 0 })
})

test('won lead emits all three rows; deal time from the → won entry', () => {
  const { csv, counts } = buildOciCsv(
    [{
      gclid: 'g1',
      createdAt: '2026-06-01T08:00:00.000Z',
      status: 'won',
      activityLog: [
        { at: '2026-06-02T10:00:00.000Z', action: 'Status: new → in-progress' },
        { at: '2026-06-08T09:00:00.000Z', action: 'Status: in-progress → won' },
      ],
    }],
    NOW
  )
  const rows = lines(csv).slice(2)
  assert.deepEqual(rows, [
    'g1,CRM Lead,2026-06-01 12:00:00,0,AED',
    'g1,CRM Qualified,2026-06-02 14:00:00,0,AED',
    'g1,CRM Deal,2026-06-08 13:00:00,0,AED',
  ])
  assert.deepEqual(counts, { lead: 1, qualified: 1, deal: 1 })
})

test('won lead that skipped in-progress still qualifies (won time used)', () => {
  const { csv } = buildOciCsv(
    [{
      gclid: 'g1',
      createdAt: '2026-06-01T08:00:00.000Z',
      status: 'won',
      activityLog: [{ at: '2026-06-04T09:00:00.000Z', action: 'Status: contacted → won' }],
    }],
    NOW
  )
  const rows = lines(csv).slice(2)
  assert.equal(rows.length, 3)
  assert.ok(rows[1].startsWith('g1,CRM Qualified,2026-06-04 13:00:00'))
  assert.ok(rows[2].startsWith('g1,CRM Deal,2026-06-04 13:00:00'))
})

test('lead that reached in-progress then lost still counts as qualified (history)', () => {
  const { counts } = buildOciCsv(
    [{
      gclid: 'g1',
      createdAt: '2026-06-01T08:00:00.000Z',
      status: 'lost',
      activityLog: [{ at: '2026-06-02T09:00:00.000Z', action: 'Status: new → in-progress' }],
    }],
    NOW
  )
  assert.deepEqual(counts, { lead: 1, qualified: 1, deal: 0 })
})

test('won lead with no activityLog falls back to updatedAt, clamped to ≥ createdAt', () => {
  const { csv } = buildOciCsv(
    [
      // updatedAt present and after createdAt → used as-is
      { gclid: 'g1', createdAt: '2026-06-01T08:00:00.000Z', status: 'won', updatedAt: '2026-06-05T08:00:00.000Z' },
      // updatedAt BEFORE createdAt (corrupt) → clamped to createdAt
      { gclid: 'g2', createdAt: '2026-06-01T08:00:00.000Z', status: 'won', updatedAt: '2026-05-20T08:00:00.000Z' },
    ],
    NOW
  )
  const rows = lines(csv).slice(2)
  assert.ok(rows.includes('g1,CRM Deal,2026-06-05 12:00:00,0,AED'))
  assert.ok(rows.includes('g2,CRM Deal,2026-06-01 12:00:00,0,AED'))
})

test('strips commas from a hostile gclid so CSV columns cannot shift', () => {
  const { csv } = buildOciCsv(
    [{ gclid: 'abc,def', createdAt: '2026-06-09T08:00:00.000Z' }],
    NOW
  )
  assert.ok(lines(csv)[2].startsWith('abcdef,CRM Lead,'))
})

test('OCI_ACTIONS names are the exact Google Ads conversion action names', () => {
  assert.deepEqual(OCI_ACTIONS, { lead: 'CRM Lead', qualified: 'CRM Qualified', deal: 'CRM Deal' })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run from `worldwise/`:
```bash
node --test --experimental-strip-types lib/oci-export.test.ts
```
Expected: FAIL — `Cannot find module … lib/oci-export.ts`.

- [ ] **Step 3: Write the implementation**

Create `worldwise/lib/oci-export.ts` with exactly:

```ts
// Google Ads Offline Conversion Import (OCI) file builder — spec:
// docs/superpowers/specs/2026-06-10-google-ads-oci-export-design.md
//
// PURE module (no fs/next/@-imports) so it stays `node --test
// --experimental-strip-types`-runnable, like lib/lead-parse.ts. Input is a
// structural subset of Lead — the CRM passes Lead[] as-is.

export interface OciActivityEntry {
  at: string
  action: string
}

export interface OciLead {
  gclid?: string
  createdAt: string
  status?: string
  updatedAt?: string
  activityLog?: OciActivityEntry[]
}

// Conversion-action names — must match the actions created in Google Ads
// (Goals → Conversions → Import → CRMs/files → Track conversions from clicks).
export const OCI_ACTIONS = {
  lead: 'CRM Lead',
  qualified: 'CRM Qualified',
  deal: 'CRM Deal',
} as const

const WINDOW_MS = 90 * 24 * 3600 * 1000 // Google's gclid click window
const DUBAI_OFFSET_MS = 4 * 3600 * 1000 // Asia/Dubai is fixed +04:00, no DST

/** UTC ISO → `yyyy-MM-dd HH:mm:ss` wall-clock time in Dubai (+04:00). */
export function formatDubaiTime(iso: string): string {
  const d = new Date(new Date(iso).getTime() + DUBAI_OFFSET_MS)
  const p = (n: number) => String(n).padStart(2, '0')
  return (
    `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ` +
    `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`
  )
}

// First activityLog entry recording a transition INTO `status`
// (updateLead writes action strings like "Status: new → in-progress, Notes updated").
function transitionAt(lead: OciLead, status: string): string | undefined {
  return lead.activityLog?.find(e => e.action.includes(`→ ${status}`))?.at
}

// A conversion can't precede the ad click (≈ lead creation) — clamp up to createdAt.
function stageTime(iso: string | undefined, lead: OciLead): string {
  const t = iso ?? lead.updatedAt ?? lead.createdAt
  return new Date(t).getTime() < new Date(lead.createdAt).getTime() ? lead.createdAt : t
}

export function buildOciCsv(
  leads: OciLead[],
  now: Date
): { csv: string; counts: { lead: number; qualified: number; deal: number } } {
  const counts = { lead: 0, qualified: 0, deal: 0 }
  const rows: string[] = []
  const minCreated = now.getTime() - WINDOW_MS

  for (const l of leads) {
    // gclid is URL-safe by spec; strip commas defensively so columns can't shift.
    const gclid = (l.gclid ?? '').trim().replace(/,/g, '')
    if (!gclid) continue
    const created = new Date(l.createdAt).getTime()
    if (!Number.isFinite(created) || created < minCreated || created > now.getTime()) continue

    const push = (name: string, timeIso: string) =>
      rows.push(`${gclid},${name},${formatDubaiTime(timeIso)},0,AED`)

    push(OCI_ACTIONS.lead, l.createdAt)
    counts.lead++

    // "Ever reached" qualified: current status OR a recorded transition —
    // history matters (in-progress → lost still earned the Qualified signal).
    const qualifiedAt = transitionAt(l, 'in-progress') ?? transitionAt(l, 'won')
    if (qualifiedAt !== undefined || l.status === 'in-progress' || l.status === 'won') {
      push(OCI_ACTIONS.qualified, stageTime(qualifiedAt, l))
      counts.qualified++
    }

    if (l.status === 'won') {
      push(OCI_ACTIONS.deal, stageTime(transitionAt(l, 'won'), l))
      counts.deal++
    }
  }

  const csv =
    [
      'Parameters:TimeZone=+0400',
      'Google Click ID,Conversion Name,Conversion Time,Conversion Value,Conversion Currency',
      ...rows,
    ].join('\n') + '\n'
  return { csv, counts }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
node --test --experimental-strip-types lib/oci-export.test.ts
```
Expected: all tests PASS (11 tests). Then run the full suite — must stay green:
```bash
node --test --experimental-strip-types lib/*.test.ts
```

- [ ] **Step 5: Commit**

```bash
cd /Users/dzhambulat/Projects/Claude
git add worldwise/lib/oci-export.ts worldwise/lib/oci-export.test.ts
git commit -m "feat(ads): pure OCI file builder for Google Ads offline conversions

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: "Export Google Ads" button in the CRM

**Files:**
- Modify: `worldwise/app/admin/leads/LeadsClient.tsx` (imports block ~line 1-16; next to `exportCsv` ~line 308-327; button row ~line 386-388)

- [ ] **Step 1: Add the import**

In the import block at the top of `LeadsClient.tsx` (after the existing `@/lib` imports), add:

```ts
import { buildOciCsv } from '@/lib/oci-export'
```

- [ ] **Step 2: Add the export function**

Directly below the existing `exportCsv()` function, add:

```ts
  function exportGoogleAds() {
    // ALL leads, not `filtered` — active CRM filters must not silently drop deals.
    const { csv, counts } = buildOciCsv(leads, new Date())
    if (counts.lead === 0) {
      alert('No leads with a gclid in the last 90 days — nothing to upload to Google Ads.')
      return
    }
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `google-ads-oci-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }
```

Note: `Lead[]` is structurally assignable to `OciLead[]` (extra fields are fine; `ActivityEntry` has `at`/`action` plus extras) — no casts needed.

- [ ] **Step 3: Add the button**

Next to the existing Export CSV button (`<button onClick={exportCsv} …>Export CSV</button>`), add a sibling with identical styling:

```tsx
        <button onClick={exportGoogleAds} className="text-sm text-navy border border-gray-200 px-4 py-2 rounded-sm hover:border-gold">
          Export Google Ads
        </button>
```

- [ ] **Step 4: Type-check and build**

From `worldwise/`:
```bash
npx tsc --noEmit && npm run build
```
Expected: no type errors; build succeeds.

- [ ] **Step 5: Verify in the running app**

```bash
npm run dev
```
Open `http://localhost:3000/admin/leads` (local `data/` is absent → empty CRM is fine): the "Export Google Ads" button renders next to "Export CSV"; clicking it with zero leads shows the alert (no file). Stop the dev server.

- [ ] **Step 6: Commit**

```bash
cd /Users/dzhambulat/Projects/Claude
git add worldwise/app/admin/leads/LeadsClient.tsx
git commit -m "feat(ads): Export Google Ads (OCI) button in the leads CRM

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Document the weekly ritual

**Files:**
- Modify: `worldwise/docs/marketing/2026-06-09-google-ads-fixes-and-conversion-tracking.md` (section C, "Загрузка (еженедельно)" list ~line 56-68)

- [ ] **Step 1: Update section C**

Replace the manual file-building steps 1–3 of «Загрузка (еженедельно)» with:

```markdown
1. CRM `/admin/leads` → кнопка **Export Google Ads** — скачивает готовый файл
   (`google-ads-oci-<дата>.csv`): все gclid-лиды за 90 дней, строки `CRM Lead` /
   `CRM Qualified` / `CRM Deal`, время стадий из activityLog, таймзона +0400,
   Value 0 (ценность сделки при желании вписать руками перед загрузкой).
2. Google Ads → Goals → Conversions → **Uploads** → Upload файл → Preview → Apply.
   Повторные строки Google сам отбрасывает как дубликаты — выгружать весь файл
   каждый раз безопасно.
```

Keep the «Настройка (один раз)» part intact, but fix the action names to the exact constants: `CRM Lead`, `CRM Qualified`, `CRM Deal`.

- [ ] **Step 2: Commit**

```bash
cd /Users/dzhambulat/Projects/Claude
git add worldwise/docs/marketing/2026-06-09-google-ads-fixes-and-conversion-tracking.md
git commit -m "docs(ads): weekly OCI ritual now uses the CRM export button

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Deploy per protocol

- [ ] **Step 1:** Backup server data: `ssh -i ~/.ssh/id_ed25519 root@62.238.35.20 "cp -r /var/www/worldwise/data /var/www/worldwise/data_backup_$(date +%Y%m%d_%H%M%S)"`
- [ ] **Step 2:** Merge to `main` (PR against `claude` remote), final `npm run build` from `main`.
- [ ] **Step 3:** rsync per CLAUDE.md (standard exclude list), grep marker on server: `grep -c 'buildOciCsv' /var/www/worldwise/app/admin/leads/LeadsClient.tsx` → expect ≥1.
- [ ] **Step 4:** `ssh … "cd /var/www/worldwise && npm install && npm run build && pm2 restart worldwise"`.
- [ ] **Step 5:** Smoke: `curl -s -o /dev/null -w '%{http_code}' https://worldwise.pro/admin/leads` → 200 (redirect to login is fine with `-L`). Owner clicks the button in the live CRM and confirms a non-empty file downloads.

---

## Self-review notes

- Spec coverage: module rules (window/stages/clamp/format) → Task 1; button + all-leads + empty-alert + filename → Task 2; doc ritual + exact action names → Task 3; deploy → Task 4. Owner's Google Ads UI setup is intentionally NOT a task (user-side, спека §"Owner's follow-up").
- Types consistent: `OciLead`/`OciActivityEntry`/`OCI_ACTIONS`/`buildOciCsv`/`formatDubaiTime` used identically across tasks.
- No placeholders; all code complete.
