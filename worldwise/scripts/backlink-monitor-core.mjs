// scripts/backlink-monitor-core.mjs
// Pure logic for the monthly backlink-monitor cron (scripts/backlink-monitor.mjs).
// No fs / env / network imports — node:test'd in backlink-monitor-core.test.mjs.

/**
 * Pick the headline profile numbers out of a DataForSEO
 * backlinks/summary/live result object (tasks[0].result[0]).
 * Missing fields coerce to 0 so a partial payload can't produce NaN deltas.
 */
export function summarizeProfile(result) {
  const n = v => (Number.isFinite(Number(v)) ? Number(v) : 0)
  return {
    rank: n(result?.rank),
    backlinks: n(result?.backlinks),
    referringDomains: n(result?.referring_domains),
    referringMainDomains: n(result?.referring_main_domains),
    referringDomainsNofollow: n(result?.referring_domains_nofollow),
    brokenBacklinks: n(result?.broken_backlinks),
  }
}

/**
 * Convert backlinks/referring_domains/live items into the state map
 * { domain: { rank, backlinks, dofollow, firstSeen } }.
 * dofollow = the domain has at least one non-nofollow referring page
 * (the API has no per-domain boolean — referring_pages vs _nofollow is the signal).
 */
export function buildDomainsState(items) {
  const out = {}
  for (const it of items ?? []) {
    if (!it?.domain) continue
    const pages = Number(it.referring_pages) || 0
    const nofollow = Number(it.referring_pages_nofollow) || 0
    out[it.domain] = {
      rank: Number(it.rank) || 0,
      backlinks: Number(it.backlinks) || 0,
      dofollow: pages > nofollow,
      firstSeen: it.first_seen ?? null,
    }
  }
  return out
}

/**
 * Diff the current domain map against the previous run's.
 * previous == null → first run → no deltas (baseline).
 * Returns { added, lost } sorted by rank desc (strongest domains first).
 */
export function computeDomainDeltas(currentDomains, previousDomains) {
  const added = []
  const lost = []
  if (!previousDomains) return { added, lost }

  for (const [domain, cur] of Object.entries(currentDomains)) {
    if (!(domain in previousDomains)) added.push({ domain, ...cur })
  }
  for (const [domain, prev] of Object.entries(previousDomains)) {
    if (!(domain in currentDomains)) lost.push({ domain, ...prev })
  }
  const byRank = (a, b) => (b.rank ?? 0) - (a.rank ?? 0)
  added.sort(byRank)
  lost.sort(byRank)
  return { added, lost }
}

/** Signed delta suffix: " (+3)" / " (−2)" / "" when unchanged or no baseline. */
function deltaSuffix(cur, prev) {
  if (prev == null) return ''
  const d = cur - prev
  if (d === 0) return ''
  return d > 0 ? ` (+${d})` : ` (−${Math.abs(d)})`
}

/**
 * Telegram digest (RU, back-office style like the rank-tracker report).
 */
export function formatBacklinkReport({ summary, prevSummary, added, lost, totalDomains, cost, firstRun }) {
  const p = firstRun ? null : prevSummary
  const lines = [
    '🔗 Бэклинк-монитор — worldwise.pro',
    `Реф. домены: ${summary.referringDomains}${deltaSuffix(summary.referringDomains, p?.referringDomains)}` +
      ` · ссылки: ${summary.backlinks}${deltaSuffix(summary.backlinks, p?.backlinks)}` +
      ` · rank: ${summary.rank}${deltaSuffix(summary.rank, p?.rank)}`,
    `Nofollow-доменов: ${summary.referringDomainsNofollow} · битых ссылок: ${summary.brokenBacklinks}`,
  ]

  if (firstRun) {
    lines.push('', `📌 Первый прогон — базовая линия записана (${totalDomains} доменов), дельты появятся со следующего месяца.`)
  } else {
    if (added.length) {
      lines.push('', `🆕 Новые домены (${added.length}):`)
      for (const d of added.slice(0, 15)) {
        lines.push(`• ${d.domain} — rank ${d.rank}${d.dofollow ? ' · dofollow' : ' · nofollow'}`)
      }
    }
    if (lost.length) {
      lines.push('', `❌ Потерянные домены (${lost.length}):`)
      for (const d of lost.slice(0, 15)) lines.push(`• ${d.domain} — был rank ${d.rank}`)
    }
    if (!added.length && !lost.length) lines.push('', 'Состав реф. доменов без изменений.')
  }

  lines.push('', `💰 Стоимость прогона: $${cost.toFixed(3)}`)
  return lines.join('\n')
}
