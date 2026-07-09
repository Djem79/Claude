// scripts/backlink-monitor.mjs
// Monthly backlink-profile monitor. Pulls our profile summary + the full
// referring-domains list from DataForSEO Backlinks API, diffs against last
// month's state (new / lost domains) and sends a Telegram digest.
//
// Run: node --env-file=.env.local scripts/backlink-monitor.mjs [--dry-run] [--sandbox]
//   --dry-run: prints the report, no state write, no Telegram.
//   --sandbox: hits sandbox.dataforseo.com (free, dummy data) — integration test.
//
// Cron (1st of month 06:40 UTC): 40 6 1 * * → /var/log/worldwise-backlink-monitor.log
// Cost: summary $0.024 + referring_domains (limit 1000) ≈ $0.06 → ≈ $0.09/run, раз в месяц.

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { summarizeProfile, buildDomainsState, computeDomainDeltas, formatBacklinkReport } from './backlink-monitor-core.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const STATE_PATH = path.join(ROOT, 'data', 'backlink-monitor-state.json')

const DRY_RUN = process.argv.includes('--dry-run')
const SANDBOX = process.argv.includes('--sandbox')

const OUR_DOMAIN = 'worldwise.pro'
const DOMAIN_LIMIT = 1000
const API_BASE = SANDBOX ? 'https://sandbox.dataforseo.com' : 'https://api.dataforseo.com'

const DFS_LOGIN = process.env.DATAFORSEO_LOGIN
const DFS_PASSWORD = process.env.DATAFORSEO_PASSWORD
const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TG_CHAT_ID = (process.env.TELEGRAM_CHAT_ID ?? '').split(',')[0].trim()

const log = msg => console.log(`[${new Date().toISOString()}] ${msg}`)

// ── Atomic write (mirrors rank-tracker.mjs) ──────────────────────────────────
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
  if (typeof data.domains !== 'object' || data.domains === null) {
    throw new Error('backlink-monitor state malformed')
  }
  return data
}

// ── DataForSEO Backlinks ─────────────────────────────────────────────────────
async function dfsPost(pathname, task) {
  const auth = Buffer.from(`${DFS_LOGIN}:${DFS_PASSWORD}`).toString('base64')
  const res = await fetch(`${API_BASE}${pathname}`, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
    body: JSON.stringify([task]),
    signal: AbortSignal.timeout(60000),
  })
  if (!res.ok) throw new Error(`DataForSEO ${res.status}: ${(await res.text()).slice(0, 160)}`)
  const json = await res.json()
  if (json.status_code !== 20000) throw new Error(`DataForSEO status ${json.status_code}: ${json.status_message}`)
  const t = json.tasks?.[0]
  if (t && t.status_code !== 20000) throw new Error(`task ${t.status_code}: ${t.status_message}`)
  return { result: t?.result?.[0] ?? null, cost: Number(t?.cost) || 0 }
}

const fetchSummary = () => dfsPost('/v3/backlinks/summary/live', {
  target: OUR_DOMAIN,
  include_subdomains: true,
  exclude_internal_backlinks: true,
  internal_list_limit: 10,
  backlinks_status_type: 'live',
  rank_scale: 'one_hundred',
})

const fetchReferringDomains = () => dfsPost('/v3/backlinks/referring_domains/live', {
  target: OUR_DOMAIN,
  limit: DOMAIN_LIMIT,
  order_by: ['rank,desc'],
  include_subdomains: true,
  exclude_internal_backlinks: true,
  backlinks_status_type: 'live',
  rank_scale: 'one_hundred',
})

// ── Telegram ─────────────────────────────────────────────────────────────────
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
  log(`Starting backlink-monitor${DRY_RUN ? ' (DRY RUN)' : ''}${SANDBOX ? ' (SANDBOX)' : ''}`)
  if (!DFS_LOGIN || !DFS_PASSWORD) {
    log('ERROR: Missing DATAFORSEO_LOGIN or DATAFORSEO_PASSWORD')
    process.exit(1)
  }

  const { result: summaryRaw, cost: c1 } = await fetchSummary()
  const summary = summarizeProfile(summaryRaw)
  log(`Summary: rank ${summary.rank}, ${summary.referringDomains} referring domains, ${summary.backlinks} backlinks`)

  const { result: domainsRaw, cost: c2 } = await fetchReferringDomains()
  const items = domainsRaw?.items ?? []
  if ((domainsRaw?.total_count ?? 0) > DOMAIN_LIMIT) {
    log(`NOTE: total_count ${domainsRaw.total_count} exceeds limit ${DOMAIN_LIMIT} — list truncated`)
  }
  const currentDomains = buildDomainsState(items)
  const cost = c1 + c2
  log(`Referring domains fetched: ${Object.keys(currentDomains).length}, cost $${cost.toFixed(4)}`)

  const state = SANDBOX ? null : readState() // sandbox dummy data must never diff/pollute real state
  const { added, lost } = computeDomainDeltas(currentDomains, state?.domains ?? null)
  const report = formatBacklinkReport({
    summary,
    prevSummary: state?.summary ?? null,
    added,
    lost,
    totalDomains: Object.keys(currentDomains).length,
    cost,
    firstRun: state === null,
  })

  if (DRY_RUN || SANDBOX) {
    log('--- report (not sent) ---')
    console.log(report)
    log('state not written, Telegram not sent')
    return
  }

  writeFileAtomic(STATE_PATH, JSON.stringify({
    updatedAt: new Date().toISOString(),
    summary,
    domains: currentDomains,
  }, null, 2))
  log(`State written: ${Object.keys(currentDomains).length} domains`)

  await sendTelegram(report)
  log('Done')
}

main().catch(e => {
  log(`FATAL: ${e.message}`)
  process.exit(1)
})
