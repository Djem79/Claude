// scripts/gsc-content-review-core.mjs
// Pure, dependency-free core for the GSC content-performance feedback loop.
// No fs / no network — unit-tested with `node --test`.

// ---------------------------------------------------------------------------
// classifyPages
// ---------------------------------------------------------------------------

/**
 * Classify GSC page rows into content-performance buckets.
 *
 * @param {Array<{ page, clicks, impressions, ctr, position }>} current
 *   ctr is a 0–1 fraction, position is a float.
 * @param {Array<{ page, clicks, impressions, ctr, position }>} previous
 *   Same shape — prior period of equal length.
 * @param {Object} [opts]
 * @returns {{ winners, decaying, strikingDistance, lowCtr }}
 */
export function classifyPages(current, previous, opts) {
  const {
    winPct          = 0.30,
    decayPct        = 0.30,
    minWinnerImpr   = 20,
    minBaseImpr     = 20,
    strikeMinPos    = 8,
    strikeMaxPos    = 20,
    minStrikingImpr = 30,
    lowCtrMaxPos    = 10,
    minLowCtrImpr   = 50,
    lowCtrThreshold = 0.01,
    cap             = 8,
  } = opts || {}

  // Build a lookup of previous impressions by page URL.
  const prevMap = new Map()
  for (const row of previous) {
    prevMap.set(row.page, row.impressions)
  }

  const winners         = []
  const decaying        = []
  const strikingDistance = []
  const lowCtr          = []

  for (const row of current) {
    const { page, impressions, position, ctr } = row
    const prev = prevMap.get(page) || 0

    // Winner: impressions grew >= winPct vs prior period
    if (prev > 0 && impressions >= minWinnerImpr) {
      const delta = (impressions - prev) / prev
      if (delta >= winPct) {
        winners.push({
          page, impressions, position, ctr,
          deltaPct: Math.round(delta * 100),
        })
      }
    }

    // Decaying: impressions fell >= decayPct from a meaningful base
    if (prev >= minBaseImpr) {
      const delta = (impressions - prev) / prev
      if (delta <= -decayPct) {
        decaying.push({
          page, impressions, position, ctr,
          deltaPct: Math.round(delta * 100),
        })
      }
    }

    // Striking distance: positions 8–20 with enough impressions
    if (position >= strikeMinPos && position <= strikeMaxPos && impressions >= minStrikingImpr) {
      strikingDistance.push({ page, impressions, position, ctr })
    }

    // Low CTR: near the top but earning almost no clicks
    if (position <= lowCtrMaxPos && impressions >= minLowCtrImpr && ctr < lowCtrThreshold) {
      lowCtr.push({ page, impressions, position, ctr })
    }
  }

  // Sort each bucket by impressions desc, then cap.
  const byImprDesc = (a, b) => b.impressions - a.impressions

  return {
    winners:          winners.sort(byImprDesc).slice(0, cap),
    decaying:         decaying.sort(byImprDesc).slice(0, cap),
    strikingDistance: strikingDistance.sort(byImprDesc).slice(0, cap),
    lowCtr:           lowCtr.sort(byImprDesc).slice(0, cap),
  }
}

// ---------------------------------------------------------------------------
// formatReport
// ---------------------------------------------------------------------------

const ORIGIN_RE = /^https?:\/\/[^/]+/

/** Strip the origin from a full URL so only the path is shown. The report is
 * sent with parse_mode HTML, and GSC page URLs are not fully trusted (crawled
 * probe paths can carry < & >) — escape like formatDigest does in gsc.mjs. */
function toPath(page) {
  const p = String(page).replace(ORIGIN_RE, '') || '/'
  return p.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** Format ctr (0–1 fraction) as a percent string with one decimal. */
function pct(ctr) {
  return (Number(ctr) * 100).toFixed(1) + '%'
}

/**
 * Build a Telegram HTML string from the classified buckets.
 *
 * @param {{ winners, decaying, strikingDistance, lowCtr }} buckets
 * @param {{ days?: number }} [opts]
 * @returns {string}
 */
export function formatReport(buckets, opts) {
  const days = opts?.days || 28
  const { winners, decaying, strikingDistance, lowCtr } = buckets

  const allEmpty =
    winners.length === 0 &&
    decaying.length === 0 &&
    strikingDistance.length === 0 &&
    lowCtr.length === 0

  if (allEmpty) {
    return 'No actionable content signals this period (GSC data still thin — grows as the site ages).'
  }

  const lines = []
  lines.push(`📈 GSC content review — last ${days}d vs prior`)
  lines.push('')

  // Winners
  if (winners.length > 0) {
    lines.push('<b>⬆️ Winners (rising impressions)</b>')
    lines.push('<i>Double down: expand, refresh, add internal links</i>')
    for (const item of winners) {
      const sign = item.deltaPct >= 0 ? '+' : ''
      lines.push(`• ${toPath(item.page)} — impr ${item.impressions}, pos ${Number(item.position).toFixed(1)}, CTR ${pct(item.ctr)} (Δ${sign}${item.deltaPct}%)`)
    }
    lines.push('')
  }

  // Decaying
  if (decaying.length > 0) {
    lines.push('<b>⬇️ Decaying (falling impressions)</b>')
    lines.push('<i>Investigate/refresh — stale or outranked</i>')
    for (const item of decaying) {
      const sign = item.deltaPct >= 0 ? '+' : ''
      lines.push(`• ${toPath(item.page)} — impr ${item.impressions}, pos ${Number(item.position).toFixed(1)}, CTR ${pct(item.ctr)} (Δ${sign}${item.deltaPct}%)`)
    }
    lines.push('')
  }

  // Striking distance
  if (strikingDistance.length > 0) {
    lines.push('<b>🎯 Striking distance (pos 8–20)</b>')
    lines.push('<i>Push to page 1: internal links, expand, sharpen the answer</i>')
    for (const item of strikingDistance) {
      lines.push(`• ${toPath(item.page)} — impr ${item.impressions}, pos ${Number(item.position).toFixed(1)}, CTR ${pct(item.ctr)}`)
    }
    lines.push('')
  }

  // Low CTR
  if (lowCtr.length > 0) {
    lines.push('<b>👀 Low CTR (ranking but not clicked)</b>')
    lines.push('<i>Rewrite title/meta to earn the click</i>')
    for (const item of lowCtr) {
      lines.push(`• ${toPath(item.page)} — impr ${item.impressions}, pos ${Number(item.position).toFixed(1)}, CTR ${pct(item.ctr)}`)
    }
    lines.push('')
  }

  return lines.join('\n').trimEnd()
}
