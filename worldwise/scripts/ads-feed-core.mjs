// scripts/ads-feed-core.mjs
// Pure, dependency-free core for the Google Ads keyword feed.
// No fs / no network — unit-tested with `node --test`.
// May import gating helpers from keyword-discovery-core (same dir, also pure).

import { passesFilters, intentWeight } from './keyword-discovery-core.mjs'

// ---------------------------------------------------------------------------
// Helpers: extract Ads-relevant metrics from an enriched candidate.
// India is deliberately excluded from Ads volume (SEO discovery geo only).
// ---------------------------------------------------------------------------

/** UK + UAE search volume. India excluded by design. */
export function adsVol(candidate) {
  const p = candidate.perGeo || {}
  return (Number(p.uk?.vol) || 0) + (Number(p.ae?.vol) || 0)
}

/** Max CPC across UK / UAE geos (rough "click cost" signal). */
export function adsCpc(candidate) {
  const p = candidate.perGeo || {}
  const ukCpc = Number(p.uk?.cpc) || 0
  const aeCpc = Number(p.ae?.cpc) || 0
  return Math.max(ukCpc, aeCpc)
}

/** Competition level from UK (primary), falling back to AE. */
export function adsCompetition(candidate) {
  const p = candidate.perGeo || {}
  return p.uk?.competition ?? p.ae?.competition ?? null
}

// ---------------------------------------------------------------------------
// Ad-group routing.
// ---------------------------------------------------------------------------

/**
 * Route a keyword to one of three existing ad groups.
 * Checks in order: visa/residency signals → developer/property-type signals →
 * investor-metric signals → default buyer group.
 */
export function adGroupBucket(keyword) {
  const k = String(keyword).toLowerCase()
  if (/(golden visa|residence visa|residency)/.test(k)) return 'investor'
  if (/(emaar|damac|sobha|nakheel|developer|off[- ]plan)/.test(k)) return 'developer'
  if (/(roi|yield|rental|invest|capital appreciation|payment plan)/.test(k)) return 'investor'
  return 'buyer'
}

// ---------------------------------------------------------------------------
// Match type selection.
// ---------------------------------------------------------------------------

/** Short high-intent phrases → exact; longer → phrase. */
export function matchType(keyword) {
  return String(keyword).trim().split(/\s+/).length <= 3 ? 'exact' : 'phrase'
}

// ---------------------------------------------------------------------------
// Build add suggestions.
// ---------------------------------------------------------------------------

/**
 * From the enriched candidate pool, select the best buyer-intent keywords to
 * add to the Google Ads campaign.
 *
 * @param {Array}  enriched  - Enriched candidates: { keyword, perGeo: { uk?, ae?, in? } }
 * @param {Object} opts
 * @param {number} opts.minAdsVol  - Minimum combined UK+UAE volume to consider.
 * @param {number} opts.n          - Max keywords to return.
 * @param {Set}    opts.seen       - Lowercased strings already suggested; excluded.
 * @returns {Array<{ keyword, adsVol, cpc, competition, bucket, matchType }>}
 */
export function buildAddSuggestions(enriched, opts) {
  const { minAdsVol = 0, n = 10, seen = new Set() } = opts || {}

  const scored = []
  for (const c of enriched) {
    const v = adsVol(c)
    const key = String(c.keyword).toLowerCase().trim()
    if (seen.has(key)) continue
    // Reuse the same gating logic as the blog side, but with adsVol as maxVol.
    if (!passesFilters(c.keyword, { minVolume: minAdsVol, maxVol: v }).ok) continue
    const score = v * intentWeight(c.keyword)
    scored.push({ candidate: c, v, score })
  }

  scored.sort((a, b) => b.score - a.score)

  return scored.slice(0, n).map(({ candidate: c, v }) => ({
    keyword: c.keyword,
    adsVol: v,
    cpc: adsCpc(c),
    competition: adsCompetition(c),
    bucket: adGroupBucket(c.keyword),
    matchType: matchType(c.keyword),
  }))
}

// ---------------------------------------------------------------------------
// Build negative keyword list.
// ---------------------------------------------------------------------------

const WASTE_TOKENS = ['rent', 'for rent', 'cheap', 'free', 'job', 'jobs', 'salary', 'vacancy']

const NEGATIVE_REASONS = new Set(['other-emirate', 'listing-intent', 'off-niche', 'off-topic'])

/**
 * From the enriched pool, identify waste keywords suitable for campaign-level
 * negatives. A candidate qualifies if it is rejected by passesFilters for a
 * "wasted spend" reason, OR it contains a waste token.
 *
 * @param {Array}  enriched  - Same enriched candidates array.
 * @param {Object} opts
 * @param {Set}    opts.seen        - Lowercased strings already suggested as negatives.
 * @param {number} opts.minNegVol   - Minimum adsVol to bother adding as a negative.
 * @returns {string[]} Deduplicated keyword strings, sorted by adsVol desc.
 */
export function buildNegatives(enriched, opts) {
  const { seen = new Set(), minNegVol = 0 } = opts || {}

  // Collect qualified negatives with their volume for sorting.
  const candidates = []
  const added = new Set([...seen].map(s => String(s).toLowerCase().trim()))

  for (const c of enriched) {
    const v = adsVol(c)
    if (v < minNegVol) continue

    const key = String(c.keyword).toLowerCase().trim()
    if (added.has(key)) continue

    // Check rejection reason.
    const verdict = passesFilters(c.keyword, { minVolume: 0, maxVol: v })
    const isNegativeReason = !verdict.ok && NEGATIVE_REASONS.has(verdict.reason)

    // Check waste tokens.
    const hasWasteToken = WASTE_TOKENS.some(t => key.includes(t))

    if (isNegativeReason || hasWasteToken) {
      added.add(key)
      candidates.push({ keyword: c.keyword, v })
    }
  }

  candidates.sort((a, b) => b.v - a.v)
  return candidates.map(c => c.keyword)
}

// ---------------------------------------------------------------------------
// Format the Claude-chrome apply prompt.
// ---------------------------------------------------------------------------

/**
 * Build a plain-text supervised instruction for a browser agent to apply the
 * keyword changes in the Google Ads web UI.
 *
 * Match-type syntax: phrase → "keyword", exact → [keyword].
 *
 * @param {Array}    adds      - Output of buildAddSuggestions.
 * @param {string[]} negatives - Output of buildNegatives.
 * @returns {string}
 */
export function formatClaudeChromePrompt(adds, negatives) {
  const lines = []

  if (!adds || adds.length === 0) {
    lines.push('No new keywords to add this week.')
  } else {
    // Group by bucket.
    const buckets = {}
    for (const item of adds) {
      if (!buckets[item.bucket]) buckets[item.bucket] = []
      buckets[item.bucket].push(item)
    }

    const BUCKET_LABELS = {
      buyer: 'Buyer (Ad Group A)',
      investor: 'Investor (Ad Group B)',
      developer: 'Developer (Ad Group D)',
    }

    lines.push('=== Google Ads — New Keywords to Add ===')
    lines.push('')

    for (const [bucket, items] of Object.entries(buckets)) {
      lines.push(`--- ${BUCKET_LABELS[bucket] || bucket} ---`)
      for (const item of items) {
        const formatted = item.matchType === 'phrase'
          ? `"${item.keyword}"`
          : `[${item.keyword}]`
        lines.push(formatted)
      }
      lines.push('')
    }

    lines.push('Steps to add keywords:')
    lines.push('1. Open Google Ads → your Search campaign.')
    for (const [bucket, items] of Object.entries(buckets)) {
      const label = BUCKET_LABELS[bucket] || bucket
      const block = items.map(i =>
        i.matchType === 'phrase' ? `"${i.keyword}"` : `[${i.keyword}]`
      ).join('\n')
      lines.push(`2. Ad Groups → ${label} → Keywords → + Add keywords → paste:`)
      lines.push(block)
    }
    lines.push('')
  }

  if (negatives && negatives.length > 0) {
    lines.push('=== Negative Keywords (campaign level) ===')
    for (const kw of negatives) {
      lines.push(kw)
    }
    lines.push('')
    lines.push('Steps to add negatives:')
    lines.push('1. Open Google Ads → your Search campaign.')
    lines.push('2. Keywords → Negative keywords → + Add → paste the list above.')
    lines.push('')
  }

  lines.push('Review each block before confirming. Google Ads keeps a full Change History, so any change here is reversible.')

  return lines.join('\n')
}
