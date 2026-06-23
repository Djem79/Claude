# Weekly Keyword Discovery Service — Design

**Date:** 2026-06-23
**Status:** Approved (brainstorming) → ready for implementation plan
**Owner:** Worldwise Real Estate (Dubai property, international investors)

## Goal

A weekly automated service that discovers the hottest / rising search queries in our niche (buying & investing in Dubai property) and feeds them into the auto-blog keyword bank (`data/article-keywords.json`), so the daily article pipeline keeps writing about what people are currently searching for. Objective: grow organic SEO by continuously targeting fresh, on-niche, buyer-intent demand instead of a static, hand-curated keyword list.

## Context (existing pipeline this plugs into)

- `scripts/generate-article.mjs` (cron, daily 09:00 UTC): **keyword-only** pipeline (news mode retired 2026-06-23). Reads the next keyword from `data/article-keywords.json` (`{ keywords: string[], index: number }`), generates a quality article via Gemini, saves a draft, and sends a **Telegram approval** message (Publish / Skip). Nothing publishes without that per-article approval. On bank exhaustion it notifies and skips the day.
- `data/article-keywords.json` is **server-only** (in `data/`, never committed, never rsynced from local). Mutated with the invariant in `incrementKeywordIndex`: strict read (throw on read/parse failure — never persist the empty fallback) + atomic temp-file/rename write.
- `scripts/gsc.mjs`, `lib/notify.ts`-style Telegram helpers, `data/articles.json` (published AI articles) are available on the server.
- This service is a NEW sibling cron script. It does **not** modify the generation pipeline.

## Decisions (locked during brainstorming)

| Decision | Choice |
| --- | --- |
| Data source | **Paid SEO API**, budget ≤ $15–20/mo |
| Provider | **Keywords Everywhere** ($15 = 100k credits, no subscription, ~1 yr validity) |
| Human-in-the-loop | **Auto-add** top candidates to the bank + Telegram **summary** (no per-keyword approval). The existing per-article Telegram approval remains the publish gate. |

## Keywords Everywhere API (confirmed capabilities)

Official REST API (`api.keywordseverywhere.com`), Bearer token:
- **PASF** ("people also search for") — confirmed; discovery from a seed term. A **Related Keywords** discovery method also appears to exist (KE's newer REST methods); the exact discovery-endpoint set is to be confirmed against the live KE docs during implementation, and the script degrades gracefully if only PASF is available (seed list is then expanded via PASF + Google autocomplete as a fallback).
- **Get Keyword Data** — confirmed; up to 100 keywords/request; returns search volume, CPC, competition, and a **12-month monthly-volume trend** array. **1 credit per keyword.**
- Each response reports remaining credit balance.

Cost estimate: ~15 seeds → a few hundred candidates → enrich a few hundred keywords ≈ a few hundred credits/run × ~4 runs/mo ≈ 1–2k credits/mo. The $15 / 100k-credit pack lasts effectively years → well within budget. Volume queries are **per-country** (credits multiply by number of geos queried — see Config).

## Architecture

A standalone Node ESM cron script `scripts/discover-keywords.mjs`, mirroring existing script conventions (`node --env-file=.env.local`, atomic writes, Telegram notify, ISO-timestamped logging). Single purpose: discover → filter → top-up the bank → notify. No coupling to `generate-article.mjs`.

### Discovery pipeline (stages inside the script)

```
SEEDS (niche terms)
  → KE Related Keywords + PASF            → candidate pool (discovery)
  → KE Get Keyword Data (volume + 12-mo trend, per target geo, summed)
  → SCORE   (rising-trend × volume × buyer-intent)
  → FILTER  (niche + Dubai-geo + min volume + buyer-intent)
  → DEDUP   (vs bank keywords + already-published article slugs)
  → SELECT top N
  → WRITE   (insert at current bank index) + Telegram summary
```

**Seeds** (config constant): our core topics, e.g. `Dubai property investment`, `buy property Dubai`, `Dubai off plan`, `Dubai golden visa property`, `Dubai rental yield`, plus area/developer terms. Tunable.

## Filtering rules (quality gate — addresses real GSC problems)

A candidate must pass ALL of:
1. **Dubai geo:** reject queries naming another emirate (Abu Dhabi, Sharjah, Ajman, RAK, etc.) unless also Dubai-relevant. (Fixes the "Abu-Dhabi residence-visa traffic" leak seen in GSC.)
2. **Niche:** must relate to buying / investing / residency / financing / areas / developers of Dubai property. Rule-based allow-list of tokens (Dubai, UAE, off-plan, golden visa, freehold, ROI, yield, payment plan, mortgage, area & developer names, …); ambiguous cases optionally confirmed by a single cheap Gemini relevance check (batch).
3. **Min search volume:** ≥ ~100/mo aggregated across target geos (tunable).
4. **Buyer intent:** informational / commercial-intent (blog-answerable). Exclude pure transactional "apartments for sale in X" (those belong on listing / area pages, not the blog) and low-value tower/building-name lookups.
5. **Dedup:** case-insensitive against (a) existing bank keywords and (b) slugs/titles of already-published articles read from `data/articles.json`. (Static editorial slugs in `lib/articles.ts` are TS and not read by the cron; the per-article Telegram approval + the generator's own slug-collision suffixing in `lib/dynamic-articles.ts` are the backstop against a rare static-slug clash.)

## Scoring

Rank survivors by a blend that favours **rising** trend and **volume**, e.g. `score = volume_normalized × trend_rise_factor × intent_weight`, where `trend_rise_factor` compares recent months vs earlier months of the 12-month KE trend array (a query trending UP scores higher than a flat high-volume one — "hottest", not just "biggest"). Take the top **N = 5/week** (tunable).

## Writing to the bank

Insert the selected keywords **at the current `index`** of `data/article-keywords.json` (front of the unused queue), so trending topics publish within days rather than after the existing ~60-item evergreen queue drains. Same invariants as `incrementKeywordIndex`:
- strict read (throw on read/parse failure — NEVER persist the empty fallback, which would wipe the bank);
- atomic temp-file + rename write;
- dedup before insert so re-runs can't duplicate.

Net flow balance: ~7 keywords/week consumed (daily generation) vs ~5 added → the evergreen queue still drains slowly while ~5/7 articles each week ride fresh trends. Both N and cadence are tunable.

## Telegram summary (notification, no buttons)

After a run, send one message to the admin chat:
> 🔎 Weekly keyword discovery — added **N** keywords to the bank:
> • `<keyword>` — vol ~X/mo, trend ↑Y%
> …
> Skipped **M** (duplicates / off-niche / low volume). Reserve candidates: `<…>`
> KE credits remaining: Z.

The user can manually drop a bad one or add a reserve via the existing `/add_keyword` command.

## Failure handling & budget

- KE API error / non-200 / timeout → log + Telegram alert; **bank untouched** (no partial/garbage write).
- Credit balance returned each call → log it; if below a threshold, Telegram alert ("top up Keywords Everywhere").
- Zero survivors after filtering → notify "no new keywords this week" and exit cleanly (no write).
- All bank mutations behind the strict-read / atomic-write invariant.

## Configuration & environment

- `KE_API_KEY` in the **server** `.env.local` (excluded from rsync, persists across deploys) + documented in `.env.example`.
- Config constants in the script: `SEEDS[]`, `N_PER_WEEK` (5), `MIN_VOLUME` (100), `TARGET_GEOS` (default `['uk','in','ae','us']` — primary international buyer markets; more geos = more credits), `EMIRATE_DENYLIST[]`, `INTENT_DENYLIST[]`.
- Reuses `GEMINI_API_KEY` (only if the optional relevance check is enabled) and `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` (already on the server).

## Ops

- Cron on the Hetzner VPS: **Sunday 05:00 UTC** (before the Monday GSC digest and ahead of the daily 09:00 generation), logging to `/var/log/worldwise-keyword-discovery.log`.
- Document in CLAUDE.md *Scheduled jobs* table + *Architecture* (a short "Keyword discovery" subsection) and add `KE_API_KEY` to the env list.
- Deploy: script ships via the normal rsync (it's code, not `data/`). `KE_API_KEY` set once on the server.

## Testing

- Pure helpers extracted and unit-tested with `node --test --experimental-strip-types` where practical: the **scorer** (trend-rise from a 12-month array), the **filters** (geo/niche/intent/min-volume), and the **dedup** — all pure functions over plain inputs, no network. (Mirrors the project's `lib/*.test.ts` pattern.)
- The network/IO shell (KE calls, bank read/write, Telegram) is thin and verified by a guarded **dry-run mode** (`--dry-run`: discover + score + filter + print the would-add list, **no** bank write, **no** Telegram send) before enabling the cron.

## Non-goals (YAGNI)

- No per-keyword approval UI / Telegram buttons (auto-add by decision; per-article approval already gates publishing).
- No second data provider (DataForSEO / Google Trends / Google Ads Planner) — Keywords Everywhere only.
- No change to `generate-article.mjs` or the article format.
- No historical analytics/dashboard of discovered keywords (the Telegram summary + log suffice).
- No automatic credit top-up (alert only).
