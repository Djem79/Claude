// scripts/rank-tracker.mjs
// Weekly rank-tracker cron. Builds a tracked-keyword set (curated CORE_TERMS +
// GSC top queries by impressions), pulls exact Google UAE positions for each via
// DataForSEO SERP API (live advanced — includes AI Overview detection), diffs
// against last week's state and sends a Telegram digest of movers.
//
// Run: node --env-file=.env.local scripts/rank-tracker.mjs [--dry-run]
//   --dry-run: first 5 keywords only, prints the report, no state write, no Telegram.
//
// Cron (Tue 05:30 UTC): 30 5 * * 2 → /var/log/worldwise-rank-tracker.log
// Cost: ~100 SERPs × $0.003 (live advanced) ≈ $0.30/run ≈ $1.3/month.

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { google } from 'googleapis'
import { mergeTrackedKeywords, parseSerp, computeDeltas, formatRankReport } from './rank-tracker-core.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const STATE_PATH = path.join(ROOT, 'data', 'rank-tracker-state.json')

const DRY_RUN = process.argv.includes('--dry-run')

// ── Config ───────────────────────────────────────────────────────────────────
const OUR_DOMAIN = 'worldwise.pro'
const GEO = 2784 // UAE
const LANG = 'en'
const SERP_DEPTH = 20
const KEYWORD_CAP = 100
const GSC_DAYS = 28
const GSC_ROW_LIMIT = 250
const REQUEST_GAP_MS = 250

// Always-tracked commercial terms — aspirational targets GSC can't surface
// while we don't rank for them yet. Area terms mirror lib/areas.ts districts.
const CORE_TERMS = [
  'buy apartment in dubai',
  'buy property in dubai',
  'dubai real estate agency',
  'off plan properties dubai',
  'dubai property investment',
  'apartments for sale in dubai',
  'villas for sale in dubai',
  'dubai golden visa property',
  'dubai rental yields',
  'best areas to invest in dubai',
  'dubai property for international investors',
  'mortgage calculator dubai',
  'uae property residence visa',
  'dubai marina apartments for sale',
  'downtown dubai apartments for sale',
  'palm jumeirah villas for sale',
  'business bay apartments for sale',
  'jlt apartments for sale',
  'dubai hills villas for sale',
  'dubai creek harbour apartments',
  'emaar beachfront apartments for sale',
]

const DFS_LOGIN = process.env.DATAFORSEO_LOGIN
const DFS_PASSWORD = process.env.DATAFORSEO_PASSWORD
const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TG_CHAT_ID = (process.env.TELEGRAM_CHAT_ID ?? '').split(',')[0].trim()

const log = msg => console.log(`[${new Date().toISOString()}] ${msg}`)
const sleep = ms => new Promise(r => setTimeout(r, ms))

// ── Atomic write (mirrors competitor-gap.mjs) ────────────────────────────────
function writeFileAtomic(filePath, contents) {
  const tmp = `${filePath}.${process.pid}.tmp`
  fs.writeFileSync(tmp, contents, 'utf-8')
  fs.renameSync(tmp, filePath)
}

// ── State — STRICT read (repo invariant: never overwrite a corrupt store) ────
function readState() {
  let raw
  try {
    raw = fs.readFileSync(STATE_PATH, 'utf-8')
  } catch (e) {
    if (e.code === 'ENOENT') return null // first run
    throw e
  }
  const data = JSON.parse(raw) // corrupt file → throw, never silently reset the baseline
  if (typeof data.positions !== 'object' || data.positions === null) {
    throw new Error('rank-tracker state malformed')
  }
  return data
}

// ── GSC top queries (client mirrors scripts/gsc.mjs — CLI has no exports) ────
async function fetchGscTopQueries() {
  const { GSC_OAUTH_CLIENT_ID, GSC_OAUTH_CLIENT_SECRET, GSC_REFRESH_TOKEN } = process.env
  if (!GSC_OAUTH_CLIENT_ID || !GSC_OAUTH_CLIENT_SECRET || !GSC_REFRESH_TOKEN) {
    log('GSC env vars missing — tracking CORE_TERMS only')
    return []
  }
  const client = new google.auth.OAuth2(GSC_OAUTH_CLIENT_ID, GSC_OAUTH_CLIENT_SECRET)
  client.setCredentials({ refresh_token: GSC_REFRESH_TOKEN })
  const wm = google.webmasters({ version: 'v3', auth: client })
  const end = new Date()
  const start = new Date(end.getTime() - GSC_DAYS * 86400_000)
  const iso = d => d.toISOString().slice(0, 10)
  const { data } = await wm.searchanalytics.query({
    siteUrl: process.env.GSC_SITE_URL || `https://${OUR_DOMAIN}/`,
    requestBody: { startDate: iso(start), endDate: iso(end), dimensions: ['query'], rowLimit: GSC_ROW_LIMIT },
  })
  return (data.rows || []).map(r => ({ key: r.keys[0], impressions: r.impressions }))
}

// ── DataForSEO SERP (live advanced — ai_overview requires advanced) ─────────
const DFS_SERP_URL = 'https://api.dataforseo.com/v3/serp/google/organic/live/advanced'

async function fetchSerp(keyword) {
  const auth = Buffer.from(`${DFS_LOGIN}:${DFS_PASSWORD}`).toString('base64')
  const res = await fetch(DFS_SERP_URL, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
    body: JSON.stringify([{
      keyword,
      location_code: GEO,
      language_code: LANG,
      depth: SERP_DEPTH,
      device: 'desktop',
    }]),
    signal: AbortSignal.timeout(60000),
  })
  if (!res.ok) throw new Error(`DataForSEO ${res.status}: ${(await res.text()).slice(0, 160)}`)
  const json = await res.json()
  if (json.status_code !== 20000) throw new Error(`DataForSEO status ${json.status_code}: ${json.status_message}`)
  const task = json.tasks?.[0]
  if (task && task.status_code !== 20000) throw new Error(`task ${task.status_code}: ${task.status_message}`)
  return { items: task?.result?.[0]?.items ?? [], cost: Number(json.cost) || 0 }
}

// ── Telegram (single message is enough — report is compact) ─────────────────
async function sendTelegram(text) {
  if (!TG_TOKEN || !TG_CHAT_ID) { log('Telegram not configured, skipping'); return }
  const res = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TG_CHAT_ID, text: text.slice(0, 4000), disable_web_page_preview: true }),
    signal: AbortSignal.timeout(10000),
  })
  if (!res.ok) log(`Telegram ${res.status}: ${(await res.text()).slice(0, 160)}`)
}

// ── main ─────────────────────────────────────────────────────────────────────
async function main() {
  log(`Starting rank-tracker${DRY_RUN ? ' (DRY RUN)' : ''}`)
  if (!DFS_LOGIN || !DFS_PASSWORD) {
    log('ERROR: Missing DATAFORSEO_LOGIN or DATAFORSEO_PASSWORD')
    process.exit(1)
  }

  let gscRows = []
  try {
    gscRows = await fetchGscTopQueries()
    log(`GSC: ${gscRows.length} queries (${GSC_DAYS}d)`)
  } catch (e) {
    log(`GSC fetch failed (non-fatal, CORE_TERMS only): ${e.message}`)
  }

  let keywords = mergeTrackedKeywords(gscRows, CORE_TERMS, KEYWORD_CAP)
  if (DRY_RUN) keywords = keywords.slice(0, 5)
  log(`Tracking ${keywords.length} keywords`)

  const results = {}
  let cost = 0
  let errors = 0
  for (const kw of keywords) {
    try {
      const { items, cost: c } = await fetchSerp(kw)
      cost += c
      const p = parseSerp(items, OUR_DOMAIN)
      results[kw] = { pos: p.ourPos, url: p.ourUrl, above: p.above, aiOverview: p.aiOverview }
    } catch (e) {
      errors++
      log(`SERP failed for "${kw}": ${e.message}`)
      // omit from results — computeDeltas must not see it as "dropped"
    }
    await sleep(REQUEST_GAP_MS)
  }
  log(`Fetched ${Object.keys(results).length}/${keywords.length} SERPs, ${errors} errors, cost $${cost.toFixed(4)}`)

  const state = readState()
  const deltas = computeDeltas(results, state?.positions ?? null)
  const report = formatRankReport({
    tracked: keywords.length,
    results,
    deltas,
    cost,
    firstRun: state === null,
  })

  if (DRY_RUN) {
    log('--- DRY RUN report ---')
    console.log(report)
    log('DRY RUN: state not written, Telegram not sent')
    return
  }

  // Merge over previous positions: errored keywords keep last week's baseline
  // instead of losing it (they were omitted from `results`).
  const positions = { ...(state?.positions ?? {}) }
  for (const [kw, r] of Object.entries(results)) positions[kw] = { pos: r.pos ?? null, url: r.url ?? null }
  writeFileAtomic(STATE_PATH, JSON.stringify({ updatedAt: new Date().toISOString(), positions }, null, 2))
  log(`State written: ${Object.keys(positions).length} keywords`)

  await sendTelegram(report)
  log('Done')
}

main().catch(e => {
  log(`FATAL: ${e.message}`)
  process.exit(1)
})
