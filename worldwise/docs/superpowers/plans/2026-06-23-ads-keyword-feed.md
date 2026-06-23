# Ads Keyword Feed — Design + Implementation Plan

> Doubles as the design-of-record (spec) and the build plan for a contained extension. Roadmap feature #2. Builds on the live weekly keyword-discovery cron.

**Goal:** Each weekly discovery run, from the SAME DataForSEO-enriched candidate pool, also produce a Google Ads feed: (a) a Telegram review summary and (b) a ready-to-run **claude-chrome apply prompt** suggesting buyer-intent keywords to ADD (per ad-group, with match type) + negative keywords to add. UK+UAE geo (India excluded — it's an SEO discovery geo but removed from Ads). The user reviews, then runs claude-chrome (supervised) to apply in the Google Ads UI. No Ads write API.

**Why this shape:** the discovery cron already gathers candidates and pays DataForSEO for volume per geo. DataForSEO's `search_volume` response ALSO carries `cpc` and `competition` per keyword — so the Ads feed is **+$0** (reuses the same calls). The Ads output is additive; the existing blog-keyword top-up is unchanged.

## Architecture

- **Extend** `scripts/discover-keywords.mjs`: enrichment captures `cpc` + `competition` (already in the DataForSEO response); after the blog-keyword step, build the Ads feed from the enriched pool, dedup vs `data/ads-suggested.json`, append new picks to it, and send the Telegram review + claude-chrome prompt.
- **New pure module** `scripts/ads-feed-core.mjs` (+ `.test.mjs`, `node --test`): all decision logic, no fs/network — `adGroupBucket`, `matchType`, `buildAddSuggestions`, `buildNegatives`, `formatClaudeChromePrompt`.
- **New dedup store** `data/ads-suggested.json` (server-only, like the bank): `{ keywords: string[], negatives: string[] }` — what we've already proposed, so weekly runs don't repeat.
- Blog-keyword discovery (`keyword-discovery-core.mjs`, bank insert) stays as-is.

## Data shapes

Enriched candidate (extended): `{ keyword, perGeo: { uk:{vol,trend,cpc,competition}, ae:{...}, in:{...} } }`.
- `competition` from DataForSEO is `'HIGH'|'MEDIUM'|'LOW'|null`.
- **Ads volume** = `(perGeo.uk?.vol||0) + (perGeo.ae?.vol||0)` — India excluded by construction.
- **Ads cpc** = max of uk/ae cpc (rough "what a click costs").

Add suggestion: `{ keyword, adsVol, cpc, competition, bucket, matchType }`.

## Pure module `scripts/ads-feed-core.mjs`

```js
// adGroupBucket: route a keyword to an existing campaign ad group by tokens.
export function adGroupBucket(keyword) {
  const k = keyword.toLowerCase()
  if (/(golden visa|residence visa|residency)/.test(k)) return 'investor'   // visa → investor group B
  if (/(emaar|damac|sobha|nakheel|developer|off[- ]plan)/.test(k)) return 'developer' // group D
  if (/(roi|yield|rental|invest|capital appreciation|payment plan)/.test(k)) return 'investor'
  return 'buyer'   // default → group A
}

// matchType: short high-intent → exact; else phrase.
export function matchType(keyword) {
  return keyword.trim().split(/\s+/).length <= 3 ? 'exact' : 'phrase'
}

// buildAddSuggestions: buyer-intent, UK+UAE volume, dedup vs seen, ranked, top N.
// opts: { minAdsVol, n, seen:Set<string> }. Reuses passesFilters/intentWeight from keyword-discovery-core
// (import them) so niche/geo/listing-intent gating matches the blog side.
export function buildAddSuggestions(enriched, { passesFilters, intentWeight }, opts) { ... }

// buildNegatives: from REJECTED candidates (other-emirate / listing-intent / off-niche) plus a waste-token
// list, keep those with meaningful Ads volume (real spend risk), dedup vs seen. opts: { seen, minNegVol }.
export function buildNegatives(rejected, wasteTokens, opts) { ... }

// formatClaudeChromePrompt: deterministic apply prompt (per-bucket keyword blocks + negatives block +
// step-by-step Ads-UI instructions). Pure string builder.
export function formatClaudeChromePrompt(adds, negatives) { ... }
```

Match-type syntax for the prompt blocks: phrase → `"keyword"`, exact → `[keyword]`. Negatives listed plain.

## Output

1. **Telegram review** (admin chat): `🎯 Ads feed — N keywords to add / M negatives` + the lists grouped by ad-group with `vol·cpc·competition`.
2. **claude-chrome prompt** (sent as a second Telegram message / code block): explicit supervised steps — open campaign → each ad group → Keywords → add the block; then Campaign → Negative keywords → add the block. Includes a guardrail line: "review before confirming; Google Ads keeps Change History (reversible)."

## Tasks (TDD; build on branch `feat/ads-keyword-feed`)

1. **Enrichment captures cpc+competition** — `discover-keywords.mjs` `fetchKeywordData`: add `cpc`/`competition` to each row and into `perGeo`. (No test; `node --check` + the dry-run covers it.)
2. **`ads-feed-core.mjs` + tests** — `adGroupBucket`, `matchType` (TDD: visa→investor, damac→developer, "dubai property"→buyer/exact, long phrase→phrase).
3. **`buildAddSuggestions` + tests** — buyer-intent only, ranks by adsVol (uk+ae), respects minAdsVol/n/seen dedup; assigns bucket+matchType.
4. **`buildNegatives` + tests** — rejected/other-emirate/listing-intent + waste tokens (`rent`, `cheap`, `free`, `job`, `jobs`, `salary`, `for rent`), keep meaningful-volume, dedup vs seen.
5. **`formatClaudeChromePrompt` + tests** — correct match-type syntax (`"phrase"`/`[exact]`), per-bucket grouping, negatives block, guardrail line present.
6. **Dedup store** — `data/ads-suggested.json` strict-ish read (forgiving→empty on ENOENT; never wipes on error) + atomic write appending new adds/negatives.
7. **Wire into `main()`** — after blog step, partition enriched pool (passesFilters), build adds+negatives, dedup vs store, append store, send Telegram review + prompt. `--dry-run` prints both, writes nothing, sends nothing.
8. **Docs** — CLAUDE.md keyword-discovery subsection: note the Ads-feed output + `data/ads-suggested.json`. (No new env.)
9. **Deploy + dry-run** — rsync the 2 changed/new scripts, server `--dry-run` on the existing DataForSEO funds, show the Ads feed + sample claude-chrome prompt; then it rides the existing Sunday cron (no new cron — same run emits both blog + Ads).

## Non-goals
- No Google Ads write API / no unattended UI automation (claude-chrome applies under user supervision).
- No reading the live campaign's current keywords (dedup is vs our own past suggestions only).
- No change to the blog-keyword pipeline or the cron schedule.
