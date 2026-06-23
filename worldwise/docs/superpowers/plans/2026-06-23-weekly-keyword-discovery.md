# Weekly Keyword Discovery Service — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A weekly cron that discovers hot/rising Dubai-property buyer search queries and auto-tops-up the auto-blog keyword bank, so daily articles target fresh demand.

**Architecture:** One standalone Node ESM cron script `scripts/discover-keywords.mjs` (IO shell) + one pure, dependency-free core module `scripts/keyword-discovery-core.mjs` (scoring, filtering, normalization, dedup — unit-tested with `node --test`). Candidates come from Google autocomplete on seed terms; volume + 12-month trend come from the **DataForSEO** `keywords_data/google_ads/search_volume/live` API (geos UK+UAE+India, normalized per geo). Top N are inserted at the current index of `data/article-keywords.json` (strict-read + atomic-write), then a Telegram summary is sent. The existing per-article Telegram approval still gates publishing.

**Tech Stack:** Node.js 24 ESM (`node --env-file=.env.local`), `node --test` (native test runner), DataForSEO REST API (Basic auth), Google autocomplete (`suggestqueries.google.com`), Telegram Bot API. No new npm dependencies.

**Spec:** `docs/superpowers/specs/2026-06-23-weekly-keyword-discovery-design.md`

---

## Why `.mjs` (not `.ts`) for the core

The cron runs `node --env-file=.env.local scripts/discover-keywords.mjs` and imports the core at runtime. A plain Node invocation cannot reliably import a `.ts` file across versions, and the existing cron scripts (`generate-article.mjs`) import nothing from the TS `lib/`. The discovery core is cron-domain only (not used by the Next app), so it lives next to the script as `.mjs` and is tested with `node --test` (no type-stripping flag needed). This matches the cron ecosystem and keeps the TS `lib/` untouched.

## File Structure

- **Create** `scripts/keyword-discovery-core.mjs` — pure helpers: `trendRiseFactor`, `normalizeVolumePerGeo`, `intentWeight`, `passesFilters`, `dedupeKeywords`, `scoreAndSelect`. No `fs`, no network, no imports.
- **Create** `scripts/keyword-discovery-core.test.mjs` — `node --test` unit tests for the core.
- **Create** `scripts/discover-keywords.mjs` — IO shell: config, autocomplete fetch, DataForSEO client, bank read/write, Telegram, `--dry-run`, logging, `main()`.
- **Modify** `.env.example` — add `DATAFORSEO_LOGIN` / `DATAFORSEO_PASSWORD`.
- **Modify** `CLAUDE.md` — Scheduled-jobs table row, env-var entry, short Architecture subsection.
- **Server (ops, manual at deploy):** `DATAFORSEO_LOGIN`/`DATAFORSEO_PASSWORD` in `/var/www/worldwise/.env.local`; root crontab entry; log at `/var/log/worldwise-keyword-discovery.log`.

## Data shapes (used across tasks)

A **candidate** flows through the pipeline as a plain object:

```js
// after autocomplete (no metrics yet):
{ keyword: 'dubai off plan payment plans' }

// after KE enrichment (per-geo volume + 12-month trend):
{
  keyword: 'dubai off plan payment plans',
  perGeo: {                       // one entry per geo that returned data
    uk: { vol: 1300, trend: [{month:'January',year:2026,value:1000}, ... 12 ] },
    ae: { vol: 880,  trend: [ ...12 ] },
    in: { vol: 4400, trend: [ ...12 ] },
  },
}

// after scoreAndSelect (adds derived fields):
{ keyword, perGeo, normVol: 0.82, rise: 1.4, intent: 1.3, score: 1.49, maxVol: 4400 }
```

KE `get_keyword_data` returns per keyword: `{ keyword, vol, cpc:{currency,value}, competition, trend:[{month,year,value}] }` plus top-level `credits`, `credits_consumed`. `trend` is 12 entries, chronological (oldest → newest).

---

### Task 1: Core scaffolding + `trendRiseFactor`

**Files:**
- Create: `scripts/keyword-discovery-core.mjs`
- Test: `scripts/keyword-discovery-core.test.mjs`

`trendRiseFactor(trend)` collapses the 12-month KE trend into a single "is it rising?" multiplier: mean of the last 3 months ÷ mean of the first 3 months, clamped to `[0.5, 3]`. Flat history → ~1.0; rising → >1; declining → <1. Guards empty/short trends (→ 1) and zero baseline (→ clamp max).

- [ ] **Step 1: Write the failing test**

```js
// scripts/keyword-discovery-core.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { trendRiseFactor } from './keyword-discovery-core.mjs'

const mk = (...vals) => vals.map((value, i) => ({ month: String(i), year: 2026, value }))

test('trendRiseFactor: flat trend ~= 1', () => {
  const f = trendRiseFactor(mk(100,100,100,100,100,100,100,100,100,100,100,100))
  assert.ok(Math.abs(f - 1) < 0.01, `expected ~1, got ${f}`)
})

test('trendRiseFactor: rising trend > 1', () => {
  const f = trendRiseFactor(mk(100,100,100,100,100,100,100,100,100,300,300,300))
  assert.ok(f > 1.5, `expected >1.5, got ${f}`)
})

test('trendRiseFactor: declining trend < 1', () => {
  const f = trendRiseFactor(mk(300,300,300,100,100,100,100,100,100,100,100,100))
  assert.ok(f < 1, `expected <1, got ${f}`)
})

test('trendRiseFactor: clamps to [0.5, 3]', () => {
  assert.equal(trendRiseFactor(mk(10,10,10,0,0,0,0,0,0,1000,1000,1000)), 3)
  assert.equal(trendRiseFactor(mk(1000,1000,1000,0,0,0,0,0,0,1,1,1)), 0.5)
})

test('trendRiseFactor: empty/short trend = 1', () => {
  assert.equal(trendRiseFactor([]), 1)
  assert.equal(trendRiseFactor(undefined), 1)
  assert.equal(trendRiseFactor(mk(100,100)), 1)
})

test('trendRiseFactor: zero baseline does not divide-by-zero', () => {
  const f = trendRiseFactor(mk(0,0,0,0,0,0,0,0,0,100,100,100))
  assert.equal(f, 3)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test scripts/keyword-discovery-core.test.mjs`
Expected: FAIL — `Cannot find module './keyword-discovery-core.mjs'` (or export missing).

- [ ] **Step 3: Write minimal implementation**

```js
// scripts/keyword-discovery-core.mjs
// Pure, dependency-free core for the weekly keyword-discovery cron.
// No fs / no network / no imports — unit-tested with `node --test`.

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n))
const mean = arr => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0)

/** 12-month KE trend → rising multiplier in [0.5, 3]. Flat≈1, rising>1, falling<1. */
export function trendRiseFactor(trend) {
  if (!Array.isArray(trend) || trend.length < 6) return 1
  const vals = trend.map(t => Number(t?.value) || 0)
  const first = mean(vals.slice(0, 3))
  const last = mean(vals.slice(-3))
  if (first <= 0) return last > 0 ? 3 : 1
  return clamp(last / first, 0.5, 3)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test scripts/keyword-discovery-core.test.mjs`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/keyword-discovery-core.mjs scripts/keyword-discovery-core.test.mjs
git commit -m "feat(keyword-discovery): pure core + trendRiseFactor with tests"
```

---

### Task 2: `normalizeVolumePerGeo`

**Files:**
- Modify: `scripts/keyword-discovery-core.mjs`
- Modify: `scripts/keyword-discovery-core.test.mjs`

Per-geo normalization prevents a high-volume market (India) from dominating. For each geo, rank candidates by that geo's volume and assign a percentile in `[0,1]`; a candidate's `normVol` is the **average of its per-geo percentiles** (only over geos where it has volume). Returns a new array with `normVol` and `maxVol` added.

- [ ] **Step 1: Write the failing test**

```js
// add to scripts/keyword-discovery-core.test.mjs
import { normalizeVolumePerGeo } from './keyword-discovery-core.mjs'

test('normalizeVolumePerGeo: highest per-geo volume gets percentile 1', () => {
  const out = normalizeVolumePerGeo([
    { keyword: 'a', perGeo: { uk: { vol: 100 }, in: { vol: 999999 } } },
    { keyword: 'b', perGeo: { uk: { vol: 500 }, in: { vol: 10 } } },
    { keyword: 'c', perGeo: { uk: { vol: 50 },  in: { vol: 100 } } },
  ])
  const a = out.find(x => x.keyword === 'a')
  const b = out.find(x => x.keyword === 'b')
  // 'a' tops India (huge) but is bottom in UK; 'b' tops UK. Per-geo ranking keeps it balanced.
  assert.equal(b.normVol > 0, true)
  assert.equal(a.maxVol, 999999)
  // 'a' must NOT auto-win just because India volume is huge:
  assert.ok(a.normVol <= 1 && a.normVol >= 0)
})

test('normalizeVolumePerGeo: India size does not dominate vs a UK+IN balanced kw', () => {
  const out = normalizeVolumePerGeo([
    { keyword: 'india-only-huge', perGeo: { in: { vol: 1000000 }, uk: { vol: 1 } } },
    { keyword: 'balanced',        perGeo: { in: { vol: 900 },     uk: { vol: 900 } } },
  ])
  const huge = out.find(x => x.keyword === 'india-only-huge')
  const bal = out.find(x => x.keyword === 'balanced')
  // balanced ranks #1 in UK (1.0) and #2 in IN; india-only ranks #1 in IN (1.0) and #2 in UK.
  // Averages are equal here (both ~0.5), proving raw India size alone does not win.
  assert.ok(Math.abs(bal.normVol - huge.normVol) < 0.001)
})

test('normalizeVolumePerGeo: empty input', () => {
  assert.deepEqual(normalizeVolumePerGeo([]), [])
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test scripts/keyword-discovery-core.test.mjs`
Expected: FAIL — `normalizeVolumePerGeo is not a function`.

- [ ] **Step 3: Write minimal implementation**

```js
// add to scripts/keyword-discovery-core.mjs

/** Percentile rank of each value within a list, in [0,1]; ties share the higher rank. */
function percentiles(values) {
  const sorted = [...values].sort((a, b) => a - b)
  const n = sorted.length
  return values.map(v => {
    if (n <= 1) return 1
    // index of last element <= v, normalized
    let count = 0
    for (const s of sorted) if (s <= v) count++
    return count / n
  })
}

/** Adds normVol (avg per-geo percentile) and maxVol to each candidate. */
export function normalizeVolumePerGeo(candidates) {
  if (!candidates.length) return []
  const geos = [...new Set(candidates.flatMap(c => Object.keys(c.perGeo || {})))]
  // per-geo percentile maps: geo -> Map(keyword -> percentile)
  const pctByGeo = {}
  for (const geo of geos) {
    const present = candidates.filter(c => c.perGeo?.[geo])
    const pcts = percentiles(present.map(c => Number(c.perGeo[geo].vol) || 0))
    pctByGeo[geo] = new Map(present.map((c, i) => [c.keyword, pcts[i]]))
  }
  return candidates.map(c => {
    const myPcts = geos
      .filter(geo => c.perGeo?.[geo])
      .map(geo => pctByGeo[geo].get(c.keyword))
    const normVol = myPcts.length ? mean(myPcts) : 0
    const maxVol = Math.max(0, ...Object.values(c.perGeo || {}).map(g => Number(g.vol) || 0))
    return { ...c, normVol, maxVol }
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test scripts/keyword-discovery-core.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/keyword-discovery-core.mjs scripts/keyword-discovery-core.test.mjs
git commit -m "feat(keyword-discovery): per-geo volume normalization"
```

---

### Task 3: Filters (`intentWeight` + `passesFilters`)

**Files:**
- Modify: `scripts/keyword-discovery-core.mjs`
- Modify: `scripts/keyword-discovery-core.test.mjs`

`passesFilters(keyword, opts)` returns `{ ok: boolean, reason: string }`. Rejects: other-emirate geo (unless also "dubai"), off-niche (must contain a niche token), off-topic deny tokens, bare listing-intent ("… for sale" without guide/compare intent), and below `minVolume` (checked against `maxVol` passed in `opts`). `intentWeight(keyword)` returns a soft multiplier (1.3 for strong buyer-intent tokens, else 1.0).

- [ ] **Step 1: Write the failing test**

```js
// add to scripts/keyword-discovery-core.test.mjs
import { passesFilters, intentWeight } from './keyword-discovery-core.mjs'

const OPTS = { minVolume: 100, maxVol: 500 }

test('passesFilters: accepts on-niche Dubai buyer query', () => {
  assert.equal(passesFilters('dubai off plan payment plans', OPTS).ok, true)
})

test('passesFilters: rejects other emirate', () => {
  assert.equal(passesFilters('abu dhabi property investor visa', OPTS).ok, false)
  // ...unless it also references Dubai
  assert.equal(passesFilters('dubai vs abu dhabi property investment', OPTS).ok, true)
})

test('passesFilters: rejects off-niche', () => {
  assert.equal(passesFilters('dubai tourist visa cost', OPTS).ok, false)   // deny token "tourist"
  assert.equal(passesFilters('best biryani in london', OPTS).ok, false)    // no niche token
})

test('passesFilters: rejects bare listing-intent but keeps guides', () => {
  assert.equal(passesFilters('studio for sale in jvc dubai', OPTS).ok, false)
  assert.equal(passesFilters('best areas to buy off plan in dubai guide', OPTS).ok, true)
})

test('passesFilters: rejects below min volume', () => {
  assert.equal(passesFilters('dubai property investment', { minVolume: 100, maxVol: 40 }).ok, false)
})

test('intentWeight: buyer-intent tokens score higher', () => {
  assert.ok(intentWeight('how to get golden visa by buying property in dubai') > 1)
  assert.equal(intentWeight('dubai real estate news'), 1)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test scripts/keyword-discovery-core.test.mjs`
Expected: FAIL — `passesFilters is not a function`.

- [ ] **Step 3: Write minimal implementation**

```js
// add to scripts/keyword-discovery-core.mjs

const OTHER_EMIRATES = ['abu dhabi', 'sharjah', 'ajman', 'ras al khaimah', 'rak ', 'fujairah', 'umm al quwain']
const NICHE_TOKENS = ['dubai', 'uae', 'off plan', 'off-plan', 'golden visa', 'property', 'real estate',
  'apartment', 'villa', 'townhouse', 'invest', 'rental', 'yield', 'roi', 'mortgage', 'freehold',
  'payment plan', 'residence', 'residency', 'developer', 'emaar', 'damac', 'sobha']
const DENY_TOKENS = ['tourist', 'holiday', 'hotel', 'airbnb short stay', 'job', 'salary', 'rent a car',
  'visa cost tourist', 'flight', 'restaurant', 'biryani']
const INTENT_TOKENS = ['buy', 'invest', 'investment', 'payment plan', 'golden visa', 'residency',
  'residence visa', 'mortgage', 'roi', 'rental yield', 'off plan', 'off-plan', 'best area']
const GUIDE_TOKENS = ['guide', 'how', 'best', 'vs', ' or ', 'worth', 'should', 'review', 'explained', 'compare']

const has = (s, list) => list.some(t => s.includes(t))

/** Soft buyer-intent multiplier. */
export function intentWeight(keyword) {
  return has(String(keyword).toLowerCase(), INTENT_TOKENS) ? 1.3 : 1.0
}

/** Niche + geo + intent + min-volume gate. opts: { minVolume, maxVol }. */
export function passesFilters(keyword, opts) {
  const k = String(keyword).toLowerCase().trim()
  if (!k) return { ok: false, reason: 'empty' }
  if (has(k, DENY_TOKENS)) return { ok: false, reason: 'off-topic' }
  if (has(k, OTHER_EMIRATES) && !k.includes('dubai')) return { ok: false, reason: 'other-emirate' }
  if (!has(k, NICHE_TOKENS)) return { ok: false, reason: 'off-niche' }
  if (/\bfor sale\b/.test(k) && !has(k, GUIDE_TOKENS)) return { ok: false, reason: 'listing-intent' }
  if ((Number(opts?.maxVol) || 0) < (Number(opts?.minVolume) || 0)) return { ok: false, reason: 'low-volume' }
  return { ok: true, reason: 'ok' }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test scripts/keyword-discovery-core.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/keyword-discovery-core.mjs scripts/keyword-discovery-core.test.mjs
git commit -m "feat(keyword-discovery): niche/geo/intent filters"
```

---

### Task 4: `dedupeKeywords`

**Files:**
- Modify: `scripts/keyword-discovery-core.mjs`
- Modify: `scripts/keyword-discovery-core.test.mjs`

`dedupeKeywords(keywords, seenSet)` drops case-insensitive duplicates against `seenSet` (a `Set` of lowercased strings already in the bank or published) AND within the input list itself. Returns the surviving original-cased strings.

- [ ] **Step 1: Write the failing test**

```js
// add to scripts/keyword-discovery-core.test.mjs
import { dedupeKeywords } from './keyword-discovery-core.mjs'

test('dedupeKeywords: removes against seen set (case-insensitive)', () => {
  const seen = new Set(['dubai golden visa property'])
  const out = dedupeKeywords(['Dubai Golden Visa Property', 'new dubai topic'], seen)
  assert.deepEqual(out, ['new dubai topic'])
})

test('dedupeKeywords: removes in-list duplicates, keeps first casing', () => {
  const out = dedupeKeywords(['Dubai ROI', 'dubai roi', 'jvc yield'], new Set())
  assert.deepEqual(out, ['Dubai ROI', 'jvc yield'])
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test scripts/keyword-discovery-core.test.mjs`
Expected: FAIL — `dedupeKeywords is not a function`.

- [ ] **Step 3: Write minimal implementation**

```js
// add to scripts/keyword-discovery-core.mjs

/** Drop case-insensitive dupes vs seenSet and within the list. Returns surviving originals. */
export function dedupeKeywords(keywords, seenSet) {
  const seen = new Set([...seenSet].map(s => String(s).toLowerCase().trim()))
  const out = []
  for (const kw of keywords) {
    const key = String(kw).toLowerCase().trim()
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(kw)
  }
  return out
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test scripts/keyword-discovery-core.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/keyword-discovery-core.mjs scripts/keyword-discovery-core.test.mjs
git commit -m "feat(keyword-discovery): case-insensitive dedupe"
```

---

### Task 5: `scoreAndSelect` (ties the core together)

**Files:**
- Modify: `scripts/keyword-discovery-core.mjs`
- Modify: `scripts/keyword-discovery-core.test.mjs`

`scoreAndSelect(enrichedCandidates, opts)` runs the full pure pipeline: normalize per geo → filter (geo/niche/intent/minVolume using `maxVol`) → compute `score = normVol × rise × intent` (rise from the best-trending geo) → sort desc → return top `N`, each with `{ keyword, score, normVol, rise, intent, maxVol, perGeo }`. `opts: { minVolume, n }`.

- [ ] **Step 1: Write the failing test**

```js
// add to scripts/keyword-discovery-core.test.mjs
import { scoreAndSelect } from './keyword-discovery-core.mjs'

const trend = (a, b) => [ // 12 months: first 3 = a, last 3 = b, middle flat
  ...[a,a,a], ...[a,a,a,a,a,a], ...[b,b,b],
].map((value, i) => ({ month: String(i), year: 2026, value }))

test('scoreAndSelect: filters, scores, returns top N', () => {
  const cands = [
    { keyword: 'dubai off plan payment plans', perGeo: { uk: { vol: 1300, trend: trend(100, 400) }, in: { vol: 4400, trend: trend(100, 400) } } }, // rising
    { keyword: 'dubai property market news',    perGeo: { uk: { vol: 1000, trend: trend(400, 100) } } },                                          // declining, weak intent
    { keyword: 'abu dhabi villas for sale',     perGeo: { uk: { vol: 5000, trend: trend(100, 400) } } },                                          // rejected: emirate + listing
    { keyword: 'low vol dubai roi',             perGeo: { uk: { vol: 10,   trend: trend(100, 400) } } },                                          // rejected: maxVol < minVolume
  ]
  const out = scoreAndSelect(cands, { minVolume: 100, n: 5 })
  const kws = out.map(o => o.keyword)
  assert.ok(kws.includes('dubai off plan payment plans'))
  assert.ok(!kws.includes('abu dhabi villas for sale'))
  assert.ok(!kws.includes('low vol dubai roi'))
  // rising buyer-intent kw outranks the declining news kw
  assert.equal(out[0].keyword, 'dubai off plan payment plans')
})

test('scoreAndSelect: respects N', () => {
  const cands = Array.from({ length: 10 }, (_, i) => ({
    keyword: `dubai investment topic ${i}`,
    perGeo: { uk: { vol: 200 + i, trend: trend(100, 200) } },
  }))
  assert.equal(scoreAndSelect(cands, { minVolume: 100, n: 3 }).length, 3)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test scripts/keyword-discovery-core.test.mjs`
Expected: FAIL — `scoreAndSelect is not a function`.

- [ ] **Step 3: Write minimal implementation**

```js
// add to scripts/keyword-discovery-core.mjs

/** Full pure pipeline: normalize → filter → score → sort → top N. opts: { minVolume, n }. */
export function scoreAndSelect(candidates, opts) {
  const minVolume = Number(opts?.minVolume) || 0
  const n = Number(opts?.n) || 5
  const normalized = normalizeVolumePerGeo(candidates)
  const scored = []
  for (const c of normalized) {
    const verdict = passesFilters(c.keyword, { minVolume, maxVol: c.maxVol })
    if (!verdict.ok) continue
    const rise = Math.max(
      1e-9,
      ...Object.values(c.perGeo || {}).map(g => trendRiseFactor(g.trend)),
    )
    const intent = intentWeight(c.keyword)
    const score = c.normVol * rise * intent
    scored.push({ keyword: c.keyword, score, normVol: c.normVol, rise, intent, maxVol: c.maxVol, perGeo: c.perGeo })
  }
  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, n)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test scripts/keyword-discovery-core.test.mjs`
Expected: PASS (all core tests green).

- [ ] **Step 5: Commit**

```bash
git add scripts/keyword-discovery-core.mjs scripts/keyword-discovery-core.test.mjs
git commit -m "feat(keyword-discovery): scoreAndSelect pipeline"
```

---

### Task 6: Script shell — config + helpers + candidate generation (autocomplete)

**Files:**
- Create: `scripts/discover-keywords.mjs`

Build the IO shell incrementally. This task adds the top matter, config, logging, atomic-write, and the Google autocomplete candidate generator. (DataForSEO client, bank IO, Telegram, and `main()` follow in later tasks.) No test here — verified by the dry-run in Task 10.

- [ ] **Step 1: Create the script with config + autocomplete**

```js
// scripts/discover-keywords.mjs
// Weekly keyword-discovery cron. Discovers hot/rising Dubai-property buyer queries
// (Google autocomplete → DataForSEO volume+trend) and tops up the auto-blog
// keyword bank. See docs/superpowers/plans/2026-06-23-weekly-keyword-discovery.md.
//
// Run: node --env-file=.env.local scripts/discover-keywords.mjs [--dry-run]

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { scoreAndSelect, dedupeKeywords } from './keyword-discovery-core.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const DATA_DIR = path.join(ROOT, 'data')
const KEYWORDS_PATH = path.join(DATA_DIR, 'article-keywords.json')
const ARTICLES_PATH = path.join(DATA_DIR, 'articles.json')

const DRY_RUN = process.argv.includes('--dry-run')

// ── Config (tunable) ─────────────────────────────────────────────────────────
const SEEDS = [
  'dubai property investment', 'buy property in dubai', 'dubai off plan',
  'dubai golden visa property', 'dubai rental yield', 'dubai property residence visa',
  'dubai off plan payment plan', 'best area to invest in dubai', 'dubai property mortgage',
  'dubai property fees', 'dubai property for foreigners', 'dubai real estate roi',
]
const TARGET_GEOS = ['uk', 'ae', 'in']     // UK + UAE + India; per-geo normalized
const LOCATION_CODES = { uk: 2826, ae: 2784, in: 2356 }   // Google geo target IDs
const N_PER_WEEK = 5
const MIN_VOLUME = 100
const CANDIDATE_CAP = 200                    // cap unique candidates before DataForSEO enrichment

const DFS_LOGIN = process.env.DATAFORSEO_LOGIN
const DFS_PASSWORD = process.env.DATAFORSEO_PASSWORD
const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TG_CHAT_ID = (process.env.TELEGRAM_CHAT_ID ?? '').split(',')[0].trim()

const log = msg => console.log(`[${new Date().toISOString()}] ${msg}`)

// Atomic write: temp file + rename (crash-safe). Mirrors generate-article.mjs.
function writeFileAtomic(filePath, contents) {
  const tmp = `${filePath}.${process.pid}.tmp`
  fs.writeFileSync(tmp, contents, 'utf-8')
  fs.renameSync(tmp, filePath)
}

// ── Candidate generation: Google autocomplete ────────────────────────────────
// suggestqueries returns [seed, [suggestion, ...]] as JSON (content-type text/javascript).
async function autocomplete(seed, geo) {
  const url = `https://suggestqueries.google.com/complete/search?client=firefox&hl=en&gl=${geo}&q=${encodeURIComponent(seed)}`
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
    if (!res.ok) return []
    const arr = JSON.parse(await res.text())
    return Array.isArray(arr?.[1]) ? arr[1] : []
  } catch (e) {
    log(`autocomplete failed (${seed}/${geo}): ${e.message}`)
    return []
  }
}

/** All unique candidate phrases from seeds × geos, capped. */
async function gatherCandidates() {
  const set = new Set()
  for (const seed of SEEDS) {
    for (const geo of TARGET_GEOS) {
      for (const s of await autocomplete(seed, geo)) {
        const k = String(s).toLowerCase().trim()
        if (k) set.add(k)
      }
    }
  }
  return [...set].slice(0, CANDIDATE_CAP)
}
```

- [ ] **Step 2: Smoke-check the module parses and autocomplete works (network)**

Run:
```bash
node --input-type=module -e "
import('./scripts/discover-keywords.mjs').catch(e=>{console.error('import err',e.message);process.exit(1)})
" 2>&1 | head -5   # expect: no syntax/import error (script has no main() yet, exits cleanly)
node --check scripts/discover-keywords.mjs && echo "syntax OK"
```
Expected: `syntax OK`. (Autocomplete is exercised end-to-end in the Task 10 dry-run.)

- [ ] **Step 3: Commit**

```bash
git add scripts/discover-keywords.mjs
git commit -m "feat(keyword-discovery): script config + autocomplete candidate generation"
```

---

### Task 7: DataForSEO client — `fetchKeywordData`

**Files:**
- Modify: `scripts/discover-keywords.mjs`

Adds the DataForSEO `keywords_data/google_ads/search_volume/live` client: up to 1000 keywords per request, one request per geo (Basic auth), returns `{ rows, cost }`. Throws on non-20000 status codes so `main()` can abort without touching the bank.

- [ ] **Step 1: Add the DataForSEO client**

```js
// add to scripts/discover-keywords.mjs (after gatherCandidates)

// ── DataForSEO: volume + 12-month trend ──────────────────────────────────────
const DFS_URL = 'https://api.dataforseo.com/v3/keywords_data/google_ads/search_volume/live'

// One geo (≤1000 kw/request). Returns { rows: [{keyword, vol, trend}], cost }.
async function fetchKeywordData(keywords, geo) {
  const auth = Buffer.from(`${DFS_LOGIN}:${DFS_PASSWORD}`).toString('base64')
  const res = await fetch(DFS_URL, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
    body: JSON.stringify([{
      location_code: LOCATION_CODES[geo],
      language_code: 'en',
      search_partners: false,
      keywords: keywords.slice(0, 1000),
    }]),
    signal: AbortSignal.timeout(60000),
  })
  if (!res.ok) throw new Error(`DataForSEO ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const json = await res.json()
  if (json.status_code !== 20000) throw new Error(`DataForSEO status ${json.status_code}: ${json.status_message}`)
  const task = json.tasks?.[0]
  if (task && task.status_code !== 20000) throw new Error(`DataForSEO task ${task.status_code}: ${task.status_message}`)
  const rows = []
  for (const r of task?.result ?? []) {
    if (!r?.keyword) continue
    const trend = (r.monthly_searches ?? [])
      .slice()
      .sort((a, b) => (a.year - b.year) || (a.month - b.month))   // chronological for trendRiseFactor
      .map(m => ({ value: Number(m.search_volume) || 0 }))
    rows.push({ keyword: String(r.keyword).toLowerCase().trim(), vol: Number(r.search_volume) || 0, trend })
  }
  return { rows, cost: Number(json.cost) || 0 }
}

// Enrich candidates with per-geo {vol,trend} across TARGET_GEOS. Returns { enriched, totalCost }.
async function enrichCandidates(candidates) {
  const byKw = new Map(candidates.map(k => [k, { keyword: k, perGeo: {} }]))
  let totalCost = 0
  for (const geo of TARGET_GEOS) {
    const { rows, cost } = await fetchKeywordData(candidates, geo)
    totalCost += cost
    for (const r of rows) {
      const c = byKw.get(r.keyword)
      if (c) c.perGeo[geo] = { vol: r.vol, trend: r.trend }
    }
  }
  return { enriched: [...byKw.values()].filter(c => Object.keys(c.perGeo).length), totalCost }
}
```

- [ ] **Step 2: Verify syntax**

Run: `node --check scripts/discover-keywords.mjs && echo "syntax OK"`
Expected: `syntax OK`.

- [ ] **Step 3: Commit**

```bash
git add scripts/discover-keywords.mjs
git commit -m "feat(keyword-discovery): DataForSEO search_volume client"
```

---

### Task 8: Bank IO (strict read + atomic insert) + dedup sources

**Files:**
- Modify: `scripts/discover-keywords.mjs`

Reads the keyword bank **strictly** (throw on read/parse failure — never persist a fallback, per the `incrementKeywordIndex` invariant), reads published article titles/slugs **forgivingly** (dedup source only), and inserts selected keywords at the current `index` (front of the unused queue), deduped, with an atomic write.

- [ ] **Step 1: Add bank + dedup IO**

```js
// add to scripts/discover-keywords.mjs (after enrichCandidates)

// ── Keyword bank + dedup sources ─────────────────────────────────────────────

// STRICT: throw on read/parse failure. The bank is the mutation target — never
// persist an empty fallback (that would wipe it). Mirrors incrementKeywordIndex.
function readBankStrict() {
  const raw = fs.readFileSync(KEYWORDS_PATH, 'utf-8')   // ENOENT/parse error => throw
  const data = JSON.parse(raw)
  if (!Array.isArray(data.keywords) || typeof data.index !== 'number') {
    throw new Error('keyword bank malformed')
  }
  return data
}

// FORGIVING: dedup source only (not a mutation target). Empty on any failure.
function readPublishedSeen() {
  try {
    const arr = JSON.parse(fs.readFileSync(ARTICLES_PATH, 'utf-8'))
    const out = new Set()
    for (const a of Array.isArray(arr) ? arr : []) {
      if (a?.title) out.add(String(a.title).toLowerCase().trim())
      if (a?.slug) out.add(String(a.slug).replace(/-/g, ' ').toLowerCase().trim())
    }
    return out
  } catch { return new Set() }
}

/** Insert keywords at the current index (front of unused queue) + atomic write. */
function insertIntoBank(selectedKeywords) {
  const bank = readBankStrict()
  const seen = new Set(bank.keywords.map(k => k.toLowerCase().trim()))
  const fresh = dedupeKeywords(selectedKeywords, seen)   // guard re-runs
  if (fresh.length) {
    bank.keywords.splice(bank.index, 0, ...fresh)
    writeFileAtomic(KEYWORDS_PATH, JSON.stringify(bank, null, 2))
  }
  return fresh
}
```

- [ ] **Step 2: Verify syntax**

Run: `node --check scripts/discover-keywords.mjs && echo "syntax OK"`
Expected: `syntax OK`.

- [ ] **Step 3: Commit**

```bash
git add scripts/discover-keywords.mjs
git commit -m "feat(keyword-discovery): strict bank read + atomic insert + published dedup"
```

---

### Task 9: Telegram summary

**Files:**
- Modify: `scripts/discover-keywords.mjs`

Sends one admin notification: keywords added (with volume + trend %), counts skipped, reserve candidates, and DataForSEO run cost. Mirrors `generate-article.mjs`'s `sendTelegramMessage`.

- [ ] **Step 1: Add Telegram helper + summary builder**

```js
// add to scripts/discover-keywords.mjs (after insertIntoBank)

async function sendTelegram(text) {
  if (!TG_TOKEN || !TG_CHAT_ID) { log('Telegram not configured, skipping'); return }
  const res = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TG_CHAT_ID, text, disable_web_page_preview: true }),
    signal: AbortSignal.timeout(10000),
  })
  if (!res.ok) log(`Telegram ${res.status}: ${(await res.text()).slice(0, 160)}`)
}

function summaryText({ added, selected, skippedCount, reserve, cost }) {
  const lines = [`🔎 Weekly keyword discovery — added ${added.length} of ${selected.length} top picks:`]
  for (const s of selected) {
    const mark = added.some(a => a.toLowerCase() === s.keyword.toLowerCase()) ? '•' : '— (dup, skipped)'
    const risePct = Math.round((s.rise - 1) * 100)
    lines.push(`${mark} ${s.keyword} — vol ~${s.maxVol}/mo, trend ${risePct >= 0 ? '↑' : '↓'}${Math.abs(risePct)}%`)
  }
  lines.push('', `Filtered out ${skippedCount} candidates (dupes / off-niche / low volume).`)
  if (reserve.length) lines.push(`Reserve: ${reserve.slice(0, 5).join(' · ')}`)
  lines.push(`This run cost: $${cost.toFixed(2)} (DataForSEO).`)
  return lines.join('\n')
}
```

- [ ] **Step 2: Verify syntax**

Run: `node --check scripts/discover-keywords.mjs && echo "syntax OK"`
Expected: `syntax OK`.

- [ ] **Step 3: Commit**

```bash
git add scripts/discover-keywords.mjs
git commit -m "feat(keyword-discovery): Telegram summary"
```

---

### Task 10: `main()` wiring + `--dry-run`

**Files:**
- Modify: `scripts/discover-keywords.mjs`

Wires the pipeline: validate env → gather candidates → dedup vs bank+published (cheap, pre-DataForSEO) → enrich via DataForSEO → `scoreAndSelect` → insert (or print) → Telegram (skipped in dry-run). On any DataForSEO error: alert + exit without touching the bank.

- [ ] **Step 1: Add `main()`**

```js
// add to scripts/discover-keywords.mjs (end of file)

async function main() {
  log(`Starting keyword discovery${DRY_RUN ? ' (DRY RUN)' : ''}`)
  if (!DFS_LOGIN || !DFS_PASSWORD) { log('ERROR: Missing DATAFORSEO_LOGIN or DATAFORSEO_PASSWORD'); process.exit(1) }

  // Bank read is strict; a malformed bank must stop us before spending API budget.
  const bank = readBankStrict()
  const seen = new Set([
    ...bank.keywords.map(k => k.toLowerCase().trim()),
    ...readPublishedSeen(),
  ])

  let candidates = await gatherCandidates()
  log(`Gathered ${candidates.length} raw candidates`)
  candidates = dedupeKeywords(candidates, seen)          // pre-DataForSEO dedup → fewer API calls
  log(`${candidates.length} candidates after dedup vs bank+published`)
  if (!candidates.length) {
    if (!DRY_RUN) await sendTelegram('🔎 Weekly keyword discovery: no new candidates this week.')
    log('No candidates, exiting'); return
  }

  let enriched, totalCost
  try {
    ({ enriched, totalCost } = await enrichCandidates(candidates))
  } catch (e) {
    log(`DataForSEO error: ${e.message}`)
    if (!DRY_RUN) await sendTelegram(`⚠️ Keyword discovery failed (DataForSEO): ${e.message}`)
    process.exit(1)                                       // bank untouched
  }
  log(`Enriched ${enriched.length} candidates; cost this run: $${totalCost.toFixed(2)}`)

  const selected = scoreAndSelect(enriched, { minVolume: MIN_VOLUME, n: N_PER_WEEK })
  const skippedCount = enriched.length - selected.length
  const reserve = scoreAndSelect(enriched, { minVolume: MIN_VOLUME, n: N_PER_WEEK + 5 })
    .slice(N_PER_WEEK).map(s => s.keyword)

  if (DRY_RUN) {
    log(`Would add ${selected.length}:`)
    for (const s of selected) log(`  ${s.score.toFixed(2)}  ${s.keyword}  (vol ${s.maxVol}, rise ${s.rise.toFixed(2)})`)
    return
  }

  const added = insertIntoBank(selected.map(s => s.keyword))
  log(`Added ${added.length} keywords to the bank at index ${bank.index}`)
  await sendTelegram(summaryText({ added, selected, skippedCount, reserve, cost: totalCost }))
  log('Done')
}

main().catch(e => { log(`FATAL: ${e.message}`); process.exit(1) })
```

- [ ] **Step 2: Full core test run + syntax**

Run:
```bash
node --test scripts/keyword-discovery-core.test.mjs && node --check scripts/discover-keywords.mjs && echo OK
```
Expected: all core tests PASS + `OK`.

- [ ] **Step 3: Local dry-run against a fixture bank (no real bank locally)**

A real `data/article-keywords.json` only exists on the server. Create a throwaway fixture so the dry-run can read a bank without touching anything real:
```bash
mkdir -p /tmp/kwd-fixture/data
printf '{"keywords":["existing dubai topic"],"index":0}' > /tmp/kwd-fixture/data/article-keywords.json
# Meaningful dry-run needs DataForSEO creds + real bank — verify on the SERVER in Task 12.
echo "Local dry-run requires DATAFORSEO_LOGIN/PASSWORD; full dry-run is run on the server in Task 12."
```
Note: the meaningful dry-run needs DataForSEO credentials (server-only) and the real bank — it is executed on the server in Task 12 before the cron is enabled. Locally we rely on the green core tests + `node --check`.

- [ ] **Step 4: Commit**

```bash
git add scripts/discover-keywords.mjs
git commit -m "feat(keyword-discovery): main() wiring + --dry-run"
```

---

### Task 11: Docs + env example

**Files:**
- Modify: `.env.example`
- Modify: `CLAUDE.md` (real path `/Users/dzhambulat/Projects/Claude/CLAUDE.md` — `worldwise/CLAUDE.md` is a symlink to it; edit the real target)

- [ ] **Step 1: Add `DATAFORSEO_LOGIN`/`DATAFORSEO_PASSWORD` to `.env.example`**

Append under the keys section:
```
# DataForSEO API credentials (weekly keyword-discovery cron, scripts/discover-keywords.mjs)
# Get from https://app.dataforseo.com/api-access
DATAFORSEO_LOGIN=
DATAFORSEO_PASSWORD=
```

- [ ] **Step 2: Add the cron row to CLAUDE.md Scheduled-jobs table**

Add this row to the table (after the existing rows):
```
| `0 5 * * 0` (Sun) | `scripts/discover-keywords.mjs` | `/var/log/worldwise-keyword-discovery.log` | Weekly keyword discovery → tops up the auto-blog keyword bank (see *Keyword discovery* under Architecture) |
```

- [ ] **Step 3: Add an Architecture subsection + env entry to CLAUDE.md**

Under the auto-blog area of Architecture, add:
```markdown
### Keyword discovery (weekly)

`scripts/discover-keywords.mjs` (cron, Sun 05:00 UTC) keeps the auto-blog keyword bank fresh. Pure core `scripts/keyword-discovery-core.mjs` (`node --test scripts/keyword-discovery-core.test.mjs`) handles scoring/filtering/normalization/dedup; the shell pulls candidates from Google autocomplete on `SEEDS`, enriches them with **DataForSEO** `keywords_data/google_ads/search_volume/live` (volume + 12-month trend, Basic auth via `DATAFORSEO_LOGIN`/`DATAFORSEO_PASSWORD`) across `TARGET_GEOS` (`uk`,`ae`,`in`, location codes 2826/2784/2356, **normalized per geo** so India can't dominate), filters (Dubai-geo / niche / buyer-intent / `MIN_VOLUME` / dedup vs bank + `data/articles.json`), scores by `normVol × trendRise × intent`, and **inserts the top `N_PER_WEEK` at the current bank index** (strict-read + atomic-write, like `incrementKeywordIndex`). It sends a Telegram summary (including run cost in USD) and auto-adds (no per-keyword approval — the per-article approval in `generate-article.mjs` still gates publishing). `--dry-run` prints the would-add list without writing or notifying. Needs `DATAFORSEO_LOGIN` and `DATAFORSEO_PASSWORD` in the server `.env.local`.
```

Add to the env-vars list:
```
- `DATAFORSEO_LOGIN` / `DATAFORSEO_PASSWORD` — DataForSEO API credentials (pay-as-you-go) for the weekly keyword-discovery cron (`scripts/discover-keywords.mjs`)
```

- [ ] **Step 4: Commit**

```bash
git add .env.example CLAUDE.md
git commit -m "docs(keyword-discovery): env example + CLAUDE.md scheduled job & architecture"
```

---

### Task 12: Deploy + server dry-run + enable cron (ops)

**Files:** none (server operations). Requires DataForSEO credentials from the user: sign up at https://app.dataforseo.com/api-access, use the $1 free trial for initial validation, then add $50 deposit (lasts years at this call volume). Copy the API login + password.

These steps run after the code is merged to `main`. Per repo workflow, code lands via branch → PR → squash-merge (direct push to `main` is blocked).

- [ ] **Step 1: Put the DataForSEO credentials on the server**

```bash
# append DATAFORSEO_LOGIN + DATAFORSEO_PASSWORD to server .env.local (excluded from rsync, persists)
ssh -i ~/.ssh/id_ed25519 root@62.238.35.20 \
  'cd /var/www/worldwise && cp -p .env.local .env.local.bak.$(date +%Y%m%d_%H%M%S) && printf "DATAFORSEO_LOGIN=%s\nDATAFORSEO_PASSWORD=%s\n" "LOGIN_HERE" "PASSWORD_HERE" >> .env.local && echo done'
```

- [ ] **Step 2: Deploy the scripts (rsync the two cron files; not part of the Next build)**

```bash
GD="/Users/dzhambulat/Projects/Claude"
rsync -avz -e "ssh -i ~/.ssh/id_ed25519" \
  "$GD/worldwise/scripts/discover-keywords.mjs" "$GD/worldwise/scripts/keyword-discovery-core.mjs" \
  root@62.238.35.20:/var/www/worldwise/scripts/
```

- [ ] **Step 3: Server dry-run (real DataForSEO + real bank, NO write/Telegram)**

```bash
ssh -i ~/.ssh/id_ed25519 root@62.238.35.20 \
  'cd /var/www/worldwise && node --env-file=.env.local scripts/discover-keywords.mjs --dry-run'
```
Expected: a "Would add N:" list of plausible Dubai buyer keywords with scores; run cost printed; **no** change to `data/article-keywords.json`. Verify the bank is unchanged:
```bash
ssh -i ~/.ssh/id_ed25519 root@62.238.35.20 \
  'cd /var/www/worldwise && node -e "const b=require(\"./data/article-keywords.json\");console.log(\"bank size\",b.keywords.length,\"index\",b.index)"'
```

- [ ] **Step 4: One real run (writes + Telegram) to confirm end-to-end**

```bash
ssh -i ~/.ssh/id_ed25519 root@62.238.35.20 \
  'cd /var/www/worldwise && cp -p data/article-keywords.json data/article-keywords.json.bak.$(date +%Y%m%d_%H%M%S) && node --env-file=.env.local scripts/discover-keywords.mjs'
```
Expected: Telegram summary arrives; bank size grows by ≤ `N_PER_WEEK`; new keywords sit at the current index.

- [ ] **Step 5: Enable the weekly cron**

```bash
ssh -i ~/.ssh/id_ed25519 root@62.238.35.20 \
  '(crontab -l 2>/dev/null; echo "0 5 * * 0 cd /var/www/worldwise && node --env-file=.env.local scripts/discover-keywords.mjs >> /var/log/worldwise-keyword-discovery.log 2>&1") | crontab - && crontab -l | grep discover-keywords'
```
Expected: the new cron line is listed.

---

## Self-Review

**Spec coverage:**
- Source = DataForSEO → Tasks 7, 12. ✓
- Auto-add + Telegram summary, no per-keyword approval → Tasks 9, 10. ✓
- Pipeline (discover → enrich → score → filter → dedup → insert) → Tasks 1–10. ✓
- Dubai-geo / niche / intent / min-volume filters → Task 3. ✓
- Dedup vs bank + published → Tasks 4, 8, 10. ✓
- Per-geo normalization (India can't dominate) → Task 2. ✓
- Insert at current index, strict-read + atomic-write → Task 8. ✓
- Failure handling (DataForSEO error → alert, bank untouched) → Tasks 9, 10. ✓
- `--dry-run` → Task 10; pure-core node:test → Tasks 1–5. ✓
- Ops (DATAFORSEO_LOGIN/PASSWORD, cron, log, docs) → Tasks 11, 12. ✓
- Candidate source: autocomplete as the concrete candidate generator + DataForSEO for authoritative volume/trend.

**Placeholder scan:** No TBD/TODO; all code complete; `PASTE_KEY_HERE` in Task 12 is an explicit user-supplied secret, not a code placeholder.

**Type consistency:** candidate shape (`{keyword, perGeo:{geo:{vol,trend}}}`) consistent across `enrichCandidates` → `scoreAndSelect` → `summaryText`; `scoreAndSelect` output fields (`keyword,score,normVol,rise,intent,maxVol,perGeo`) used consistently in `main()`/`summaryText`. Core exports (`trendRiseFactor,normalizeVolumePerGeo,intentWeight,passesFilters,dedupeKeywords,scoreAndSelect`) match imports in script + tests.
