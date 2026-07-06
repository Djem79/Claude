# Rank-tracker (weekly) + gap-intersection upgrade (monthly)

**Date:** 2026-07-06 · **Approved by:** user («можешь подключать rank-tracker и intersection»)
**Verification:** `node --test scripts/*.test.mjs` + local `npm run build` (no app code touched) + server `--dry-run` of both scripts before installing the cron.

## Why

Both additions instrument existing efforts (DataForSEO research 2026-07-05):

- **Rank-tracker** — GSC shows averages with lag and hides who outranks us and whether an AI
  Overview eats the clicks. Weekly exact positions close the change→effect loop from ~6 weeks
  to 1 week. Cost ≈ $1.3/mo (100 kw × live advanced SERP).
- **Gap intersection** — keywords where ≥2 competitors rank top-20 and we don't = demand
  confirmed twice. Computed from rows the monthly gap cron ALREADY fetches (zero marginal
  API cost). Plus `relevant_pages` for the big three (~$0.04/mo) = which competitor PAGES
  earn traffic → what to build.

## 1. `scripts/rank-tracker.mjs` (+ pure core + tests)

- **Keyword set (auto, cap 100):** GSC top queries by impressions (28d, searchanalytics via
  the same OAuth env vars as gsc.mjs — client code deliberately duplicated like the
  geocode-gate precedent) merged with `CORE_TERMS` (curated commercial + per-area terms).
  Core terms win ties; dedup case-insensitively.
- **SERP:** DataForSEO `serp/google/organic/live/advanced` (needed for `ai_overview` items),
  location 2784 (UAE), language en, depth 20, sequential requests.
- **State:** `data/rank-tracker-state.json` `{ updatedAt, positions: {kw: {pos, url}} }` —
  server-only like other data files. STRICT read for the RMW (ENOENT → first run; corrupt →
  throw, never overwrite with fallback). Atomic write.
- **Report (Telegram, RU):** tracked/top-20/AI-Overview counts, movers ▲▼ (|Δ| ≥ 3), new in /
  dropped from top-20, worst gainers' outrankers, run cost. `--dry-run` = fetch GSC + SERP for
  the first 5 keywords only, print report, no state write, no Telegram.
- **Pure core `rank-tracker-core.mjs`:** `mergeTrackedKeywords`, `parseSerp` (our position,
  top-3 domains above us, AI Overview flag), `computeDeltas`, `formatRankReport` — node:test'd,
  no fs/env.
- **Cron:** `30 5 * * 2` → `/var/log/worldwise-rank-tracker.log` (Tue: clear of Mon digests,
  Sun discovery).

## 2. `competitor-gap.mjs` upgrade

- **Intersection (pure):** new core fn `computeIntersection(rowsByDomain, ourSet)` — keywords
  ranked ≤20 by ≥2 competitor domains, absent from ourSet, passing the existing winnable/niche
  filters. Report gets a «Дважды подтверждённые» section; the top-5 bank feed prefers
  double-confirmed keywords over single-source gap picks.
- **relevant_pages:** one Labs `relevant_pages/live` call per big-three domain
  (bayut, propertyfinder, betterhomes), limit 10 → report-only section «Страницы-магниты
  конкурентов» (page path + ETV + keyword count). Wrapped in try/catch: a failure cannot
  break the existing gap flow.
- No new env vars, no schedule change.

## Rollout

1. Core + tests → `node --test` green locally.
2. Shells → local syntax run (`node --check`), build untouched.
3. PR → squash-merge → deploy from main (backup data/ first).
4. Server: `--dry-run` both scripts with live creds; inspect output.
5. Install rank-tracker crontab line; verify first real run Tue or via manual run.
6. Update CLAUDE.md cron table + memory.
