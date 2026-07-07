// scripts/rank-tracker-core.mjs
// Pure logic for the weekly rank-tracker cron (scripts/rank-tracker.mjs).
// No fs / env / network imports — node:test'd in rank-tracker-core.test.mjs.

/** |Δpos| threshold for a keyword to appear in the movers section. */
export const MIN_DELTA = 3

/**
 * Merge curated core terms with GSC top queries into the tracked set.
 * Core terms always survive; GSC rows fill the remainder by impressions desc.
 * Returns lowercase-trimmed unique keywords, capped.
 */
export function mergeTrackedKeywords(gscRows, coreTerms, cap = 100) {
  const seen = new Set()
  const out = []
  const push = kw => {
    const k = String(kw ?? '').toLowerCase().trim()
    if (k.length < 3 || seen.has(k) || out.length >= cap) return
    seen.add(k)
    out.push(k)
  }
  for (const t of coreTerms) push(t)
  const sorted = [...gscRows].sort((a, b) => (b.impressions ?? 0) - (a.impressions ?? 0))
  for (const r of sorted) push(r.key)
  return out
}

/**
 * Extract our ranking picture from a DataForSEO advanced SERP items array.
 * Returns { ourPos, ourUrl, above, aiOverview }:
 *  - ourPos/ourUrl — first organic hit whose domain is ourDomain (or a subdomain), else null
 *  - above — up to 3 distinct organic domains ranked better than us
 *            (or the top-3 overall when we are absent)
 *  - aiOverview — true when the SERP carries an ai_overview block
 */
export function parseSerp(items, ourDomain) {
  const organic = (items ?? []).filter(i => i?.type === 'organic' && i.domain)
  const isOurs = d => d === ourDomain || String(d).endsWith(`.${ourDomain}`)

  let ourPos = null
  let ourUrl = null
  for (const it of organic) {
    if (isOurs(it.domain)) {
      ourPos = it.rank_group ?? it.rank_absolute ?? null
      ourUrl = it.url ?? null
      break
    }
  }

  const above = []
  for (const it of organic) {
    const rank = it.rank_group ?? it.rank_absolute ?? Infinity
    if (ourPos != null && rank >= ourPos) break
    if (!isOurs(it.domain) && !above.includes(it.domain)) above.push(it.domain)
    if (above.length >= 3) break
  }

  const aiOverview = (items ?? []).some(i => i?.type === 'ai_overview')
  return { ourPos, ourUrl, above, aiOverview }
}

/**
 * Diff current positions against the previous run.
 * current/previous: { [kw]: { pos: number|null } } — pos null = not in tracked depth.
 * Only keywords PRESENT in `current` are considered (a fetch error must not
 * fabricate a "dropped" alert — the shell simply omits errored keywords).
 * previous == null → first run → no deltas.
 */
export function computeDeltas(current, previous) {
  const up = [], down = [], entered = [], dropped = []
  if (!previous) return { up, down, entered, dropped }

  for (const [kw, cur] of Object.entries(current)) {
    const prevPos = previous[kw]?.pos ?? null
    const curPos = cur?.pos ?? null
    if (prevPos == null && curPos == null) continue
    if (prevPos == null && curPos != null) { entered.push({ kw, to: curPos }); continue }
    if (prevPos != null && curPos == null) { dropped.push({ kw, from: prevPos }); continue }
    const delta = prevPos - curPos // positive = improved
    if (delta >= MIN_DELTA) up.push({ kw, from: prevPos, to: curPos })
    else if (delta <= -MIN_DELTA) down.push({ kw, from: prevPos, to: curPos })
  }

  const byTo = (a, b) => a.to - b.to
  up.sort(byTo); down.sort(byTo); entered.sort(byTo)
  dropped.sort((a, b) => a.from - b.from)
  return { up, down, entered, dropped }
}

/**
 * Telegram digest (RU, back-office style like the gap report).
 * results: { [kw]: { pos, url, above, aiOverview } } — fetched keywords only.
 */
export function formatRankReport({ tracked, results, deltas, cost, firstRun }) {
  const entries = Object.entries(results)
  const inTop20 = entries.filter(([, r]) => r.pos != null && r.pos <= 20)
  const inTop10 = entries.filter(([, r]) => r.pos != null && r.pos <= 10)
  const aiKws = entries.filter(([, r]) => r.aiOverview)

  const lines = [
    '📊 Rank-tracker — worldwise.pro (Google UAE)',
    `Отслеживается: ${tracked} · получено: ${entries.length} · топ-10: ${inTop10.length} · топ-20: ${inTop20.length}`,
    `AI Overview на выдаче: ${aiKws.length} ключей`,
  ]

  // AI Overview sitting over the keywords we actually rank for — these are the
  // positions being devalued (clicks bleed to the AI answer). The actionable cut.
  const aiRanked = inTop20.filter(([, r]) => r.aiOverview).sort((a, b) => a[1].pos - b[1].pos)
  if (aiRanked.length) {
    lines.push('', `🤖 AI Overview на наших топ-20 (${aiRanked.length}):`)
    for (const [kw, r] of aiRanked.slice(0, 10)) lines.push(`• #${r.pos} ${kw}`)
  }

  if (firstRun) {
    lines.push('', '📌 Первый прогон — базовая линия записана, дельты появятся со следующей недели.')
    if (inTop20.length) {
      lines.push('', 'Текущий топ-20:')
      for (const [kw, r] of inTop20.sort((a, b) => a[1].pos - b[1].pos).slice(0, 15)) {
        lines.push(`• #${r.pos} ${kw}`)
      }
    }
  } else {
    const { up, down, entered, dropped } = deltas
    if (up.length) {
      lines.push('', `▲ Рост (${up.length}):`)
      for (const m of up.slice(0, 10)) lines.push(`• ${m.kw}: ${m.from} → ${m.to}`)
    }
    if (down.length) {
      lines.push('', `▼ Падение (${down.length}):`)
      for (const m of down.slice(0, 10)) {
        const outrankers = (results[m.kw]?.above ?? []).slice(0, 2).join(', ')
        lines.push(`• ${m.kw}: ${m.from} → ${m.to}${outrankers ? ` (выше: ${outrankers})` : ''}`)
      }
    }
    if (entered.length) {
      lines.push('', `🆕 Вошли в выдачу (${entered.length}):`)
      for (const m of entered.slice(0, 10)) lines.push(`• ${m.kw} → #${m.to}`)
    }
    if (dropped.length) {
      lines.push('', `❌ Выпали из выдачи (${dropped.length}):`)
      for (const m of dropped.slice(0, 10)) lines.push(`• ${m.kw} (был #${m.from})`)
    }
    if (!up.length && !down.length && !entered.length && !dropped.length) {
      lines.push('', 'Без значимых движений (|Δ| < 3).')
    }
  }

  lines.push('', `💰 Стоимость прогона: $${cost.toFixed(2)}`)
  return lines.join('\n')
}
