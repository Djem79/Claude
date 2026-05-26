# GSC CLI — Design Spec

**Date:** 2026-05-27
**Status:** Approved (auth approach pivoted from Service Account to OAuth — see Decision Log)
**Goal:** Local Node.js CLI for ad-hoc queries against Google Search Console for `worldwise.pro` — diagnose indexing issues, see what queries drive traffic, check sitemap status. No web UI, no scheduled cron — just `node scripts/gsc.mjs <command>` when needed.

## Why this tool

After shipping the area landing pages, we need visibility into:

- Whether new pages are actually indexed (URL Inspection).
- What queries are bringing traffic (Search Analytics).
- Whether the sitemap is being processed without errors.

Today this all requires clicking through the GSC web UI. The CLI gives faster, scriptable, repeatable access to the same data.

## Out of scope

- **Web dashboard.** Single user, terminal output is enough.
- **Scheduled reports / Telegram digest.** Add later if there's demand.
- **CSV / JSON export.** Add later if there's demand.
- **Storing historical data in a DB.** GSC retains 16 months — query on demand.
- **Request Indexing automation.** No public API exists for general pages. The Indexing API is restricted to `JobPosting` and `BroadcastEvent`; using it for normal pages violates Google's TOS. URL Inspection from the CLI is the closest we can get.

## Decision Log

**Auth: OAuth 2.0 Desktop client (with refresh token), not Service Account.**

- The user (`tdm.979@gmail.com`) holds a personal Gmail account, not Google Workspace. Personal Gmail GSC properties refuse to add service-account emails as users — the "email not found" bug is well-documented.
- OAuth Desktop client works against the user's own Google account, which is already an Owner of the GSC property. No permission grant inside GSC is needed at all.
- Trade-off: first run requires a one-time browser consent. Subsequent runs use the persisted refresh token. Acceptable.

## Architecture

```
worldwise/
├── scripts/
│   └── gsc.mjs                 ← new CLI (Node ESM, single file)
├── .env.local                  ← already created; gitignored by repo-root .gitignore
│     GSC_OAUTH_CLIENT_ID=...
│     GSC_OAUTH_CLIENT_SECRET=...
│     GSC_REFRESH_TOKEN=...     (written by the `auth` command on first run)
│     GSC_SITE_URL=https://worldwise.pro/  (optional; default hard-coded)
└── package.json                ← +1 dep: googleapis
```

**Runtime:** local on the user's Mac. Not deployed to the server — this is a diagnostic tool, the production app does not need it.

**Module style:** Node ESM `.mjs`, matching `scripts/generate-article.mjs`. Run via:

```
cd worldwise && node --env-file=.env.local scripts/gsc.mjs <command> [args]
```

(The `--env-file=.env.local` flag is Node ≥ 20.6 native, already used by the auto-blog script.)

## Commands

| Command | Description | Example |
|---|---|---|
| `auth` | One-time OAuth flow. Opens browser, captures the refresh token on a local loopback port, writes `GSC_REFRESH_TOKEN=…` to `.env.local`. Idempotent — running again rotates the token. | `node scripts/gsc.mjs auth` |
| `inspect <url>` | URL Inspection API. Prints: index verdict (`PASS`/`PARTIAL`/`FAIL`/`NEUTRAL`/`VERDICT_UNSPECIFIED`), declared canonical, Google-selected canonical, last crawl time, mobile-friendly verdict, rich results items + errors. | `node scripts/gsc.mjs inspect https://worldwise.pro/dubai-marina` |
| `queries [--days=N] [--limit=N]` | Top search queries over the date window (default 28 days, default 20 rows). Columns: query, clicks, impressions, CTR%, avg position. Sorted by clicks desc. | `node scripts/gsc.mjs queries --days=7 --limit=10` |
| `pages [--days=N] [--limit=N]` | Top pages over the date window (defaults same as `queries`). Columns: page URL, clicks, impressions, CTR%, avg position. | `node scripts/gsc.mjs pages` |
| `sitemaps` | List submitted sitemaps. Columns: path, last submitted, last downloaded, status (warnings / errors), URLs in sitemap, URLs indexed. | `node scripts/gsc.mjs sitemaps` |

`auth` is the only command that performs a browser interaction. All others are headless and rely on the refresh token.

## Output format

Plain text tables to stdout. Right-aligned numeric columns. Header line, then rows, ~80 columns wide max. Truncate long URLs with an ellipsis if they exceed column width. Examples:

```
$ node scripts/gsc.mjs queries --days=7 --limit=5

Top queries — last 7 days
─────────────────────────────────────────────────────────────────
QUERY                              CLICKS  IMPR.   CTR%   POS.
─────────────────────────────────────────────────────────────────
dubai marina apartments               42  1,820   2.3%   8.4
worldwise real estate                 31     97  32.0%   1.2
…
─────────────────────────────────────────────────────────────────
```

No colour, no spinners — works in plain SSH terminals if ever invoked there. Errors go to stderr with non-zero exit code.

## API & auth details

**Library:** `googleapis` (official Google SDK). Specifically:

- `google.auth.OAuth2` — token management
- `google.webmasters({ version: 'v3' })` — Search Analytics, Sitemaps
- `google.searchconsole({ version: 'v1' })` — URL Inspection

**Scope:** `https://www.googleapis.com/auth/webmasters` (read-write, so a future `sitemaps:submit` works without re-auth).

**OAuth redirect URI for `auth` command:** Loopback — `http://127.0.0.1:<random-free-port>/callback`. Google requires loopback (not `urn:ietf:wg:oauth:2.0:oob` which is deprecated since 2022). The CLI:

1. Opens a free port on `127.0.0.1`.
2. Builds auth URL with that loopback as redirect.
3. Opens the URL in the default browser (`open` on macOS).
4. Waits for the callback hit (with the `code` query param).
5. Exchanges the code for tokens.
6. Persists the `refresh_token` into `.env.local` (idempotent — replaces existing `GSC_REFRESH_TOKEN=…` line, appends if missing).

**Access token:** never persisted — minted on each run from the refresh token (1-hour TTL).

## Setup steps (user-facing, already partially done)

1. ✅ Enable Search Console API in GCP project `worldwise-497520`.
2. ✅ Configure OAuth consent screen (External, with `tdm.979@gmail.com` as Test user).
3. ✅ Create OAuth Client ID (Desktop app), name `gsc-cli-desktop`.
4. ✅ Put `GSC_OAUTH_CLIENT_ID` and `GSC_OAUTH_CLIENT_SECRET` in `worldwise/.env.local`.
5. ⏳ (After implementation) Run `node scripts/gsc.mjs auth` once.
6. ✅ Delete the unused `gsc-cli` Service Account from GCP (optional cleanup — it's a no-op security-wise, but tidy).

## Security

- `.env.local` is gitignored by `**/.env.local` in the repo-root `.gitignore`. Confirmed: file does not appear in `git status`.
- Refresh token in `.env.local` proves Google account authorization — treat as secret. Can be revoked at any time at `myaccount.google.com/permissions` (the consent screen app `Worldwise GSC CLI` will appear there).
- OAuth Client ID and Secret for a Desktop app are technically public values (Google explicitly says Desktop OAuth apps can't keep secrets — Secret is more an identifier than a real secret), but still kept in `.env.local` out of habit. Rotation via GCP UI is one click.
- Tool runs only on the user's machine, never on the production server.

## Files to create / modify

| File | Action | Responsibility |
|---|---|---|
| `worldwise/scripts/gsc.mjs` | Create | The whole CLI: command router + 5 command handlers + OAuth flow + output formatting. |
| `worldwise/package.json` | Modify | Add `googleapis` to `dependencies`. |
| `worldwise/package-lock.json` | Modify (auto) | npm install side effect. |
| `CLAUDE.md` | Modify | New "GSC CLI" subsection under Architecture: where the script lives, what env vars it expects, the 5 commands, run pattern. |

No code change in the Next.js app itself.

## Verification (acceptance criteria)

1. `cd worldwise && node --env-file=.env.local scripts/gsc.mjs` (no args) prints help text listing the 5 commands and exits 0.
2. `node --env-file=.env.local scripts/gsc.mjs auth` opens the browser, completes the flow, and writes `GSC_REFRESH_TOKEN=…` to `.env.local`. Re-running it works (token rotates, not duplicates).
3. `node --env-file=.env.local scripts/gsc.mjs sitemaps` shows `https://worldwise.pro/sitemap.xml` with a recent download timestamp.
4. `node --env-file=.env.local scripts/gsc.mjs inspect https://worldwise.pro/dubai-marina` returns a verdict (may be `URL is unknown to Google` until the crawler reaches it — that's still a successful API call, not a failure).
5. `node --env-file=.env.local scripts/gsc.mjs queries` and `…pages` return tables with real production data over the last 28 days.
6. Error handling: missing env var → human-readable error, non-zero exit. Expired refresh token → clear instruction to re-run `auth`. Unreachable Google → curl-style error with URL.
7. `git status` after implementation does not show `.env.local`.

## File-size discipline

The CLI is one file (`scripts/gsc.mjs`). Estimated ~250–350 lines. Sections inside it: imports → constants/env helpers → OAuth flow → API helpers → command handlers → CLI dispatcher → main. If it grows past ~500 lines, split per command. For v1 a single file is appropriate — matches `generate-article.mjs` pattern.

## What we're NOT building (recap)

- No new dependency beyond `googleapis`.
- No npm scripts in `package.json` (`scripts.gsc`) — keep `package.json` clean; direct `node …` is fine.
- No alias/wrapper shell script.
- No type definitions / TypeScript — matches existing `.mjs` script convention.
- No automated tests — matches project convention (no test suite).
