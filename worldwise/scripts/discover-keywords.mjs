// scripts/discover-keywords.mjs
// Weekly keyword-discovery cron. Discovers hot/rising Dubai-property buyer queries
// (Google autocomplete → Keywords Everywhere volume+trend) and tops up the auto-blog
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
const N_PER_WEEK = 5
const MIN_VOLUME = 100
const CANDIDATE_CAP = 200                    // cap unique candidates before KE enrichment (credit guard)
const CREDIT_LOW_WATERMARK = 20000           // Telegram alert if KE credits drop below this

const KE_API_KEY = process.env.KE_API_KEY
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

// ── Keywords Everywhere: volume + 12-month trend ─────────────────────────────
const KE_URL = 'https://api.keywordseverywhere.com/v1/get_keyword_data'

function chunk(arr, size) {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

/** One geo, up to 100 kw/request. Returns { rows: [{keyword, vol, trend}], creditsRemaining }. */
async function fetchKeywordData(keywords, geo) {
  const rows = []
  let creditsRemaining = null
  for (const batch of chunk(keywords, 100)) {
    const body = new URLSearchParams()
    body.set('dataSource', 'gkp')
    body.set('country', geo)
    body.set('currency', 'usd')
    for (const kw of batch) body.append('kw[]', kw)
    const res = await fetch(KE_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${KE_API_KEY}`,
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
      signal: AbortSignal.timeout(30000),
    })
    if (!res.ok) throw new Error(`KE ${res.status} (${geo}): ${(await res.text()).slice(0, 200)}`)
    const json = await res.json()
    for (const d of json.data ?? []) {
      rows.push({ keyword: String(d.keyword).toLowerCase().trim(), vol: Number(d.vol) || 0, trend: d.trend ?? [] })
    }
    if (typeof json.credits === 'number') creditsRemaining = json.credits
  }
  return { rows, creditsRemaining }
}

/** Enrich candidates with per-geo {vol, trend} from KE across all TARGET_GEOS. */
async function enrichCandidates(candidates) {
  const byKw = new Map(candidates.map(k => [k, { keyword: k, perGeo: {} }]))
  let creditsRemaining = null
  for (const geo of TARGET_GEOS) {
    const { rows, creditsRemaining: cr } = await fetchKeywordData(candidates, geo)
    if (cr != null) creditsRemaining = cr
    for (const r of rows) {
      const c = byKw.get(r.keyword)
      if (c) c.perGeo[geo] = { vol: r.vol, trend: r.trend }
    }
  }
  return { enriched: [...byKw.values()].filter(c => Object.keys(c.perGeo).length), creditsRemaining }
}

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
