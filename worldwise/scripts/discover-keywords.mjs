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
import { buildAddSuggestions, buildNegatives, formatClaudeChromePrompt } from './ads-feed-core.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const DATA_DIR = path.join(ROOT, 'data')
const KEYWORDS_PATH = path.join(DATA_DIR, 'article-keywords.json')
const ARTICLES_PATH = path.join(DATA_DIR, 'articles.json')
const ADS_SUGGESTED_PATH = path.join(DATA_DIR, 'ads-suggested.json')

const DRY_RUN = process.argv.includes('--dry-run')

// ── Config (tunable) ─────────────────────────────────────────────────────────
const SEEDS = [
  'dubai off plan payment plan', 'buy property in dubai golden visa',
  'dubai property residence visa', 'best area to invest in dubai',
  'dubai apartment rental yield', 'dubai off plan vs ready',
  'buy property in dubai as a foreigner', 'dubai property mortgage for expats',
  'dubai property service charges', 'dubai real estate capital appreciation',
  'damac off plan dubai', 'emaar off plan dubai',
  'dubai marina apartment investment', 'jvc dubai property investment',
  'business bay dubai property investment', 'dubai studio apartment investment',
]
const TARGET_GEOS = ['uk', 'ae', 'in']     // UK + UAE + India; per-geo normalized
const LOCATION_CODES = { uk: 2826, ae: 2784, in: 2356 }   // Google geo target IDs: UK, UAE, India
const N_PER_WEEK = 5
const MIN_VOLUME = 100
const CANDIDATE_CAP = 200                    // cap unique candidates before DataForSEO enrichment
const ADS_N = 8                              // max keywords to suggest adding per run
const ADS_MIN_NEG_VOL = 200                  // only negate waste terms with real volume

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

// DataForSEO Google Ads rejects the WHOLE request if any keyword breaks its limits:
// max 10 words and max 80 chars per phrase. Drop offending autocomplete suggestions here.
const isQueryable = k => k.length > 0 && k.length <= 80 && k.split(/\s+/).length <= 10

/** All unique candidate phrases from seeds × geos, capped. */
async function gatherCandidates() {
  const set = new Set()
  for (const seed of SEEDS) {
    for (const geo of TARGET_GEOS) {
      for (const s of await autocomplete(seed, geo)) {
        const k = String(s).toLowerCase().trim()
        if (isQueryable(k)) set.add(k)
      }
    }
  }
  return [...set].slice(0, CANDIDATE_CAP)
}

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
    rows.push({
      keyword: String(r.keyword).toLowerCase().trim(),
      vol: Number(r.search_volume) || 0,
      trend,
      cpc: Number(r.cpc) || 0,
      competition: r.competition ?? null,
    })
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
      if (c) c.perGeo[geo] = { vol: r.vol, trend: r.trend, cpc: r.cpc, competition: r.competition }
    }
  }
  return { enriched: [...byKw.values()].filter(c => Object.keys(c.perGeo).length), totalCost }
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

// ── Ads-suggested dedup store ─────────────────────────────────────────────────

// ENOENT → return empty store (first run). Present-but-unparseable → THROW (never
// silently wipe past suggestions). Coerce missing arrays to [].
function readAdsSuggested() {
  try {
    const raw = fs.readFileSync(ADS_SUGGESTED_PATH, 'utf-8')
    const data = JSON.parse(raw)
    return {
      keywords: Array.isArray(data.keywords) ? data.keywords : [],
      negatives: Array.isArray(data.negatives) ? data.negatives : [],
    }
  } catch (e) {
    if (e.code === 'ENOENT') return { keywords: [], negatives: [] }
    throw e   // parse error → propagate, never overwrite
  }
}

// Merge new items (case-insensitive dedup) into each array and atomic-write.
function appendAdsSuggested(newKeywords, newNegatives) {
  const store = readAdsSuggested()
  const kwSet = new Set(store.keywords.map(k => k.toLowerCase().trim()))
  const negSet = new Set(store.negatives.map(k => k.toLowerCase().trim()))
  for (const k of newKeywords) {
    const key = String(k).toLowerCase().trim()
    if (!kwSet.has(key)) { kwSet.add(key); store.keywords.push(k) }
  }
  for (const k of newNegatives) {
    const key = String(k).toLowerCase().trim()
    if (!negSet.has(key)) { negSet.add(key); store.negatives.push(k) }
  }
  writeFileAtomic(ADS_SUGGESTED_PATH, JSON.stringify(store, null, 2))
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

  // ── Ads feed (computed from the same enriched pool) ───────────────────────
  const store = readAdsSuggested()
  const seenKw  = new Set(store.keywords.map(k => k.toLowerCase().trim()))
  const seenNeg = new Set(store.negatives.map(k => k.toLowerCase().trim()))
  const adds = buildAddSuggestions(enriched, { minAdsVol: MIN_VOLUME, n: ADS_N, seen: seenKw })
  const negs = buildNegatives(enriched, { minNegVol: ADS_MIN_NEG_VOL, seen: seenNeg })
  const prompt = formatClaudeChromePrompt(adds, negs)

  if (DRY_RUN) {
    log(`Would add ${selected.length}:`)
    for (const s of selected) log(`  ${s.score.toFixed(2)}  ${s.keyword}  (vol ${s.maxVol}, rise ${s.rise.toFixed(2)})`)
    log(`Ads feed (dry-run): ${adds.length} to add, ${negs.length} negatives`)
    for (const a of adds) log(`  ${a.keyword}  bucket=${a.bucket}  match=${a.matchType}  vol=${a.adsVol}  cpc=${a.cpc}  comp=${a.competition}`)
    if (negs.length) log(`  Negatives: ${negs.join(' · ')}`)
    log('--- claude-chrome prompt ---')
    log(prompt)
    return
  }

  const added = insertIntoBank(selected.map(s => s.keyword))
  log(`Added ${added.length} keywords to the bank at index ${bank.index}`)
  await sendTelegram(summaryText({ added, selected, skippedCount, reserve, cost: totalCost }))

  // ── Ads feed: persist + notify ────────────────────────────────────────────
  try {
    appendAdsSuggested(adds.map(a => a.keyword), negs)
    const reviewMsg = adsFeedSummary(adds, negs)
    await sendTelegram(reviewMsg)
    // claude-chrome prompt: split into ≤3900-char chunks if needed
    const CHUNK = 3900
    if (prompt.length <= CHUNK) {
      await sendTelegram(prompt)
    } else {
      const lines = prompt.split('\n')
      let chunk = ''
      for (const line of lines) {
        const next = chunk ? chunk + '\n' + line : line
        if (next.length > CHUNK) {
          await sendTelegram(chunk)
          chunk = line
        } else {
          chunk = next
        }
      }
      if (chunk) await sendTelegram(chunk)
    }
  } catch (e) {
    log(`Ads feed error (non-fatal): ${e.message}`)
  }

  log('Done')
}

function adsFeedSummary(adds, negs) {
  const lines = [`🎯 Ads feed — ${adds.length} keywords to add / ${negs.length} negatives`]
  if (adds.length) {
    const byBucket = {}
    for (const a of adds) {
      if (!byBucket[a.bucket]) byBucket[a.bucket] = []
      byBucket[a.bucket].push(a)
    }
    for (const [bucket, items] of Object.entries(byBucket)) {
      lines.push(`\n[${bucket}]`)
      for (const item of items) {
        lines.push(`• ${item.keyword}  vol=${item.adsVol}  cpc=${item.cpc.toFixed(2)}  comp=${item.competition ?? '—'}  match=${item.matchType}`)
      }
    }
  }
  if (negs.length) {
    lines.push('\nNegatives:')
    for (const n of negs) lines.push(`- ${n}`)
  }
  return lines.join('\n')
}

main().catch(e => { log(`FATAL: ${e.message}`); process.exit(1) })
