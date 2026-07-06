// scripts/competitor-gap-core.mjs
// Pure, dependency-free core for the monthly competitor keyword-gap cron.
// No fs / no network — unit-tested with `node --test`.
// May import gating helpers from keyword-discovery-core (same dir, also pure).

import { passesFilters, intentWeight, themeKey } from './keyword-discovery-core.mjs'

// ---------------------------------------------------------------------------
// 1. computeGap
// ---------------------------------------------------------------------------

/**
 * Aggregate competitor rows by keyword, merge sources, exclude keywords we
 * already rank for (ourSet).
 *
 * @param {Array<{keyword, domain, rank, search_volume, keyword_difficulty, cpc, competition}>} competitorRows
 * @param {Set<string>} ourSet - Set of our lowercased keywords
 * @returns {Array<{keyword, search_volume, keyword_difficulty, cpc, competition, sources}>}
 */
export function computeGap(competitorRows, ourSet) {
  // Map from lowercased keyword → aggregated entry
  const map = new Map()

  for (const row of competitorRows) {
    const key = String(row.keyword || '').toLowerCase().trim()
    if (!key) continue
    if (ourSet.has(key)) continue

    if (!map.has(key)) {
      map.set(key, {
        keyword: row.keyword, // original casing of first row seen
        search_volume: row.search_volume != null ? Number(row.search_volume) : null,
        keyword_difficulty: row.keyword_difficulty != null ? Number(row.keyword_difficulty) : null,
        // representative cpc/competition from the highest-volume row (updated below)
        _highestVol: row.search_volume != null ? Number(row.search_volume) : -Infinity,
        cpc: row.cpc,
        competition: row.competition,
        sources: [{ domain: row.domain, rank: row.rank }],
      })
    } else {
      const entry = map.get(key)
      // merge sources
      entry.sources.push({ domain: row.domain, rank: row.rank })
      // max search_volume (treat null/undefined as not-present so real number wins)
      const rowVol = row.search_volume != null ? Number(row.search_volume) : null
      if (rowVol != null && (entry.search_volume == null || rowVol > entry.search_volume)) {
        entry.search_volume = rowVol
      }
      // min keyword_difficulty (best-case winnability; null = not present, real number wins)
      const rowKd = row.keyword_difficulty != null ? Number(row.keyword_difficulty) : null
      if (rowKd != null && (entry.keyword_difficulty == null || rowKd < entry.keyword_difficulty)) {
        entry.keyword_difficulty = rowKd
      }
      // representative cpc/competition from the highest-volume row
      const vol = rowVol ?? -Infinity
      if (vol > entry._highestVol) {
        entry._highestVol = vol
        entry.cpc = row.cpc
        entry.competition = row.competition
      }
    }
  }

  // Clean up internal tracking field, return plain objects
  return Array.from(map.values()).map(({ _highestVol: _v, ...rest }) => rest)
}

// ---------------------------------------------------------------------------
// 2. isWinnable
// ---------------------------------------------------------------------------

/**
 * True when the candidate is within our reachable difficulty + volume window.
 * null KD → treated as 100 (not winnable).
 *
 * @param {{ search_volume, keyword_difficulty }} cand
 * @param {{ maxDifficulty: number, minVolume: number, maxVolume: number }} opts
 */
export function isWinnable(cand, opts) {
  const vol = Number(cand.search_volume) || 0
  const kd = cand.keyword_difficulty == null ? 100 : Number(cand.keyword_difficulty)
  return kd <= opts.maxDifficulty && vol >= opts.minVolume && vol <= opts.maxVolume
}

// ---------------------------------------------------------------------------
// 3. scoreGap
// ---------------------------------------------------------------------------

/**
 * Score a gap candidate: volume * intent / (1 + KD/100).
 * Favours decent volume, buyer intent, low difficulty.
 * null KD → 100.
 *
 * @param {{ keyword, search_volume, keyword_difficulty }} cand
 * @returns {number}
 */
export function scoreGap(cand) {
  const vol = Number(cand.search_volume) || 0
  const kd = cand.keyword_difficulty == null ? 100 : Number(cand.keyword_difficulty)
  return vol * intentWeight(cand.keyword) / (1 + kd / 100)
}

// ---------------------------------------------------------------------------
// 3b. isGapWorthy — stricter than the blog niche gate.
// Competitor domains (esp. classifieds/portals) rank for masses of navigational
// and off-topic terms (specific building/tower/community names, gov offices,
// cars, jobs) that merely contain "dubai". A gap candidate must show real
// buyer/investment/informational intent AND not be classifieds noise.
// ---------------------------------------------------------------------------

const GAP_DENY = ['car', 'cars', 'used car', 'job', 'jobs', 'salary', 'vacancy', 'directorate',
  'foreigners affairs', 'licence', 'license', 'tourist', 'flight', 'court', 'police',
  'visa stamp', 'hotel', 'furniture', 'metro station', 'bus',
  // rental-search = renters, not our sales/investor customer (rental YIELD still kept via 'yield')
  'rent', 'renting', 'accommodation', 'flatmate']
// NOTE: no bare 'residence'/'rent' here — they match building names ("Damac Residences") and rental
// search. Use specific multi-word intent ('residence visa') + 'residency' (won't match "residences").
// 'roi' and ' vs ' are space-bounded (k is space-padded) so they don't match inside words
// ("detROIt"); bare 'residency' removed — it's a common Dubai building-name suffix ("Mayfair Residency").
const GAP_INTENT = ['buy', 'invest', 'for sale', 'price', 'yield', ' roi ', 'off plan',
  'off-plan', 'payment plan', 'golden visa', 'residence visa', 'property visa', 'mortgage', 'freehold',
  'handover', 'service charge', 'cost', 'fees', 'cheap', 'affordable', 'best area', 'how to',
  'what is', 'guide', 'worth', ' vs ']
const normPad = s => ` ${String(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim()} `

/** Require buyer/info intent; reject word-bounded classifieds/navigational noise. */
export function isGapWorthy(keyword) {
  const k = normPad(keyword)
  if (GAP_DENY.some(t => k.includes(` ${t} `))) return false
  return GAP_INTENT.some(t => k.includes(t))
}

// ---------------------------------------------------------------------------
// 4. selectGap
// ---------------------------------------------------------------------------

/**
 * Full pipeline: computeGap → drop bankSeen → passesFilters → isWinnable →
 * score → sort desc → theme-diversify → top n.
 *
 * @param {Array} competitorRows
 * @param {Set<string>} ourSet
 * @param {{
 *   bankSeen?: Set<string>,
 *   maxDifficulty: number,
 *   minVolume: number,
 *   maxVolume: number,
 *   n: number,
 *   maxPerTheme?: number
 * }} opts
 * @returns {Array<{keyword, search_volume, keyword_difficulty, cpc, competition, sources, score}>}
 */
export function selectGap(competitorRows, ourSet, opts) {
  const bankSeen = opts.bankSeen ?? new Set()
  const maxPerTheme = Number(opts.maxPerTheme) || 2
  const n = Number(opts.n) || 10

  // Step 1: aggregate
  const gap = computeGap(competitorRows, ourSet)

  // Step 2: drop bankSeen
  const filtered = gap.filter(c => !bankSeen.has(c.keyword.toLowerCase().trim()))

  // Step 3: niche/geo/intent gate
  const niched = filtered.filter(c => {
    const vol = Number(c.search_volume) || 0
    return passesFilters(c.keyword, { minVolume: opts.minVolume, maxVol: vol }).ok
  })

  // Step 3b: gap-worthy gate — buyer/info intent only, no classifieds/navigational noise
  const worthy = niched.filter(c => isGapWorthy(c.keyword))

  // Step 4: winnability gate
  const winnable = worthy.filter(c => isWinnable(c, {
    maxDifficulty: opts.maxDifficulty,
    minVolume: opts.minVolume,
    maxVolume: opts.maxVolume,
  }))

  // Step 5: score + sort
  const scored = winnable
    .map(c => ({ ...c, score: scoreGap(c) }))
    .sort((a, b) => b.score - a.score)

  // Step 6: theme-diversify
  const out = []
  const themeCount = new Map()
  for (const c of scored) {
    const tk = themeKey(c.keyword)
    const count = themeCount.get(tk) || 0
    if (count >= maxPerTheme) continue
    themeCount.set(tk, count + 1)
    out.push(c)
    if (out.length >= n) break
  }

  return out
}

// ---------------------------------------------------------------------------
// 5. formatGapReport
// ---------------------------------------------------------------------------

/**
 * Build a Telegram-ready gap report string.
 *
 * @param {Array<{keyword, search_volume, keyword_difficulty, cpc, competition, sources}>} items
 * @returns {string}
 */
export function formatGapReport(items) {
  if (!items.length) return 'No new competitor-gap keywords this month.'

  const doubleCount = items.filter(it => (it.sources?.length ?? 0) >= 2).length
  const header = doubleCount
    ? `🔍 Competitor gap — ${items.length} opportunities (×2 = подтверждены двумя+ конкурентами: ${doubleCount}):`
    : `🔍 Competitor gap — ${items.length} opportunities:`
  const lines = [header]

  for (const item of items) {
    const vol = item.search_volume ?? 'n/a'
    const kd = item.keyword_difficulty ?? 'n/a'
    const cpc = item.cpc != null ? `$${Number(item.cpc).toFixed(2)}` : 'n/a'
    const srcList = (item.sources || [])
      .slice(0, 3)
      .map(s => `${s.domain} #${s.rank}`)
      .join(', ')
    const mark = (item.sources?.length ?? 0) >= 2 ? '×2 ' : ''
    lines.push(`• ${mark}${item.keyword} — vol ${vol}, KD ${kd}, ${cpc} — ranked by: ${srcList}`)
  }

  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// 6. Intersection + relevant pages (monthly upgrade, 2026-07-06)
// ---------------------------------------------------------------------------

/**
 * Split gap items into double-confirmed (ranked top-20 by ≥2 competitor
 * domains — demand verified twice) vs single-source. The bank feed prefers
 * double-confirmed keywords.
 */
export function splitByConfirmation(items) {
  const double = [], single = []
  for (const it of items) ((it.sources?.length ?? 0) >= 2 ? double : single).push(it)
  return { double, single }
}

/**
 * Format the "competitor traffic-magnet pages" report section.
 * byDomain: { [domain]: [{ page, etv, keywords }] } sorted by ETV desc.
 * Answers "what PAGES should we build" — page types that demonstrably earn traffic.
 */
export function formatRelevantPages(byDomain) {
  const domains = Object.keys(byDomain).filter(d => byDomain[d]?.length)
  if (!domains.length) return ''

  const lines = ['📄 Страницы-магниты конкурентов (топ по трафику, UAE):']
  for (const domain of domains) {
    lines.push(`\n${domain}:`)
    for (const p of byDomain[domain].slice(0, 5)) {
      const etv = Math.round(p.etv ?? 0)
      lines.push(`• ${p.page} — ~${etv} визитов/мес, ${p.keywords ?? 0} ключей`)
    }
  }
  return lines.join('\n')
}
