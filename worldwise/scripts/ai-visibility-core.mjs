// scripts/ai-visibility-core.mjs
// Pure logic for the weekly AI-visibility cron (scripts/ai-visibility.mjs).
// No fs / env / network imports — node:test'd in ai-visibility-core.test.mjs.

/**
 * Flatten a DataForSEO llm_responses/live result item array into
 * { text, citations } — text from items[type=message].sections[type=text],
 * citations from every section's annotations[] urls (deduped).
 * annotations is null when web_search is off; sections may omit it entirely.
 */
export function extractAnswer(items) {
  const chunks = []
  const citations = []
  for (const it of items ?? []) {
    if (it?.type !== 'message') continue
    for (const sec of it.sections ?? []) {
      if (sec?.type === 'text' && typeof sec.text === 'string') chunks.push(sec.text)
      for (const a of sec?.annotations ?? []) {
        if (a?.url && !citations.includes(a.url)) citations.push(a.url)
      }
    }
  }
  return { text: chunks.join('\n'), citations }
}

/**
 * Did the answer mention us? `mentioned` — brand name appears in the text;
 * `cited` — one of the citation urls points at our domain (incl. subdomains).
 */
export function detectMention({ text, citations }, ourDomain, brandRe = /worldwise/i) {
  const mentioned = brandRe.test(text ?? '')
  const domRe = new RegExp(`(^|[./])${ourDomain.replace(/\./g, '\\.')}(/|$)`, 'i')
  const cited = (citations ?? []).some(u => {
    try {
      return domRe.test(new URL(u).hostname + '/')
    } catch {
      return domRe.test(String(u))
    }
  })
  return { mentioned, cited }
}

/**
 * Which known competitor brands appear in the answer (text or citation hosts)?
 * competitors: [{ name, re }] — returns the names present, order preserved.
 */
export function detectBrands({ text, citations }, competitors) {
  const hosts = (citations ?? [])
    .map(u => {
      try { return new URL(u).hostname } catch { return String(u) }
    })
    .join(' ')
  const haystack = `${text ?? ''}\n${hosts}`
  return competitors.filter(c => c.re.test(haystack)).map(c => c.name)
}

/**
 * Aggregate brand appearances across prompts: { name: promptCount } sorted desc.
 * results: { [key]: { brands: string[] } }
 */
export function tallyBrands(results) {
  const counts = {}
  for (const r of Object.values(results)) {
    for (const b of r.brands ?? []) counts[b] = (counts[b] ?? 0) + 1
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])
}

/**
 * Diff mention flags per prompt vs previous run.
 * Only prompts present in `current` are considered (fetch errors are omitted
 * upstream and must not fabricate a "потеряли упоминание" alert).
 * previous == null → first run → no deltas.
 */
export function computeVisibilityDeltas(current, previous) {
  const gained = []
  const lostMention = []
  if (!previous) return { gained, lostMention }
  for (const [key, cur] of Object.entries(current)) {
    const prev = previous[key]
    if (!prev) continue
    if (cur.mentioned && !prev.mentioned) gained.push(key)
    if (!cur.mentioned && prev.mentioned) lostMention.push(key)
  }
  return { gained, lostMention }
}

/**
 * Telegram digest (RU). results: { [key]: { label, mentioned, cited, probe, brands } }.
 * Probe prompts (direct brand questions) are excluded from the mention share.
 */
export function formatAiReport({ results, deltas, cost, firstRun, model, probeSnippet }) {
  const entries = Object.entries(results)
  const scored = entries.filter(([, r]) => !r.probe)
  const mentioned = scored.filter(([, r]) => r.mentioned)
  const cited = scored.filter(([, r]) => r.cited)

  const lines = [
    `🤖 AI-visibility — worldwise.pro (${model}, web search)`,
    `Упоминание бренда: ${mentioned.length}/${scored.length} промптов · цитирование сайта: ${cited.length}/${scored.length}`,
  ]

  if (mentioned.length) {
    lines.push('', '✓ Упомянуты в:')
    for (const [, r] of mentioned) lines.push(`• ${r.label}${r.cited ? ' (с цитатой)' : ''}`)
  }

  if (firstRun) {
    lines.push('', '📌 Первый прогон — базовая линия записана, дельты появятся со следующей недели.')
  } else {
    const { gained, lostMention } = deltas
    if (gained.length) {
      lines.push('', `▲ Появилось упоминание (${gained.length}):`)
      for (const k of gained) lines.push(`• ${results[k]?.label ?? k}`)
    }
    if (lostMention.length) {
      lines.push('', `▼ Пропало упоминание (${lostMention.length}):`)
      for (const k of lostMention) lines.push(`• ${results[k]?.label ?? k}`)
    }
    if (!gained.length && !lostMention.length) lines.push('', 'Дельт по упоминаниям нет.')
  }

  const brands = tallyBrands(Object.fromEntries(scored))
  if (brands.length) {
    lines.push('', '🏢 Чужие бренды в ответах:')
    lines.push(brands.slice(0, 8).map(([n, c]) => `${n} ×${c}`).join(' · '))
  }

  if (probeSnippet) {
    lines.push('', `🔍 Что модель знает о Worldwise: ${probeSnippet}`)
  }

  lines.push('', `💰 Стоимость прогона: $${cost.toFixed(3)}`)
  return lines.join('\n')
}
