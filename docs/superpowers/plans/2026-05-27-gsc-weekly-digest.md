# GSC Weekly Digest Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend `scripts/gsc.mjs` with a `digest` command that posts a weekly snapshot (indexing health, sitemap, top queries, top pages) to Telegram, plus a server cron entry to run it every Monday at 06:00 UTC.

**Architecture:** New subcommand `digest` in the existing single-file CLI. Talks to GSC via `googleapis` (already installed) and posts a formatted HTML message to Telegram via `fetch` (Node 18+ built-in). Cron runs the same command on the Hetzner VPS using `--env-file=.env.local`, where `GSC_OAUTH_CLIENT_ID/SECRET/REFRESH_TOKEN` are copied from local via `scp` (one-time).

**Tech Stack:** Node ≥ 20.6 ESM · `googleapis` (already a dep) · Telegram Bot API via `fetch` · macOS for local · Ubuntu 24.04 + cron for server.

**Verification model:** Project has no test suite. Each task ends with a concrete observable — `--dry-run` output, a Telegram message landing in chat, a cron log file, or an `npm run build` pass.

**Working directory for `npm`/`node` commands:** `worldwise/` unless stated otherwise. If `npm` missing: `source ~/.nvm/nvm.sh && nvm use 24`.

---

## File Map

| Path | Action | Responsibility |
|---|---|---|
| `worldwise/scripts/gsc.mjs` | Modify | Add `PRIORITY_PATHS` constant, `inspectOne`, `fetchSitemapsSummary`, `safe`, `cmdDigest`, `formatDigest`, `escapeHtml`, `sendTelegram` helpers. Extend `parseOpts` to handle boolean flags. Register `digest` in dispatcher. Update `printHelp`. |
| `CLAUDE.md` (repo root) | Modify | Extend "GSC CLI" subsection with `digest` command + cron + log path. |
| Server `/var/www/worldwise/.env.local` | Modify (manual scp) | Append `GSC_OAUTH_CLIENT_ID`, `GSC_OAUTH_CLIENT_SECRET`, `GSC_REFRESH_TOKEN` once. |
| Server crontab (`root` user) | Modify (manual SSH) | Add one cron line. |
| Server file `/var/www/worldwise/scripts/gsc.mjs` | Modify (rsync) | Identical to local. |
| Server `/var/log/worldwise-gsc.log` | Created on first cron run | Captures stdout/stderr from cron. |

One file changed in code (`scripts/gsc.mjs`); the rest is configuration and deployment.

---

## Task 1: Implement `digest` Command in `scripts/gsc.mjs`

**Files:**
- Modify: `worldwise/scripts/gsc.mjs`

The CLI is a single file. The plan provides the EXACT code chunks to insert. Order doesn't matter as long as functions are defined before they're called (they're all top-level so this is automatic in JavaScript thanks to hoisting for `function` declarations).

- [ ] **Step 1.1 — Add `PRIORITY_PATHS` constant near other constants (after `OAUTH_SCOPE`)**

Find the constants block:

```js
const DEFAULT_SITE = 'https://worldwise.pro/'
const OAUTH_SCOPE = 'https://www.googleapis.com/auth/webmasters'
```

Add immediately after, before any function definition:

```js
// Priority URLs for the weekly digest health check.
// Keep in sync with lib/areas.ts areaSlugs — adding a new district means
// updating this list too. (Scripts cannot import the TS file directly.)
const PRIORITY_PATHS = [
  '/',
  '/dubai-marina',
  '/downtown-dubai',
  '/palm-jumeirah',
  '/business-bay',
  '/dubai-hills',
  '/jlt',
  '/creek-harbour',
  '/emaar-beachfront',
]
```

- [ ] **Step 1.2 — Add `escapeHtml` and `safe` helpers near the existing `pad` helper (in the output section)**

Find the existing `pad` function:

```js
function pad(s, w, align = 'left') {
  if (s.length > w) s = s.slice(0, w - 1) + '…'
  return align === 'right' ? s.padStart(w) : s.padEnd(w)
}
```

Add **right after** it:

```js
/** Escape user-supplied strings for Telegram HTML parse_mode. */
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/** Wrap an async call so per-section failures don't kill the whole digest.
 *  invalid_grant is re-thrown — token expiry is fatal at the digest level. */
async function safe(fn) {
  try {
    return { ok: true, data: await fn() }
  } catch (err) {
    if (err.message?.includes('invalid_grant')) throw err
    return { ok: false, error: err.message }
  }
}
```

- [ ] **Step 1.3 — Add `inspectOne` and `fetchSitemapsSummary` helpers in the API helpers section**

Find the `siteUrl` / `dateRange` / `iso` block:

```js
function siteUrl() {
  return process.env.GSC_SITE_URL || DEFAULT_SITE
}

function dateRange(days) {
  ...
}

function iso(d) {
  return d.toISOString().slice(0, 10)
}
```

Add **right after** `iso`:

```js
/** Single URL inspection — returns the raw inspectionResult object. */
async function inspectOne(url) {
  const auth = getAuthedClient()
  const searchconsole = google.searchconsole({ version: 'v1', auth })
  const { data } = await searchconsole.urlInspection.index.inspect({
    requestBody: { inspectionUrl: url, siteUrl: siteUrl() },
  })
  return data.inspectionResult || {}
}

/** First sitemap's summary stats — we have only `/sitemap.xml`. */
async function fetchSitemapsSummary() {
  const auth = getAuthedClient()
  const wm = google.webmasters({ version: 'v3', auth })
  const { data } = await wm.sitemaps.list({ siteUrl: siteUrl() })
  const sitemaps = data.sitemap || []
  if (sitemaps.length === 0) {
    return { submitted: 0, errors: 0, warnings: 0, lastDownloaded: 'never' }
  }
  const sm = sitemaps[0]
  return {
    submitted: Number(sm.contents?.[0]?.submitted || 0),
    errors: Number(sm.errors || 0),
    warnings: Number(sm.warnings || 0),
    lastDownloaded: sm.lastDownloaded || 'never',
  }
}
```

- [ ] **Step 1.4 — Add `sendTelegram` helper at the end of the API helpers section**

Right after `fetchSitemapsSummary` (the function you just added):

```js
async function sendTelegram(text) {
  const token = getEnv('TELEGRAM_BOT_TOKEN')
  const chatIds = getEnv('TELEGRAM_CHAT_ID').split(',').map(s => s.trim()).filter(Boolean)
  const chatId = chatIds[0]  // digest goes to first ID only (admin)

  const resp = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
  })

  if (!resp.ok) {
    const body = await resp.text()
    throw new Error(`Telegram API ${resp.status}: ${body}`)
  }
}
```

- [ ] **Step 1.5 — Add `cmdDigest` and `formatDigest` in the commands section**

Find the existing `cmdSitemaps` function. Add **right after** it:

```js
async function cmdDigest(opts) {
  const dryRun = !!opts['dry-run']
  let message
  try {
    const data = await collectDigestData()
    message = formatDigest(data)
  } catch (err) {
    if (err.message?.includes('invalid_grant')) {
      message = '⚠️ <b>GSC token expired</b>\nRe-auth needed on local Mac:\n<code>node --env-file=.env.local scripts/gsc.mjs auth</code>'
    } else {
      message = `⚠️ <b>GSC digest failed</b>\n<code>${escapeHtml(err.message)}</code>`
    }
  }

  if (dryRun) {
    console.log(message)
    return
  }

  try {
    await sendTelegram(message)
    console.log('✓ Digest sent to Telegram')
  } catch (err) {
    console.error(`Telegram send failed: ${err.message}`)
    // exit 0 so cron doesn't escalate
  }
}

async function collectDigestData() {
  const base = siteUrl().replace(/\/$/, '')

  const indexResults = []
  for (const p of PRIORITY_PATHS) {
    const url = base + p
    try {
      indexResults.push({ path: p, ok: true, data: await inspectOne(url) })
    } catch (err) {
      if (err.message?.includes('invalid_grant')) throw err
      indexResults.push({ path: p, ok: false, error: err.message })
    }
  }

  const sitemap = await safe(() => fetchSitemapsSummary())
  const queries = await safe(() => searchAnalytics('query', { days: 7, limit: 10 }))
  const pages = await safe(() => searchAnalytics('page', { days: 7, limit: 10 }))

  return { indexResults, sitemap, queries, pages }
}

function formatDigest({ indexResults, sitemap, queries, pages }) {
  const today = iso(new Date())
  const lines = []
  lines.push(`🔍 <b>GSC Weekly Digest — ${today}</b>`)
  lines.push(`<i>${escapeHtml(siteUrl())}</i>`)
  lines.push('')

  // Indexing health
  lines.push('<b>📊 Indexing health</b>')
  for (const r of indexResults) {
    if (!r.ok) {
      lines.push(`⚠️ <code>${escapeHtml(r.path)}</code>  ${escapeHtml(r.error)}`)
      continue
    }
    const idx = r.data.indexStatusResult || {}
    const verdict = idx.verdict || 'UNKNOWN'
    const emoji = verdict === 'PASS' ? '✅' : verdict === 'FAIL' || verdict === 'PARTIAL' ? '❌' : '⏳'
    const lastCrawl = idx.lastCrawlTime
      ? idx.lastCrawlTime.slice(0, 10)
      : 'never'
    lines.push(`${emoji} <code>${escapeHtml(r.path)}</code>  ${verdict}  <i>(crawl: ${lastCrawl})</i>`)
  }
  lines.push('')

  // Sitemap
  lines.push('<b>📁 Sitemap</b>')
  if (!sitemap.ok) {
    lines.push(`⚠️ ${escapeHtml(sitemap.error)}`)
  } else {
    const s = sitemap.data
    const fetched = String(s.lastDownloaded).slice(0, 10)
    lines.push(`${s.submitted} URLs · ${s.errors} errors · ${s.warnings} warnings · last fetch ${fetched}`)
  }
  lines.push('')

  // Top queries (7d)
  lines.push('<b>🔎 Top queries (7d)</b>')
  if (!queries.ok) {
    lines.push(`⚠️ ${escapeHtml(queries.error)}`)
  } else if (queries.data.length === 0) {
    lines.push('(no data this week)')
  } else {
    lines.push('<pre>')
    lines.push('query                             clicks  impr   pos')
    for (const row of queries.data) {
      const q = pad(escapeHtml(String(row.key)), 33)
      const c = String(row.clicks).padStart(6)
      const i = String(row.impressions).padStart(5)
      const p = String(row.position).padStart(5)
      lines.push(`${q}  ${c}  ${i}  ${p}`)
    }
    lines.push('</pre>')
  }
  lines.push('')

  // Top pages (7d)
  lines.push('<b>📄 Top pages (7d)</b>')
  if (!pages.ok) {
    lines.push(`⚠️ ${escapeHtml(pages.error)}`)
  } else if (pages.data.length === 0) {
    lines.push('(no data this week)')
  } else {
    lines.push('<pre>')
    lines.push('page                              clicks  impr   pos')
    for (const row of pages.data) {
      const short = String(row.key).replace('https://worldwise.pro', '') || '/'
      const k = pad(escapeHtml(short), 33)
      const c = String(row.clicks).padStart(6)
      const i = String(row.impressions).padStart(5)
      const p = String(row.position).padStart(5)
      lines.push(`${k}  ${c}  ${i}  ${p}`)
    }
    lines.push('</pre>')
  }
  lines.push('')

  lines.push('<i>Local: <code>node --env-file=.env.local scripts/gsc.mjs &lt;cmd&gt;</code></i>')

  return lines.join('\n')
}
```

- [ ] **Step 1.6 — Update `parseOpts` to handle boolean flags (`--dry-run`)**

Find the existing `parseOpts`:

```js
function parseOpts(args, defaults = { days: 28, limit: 20 }) {
  const opts = { ...defaults }
  for (const arg of args) {
    const m = arg.match(/^--(\w+)=(.+)$/)
    if (m) {
      const num = Number(m[2])
      opts[m[1]] = Number.isFinite(num) ? num : m[2]
    }
  }
  return opts
}
```

Replace **entirely** with:

```js
function parseOpts(args, defaults = { days: 28, limit: 20 }) {
  const opts = { ...defaults }
  for (const arg of args) {
    const eq = arg.match(/^--([\w-]+)=(.+)$/)
    if (eq) {
      const num = Number(eq[2])
      opts[eq[1]] = Number.isFinite(num) ? num : eq[2]
      continue
    }
    const flag = arg.match(/^--([\w-]+)$/)
    if (flag) {
      opts[flag[1]] = true
    }
  }
  return opts
}
```

Two changes: now accepts hyphens in keys (`--dry-run` → key `'dry-run'`), and handles boolean flags without `=value`.

- [ ] **Step 1.7 — Register `digest` in the dispatcher**

Find the switch statement in `main`:

```js
    switch (cmd) {
      case 'auth':     return await cmdAuth()
      case 'inspect':  return await cmdInspect(rest[0])
      case 'queries':  return await cmdQueries(parseOpts(rest))
      case 'pages':    return await cmdPages(parseOpts(rest))
      case 'sitemaps': return await cmdSitemaps()
      default:
```

Insert `digest` case immediately before `default`:

```js
      case 'sitemaps': return await cmdSitemaps()
      case 'digest':   return await cmdDigest(parseOpts(rest))
      default:
```

- [ ] **Step 1.8 — Update `printHelp` to list the `digest` command**

Find the help text inside `printHelp`:

```js
  sitemaps                          List submitted sitemaps and their status

Run with --env-file=.env.local so OAuth secrets are loaded:
```

Insert one line for `digest` before the blank line:

```js
  sitemaps                          List submitted sitemaps and their status
  digest [--dry-run]                Send a weekly snapshot to Telegram (--dry-run prints to stdout)

Run with --env-file=.env.local so OAuth secrets are loaded:
```

Also add Telegram env vars to the env-vars listing block at the bottom of `printHelp`:

Find:

```js
Env vars (loaded from worldwise/.env.local):
  GSC_OAUTH_CLIENT_ID       (required)
  GSC_OAUTH_CLIENT_SECRET   (required)
  GSC_REFRESH_TOKEN         (set by \`auth\` command)
  GSC_SITE_URL              (optional, default https://worldwise.pro/)
```

Replace with:

```js
Env vars (loaded from worldwise/.env.local):
  GSC_OAUTH_CLIENT_ID       (required)
  GSC_OAUTH_CLIENT_SECRET   (required)
  GSC_REFRESH_TOKEN         (set by \`auth\` command)
  GSC_SITE_URL              (optional, default https://worldwise.pro/)
  TELEGRAM_BOT_TOKEN        (required for \`digest\`)
  TELEGRAM_CHAT_ID          (required for \`digest\`; comma-separated, first ID used)
```

- [ ] **Step 1.9 — Verify help text and dry-run path**

```bash
cd /Users/dzhambulat/Documents/Claude/worldwise
node scripts/gsc.mjs | grep -E "digest|TELEGRAM"
```

Expected: prints the `digest` command line AND both `TELEGRAM_*` env-var lines.

- [ ] **Step 1.10 — Verify the build still passes**

```bash
npm run build 2>&1 | tail -3
```

Expected: `Compiled successfully` — the Next.js app is unaffected by changes in `scripts/`.

- [ ] **Step 1.11 — Commit**

```bash
cd /Users/dzhambulat/Documents/Claude
git add worldwise/scripts/gsc.mjs
git commit -m "feat(gsc): add weekly digest command that posts snapshot to Telegram

New \`digest\` subcommand collects indexing health for homepage + 8 area
pages, sitemap status, top 10 queries, top 10 pages (last 7 days), and
posts an HTML-formatted Telegram message. With --dry-run, prints to
stdout instead. Designed to be cron-run weekly on the server."
```

---

## Task 2: Local Verification (Dry-Run + Real Send)

**Files:** none modified.

- [ ] **Step 2.1 — Dry-run: print message to stdout, verify formatting**

```bash
cd /Users/dzhambulat/Documents/Claude/worldwise
node --env-file=.env.local scripts/gsc.mjs digest --dry-run
```

Expected: prints the full HTML-formatted digest. Eyeball it for:
- Title line `🔍 <b>GSC Weekly Digest — <today></b>`
- 9 lines under "Indexing health" (homepage + 8 areas)
- "Sitemap" section with sensible numbers
- "Top queries (7d)" and "Top pages (7d)" tables (or "(no data this week)" if last 7 days are sparse)
- Closing line mentioning local invocation

The output is HTML (with `<b>`, `<pre>`, `<code>`, `<i>` tags) — that's expected; Telegram will render those.

- [ ] **Step 2.2 — Check approximate message length**

```bash
node --env-file=.env.local scripts/gsc.mjs digest --dry-run | wc -c
```

Expected: between 1,500 and 4,000 characters. Telegram's per-message limit is 4,096; we're well under.

- [ ] **Step 2.3 — Real send to Telegram**

```bash
node --env-file=.env.local scripts/gsc.mjs digest
```

Expected: stdout prints `✓ Digest sent to Telegram` and a real Telegram message arrives in the chat configured by `TELEGRAM_CHAT_ID`.

In Telegram, verify:
- HTML formatting (bold headers, monospace tables) is correctly rendered.
- Emoji and indentation look readable on mobile.
- No raw `<b>` or `<pre>` characters (which would mean the `parse_mode: HTML` was rejected — check stdout for any Telegram API errors).

- [ ] **Step 2.4 — Verify failure path: corrupt refresh token, expect fallback Telegram message**

```bash
cp .env.local .env.local.bak
sed -i '' 's|^GSC_REFRESH_TOKEN=.*|GSC_REFRESH_TOKEN=invalid_token_for_test|' .env.local
node --env-file=.env.local scripts/gsc.mjs digest
```

Expected: stdout prints `✓ Digest sent to Telegram`, and a Telegram message arrives saying `⚠️ GSC token expired. Re-auth needed on local Mac: …`.

Restore:

```bash
mv .env.local.bak .env.local
node --env-file=.env.local scripts/gsc.mjs digest --dry-run | head -3
```

Expected: dry-run output begins normally with the digest header again — token works.

---

## Task 3: Copy GSC Credentials to Server `.env.local`

**Files:**
- Modify: `/var/www/worldwise/.env.local` on Hetzner VPS (manual scp + append).

The server already has `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `NEXT_PUBLIC_SITE_URL`, etc. from the existing setup. It does NOT yet have the three GSC vars.

- [ ] **Step 3.1 — Confirm server doesn't already have the GSC vars**

```bash
ssh -i ~/.ssh/id_ed25519 root@62.238.35.20 "grep -E '^GSC_' /var/www/worldwise/.env.local || echo 'NONE'"
```

Expected: `NONE` (no GSC vars yet). If they're somehow already there, skip Task 3 and re-verify by running Task 4 manual step.

- [ ] **Step 3.2 — Append GSC vars from local to server (one-time)**

```bash
grep -E '^GSC_(OAUTH_CLIENT_ID|OAUTH_CLIENT_SECRET|REFRESH_TOKEN)=' /Users/dzhambulat/Documents/Claude/worldwise/.env.local | \
  ssh -i ~/.ssh/id_ed25519 root@62.238.35.20 'cat >> /var/www/worldwise/.env.local'
```

Expected: no output, just exits cleanly.

- [ ] **Step 3.3 — Verify on server**

```bash
ssh -i ~/.ssh/id_ed25519 root@62.238.35.20 \
  "awk -F= '/^GSC_/ { v=\$2; print \$1 \"=\" substr(v,1,12) \"...\" }' /var/www/worldwise/.env.local"
```

Expected: three lines, the third being `GSC_REFRESH_TOKEN=1//...` (refresh token prefix).

---

## Task 4: Rsync Code, Install Dependencies, Manual Run on Server

**Files:**
- Modify: `/var/www/worldwise/scripts/gsc.mjs` (rsync target)
- Modify: `/var/www/worldwise/package.json` and `package-lock.json` (rsync target)
- Modify: `/var/www/worldwise/node_modules/` (npm install)

- [ ] **Step 4.1 — Backup server `data/` before rsync (per project rule)**

```bash
ssh -i ~/.ssh/id_ed25519 root@62.238.35.20 \
  "cp -r /var/www/worldwise/data /var/www/worldwise/data_backup_$(date +%Y%m%d_%H%M%S) && ls -d /var/www/worldwise/data_backup_* | tail -1"
```

Expected: prints the new backup dir path.

- [ ] **Step 4.2 — Rsync (standard exclusions, identical to the regular deploy command)**

```bash
rsync -avz \
  --exclude='.git' --exclude='node_modules' --exclude='.next' \
  --exclude='data/' --exclude='public/files/' --exclude='public/images/blog/' \
  --exclude='.env.local' --exclude='AGENTS.md' --exclude='CLAUDE.md' \
  -e "ssh -i ~/.ssh/id_ed25519" \
  /Users/dzhambulat/Documents/Claude/worldwise/ root@62.238.35.20:/var/www/worldwise/ 2>&1 | tail -10
```

Expected: file list includes `scripts/gsc.mjs`, `package.json`, `package-lock.json`. `.env.local` is excluded — server keeps its own copy with the GSC vars from Task 3.

- [ ] **Step 4.3 — Install dependencies on server (`googleapis` is new since the last deploy)**

```bash
ssh -i ~/.ssh/id_ed25519 root@62.238.35.20 \
  "cd /var/www/worldwise && npm install --silent 2>&1 | tail -3"
```

Expected: completes; may report `added 1 package` (the `googleapis` we added in Task 1 of the previous feature).

- [ ] **Step 4.4 — Manually run `digest` once on the server to confirm everything works**

```bash
ssh -i ~/.ssh/id_ed25519 root@62.238.35.20 \
  "cd /var/www/worldwise && node --env-file=.env.local scripts/gsc.mjs digest"
```

Expected: prints `✓ Digest sent to Telegram` on stderr/stdout, and a real Telegram message arrives. Same chat as before. This proves the server context (env vars, network, Telegram reachability) works.

If you see `Refresh token expired or revoked. Re-run: node --env-file=.env.local scripts/gsc.mjs auth` — that means the refresh token doesn't work from the server's IP. Google sometimes flags `invalid_grant` for IPs outside the consent flow's origin. **Workaround:** re-run `auth` on local, copy the new token, re-do Task 3. (Rare; usually doesn't happen.)

- [ ] **Step 4.5 — Restart PM2 (regular deploy step, harmless if already running)**

```bash
ssh -i ~/.ssh/id_ed25519 root@62.238.35.20 \
  "cd /var/www/worldwise && npm run build 2>&1 | tail -3 && pm2 restart worldwise"
```

Expected: build passes, PM2 reports `online`. The Next.js app is unaffected by gsc.mjs changes, but this is the standard deploy hygiene.

---

## Task 5: Add the Cron Entry

**Files:**
- Modify: server crontab (root user).

- [ ] **Step 5.1 — Show the current crontab so we know what's there**

```bash
ssh -i ~/.ssh/id_ed25519 root@62.238.35.20 "crontab -l"
```

Expected: lists existing cron entries, including the auto-blog one (`0 9 * * * cd /var/www/worldwise && node --env-file=.env.local scripts/generate-article.mjs …`).

(Typo guard: if the SSH host shows `crontab: command not found`, use `/usr/bin/crontab -l`.)

- [ ] **Step 5.2 — Append the GSC digest cron line**

```bash
ssh -i ~/.ssh/id_ed25519 root@62.238.35.20 \
  '(crontab -l 2>/dev/null; echo "0 6 * * 1 cd /var/www/worldwise && node --env-file=.env.local scripts/gsc.mjs digest >> /var/log/worldwise-gsc.log 2>&1") | crontab -'
```

Expected: no output. The new line is now in root's crontab.

- [ ] **Step 5.3 — Verify the crontab**

```bash
ssh -i ~/.ssh/id_ed25519 root@62.238.35.20 "crontab -l | grep gsc.mjs"
```

Expected: prints `0 6 * * 1 cd /var/www/worldwise && node --env-file=.env.local scripts/gsc.mjs digest >> /var/log/worldwise-gsc.log 2>&1`.

- [ ] **Step 5.4 — Touch the log file with the right permissions (so cron's first run doesn't fail on a missing file in some restrictive setups)**

```bash
ssh -i ~/.ssh/id_ed25519 root@62.238.35.20 "touch /var/log/worldwise-gsc.log && chmod 644 /var/log/worldwise-gsc.log && ls -la /var/log/worldwise-gsc.log"
```

Expected: prints something like `-rw-r--r-- 1 root root 0 May 27 … /var/log/worldwise-gsc.log`.

- [ ] **Step 5.5 — Smoke-run the EXACT cron command to validate it executes end-to-end (since first real fire is days away)**

```bash
ssh -i ~/.ssh/id_ed25519 root@62.238.35.20 \
  '/bin/bash -c "cd /var/www/worldwise && node --env-file=.env.local scripts/gsc.mjs digest >> /var/log/worldwise-gsc.log 2>&1" && tail -5 /var/log/worldwise-gsc.log'
```

Expected: log file shows the last digest run's output (`✓ Digest sent to Telegram` line). Another Telegram message arrives. This catches any path/permission issues that would only surface from cron's restricted environment.

---

## Task 6: Update CLAUDE.md

**Files:**
- Modify: `/Users/dzhambulat/Documents/Claude/CLAUDE.md`

- [ ] **Step 6.1 — Locate the existing GSC CLI subsection**

```bash
grep -n "### GSC CLI\|0 6 \* \* 1" /Users/dzhambulat/Documents/Claude/CLAUDE.md
```

Expected: one match for `### GSC CLI`. No match for the cron line (we're about to add it).

- [ ] **Step 6.2 — Append digest command and cron documentation to the GSC CLI subsection**

In `CLAUDE.md`, find the existing block listing the commands:

```bash
node --env-file=.env.local scripts/gsc.mjs auth                               # one-time OAuth
node --env-file=.env.local scripts/gsc.mjs inspect https://worldwise.pro/<x>  # URL inspection
node --env-file=.env.local scripts/gsc.mjs queries [--days=N] [--limit=N]     # top queries
node --env-file=.env.local scripts/gsc.mjs pages   [--days=N] [--limit=N]     # top pages
node --env-file=.env.local scripts/gsc.mjs sitemaps                           # sitemap status
```

Add one line at the end of that code block (still inside the same fenced block):

```bash
node --env-file=.env.local scripts/gsc.mjs digest [--dry-run]                 # send weekly snapshot to Telegram
```

Then, immediately after the closing ``` of that code block, add a new paragraph:

```markdown

**Weekly cron on the server** (Hetzner VPS) runs the `digest` command every Monday at 06:00 UTC and appends to `/var/log/worldwise-gsc.log`:

```
0 6 * * 1 cd /var/www/worldwise && node --env-file=.env.local scripts/gsc.mjs digest >> /var/log/worldwise-gsc.log 2>&1
```

The digest needs `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` on the server (already present, used by lead notifications) plus the three `GSC_*` vars (copied to server `.env.local` during initial setup — `.env.local` is not in rsync).
```

- [ ] **Step 6.3 — Commit**

```bash
cd /Users/dzhambulat/Documents/Claude
git add CLAUDE.md
git commit -m "docs(gsc): document weekly digest cron + server env vars"
```

---

## Task 7: Push to Remote

**Files:** none modified.

- [ ] **Step 7.1 — Push**

```bash
cd /Users/dzhambulat/Documents/Claude
git log --oneline -5
git push claude main 2>&1 | tail -3
```

Expected: three new commits since the last push: digest implementation, the (already-existing) spec, the docs. (Task 2, 3, 4, 5 are operational — no commits.)

---

## Self-Review

**Spec coverage:**

| Spec requirement | Covered by |
|---|---|
| New `digest` command in `gsc.mjs` | Task 1 (Step 1.5) |
| `--dry-run` prints to stdout | Task 1 (Step 1.5 `cmdDigest`), Task 2 Step 2.1 |
| Sends HTML-formatted message via Telegram | Task 1 (Step 1.4 `sendTelegram`), Task 2 Step 2.3 |
| Priority URLs = homepage + 8 area pages | Task 1 (Step 1.1 `PRIORITY_PATHS`) |
| Sitemap summary line | Task 1 (Step 1.3 `fetchSitemapsSummary`, Step 1.5 `formatDigest`) |
| Top 10 queries / pages last 7 days | Task 1 (Step 1.5 `collectDigestData` calls `searchAnalytics` with `{days:7, limit:10}`) |
| Refresh-token failure → special Telegram message, exit 0 | Task 1 (Step 1.5 `cmdDigest` catch block), Task 2 Step 2.4 |
| API or Telegram failure → log, exit 0 (cron doesn't escalate) | Task 1 (Step 1.5 try/catch in `cmdDigest`) |
| Boolean flag support in `parseOpts` | Task 1 (Step 1.6) |
| Help text lists `digest` and Telegram vars | Task 1 (Step 1.8), Step 1.9 verifies |
| Server cron at Monday 06:00 UTC | Task 5 |
| Log file at `/var/log/worldwise-gsc.log` | Task 5 (Step 5.2 cron line, Step 5.4 file creation) |
| Server gets GSC env vars via scp | Task 3 |
| Rsync + npm install on server | Task 4 |
| CLAUDE.md updated | Task 6 |
| Smoke test on server before relying on cron | Task 4 Step 4.4 and Task 5 Step 5.5 |

All spec requirements have tasks.

**Placeholder scan:** None. All code is inlined, all commands exact, all expected outputs described.

**Type / name consistency:**

- `PRIORITY_PATHS`, `inspectOne`, `fetchSitemapsSummary`, `safe`, `cmdDigest`, `collectDigestData`, `formatDigest`, `escapeHtml`, `sendTelegram` — each defined once, called consistently.
- `parseOpts` now returns `opts['dry-run']` (string-key) — `cmdDigest` accesses `opts['dry-run']` (matches).
- Telegram env vars `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` are exactly what's already used elsewhere in the project (confirmed by CLAUDE.md `Environment variables` section).
- Cron command in Task 5 matches the line documented in Task 6 verbatim.

**One minor typo caught:** Task 5 Step 5.1 had `ed25500` in the SSH command instead of `ed25519`. Fixed inline before saving.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-27-gsc-weekly-digest.md`. Two execution options:

**1. Subagent-Driven (recommended)** — fresh subagent per task, two-stage review after the code task. Tasks 2–7 are operational and run inline (no code review needed for cron lines).

**2. Inline Execution** — execute every task in this session.

Which approach?
