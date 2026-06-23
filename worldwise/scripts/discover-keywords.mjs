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
