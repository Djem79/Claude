// scripts/keyword-discovery-core.mjs
// Pure, dependency-free core for the weekly keyword-discovery cron.
// No fs / no network / no imports — unit-tested with `node --test`.

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n))
const mean = arr => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0)

/**
 * 12-month trend → rising multiplier in [0.6, 2]. Flat≈1, rising>1, falling<1.
 * Smoothed: a constant k (half the series' own average, min 5) is added to both
 * sides so a near-zero early baseline can't blow the ratio up to the clamp — that
 * artefact pinned every keyword to the max and killed discrimination between them.
 */
export function trendRiseFactor(trend) {
  if (!Array.isArray(trend) || trend.length < 6) return 1
  const vals = trend.map(t => Number(t?.value) || 0)
  const k = Math.max(mean(vals) * 0.5, 5)
  const first = mean(vals.slice(0, 3))
  const last = mean(vals.slice(-3))
  return clamp((last + k) / (first + k), 0.6, 2)
}

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

const THEME_STOP = new Set(['dubai', 'uae', 'property', 'properties', 'real', 'estate', 'in', 'for',
  'the', 'to', 'a', 'of', 'and', 'or', 'vs', 'my', 'your', 'best', 'how', 'what', 'is', 'are', 'can',
  'i', 'with', 'on', 'buy', 'get'])
const singular = w => (w.endsWith('s') && w.length > 3 ? w.slice(0, -1) : w)

/** Cluster key = first significant (non-generic, singularised) token. Caps near-duplicate themes. */
export function themeKey(keyword) {
  const toks = String(keyword).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)
  const sig = toks.filter(t => !THEME_STOP.has(t)).map(singular)
  return sig[0] || toks[0] || ''
}

/** Full pure pipeline: normalize → filter → score → sort → diversify → top N. opts: { minVolume, n, maxPerTheme }. */
export function scoreAndSelect(candidates, opts) {
  const minVolume = Number(opts?.minVolume) || 0
  const n = Number(opts?.n) || 5
  const maxPerTheme = Number(opts?.maxPerTheme) || 2
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
  // Diversity: cap how many picks share a theme so one cluster can't fill the whole list.
  const out = []
  const themeCount = new Map()
  for (const s of scored) {
    const tk = themeKey(s.keyword)
    const count = themeCount.get(tk) || 0
    if (count >= maxPerTheme) continue
    themeCount.set(tk, count + 1)
    out.push(s)
    if (out.length >= n) break
  }
  return out
}
