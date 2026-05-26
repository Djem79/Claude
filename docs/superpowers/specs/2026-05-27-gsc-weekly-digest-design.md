# GSC Weekly Digest — Design Spec

**Date:** 2026-05-27
**Status:** Approved
**Goal:** A weekly Telegram report from the GSC CLI summarising indexing health and search performance, so we don't have to manually run `gsc.mjs` every Monday.

## Why this

We just shipped the GSC CLI. Ad-hoc queries are great when there's something specific to check, but for routine awareness (is the sitemap healthy, are the new area pages getting indexed, what searches are working) we need a recurring snapshot pushed to where we already live — Telegram.

## Scope

One new command in the existing `scripts/gsc.mjs` plus a cron entry on the server. No new file.

## Out of scope

- **Delta tracking ("changed since last week").** Requires persisted state. GSC itself retains 16 months — easy to add later. Not v1.
- **Email or any non-Telegram channel.** Telegram is the project's existing notification channel; one channel keeps things tidy.
- **Event-based alerts** (URL fell out of index, query position dropped). Needs state. Defer.
- **Configurable schedule / content / recipients.** One format, one cron, hard-coded.
- **Indexing API automation.** Still no API for general Request Indexing. The digest is informational only.

## Architecture

One new subcommand: `digest`.

```
worldwise/
├── scripts/
│   └── gsc.mjs       ← +command `digest` + Telegram helper + format helpers
└── .env.local        ← (server only) needs GSC_OAUTH_CLIENT_ID/SECRET/REFRESH_TOKEN
                        added once via scp from local; TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID
                        already present (used by auto-blog and lead notifications)
```

Server cron entry (added by hand in `crontab -e` on the Hetzner VPS, like the existing auto-blog entry):

```
0 6 * * 1 cd /var/www/worldwise && node --env-file=.env.local scripts/gsc.mjs digest >> /var/log/worldwise-gsc.log 2>&1
```

`0 6 * * 1` = every Monday at 06:00 UTC = 10:00 Dubai time. Same operational pattern as the existing `0 9 * * *` auto-blog cron at `/var/log/worldwise-blog.log`.

## Command interface

```
node --env-file=.env.local scripts/gsc.mjs digest          # send to Telegram
node --env-file=.env.local scripts/gsc.mjs digest --dry-run # print to stdout, don't send
```

The `--dry-run` flag is for local debugging — produces the exact same message, just to stdout instead of Telegram. Useful before deploying to verify formatting.

## Telegram message format

One message, ≤ 4096 chars (Telegram limit), MarkdownV2 formatting kept minimal to avoid escape-character hell. Plain text with light emoji and code blocks where columns matter.

```
🔍 GSC Weekly Digest — 2026-05-27
worldwise.pro

📊 Indexing health
✅ /                   PASS  (crawled 25 May)
⏳ /dubai-marina       UNKNOWN  (not yet crawled)
⏳ /downtown-dubai     UNKNOWN  (not yet crawled)
⏳ /palm-jumeirah      UNKNOWN  (not yet crawled)
…(remaining area URLs)…

📁 Sitemap
171 URLs submitted · 0 errors · 0 warnings · last fetch 26 May

🔎 Top queries (7d)
 1.  dubai leasehold vs freehold        1 / 1 / 100% / 9.0
 2.  buying property in dubai…          0 / 4 / 0% / 79.5
…
(query / clicks / impressions / CTR / avg position)

📄 Top pages (7d)
 1.  /tpost/ti51yhg191-new-rule-for-overseas…   6 / 363 / 6.0
 2.  /                                          4 / 176 / 9.5
…
(page / clicks / impressions / avg position)

Run any command locally: node --env-file=.env.local scripts/gsc.mjs <cmd>
```

Sections:

1. **Indexing health** — homepage + all 8 area pages (imported from `lib/areas.ts` → `areaSlugs`, so adding a new district auto-appears here). One line per URL: emoji (`✅ PASS`, `⚠️ FAIL/NEUTRAL`, `⏳ UNKNOWN`) + path + verdict + last crawl date.

2. **Sitemap** — one line summary: submitted count, errors, warnings, last download date.

3. **Top queries (7d)** — 10 rows, sorted by clicks desc.

4. **Top pages (7d)** — 10 rows, sorted by clicks desc.

Last line: a reminder of the local invocation pattern.

## Telegram delivery

Use the existing `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` env vars (already set in server `.env.local` for the auto-blog approval flow). If `TELEGRAM_CHAT_ID` is comma-separated (multiple recipients, per CLAUDE.md), send to the first ID only — digests are admin-only, not for the whole team.

Endpoint: `https://api.telegram.org/bot<TOKEN>/sendMessage` with body `{ chat_id, text, parse_mode: 'HTML', disable_web_page_preview: true }`. HTML mode is simpler than MarkdownV2 for our needs (just escaping `<`, `>`, `&` in user-supplied query/page text).

## Failure modes

| Failure | Behaviour |
|---|---|
| Refresh token expired (`invalid_grant`) | Send a special Telegram message: "⚠️ GSC token expired. Re-auth needed on local Mac: `node --env-file=.env.local scripts/gsc.mjs auth`". Exit 0 so cron doesn't email an alert about the script failing. |
| GSC API 5xx or unreachable | Send Telegram message "⚠️ GSC API error: \<message\>". Exit 0. |
| Telegram API unreachable | Log to stderr (captured by `>> /var/log/worldwise-gsc.log`). Exit 0 — no recursive Telegram-to-tell-you-Telegram-is-broken. |
| `TELEGRAM_BOT_TOKEN` or `TELEGRAM_CHAT_ID` missing | Exit 1 with clear error (this is a config bug, not a transient failure). |
| Some priority URLs error inspections but others succeed | Show `⚠️ <error>` for the failing rows, keep going. Don't fail the whole digest. |
| All 10 queries / pages are empty | Print "(no data this week)" instead of an empty table. |

## Server deployment one-time setup

Once after Task 2 ships:

1. Copy GSC credentials to server `.env.local`:

   ```bash
   ssh root@62.238.35.20 "tail -3 /var/www/worldwise/.env.local"  # see current content
   # then on local:
   scp <(grep -E '^GSC_(OAUTH_CLIENT_ID|OAUTH_CLIENT_SECRET|REFRESH_TOKEN)=' \
     /Users/dzhambulat/Documents/Claude/worldwise/.env.local) \
     root@62.238.35.20:/tmp/gsc-creds.env
   ssh root@62.238.35.20 "cat /tmp/gsc-creds.env >> /var/www/worldwise/.env.local && rm /tmp/gsc-creds.env"
   ```

   (The plan-task will give the exact one-liner — this section is illustrative.)

2. After rsync of `scripts/gsc.mjs` and `npm install googleapis`, run **once manually** on the server to confirm Telegram message arrives:

   ```bash
   ssh root@62.238.35.20 "cd /var/www/worldwise && node --env-file=.env.local scripts/gsc.mjs digest"
   ```

3. Add the cron line via `crontab -e` on the server:

   ```
   0 6 * * 1 cd /var/www/worldwise && node --env-file=.env.local scripts/gsc.mjs digest >> /var/log/worldwise-gsc.log 2>&1
   ```

## Files to change

| File | Action | Responsibility |
|---|---|---|
| `worldwise/scripts/gsc.mjs` | Modify | Add `cmdDigest`, `formatDigest`, `sendTelegram` helpers; register `digest` in the dispatcher; update help text. |
| `CLAUDE.md` | Modify | Extend the existing "GSC CLI" subsection with the `digest` command + cron schedule + log file path. |
| Server `crontab` | Modify (manual SSH) | Add the weekly cron line. |
| Server `.env.local` | Modify (manual scp) | Add the 3 GSC env vars (one-time). |

No npm dependency change — `googleapis` (already added) plus Node's built-in `fetch` (Node ≥ 18) handles Telegram. No new files.

## Verification

1. **Local dry-run:** `node --env-file=.env.local scripts/gsc.mjs digest --dry-run` prints the full message to stdout. Eyeball the formatting.
2. **Local real send:** `node --env-file=.env.local scripts/gsc.mjs digest` arrives in Telegram, looks like the design above.
3. **Refresh-token failure path:** temporarily corrupt `GSC_REFRESH_TOKEN`, run `digest`, confirm the special "token expired" Telegram message arrives (not a script crash).
4. **Server deployment:** after scp + rsync + manual run on server, Telegram message arrives from server context (same content as local).
5. **Cron schedule:** check `crontab -l` on server contains the line; wait for the next Monday at 06:00 UTC (or manually run the exact cron command at any time to simulate).
6. **Log file:** `tail -50 /var/log/worldwise-gsc.log` shows the digest run's stdout/stderr each Monday.

## Sample output dimensions

- ~9 indexing lines (homepage + 8 areas) × ~50 chars = ~450 chars
- Sitemap line ~80 chars
- Top queries 10 rows × ~80 chars = ~800 chars
- Top pages 10 rows × ~80 chars = ~800 chars
- Headers + footer ~200 chars
- **Total ≈ 2,300 chars** — well under Telegram's 4,096 limit.
