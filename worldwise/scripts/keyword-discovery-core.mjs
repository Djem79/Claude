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
