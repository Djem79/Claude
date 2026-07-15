// scripts/ai-visibility.mjs
// Weekly AI-visibility monitor ("GEO"). Asks ChatGPT (via DataForSEO LLM
// Responses API, web search on) the typical investor questions our buyers ask,
// checks whether worldwise.pro is mentioned/cited, tallies which competitor
// brands the model names instead, diffs vs last week and sends a Telegram digest.
//
// Run: node --env-file=.env.local scripts/ai-visibility.mjs [--dry-run] [--sandbox]
//   --dry-run: first 3 prompts only, prints the report, no state write, no Telegram.
//   --sandbox: hits sandbox.dataforseo.com (free, dummy data) — integration test.
//
// Cron (Wed 05:30 UTC): 30 5 * * 3 → /var/log/worldwise-ai-visibility.log
// Cost: 12 prompts × ($0.0006 + LLM tokens ≈ $0.01) ≈ $0.13/run ≈ $0.55/month.
// Actual charge always read from tasks[0].cost.

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import {
  extractAnswer, detectMention, detectBrands,
  computeVisibilityDeltas, formatAiReport,
} from './ai-visibility-core.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const STATE_PATH = path.join(ROOT, 'data', 'ai-visibility-state.json')

const DRY_RUN = process.argv.includes('--dry-run')
const SANDBOX = process.argv.includes('--sandbox')

const OUR_DOMAIN = 'worldwise.pro'
const MODEL = 'gpt-4o'
const MAX_TOKENS = 1024
const REQUEST_GAP_MS = 1000
const API_BASE = SANDBOX ? 'https://sandbox.dataforseo.com' : 'https://api.dataforseo.com'

// Investor questions our buyers actually ask AI models. Keys are stable state
// identifiers — renaming a key resets that prompt's baseline. `probe: true` =
// direct brand question, excluded from the mention-share metric.
const PROMPTS = [
  { key: 'agency', label: 'лучшие агентства для инвесторов', prompt: 'What are the best real estate agencies in Dubai for international investors?' },
  { key: 'advisory', label: 'какой advisory выбрать иностранцу', prompt: 'Which Dubai property advisory should I use as a foreign buyer who wants investment guidance, not just listings?' },
  { key: 'how-to-buy', label: 'как купить иностранцу end-to-end', prompt: 'How can a foreigner buy property in Dubai, and which companies help with the whole process end to end?' },
  { key: 'remote', label: 'покупка удалённо', prompt: 'Can I buy property in Dubai without visiting in person? Which agencies handle remote purchases?' },
  { key: 'yields', label: 'доходность по районам', prompt: 'Which Dubai districts have the best gross rental yields in 2026, and who publishes reliable district-by-district yield data?' },
  { key: 'areas', label: 'районы под аренду', prompt: 'What are the best areas to buy an apartment in Dubai for rental income?' },
  { key: 'off-plan', label: 'off-plan консультанты', prompt: 'Who are the best off-plan property consultants in Dubai for overseas buyers?' },
  { key: 'golden-visa', label: 'Golden Visa через недвижимость', prompt: 'How do I get a UAE Golden Visa through property investment, and which advisors can guide me?' },
  { key: 'mortgage', label: 'ипотека нерезиденту', prompt: 'Can non-residents get a mortgage in Dubai, and which advisors help arrange one?' },
  { key: 'costs', label: 'транзакционные издержки', prompt: 'What are the full transaction costs when buying property in Dubai (DLD fees, agent fees, etc.)?' },
  { key: 'worth-it', label: 'стоит ли инвестировать', prompt: 'Is Dubai property a good investment in 2026? Which experts publish trustworthy data on this market?' },
  { key: 'brand-probe', label: 'бренд-проба', prompt: 'What do you know about Worldwise Real Estate in Dubai (worldwise.pro)?', probe: true },
]

// Brand patterns matched against answer text + citation hostnames.
const COMPETITORS = [
  { name: 'Bayut', re: /bayut/i },
  { name: 'Property Finder', re: /property\s?finder/i },
  { name: 'Betterhomes', re: /betterhomes|bhomes\.com/i },
  { name: 'fäm Properties', re: /f[aä]m\s?properties/i },
  { name: 'Driven', re: /driven\s?properties/i },
  { name: 'Allsopp & Allsopp', re: /allsopp/i },
  { name: 'Espace', re: /espace/i },
  { name: 'haus & haus', re: /haus\s?(&|and)\s?haus/i },
  { name: 'Metropolitan', re: /metropolitan\s?(premium|group|homes)?/i },
  { name: 'Provident', re: /provident\s?(estate|real)/i },
  { name: 'Unique Properties', re: /unique\s?properties/i },
  { name: 'dubizzle', re: /dubizzle/i },
  { name: 'Emirates.Estate', re: /emirates\.estate/i },
  { name: 'Savills', re: /savills/i },
  { name: 'Knight Frank', re: /knight\s?frank/i },
]

const DFS_LOGIN = process.env.DATAFORSEO_LOGIN
const DFS_PASSWORD = process.env.DATAFORSEO_PASSWORD
const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TG_CHAT_ID = (process.env.TELEGRAM_CHAT_ID ?? '').split(',')[0].trim()

const log = msg => console.log(`[${new Date().toISOString()}] ${msg}`)
const sleep = ms => new Promise(r => setTimeout(r, ms))

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
  if (typeof data.results !== 'object' || data.results === null) {
    throw new Error('ai-visibility state malformed')
  }
  return data
}

// ── DataForSEO LLM Responses (live — one task per call, up to 120s) ──────────
async function fetchLlmResponse(prompt) {
  const auth = Buffer.from(`${DFS_LOGIN}:${DFS_PASSWORD}`).toString('base64')
  const res = await fetch(`${API_BASE}/v3/ai_optimization/chat_gpt/llm_responses/live`, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
    body: JSON.stringify([{
      user_prompt: prompt,
      model_name: MODEL,
      max_output_tokens: MAX_TOKENS,
      web_search: true,
    }]),
    signal: AbortSignal.timeout(150000),
  })
  if (!res.ok) throw new Error(`DataForSEO ${res.status}: ${(await res.text()).slice(0, 160)}`)
  const json = await res.json()
  if (json.status_code !== 20000) throw new Error(`DataForSEO status ${json.status_code}: ${json.status_message}`)
  const t = json.tasks?.[0]
  if (t && t.status_code !== 20000) throw new Error(`task ${t.status_code}: ${t.status_message}`)
  return { items: t?.result?.[0]?.items ?? [], cost: Number(t?.cost) || 0 }
}

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
  log(`Starting ai-visibility${DRY_RUN ? ' (DRY RUN)' : ''}${SANDBOX ? ' (SANDBOX)' : ''}`)
  if (!DFS_LOGIN || !DFS_PASSWORD) {
    log('ERROR: Missing DATAFORSEO_LOGIN or DATAFORSEO_PASSWORD')
    process.exit(1)
  }

  const prompts = DRY_RUN ? PROMPTS.slice(0, 3) : PROMPTS
  log(`Asking ${prompts.length} prompts (${MODEL}, web_search on)`)

  const results = {}
  let probeSnippet = null
  let cost = 0
  let errors = 0
  for (const p of prompts) {
    try {
      const { items, cost: c } = await fetchLlmResponse(p.prompt)
      cost += c
      const answer = extractAnswer(items)
      const { mentioned, cited } = detectMention(answer, OUR_DOMAIN)
      results[p.key] = {
        label: p.label,
        mentioned,
        cited,
        probe: p.probe === true,
        brands: detectBrands(answer, COMPETITORS),
      }
      if (p.probe) probeSnippet = answer.text.replace(/\s+/g, ' ').trim().slice(0, 220) || null
      // Cited URLs go to the log only (not state/report) — they answer "who wins
      // this prompt and with what page" without a paid re-probe (see 2026-07-15).
      const citedPages = answer.citations.slice(0, 10).map(u => u.split('?')[0])
      log(`"${p.key}": mentioned=${mentioned} cited=${cited} brands=[${results[p.key].brands.join(', ')}] citations=[${citedPages.join(' ')}]`)
    } catch (e) {
      errors++
      log(`LLM fetch failed for "${p.key}": ${e.message}`)
      // omit from results — computeVisibilityDeltas must not see it as "lost"
    }
    await sleep(REQUEST_GAP_MS)
  }
  log(`Fetched ${Object.keys(results).length}/${prompts.length} answers, ${errors} errors, cost $${cost.toFixed(4)}`)

  const state = SANDBOX ? null : readState() // sandbox dummy data must never diff/pollute real state
  const deltas = computeVisibilityDeltas(results, state?.results ?? null)
  const report = formatAiReport({
    results,
    deltas,
    cost,
    firstRun: state === null,
    model: MODEL,
    probeSnippet,
  })

  if (DRY_RUN || SANDBOX) {
    log('--- report (not sent) ---')
    console.log(report)
    log('state not written, Telegram not sent')
    return
  }

  // Merge over previous results: errored prompts keep last week's baseline.
  const merged = { ...(state?.results ?? {}) }
  for (const [key, r] of Object.entries(results)) {
    merged[key] = { label: r.label, mentioned: r.mentioned, cited: r.cited, probe: r.probe, brands: r.brands }
  }
  writeFileAtomic(STATE_PATH, JSON.stringify({
    updatedAt: new Date().toISOString(),
    model: MODEL,
    results: merged,
  }, null, 2))
  log(`State written: ${Object.keys(merged).length} prompts`)

  await sendTelegram(report)
  log('Done')
}

main().catch(e => {
  log(`FATAL: ${e.message}`)
  process.exit(1)
})
