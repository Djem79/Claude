// scripts/competitor-gap.mjs
// Monthly competitor keyword-gap cron. Fetches DataForSEO Labs ranked_keywords
// for 7 Dubai-property competitors, computes a gap vs worldwise.pro, filters to
// winnable niche targets, and (a) sends a Telegram gap report, (b) feeds the
// top GAP_FEED_M into the auto-blog keyword bank.
//
// Run: node --env-file=.env.local scripts/competitor-gap.mjs [--dry-run]

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { selectGap, formatGapReport, splitByConfirmation, formatRelevantPages } from './competitor-gap-core.mjs'
import { dedupeKeywords } from './keyword-discovery-core.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const DATA_DIR = path.join(ROOT, 'data')
const KEYWORDS_PATH = path.join(DATA_DIR, 'article-keywords.json')

const DRY_RUN = process.argv.includes('--dry-run')

// ── Config (tunable) ─────────────────────────────────────────────────────────
// dubizzle.com intentionally excluded — general classifieds (cars/jobs/gov) floods the gap with noise.
const COMPETITORS = [
  'bayut.com',
  'propertyfinder.ae',
  'bhomes.com', // Betterhomes — the real domain (betterhomes.ae is an empty shell; backlink audit 2026-06-25)
  'famproperties.com',
  'drivenproperties.com',
  'metropolitan.realestate',
]
const OUR_DOMAIN = 'worldwise.pro'
// Big-three for the monthly "traffic-magnet pages" section (relevant_pages is
// per-domain paid — keep the panel small; report-only, no feed).
const BIG3 = ['bayut.com', 'propertyfinder.ae', 'bhomes.com']
const GEO = 2784            // UAE
const LANG = 'en'
const PER_DOMAIN_LIMIT = 1000
const MAX_DIFFICULTY = 40
const MIN_VOLUME = 100
const MAX_VOLUME = 20000
const GAP_N = 20            // report size
const GAP_FEED_M = 5        // top N fed into the keyword bank
const MAX_PER_THEME = 2

const DFS_LOGIN = process.env.DATAFORSEO_LOGIN
const DFS_PASSWORD = process.env.DATAFORSEO_PASSWORD
const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TG_CHAT_ID = (process.env.TELEGRAM_CHAT_ID ?? '').split(',')[0].trim()

const log = msg => console.log(`[${new Date().toISOString()}] ${msg}`)

// ── Atomic write (mirrors discover-keywords.mjs) ─────────────────────────────
function writeFileAtomic(filePath, contents) {
  const tmp = `${filePath}.${process.pid}.tmp`
  fs.writeFileSync(tmp, contents, 'utf-8')
  fs.renameSync(tmp, filePath)
}

// ── Keyword bank — STRICT read (never persist an empty fallback) ─────────────
function readBankStrict() {
  const raw = fs.readFileSync(KEYWORDS_PATH, 'utf-8')   // ENOENT/parse error → throw
  const data = JSON.parse(raw)
  if (!Array.isArray(data.keywords) || typeof data.index !== 'number') {
    throw new Error('keyword bank malformed')
  }
  return data
}

// ── DataForSEO Labs client ────────────────────────────────────────────────────

const DFS_LABS_URL = 'https://api.dataforseo.com/v3/dataforseo_labs/google/ranked_keywords/live'

/**
 * Fetch ranked keywords for a single domain from DataForSEO Labs.
 * Returns { rows: [{keyword, domain, rank, search_volume, keyword_difficulty, cpc, competition}], cost }.
 * Throws on HTTP error or DataForSEO status ≠ 20000.
 */
async function fetchRankedKeywords(domain) {
  const auth = Buffer.from(`${DFS_LOGIN}:${DFS_PASSWORD}`).toString('base64')
  const res = await fetch(DFS_LABS_URL, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
    body: JSON.stringify([{
      target: domain,
      location_code: GEO,
      language_code: LANG,
      limit: PER_DOMAIN_LIMIT,
      order_by: ['keyword_data.keyword_info.search_volume,desc'],
      filters: [
        ['keyword_data.keyword_info.search_volume', '>=', MIN_VOLUME],
        'and',
        ['keyword_data.keyword_properties.keyword_difficulty', '<=', MAX_DIFFICULTY],
        'and',
        ['ranked_serp_element.serp_item.rank_group', '<=', 20],
      ],
    }]),
    signal: AbortSignal.timeout(60000),
  })

  if (!res.ok) throw new Error(`DataForSEO ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const json = await res.json()
  if (json.status_code !== 20000) throw new Error(`DataForSEO status ${json.status_code}: ${json.status_message}`)

  const task = json.tasks?.[0]
  if (task && task.status_code !== 20000) {
    throw new Error(`DataForSEO task status ${task.status_code}: ${task.status_message}`)
  }

  const items = task?.result?.[0]?.items ?? []
  const rows = []
  for (const it of items) {
    // Defensive: documented nesting, but guard it in case of shape drift
    const kw = it?.keyword_data?.keyword || it?.keyword_data?.keyword_info?.keyword
    if (!kw) continue

    const info = it?.keyword_data?.keyword_info || {}
    const props = it?.keyword_data?.keyword_properties || {}
    const serp = it?.ranked_serp_element?.serp_item || {}

    rows.push({
      keyword: kw,
      domain,
      rank: serp.rank_group ?? serp.rank_absolute ?? null,
      search_volume: Number(info.search_volume) || 0,
      keyword_difficulty: props.keyword_difficulty ?? null,
      cpc: Number(info.cpc) || 0,
      competition: info.competition_level ?? info.competition ?? null,
    })
  }

  return { rows, cost: Number(json.cost) || 0 }
}

const DFS_PAGES_URL = 'https://api.dataforseo.com/v3/dataforseo_labs/google/relevant_pages/live'

/**
 * Fetch a domain's top traffic pages from DataForSEO Labs relevant_pages.
 * Returns { rows: [{page, etv, keywords}], cost }. Throws on API error.
 */
async function fetchRelevantPages(domain) {
  const auth = Buffer.from(`${DFS_LOGIN}:${DFS_PASSWORD}`).toString('base64')
  const res = await fetch(DFS_PAGES_URL, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
    body: JSON.stringify([{
      target: domain,
      location_code: GEO,
      language_code: LANG,
      limit: 10,
      order_by: ['metrics.organic.etv,desc'],
    }]),
    signal: AbortSignal.timeout(60000),
  })
  if (!res.ok) throw new Error(`DataForSEO ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const json = await res.json()
  if (json.status_code !== 20000) throw new Error(`DataForSEO status ${json.status_code}: ${json.status_message}`)
  const task = json.tasks?.[0]
  if (task && task.status_code !== 20000) {
    throw new Error(`DataForSEO task status ${task.status_code}: ${task.status_message}`)
  }
  const items = task?.result?.[0]?.items ?? []
  const rows = items.map(it => ({
    page: it?.page_address ?? '?',
    etv: Number(it?.metrics?.organic?.etv) || 0,
    keywords: Number(it?.metrics?.organic?.count) || 0,
  }))
  return { rows, cost: Number(json.cost) || 0 }
}

// ── Telegram (mirrors discover-keywords.mjs, with 3900-char chunking) ────────
async function sendTelegram(text) {
  if (!TG_TOKEN || !TG_CHAT_ID) { log('Telegram not configured, skipping'); return }
  const CHUNK = 3900
  if (text.length <= CHUNK) {
    await _tgSend(text)
  } else {
    const lines = text.split('\n')
    let chunk = ''
    for (const line of lines) {
      const next = chunk ? chunk + '\n' + line : line
      if (next.length > CHUNK) {
        await _tgSend(chunk)
        chunk = line
      } else {
        chunk = next
      }
    }
    if (chunk) await _tgSend(chunk)
  }
}

async function _tgSend(text) {
  const res = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TG_CHAT_ID, text, disable_web_page_preview: true }),
    signal: AbortSignal.timeout(10000),
  })
  if (!res.ok) log(`Telegram ${res.status}: ${(await res.text()).slice(0, 160)}`)
}

// ── main ──────────────────────────────────────────────────────────────────────
async function main() {
  log(`Starting competitor keyword-gap${DRY_RUN ? ' (DRY RUN)' : ''}`)
  if (!DFS_LOGIN || !DFS_PASSWORD) {
    log('ERROR: Missing DATAFORSEO_LOGIN or DATAFORSEO_PASSWORD')
    process.exit(1)
  }

  // ── 1. Pull our own ranked keywords to build ourSet ───────────────────────
  log(`Fetching ranked keywords for ${OUR_DOMAIN}`)
  let ourSet = new Set()
  try {
    const { rows: ourRows, cost: ourCost } = await fetchRankedKeywords(OUR_DOMAIN)
    ourSet = new Set(ourRows.map(r => r.keyword.toLowerCase().trim()))
    log(`${OUR_DOMAIN}: ${ourRows.length} ranked keywords (cost: $${ourCost.toFixed(4)})`)
  } catch (e) {
    // Not fatal: an empty ourSet means no exclusions — gap will be wider but correct
    log(`WARNING: Could not fetch ${OUR_DOMAIN} rankings: ${e.message} — proceeding with empty ourSet`)
  }

  // ── 2. Pull each competitor (per-domain error = skip, not abort) ──────────
  const allRows = []
  let totalCost = 0
  for (const domain of COMPETITORS) {
    log(`Fetching ranked keywords for ${domain}`)
    try {
      const { rows, cost } = await fetchRankedKeywords(domain)
      log(`${domain}: ${rows.length} items (cost: $${cost.toFixed(4)})`)
      allRows.push(...rows)
      totalCost += cost
    } catch (e) {
      log(`ERROR fetching ${domain}: ${e.message} — continuing with other domains`)
    }
  }
  log(`Total rows collected: ${allRows.length}; running cost so far: $${totalCost.toFixed(4)}`)

  // ── 3. Read the bank strictly (before we spend Telegram on a bank-corrupt run) ──
  let bank
  try {
    bank = readBankStrict()
  } catch (e) {
    log(`FATAL: Cannot read keyword bank: ${e.message}`)
    process.exit(1)
  }
  const bankSeen = new Set(bank.keywords.map(k => k.toLowerCase().trim()))

  // ── 4. Compute gap ────────────────────────────────────────────────────────
  const items = selectGap(allRows, ourSet, {
    bankSeen,
    maxDifficulty: MAX_DIFFICULTY,
    minVolume: MIN_VOLUME,
    maxVolume: MAX_VOLUME,
    n: GAP_N,
    maxPerTheme: MAX_PER_THEME,
  })

  // Bank feed prefers double-confirmed keywords (ranked by ≥2 competitors —
  // demand verified twice), then falls back to single-source picks.
  const { double, single } = splitByConfirmation(items)
  const feedList = [...double, ...single].slice(0, GAP_FEED_M).map(it => it.keyword)

  // ── 4b. Traffic-magnet pages of the big three (report-only) ──────────────
  const pagesByDomain = {}
  for (const domain of BIG3) {
    try {
      const { rows, cost } = await fetchRelevantPages(domain)
      pagesByDomain[domain] = rows
      totalCost += cost
      log(`${domain}: ${rows.length} relevant pages (cost: $${cost.toFixed(4)})`)
    } catch (e) {
      log(`relevant_pages failed for ${domain} (non-fatal): ${e.message}`)
    }
  }
  const pagesSection = formatRelevantPages(pagesByDomain)
  const report = formatGapReport(items) + (pagesSection ? `\n\n${pagesSection}` : '')

  // ── 5. DRY RUN: print, write/send nothing ────────────────────────────────
  if (DRY_RUN) {
    log(`Total DataForSEO cost this run: $${totalCost.toFixed(4)}`)
    log('--- gap report ---')
    log(report)
    log(`--- would feed top ${GAP_FEED_M} into bank ---`)
    for (const kw of feedList) log(`  ${kw}`)
    log('DRY RUN complete — nothing written or sent')
    return
  }

  // ── 6. Real run: insert top GAP_FEED_M into bank + send Telegram ─────────

  // Bank insert (replicate insertIntoBank from discover-keywords.mjs verbatim)
  try {
    const freshBank = readBankStrict()                              // re-read for freshness
    const seen = new Set(freshBank.keywords.map(k => k.toLowerCase().trim()))
    const fresh = dedupeKeywords(feedList, seen)                    // guard re-runs
    if (fresh.length) {
      freshBank.keywords.splice(freshBank.index, 0, ...fresh)
      writeFileAtomic(KEYWORDS_PATH, JSON.stringify(freshBank, null, 2))
      log(`Inserted ${fresh.length} keywords into bank at index ${freshBank.index}: ${fresh.join(', ')}`)
    } else {
      log('No fresh keywords to insert (all already in bank)')
    }
  } catch (e) {
    log(`ERROR inserting into bank (non-fatal for report): ${e.message}`)
  }

  // Telegram report
  try {
    await sendTelegram(report)
    log('Telegram report sent')
  } catch (e) {
    log(`ERROR sending Telegram (non-fatal): ${e.message}`)
  }

  log(`Done. Total DataForSEO cost: $${totalCost.toFixed(4)}`)
}

main().catch(e => { log(`FATAL: ${e.message}`); process.exit(1) })
