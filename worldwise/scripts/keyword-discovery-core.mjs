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
