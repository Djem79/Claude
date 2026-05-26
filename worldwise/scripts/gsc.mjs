#!/usr/bin/env node
// GSC CLI for worldwise.pro — see docs/superpowers/specs/2026-05-27-gsc-cli-design.md

import { google } from 'googleapis'
import http from 'node:http'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { exec } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url))
const REPO_DIR = path.resolve(SCRIPT_DIR, '..')
const ENV_FILE = path.join(REPO_DIR, '.env.local')
const DEFAULT_SITE = 'https://worldwise.pro/'
const OAUTH_SCOPE = 'https://www.googleapis.com/auth/webmasters'

// ─── env helpers ────────────────────────────────────────────────────────────

function getEnv(name, required = true) {
  const value = process.env[name]
  if (!value && required) {
    fail(`Missing env var ${name}. Expected in ${ENV_FILE}.`)
  }
  return value
}

function fail(msg) {
  console.error(`Error: ${msg}`)
  process.exit(1)
}

/** Upsert KEY=value into .env.local (idempotent — replaces existing line if present). */
function upsertEnvVar(name, value) {
  let content = existsSync(ENV_FILE) ? readFileSync(ENV_FILE, 'utf8') : ''
  const lineRe = new RegExp(`^${name}=.*$`, 'm')
  if (lineRe.test(content)) {
    content = content.replace(lineRe, `${name}=${value}`)
  } else {
    if (content && !content.endsWith('\n')) content += '\n'
    content += `${name}=${value}\n`
  }
  writeFileSync(ENV_FILE, content)
}

// ─── OAuth ──────────────────────────────────────────────────────────────────

function makeOAuthClient(redirectUri) {
  return new google.auth.OAuth2(
    getEnv('GSC_OAUTH_CLIENT_ID'),
    getEnv('GSC_OAUTH_CLIENT_SECRET'),
    redirectUri,
  )
}

function getAuthedClient() {
  const client = makeOAuthClient()
  client.setCredentials({ refresh_token: getEnv('GSC_REFRESH_TOKEN') })
  return client
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const srv = http.createServer()
    srv.listen(0, '127.0.0.1', () => {
      const port = srv.address().port
      srv.close(() => resolve(port))
    })
    srv.on('error', reject)
  })
}

function openInBrowser(url) {
  // macOS only; project is macOS-bound for local dev.
  exec(`open "${url.replace(/"/g, '\\"')}"`)
}

async function cmdAuth() {
  const port = await getFreePort()
  const redirectUri = `http://127.0.0.1:${port}/callback`
  const client = makeOAuthClient(redirectUri)

  const authUrl = client.generateAuthUrl({
    access_type: 'offline',
    scope: [OAUTH_SCOPE],
    prompt: 'consent', // force refresh token issuance on every auth run
  })

  const codePromise = new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, `http://127.0.0.1:${port}`)
      if (url.pathname !== '/callback') {
        res.writeHead(404); res.end('Not found'); return
      }
      const code = url.searchParams.get('code')
      const errParam = url.searchParams.get('error')
      if (errParam) {
        res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(`<h1>Auth failed</h1><p>${errParam}</p><p>You can close this tab.</p>`)
        server.close()
        reject(new Error(`OAuth error: ${errParam}`))
        return
      }
      if (!code) {
        res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end('<h1>Missing code</h1>')
        server.close()
        reject(new Error('No code in callback'))
        return
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end('<h1>Auth complete</h1><p>You can close this tab and return to the terminal.</p>')
      server.close()
      resolve(code)
    })
    server.listen(port, '127.0.0.1')
  })

  console.error('Opening browser for OAuth consent…')
  console.error('If it does not open, copy this URL into a browser manually:')
  console.error(authUrl)
  console.error('')
  openInBrowser(authUrl)

  const code = await codePromise
  const { tokens } = await client.getToken(code)

  if (!tokens.refresh_token) {
    fail('No refresh_token returned. This usually means consent was previously granted without prompt=consent — try revoking access at myaccount.google.com/permissions and re-run.')
  }

  upsertEnvVar('GSC_REFRESH_TOKEN', tokens.refresh_token)
  console.log('✓ Refresh token saved to .env.local')
}

// ─── API helpers ────────────────────────────────────────────────────────────

function siteUrl() {
  return process.env.GSC_SITE_URL || DEFAULT_SITE
}

function dateRange(days) {
  const end = new Date()
  const start = new Date(end)
  start.setDate(start.getDate() - days)
  return { startDate: iso(start), endDate: iso(end) }
}

function iso(d) {
  return d.toISOString().slice(0, 10)
}

// ─── commands ───────────────────────────────────────────────────────────────

async function cmdInspect(url) {
  if (!url) fail('Usage: gsc.mjs inspect <url>')
  const auth = getAuthedClient()
  const searchconsole = google.searchconsole({ version: 'v1', auth })
  const { data } = await searchconsole.urlInspection.index.inspect({
    requestBody: { inspectionUrl: url, siteUrl: siteUrl() },
  })

  const r = data.inspectionResult || {}
  const idx = r.indexStatusResult || {}
  const mob = r.mobileUsabilityResult || {}
  const rich = r.richResultsResult || {}

  console.log(`URL: ${url}`)
  console.log('─'.repeat(80))
  console.log(`Verdict:                   ${idx.verdict ?? 'unknown'}`)
  console.log(`Coverage state:            ${idx.coverageState ?? 'unknown'}`)
  console.log(`Robots.txt state:          ${idx.robotsTxtState ?? 'unknown'}`)
  console.log(`Indexing state:            ${idx.indexingState ?? 'unknown'}`)
  console.log(`Page fetch state:          ${idx.pageFetchState ?? 'unknown'}`)
  console.log(`Last crawled:              ${idx.lastCrawlTime ?? 'never'}`)
  console.log(`Crawled as:                ${idx.crawledAs ?? 'unknown'}`)
  console.log(`User-declared canonical:   ${idx.userCanonical ?? '—'}`)
  console.log(`Google-selected canonical: ${idx.googleCanonical ?? '—'}`)
  console.log()
  console.log(`Mobile usability:          ${mob.verdict ?? 'unknown'}`)
  for (const i of (mob.issues || [])) console.log(`  - ${i.issueType}: ${i.message}`)
  console.log()
  if (rich.verdict) {
    console.log(`Rich results verdict:      ${rich.verdict}`)
    for (const item of (rich.detectedItems || [])) {
      console.log(`  ${item.richResultType}: ${(item.items || []).length} item(s)`)
    }
  }
  console.log('─'.repeat(80))
  if (r.inspectionResultLink) console.log(`Full report: ${r.inspectionResultLink}`)
}

async function cmdSitemaps() {
  const auth = getAuthedClient()
  const webmasters = google.webmasters({ version: 'v3', auth })
  const { data } = await webmasters.sitemaps.list({ siteUrl: siteUrl() })
  const sitemaps = data.sitemap || []

  if (sitemaps.length === 0) {
    console.log(`No sitemaps submitted for ${siteUrl()}`)
    return
  }

  console.log(`Sitemaps for ${siteUrl()}`)
  console.log('─'.repeat(80))
  for (const sm of sitemaps) {
    console.log(`Path:             ${sm.path}`)
    console.log(`  Type:           ${sm.type ?? 'unknown'}`)
    console.log(`  Is index:       ${sm.isSitemapsIndex ?? false}`)
    console.log(`  Last submitted: ${sm.lastSubmitted ?? 'never'}`)
    console.log(`  Last downloaded:${sm.lastDownloaded ?? 'never'}`)
    console.log(`  Errors:         ${sm.errors ?? 0}`)
    console.log(`  Warnings:       ${sm.warnings ?? 0}`)
    for (const c of (sm.contents || [])) {
      console.log(`  ${c.type}: submitted=${c.submitted}, indexed=${c.indexed}`)
    }
    console.log('─'.repeat(80))
  }
}

async function cmdQueries(opts) {
  const rows = await searchAnalytics('query', opts)
  printTable(`Top queries — last ${opts.days} days`, rows, [
    { key: 'key',         header: 'QUERY',  width: 40 },
    { key: 'clicks',      header: 'CLICKS', width: 7,  align: 'right' },
    { key: 'impressions', header: 'IMPR.',  width: 8,  align: 'right' },
    { key: 'ctr',         header: 'CTR%',   width: 7,  align: 'right' },
    { key: 'position',    header: 'POS.',   width: 6,  align: 'right' },
  ])
}

async function cmdPages(opts) {
  const rows = await searchAnalytics('page', opts)
  printTable(`Top pages — last ${opts.days} days`, rows, [
    { key: 'key',         header: 'PAGE',   width: 55 },
    { key: 'clicks',      header: 'CLICKS', width: 7,  align: 'right' },
    { key: 'impressions', header: 'IMPR.',  width: 8,  align: 'right' },
    { key: 'ctr',         header: 'CTR%',   width: 7,  align: 'right' },
    { key: 'position',    header: 'POS.',   width: 6,  align: 'right' },
  ])
}

async function searchAnalytics(dimension, opts) {
  const auth = getAuthedClient()
  const wm = google.webmasters({ version: 'v3', auth })
  const { startDate, endDate } = dateRange(opts.days)
  const { data } = await wm.searchanalytics.query({
    siteUrl: siteUrl(),
    requestBody: {
      startDate, endDate,
      dimensions: [dimension],
      rowLimit: opts.limit,
    },
  })
  const rows = (data.rows || []).map(r => ({
    key: r.keys[0],
    clicks: r.clicks,
    impressions: r.impressions,
    ctr: (r.ctr * 100).toFixed(1) + '%',
    position: r.position.toFixed(1),
  }))
  rows.sort((a, b) => b.clicks - a.clicks)
  return rows
}

// ─── output ─────────────────────────────────────────────────────────────────

function printTable(title, rows, columns) {
  const totalWidth = columns.reduce((w, c) => w + c.width + 2, -2)
  const sep = '─'.repeat(totalWidth)
  console.log()
  console.log(title)
  console.log(sep)
  console.log(columns.map(c => pad(c.header, c.width, c.align)).join('  '))
  console.log(sep)
  if (rows.length === 0) {
    console.log('(no data)')
  } else {
    for (const row of rows) {
      console.log(columns.map(c => pad(String(row[c.key]), c.width, c.align)).join('  '))
    }
  }
  console.log(sep)
}

function pad(s, w, align = 'left') {
  if (s.length > w) s = s.slice(0, w - 1) + '…'
  return align === 'right' ? s.padStart(w) : s.padEnd(w)
}

// ─── dispatcher ─────────────────────────────────────────────────────────────

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

function printHelp() {
  console.log(`GSC CLI for ${process.env.GSC_SITE_URL || DEFAULT_SITE}

Commands:
  auth                              One-time OAuth — opens browser, persists refresh token
  inspect <url>                     Run URL Inspection on the given URL
  queries [--days=N] [--limit=N]    Top search queries (default: --days=28 --limit=20)
  pages   [--days=N] [--limit=N]    Top pages by clicks
  sitemaps                          List submitted sitemaps and their status

Run with --env-file=.env.local so OAuth secrets are loaded:
  node --env-file=.env.local scripts/gsc.mjs <command>

Env vars (loaded from worldwise/.env.local):
  GSC_OAUTH_CLIENT_ID       (required)
  GSC_OAUTH_CLIENT_SECRET   (required)
  GSC_REFRESH_TOKEN         (set by \`auth\` command)
  GSC_SITE_URL              (optional, default https://worldwise.pro/)
`)
}

async function main() {
  const [, , cmd, ...rest] = process.argv

  if (!cmd || cmd === 'help' || cmd === '-h' || cmd === '--help') {
    printHelp()
    return
  }

  try {
    switch (cmd) {
      case 'auth':     return await cmdAuth()
      case 'inspect':  return await cmdInspect(rest[0])
      case 'queries':  return await cmdQueries(parseOpts(rest))
      case 'pages':    return await cmdPages(parseOpts(rest))
      case 'sitemaps': return await cmdSitemaps()
      default:
        console.error(`Unknown command: ${cmd}\n`)
        printHelp()
        process.exit(1)
    }
  } catch (err) {
    const msg = err?.message || String(err)
    if (msg.includes('invalid_grant')) {
      console.error('Refresh token expired or revoked. Re-run: node --env-file=.env.local scripts/gsc.mjs auth')
      process.exit(1)
    }
    console.error(`Error: ${msg}`)
    if (process.env.DEBUG) console.error(err?.stack || err)
    process.exit(1)
  }
}

main()
