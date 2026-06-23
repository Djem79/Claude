# GSC Content-Performance Feedback Loop — Design + Plan

> Design-of-record + build plan. Roadmap feature #6. Extends the existing `gsc.mjs` CLI.

**Goal:** Monthly, compare two GSC windows (last 28 days vs the prior 28 days) at the page level and classify content into actionable buckets, then send a Telegram report with concrete recommendations. Closes the loop: discovery/gap find NEW topics; this tells us which EXISTING content to double down on, refresh, push, or fix. Report-only — humans act on the flags.

## Data source
Existing `scripts/gsc.mjs` (OAuth token live; reuses `dateRange()`, `searchanalytics.query()`, `sendTelegram()`, `iso()`, the `parseOpts`/`switch` dispatch). Search Analytics API, dimension `['page']`, `rowLimit` ~250, two date windows. Free.

## Architecture
- **New pure core** `scripts/gsc-content-review-core.mjs` (+ `.test.mjs`, `node --test`): `classifyPages(current, previous, opts)` → `{ winners, decaying, strikingDistance, lowCtr }`; `formatReport(buckets, opts)` → Telegram string. No fs/network/Next imports.
- **New subcommand** in `gsc.mjs`: `cmdContentReview(opts)` — fetch both windows, map rows, call the core, print (`--dry-run`) or `sendTelegram`. Add `case 'content-review': return await cmdContentReview(parseOpts(rest))` to the dispatch.

## Input/Output shapes
GSC `searchanalytics.query` returns `data.rows = [{ keys:[page], clicks, impressions, ctr, position }]` (ctr is 0–1 fraction; position is a float). The command maps to `{ page, clicks, impressions, ctr, position }`.

## Pure core `scripts/gsc-content-review-core.mjs`
`classifyPages(current, previous, opts)` — `opts` (defaults): `{ winPct=0.30, decayPct=0.30, minWinnerImpr=20, minBaseImpr=20, strikeMinPos=8, strikeMaxPos=20, minStrikingImpr=30, lowCtrMaxPos=10, minLowCtrImpr=50, lowCtrThreshold=0.01, cap=8 }`.
- Build `prevByPage = Map(page → previous row)`.
- For each `c` in current (impr = c.impressions, pos = c.position, ctr = c.ctr, prev = prevByPage.get(c.page)?.impressions || 0):
  - **winner** if `prev > 0 && impr >= minWinnerImpr && (impr - prev)/prev >= winPct` → include `deltaPct = round((impr-prev)/prev*100)`.
  - **decaying** if `prev >= minBaseImpr && (impr - prev)/prev <= -decayPct` → include `deltaPct`.
  - **strikingDistance** if `pos >= strikeMinPos && pos <= strikeMaxPos && impr >= minStrikingImpr`.
  - **lowCtr** if `pos <= lowCtrMaxPos && impr >= minLowCtrImpr && ctr < lowCtrThreshold`.
  (A page may fall in more than one bucket — that's fine, they're different lenses.)
- Each bucket: sort by impressions desc, slice to `cap`. Items keep `{ page, impressions, position, ctr, deltaPct? }`.
- Return `{ winners, decaying, strikingDistance, lowCtr }`.

`formatReport(buckets, opts)` — Telegram string. Header `📈 GSC content review — last ${days}d vs prior ${days}d`. For each NON-empty bucket, a labelled section with its recommendation + lines `• <path> — impr N, pos X.X, CTR Y%` (winners/decaying also show `Δ±Z%`). Recommendations:
- Winners → "double down: expand, refresh, add internal links."
- Decaying → "investigate/refresh — content may be going stale or outranked."
- Striking distance → "push to page 1: add internal links, expand the section, sharpen the on-page answer to the ranking query."
- Page-1 low-CTR → "rewrite the title/meta to earn the click."
If all buckets empty → "No actionable content signals this period (GSC data still thin — this grows as the site ages)."

## `cmdContentReview(opts)` in gsc.mjs
- `days = Number(opts.days) || 28`.
- current window: `dateRange(days)` → `{startDate, endDate}`. prior window: compute `{ startDate: today-2*days, endDate: today-days }` using the existing `iso()` + Date math (mirror `dateRange`).
- `fetchPages(startDate, endDate)`: `searchanalytics.query({ siteUrl, requestBody: { startDate, endDate, dimensions:['page'], rowLimit: 250 }})` → map rows to `{page, clicks, impressions, ctr, position}` (page = `row.keys[0]`). Reuse the auth/client the existing `cmdPages` uses.
- `classifyPages(current, previous, {})` → buckets; `formatReport(buckets, { days })` → text.
- `--dry-run`: `console.log` the report, send nothing. Else `await sendTelegram(text)`.

## Ops
- Cron on the VPS: `0 7 1 * * cd /var/www/worldwise && node --env-file=.env.local scripts/gsc.mjs content-review >> /var/log/worldwise-content-review.log 2>&1` (1st of month, 07:00 UTC — after the gap run at 06:00).
- Docs: CLAUDE.md Scheduled-jobs row + add `content-review` to the GSC CLI commands list. No new env (reuses GSC_* + TELEGRAM_*).

## Tasks (TDD; branch `feat/gsc-content-review`)
1. **`gsc-content-review-core.mjs` + tests** — `classifyPages` (each bucket's threshold logic incl. multi-bucket membership, cap, deltaPct) + `formatReport` (per-bucket recs, empty-all message). Real assertions.
2. **`cmdContentReview` in gsc.mjs** — two-window fetch + map + core + report + `--dry-run`; wire the `content-review` case into the dispatch. `node --check` passes; `gsc.mjs` other commands unaffected.
3. **Docs** — CLAUDE.md scheduled job + CLI command note.
4. **Verify** — `node --test scripts/gsc-content-review-core.test.mjs` green; `node --check scripts/gsc.mjs`; server `--dry-run` (real GSC, free) prints a (likely sparse) report.
5. **Deploy + cron** — rsync `gsc.mjs` + `gsc-content-review-core.mjs`; add the monthly cron.

## Non-goals
- No auto-action on content (report-only; humans act). No new data store. No change to the weekly digest or other crons. No new env/credentials.
