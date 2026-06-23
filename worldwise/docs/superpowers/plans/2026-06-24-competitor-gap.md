# Competitor Keyword-Gap — Design + Implementation Plan

> Doubles as design-of-record + build plan. Roadmap feature #3. Builds on the DataForSEO integration.

**Goal:** Monthly, find keywords our Dubai-property competitors rank for that `worldwise.pro` does NOT, filter to our niche + buyer/informational intent + realistically winnable difficulty, dedup vs our keyword bank + published, and surface them as content/landing targets — (a) a Telegram gap report and (b) the top few fed into the autoblog keyword bank (per-article approval still gates publishing). Captures demand competitors already prove exists but we're absent from. Feeds roadmap #1 (landing pages).

## Data source — DataForSEO Labs `ranked_keywords` (confirmed)
`POST https://api.dataforseo.com/v3/dataforseo_labs/google/ranked_keywords/live`, Basic auth (reuse `DATAFORSEO_LOGIN`/`DATAFORSEO_PASSWORD`).
Request task fields: `target` (domain WITHOUT `https://`/`www.`), `location_code` (2784 = UAE), `language_code` (`en`), `limit`, `order_by` (e.g. `["keyword_data.keyword_info.search_volume,desc"]`), `filters` (server-side, to cut noise + cost). Response `tasks[].result[].items[]`, each: `keyword_data.keyword_info.{search_volume,cpc,competition}` + `keyword_data.keyword_properties.keyword_difficulty` + `ranked_serp_element.serp_item.{rank_group,rank_absolute}`. Top-level `cost`. (Implementer: confirm exact JSON nesting from the saved doc / a probe call before finalizing parse paths.)
Cost: Labs per-request + per-result; with `limit` + `filters` ≈ cents/domain → ~$1–2 per monthly run for ~7 domains.

## Competitors (config array, editable)
Portals (demand breadth): `bayut.com`, `propertyfinder.ae`, `dubizzle.com`.
Agencies (comparable, content-driven): `betterhomes.ae`, `famproperties.com`, `drivenproperties.com`, `metropolitan.realestate`.
Our domain: `worldwise.pro`.

## Architecture
- **New pure module** `scripts/competitor-gap-core.mjs` (+ `.test.mjs`): `computeGap`, `isWinnable`, `scoreGap`, `selectGap`, `formatGapReport`. Imports `passesFilters`, `intentWeight`, `themeKey` from `keyword-discovery-core.mjs` (pure, same dir). No fs/network.
- **New script** `scripts/competitor-gap.mjs`: DataForSEO Labs client + orchestration + bank feed + Telegram + `--dry-run`. Reuses the Basic-auth + atomic-write + strict-bank-read + `sendTelegram` patterns from `discover-keywords.mjs` (read that file for conventions).
- Reuses the existing bank `data/article-keywords.json` (strict read + atomic insert at index, same invariant as `incrementKeywordIndex`).

## Pure module `scripts/competitor-gap-core.mjs`
Input rows (from the Labs client, one per competitor keyword): `{ keyword, domain, rank, search_volume, keyword_difficulty, cpc, competition }`.

- `computeGap(competitorRows, ourSet)` → aggregate by lowercased keyword: merge `sources: [{domain, rank}]`, keep `max(search_volume)`, `min(keyword_difficulty)` (best-case winnability), representative cpc/competition; EXCLUDE any keyword in `ourSet` (Set of our lowercased keywords). Returns `[{ keyword, search_volume, keyword_difficulty, cpc, competition, sources }]`.
- `isWinnable(cand, { maxDifficulty, minVolume, maxVolume })` → `kd <= maxDifficulty && vol >= minVolume && vol <= maxVolume` (exclude ultra-high-volume head terms the giants own; `keyword_difficulty` null → treat as 100 = not winnable).
- `scoreGap(cand)` → `search_volume * intentWeight(keyword) / (1 + keyword_difficulty/100)` (favours decent volume, buyer intent, low difficulty).
- `selectGap(competitorRows, ourSet, opts)` where `opts = { bankSeen:Set, maxDifficulty, minVolume, maxVolume, n, maxPerTheme }`: computeGap → drop bankSeen → keep `passesFilters(keyword,{minVolume,maxVol:vol}).ok` (niche/geo/intent) → keep `isWinnable` → score → sort desc → theme-diversify (`themeKey`, `maxPerTheme`) → top `n`. Returns scored gap items.
- `formatGapReport(items)` → Telegram string: header + per item `keyword · vol N · KD X · $cpc · ranked by: bayut #3, …`. Empty → "No new competitor-gap keywords this month."

## Output
1. **Telegram gap report** — the full top-`GAP_N` (≈20) for the user's review / landing-page planning (#1).
2. **Feed top `GAP_FEED_M` (≈5) into the bank** — strict read + atomic insert at index, deduped (so the autoblog writes them; per-article approval gates publishing).

## Config (in `competitor-gap.mjs`)
`COMPETITORS` (the 7 above), `OUR_DOMAIN='worldwise.pro'`, `GEO=2784`, `LANG='en'`, `PER_DOMAIN_LIMIT=1000`, `MAX_DIFFICULTY=40`, `MIN_VOLUME=100`, `MAX_VOLUME=20000`, `GAP_N=20`, `GAP_FEED_M=5`, `MAX_PER_THEME=2`. Server-side `filters` mirror MAX_DIFFICULTY/MIN_VOLUME and `rank_group<=20` to cut cost.

## Tasks (TDD; branch `feat/competitor-gap`)
1. **`competitor-gap-core.mjs` + tests** — `computeGap` (aggregation + ourSet exclusion + multi-domain merge), `isWinnable` (difficulty/volume bounds, null KD), `scoreGap`, `selectGap` (full pipeline incl. bankSeen dedup + passesFilters + winnable + theme cap + n), `formatGapReport`. Real assertions, `node --test`.
2. **Labs client** in `competitor-gap.mjs` — `fetchRankedKeywords(domain)` (Basic auth, location/lang/limit/order_by/filters; parse items → rows; throw on non-2xx / status≠20000; return `{rows, cost}`); confirm the response nesting against the doc/probe.
3. **Orchestration `main()`** — pull `OUR_DOMAIN` → ourSet; pull each competitor (accumulate rows + cost); `selectGap`; build report; `--dry-run` prints report + would-feed list, writes/sends nothing; real run feeds top-M into bank (strict+atomic+dedup) + sends Telegram report. Wrap bank/Telegram in try/catch; never corrupt the bank.
4. **Docs** — CLAUDE.md Scheduled-jobs row (`0 6 1 * *` monthly) + a "Competitor gap" note in the keyword-discovery architecture area. No new env.
5. **Deploy + dry-run** — rsync the 2 new scripts (+ keyword-discovery-core unchanged), server `--dry-run` (real Labs spend ~$1-2), show the gap report; then add the monthly cron `0 6 1 * * cd /var/www/worldwise && node --env-file=.env.local scripts/competitor-gap.mjs >> /var/log/worldwise-competitor-gap.log 2>&1`.

## Non-goals
- No live-rank tracking; no per-competitor deep SERP analysis; no auto-publishing (bank feed → per-article approval).
- No new env/credentials (reuses DataForSEO). No change to the weekly discovery / ads-feed pipelines.
