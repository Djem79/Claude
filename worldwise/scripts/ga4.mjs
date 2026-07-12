#!/usr/bin/env node
// GA4 Data API CLI — the on-site half of the picture.
//
// GSC ends at the click, the CRM starts at the lead; what happens in between was
// dark. This reads GA4 (already installed site-wide with Consent Mode v2, so it
// sees every visitor, not just the ones who accept cookies) and answers the only
// question that matters for lead-gen: where do we lose people on the way to a form?
//
// Auth: OAuth 2.0 Desktop client — the SAME GCP client as gsc.mjs
// (GSC_OAUTH_CLIENT_ID/SECRET, project worldwise-497520), but a SEPARATE refresh
// token (GA4_REFRESH_TOKEN) minted with the analytics.readonly scope. The working
// GSC token is never touched.
//
// One-time setup:
//   1. Enable "Google Analytics Data API" in GCP project worldwise-497520:
//      https://console.cloud.google.com/apis/library/analyticsdata.googleapis.com
//   2. node --env-file=.env.local scripts/ga4.mjs auth      (browser consent)
//
// Commands (from worldwise/):
//   node --env-file=.env.local scripts/ga4.mjs overview [--days=N]
//   node --env-file=.env.local scripts/ga4.mjs sources  [--days=N]
//   node --env-file=.env.local scripts/ga4.mjs pages    [--days=N] [--limit=N]
//   node --env-file=.env.local scripts/ga4.mjs funnel   [--days=N]   ← the lead-gen report
//   node --env-file=.env.local scripts/ga4.mjs events   [--days=N]

import { google } from 'googleapis'
import http from 'node:http'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { execFile } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url))
const REPO_DIR = path.join(SCRIPT_DIR, '..')
const ENV_FILE = path.join(REPO_DIR, '.env.local')
const OAUTH_SCOPE = 'https://www.googleapis.com/auth/analytics.readonly'

// The lead-capture events the site already fires (lib/analytics.ts).
const LEAD_EVENTS = ['lead_form_submit', 'whatsapp_click']
const INTENT_EVENTS = ['property_view']

// ─── env / util ─────────────────────────────────────────────────────────────

function fail(msg) {
  console.error(`Error: ${msg}`)
  process.exit(1)
}

function getEnv(name, required = true) {
  const value = process.env[name]
  if (!value && required) fail(`Missing env var ${name}. Expected in ${ENV_FILE}.`)
  return value
}

/** Upsert KEY=value into .env.local (idempotent). */
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

function propertyId() {
  return `properties/${getEnv('GA4_PROPERTY_ID')}`
}

function dateRange(days = 28) {
  const end = new Date()
  const start = new Date(end.getTime() - days * 86400000)
  const iso = d => d.toISOString().slice(0, 10)
  return { startDate: iso(start), endDate: iso(end) }
}

function parseOpts(argv) {
  const opts = { days: 28, limit: 20 }
  for (const a of argv) {
    const m = a.match(/^--(days|limit)=(\d+)$/)
    if (m) opts[m[1]] = Number(m[2])
  }
  return opts
}

// ─── OAuth (mirrors gsc.mjs; separate token so GSC is never disturbed) ───────

function makeOAuthClient(redirectUri) {
  return new google.auth.OAuth2(
    getEnv('GSC_OAUTH_CLIENT_ID'),
    getEnv('GSC_OAUTH_CLIENT_SECRET'),
    redirectUri,
  )
}

function getAuthedClient() {
  const client = makeOAuthClient()
  const refreshToken = process.env.GA4_REFRESH_TOKEN
  if (!refreshToken) {
    fail('No GA4 refresh token. Run first: node --env-file=.env.local scripts/ga4.mjs auth')
  }
  client.setCredentials({ refresh_token: refreshToken })
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

async function cmdAuth() {
  const port = await getFreePort()
  const redirectUri = `http://127.0.0.1:${port}/callback`
  const client = makeOAuthClient(redirectUri)

  const authUrl = client.generateAuthUrl({
    access_type: 'offline',
    scope: [OAUTH_SCOPE],
    prompt: 'consent', // force a refresh token on every auth run
  })

  const codePromise = new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, `http://127.0.0.1:${port}`)
      if (url.pathname !== '/callback') { res.writeHead(404); res.end('Not found'); return }
      const errParam = url.searchParams.get('error')
      if (errParam) {
        res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(`<h1>Auth failed</h1><p>${errParam}</p>`)
        server.close(); reject(new Error(`OAuth error: ${errParam}`)); return
      }
      const code = url.searchParams.get('code')
      if (!code) {
        res.writeHead(400); res.end('Missing code')
        server.close(); reject(new Error('No code in callback')); return
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end('<h1>Auth complete</h1><p>You can close this tab.</p>')
      server.close(); resolve(code)
    })
    server.on('error', reject)
    server.listen(port, '127.0.0.1')
  })

  console.error('Opening browser for GA4 OAuth consent…')
  console.error('If it does not open, paste this URL manually:')
  console.error(authUrl + '\n')
  execFile('open', [authUrl])

  const code = await codePromise
  const { tokens } = await client.getToken(code)
  if (!tokens.refresh_token) {
    fail('No refresh_token returned. Revoke at myaccount.google.com/permissions and re-run.')
  }
  upsertEnvVar('GA4_REFRESH_TOKEN', tokens.refresh_token)
  console.log('✓ GA4_REFRESH_TOKEN saved to .env.local')
  console.log('  Now set GA4_PROPERTY_ID too (numeric property id, not the G-XXXX measurement id).')
}

// ─── Data API ───────────────────────────────────────────────────────────────

async function runReport({ dimensions = [], metrics, days, limit = 50, orderBy }) {
  const auth = getAuthedClient()
  const data = google.analyticsdata({ version: 'v1beta', auth })
  const { startDate, endDate } = dateRange(days)
  const { data: res } = await data.properties.runReport({
    property: propertyId(),
    requestBody: {
      dateRanges: [{ startDate, endDate }],
      dimensions: dimensions.map(name => ({ name })),
      metrics: metrics.map(name => ({ name })),
      limit,
      ...(orderBy ? { orderBys: [orderBy] } : {}),
    },
  })
  return (res.rows || []).map(r => ({
    keys: (r.dimensionValues || []).map(d => d.value),
    values: (r.metricValues || []).map(m => m.value),
  }))
}

const num = v => Number(v || 0)
const pct = (a, b) => (b > 0 ? `${((a / b) * 100).toFixed(1)}%` : '—')

function table(title, headers, rows) {
  console.log(`\n${title}`)
  console.log('─'.repeat(84))
  console.log(headers.map((h, i) => (i === 0 ? h.padEnd(46) : h.padStart(11))).join(''))
  console.log('─'.repeat(84))
  for (const r of rows) {
    console.log(r.map((c, i) => (i === 0 ? String(c).slice(0, 45).padEnd(46) : String(c).padStart(11))).join(''))
  }
  console.log('─'.repeat(84))
}

// ─── commands ───────────────────────────────────────────────────────────────

async function cmdOverview(opts) {
  const rows = await runReport({
    metrics: ['sessions', 'totalUsers', 'newUsers', 'engagedSessions', 'screenPageViews'],
    days: opts.days,
  })
  // A property with no data returns ZERO rows — default every metric so the
  // report prints honest zeros instead of "undefined".
  const v = rows[0]?.values ?? []
  const [sessions = 0, users = 0, newUsers = 0, engaged = 0, views = 0] = v.map(num)
  console.log(`\nGA4 overview — last ${opts.days} days`)
  console.log('─'.repeat(50))
  console.log(`  Users               ${users}   (new: ${newUsers})`)
  console.log(`  Sessions            ${sessions}`)
  console.log(`  Engaged sessions    ${engaged}   (${pct(engaged, sessions)} of sessions)`)
  console.log(`  Page views          ${views}`)
  console.log('─'.repeat(50))
  if (sessions === 0) {
    console.log('  ⚠ Zero sessions — check GA4_PROPERTY_ID, or the property genuinely has no data.')
  }
}

async function cmdSources(opts) {
  const rows = await runReport({
    dimensions: ['sessionDefaultChannelGroup'],
    metrics: ['sessions', 'engagedSessions'],
    days: opts.days,
    orderBy: { metric: { metricName: 'sessions' }, desc: true },
  })
  table(
    `Traffic by channel — last ${opts.days} days`,
    ['CHANNEL', 'SESSIONS', 'ENGAGED', 'ENG.RATE'],
    rows.map(r => {
      const [s, e] = r.values.map(num)
      return [r.keys[0], s, e, pct(e, s)]
    }),
  )
}

async function cmdPages(opts) {
  const rows = await runReport({
    dimensions: ['landingPagePlusQueryString'],
    metrics: ['sessions', 'engagedSessions'],
    days: opts.days,
    limit: opts.limit,
    orderBy: { metric: { metricName: 'sessions' }, desc: true },
  })
  table(
    `Landing pages — last ${opts.days} days`,
    ['LANDING PAGE', 'SESSIONS', 'ENGAGED', 'ENG.RATE'],
    rows.map(r => {
      const [s, e] = r.values.map(num)
      return [r.keys[0], s, e, pct(e, s)]
    }),
  )
}

async function cmdEvents(opts) {
  const rows = await runReport({
    dimensions: ['eventName'],
    metrics: ['eventCount'],
    days: opts.days,
    limit: 50,
    orderBy: { metric: { metricName: 'eventCount' }, desc: true },
  })
  table(
    `Events — last ${opts.days} days`,
    ['EVENT', 'COUNT'],
    rows.map(r => [r.keys[0], num(r.values[0])]),
  )
}

/**
 * The lead-gen funnel: how many visitors arrive, how many show buying intent
 * (property_view), and how many actually reach out (form / WhatsApp).
 * Drop-off between the steps is where clients are being lost.
 */
async function cmdFunnel(opts) {
  const [sessionRows, eventRows] = await Promise.all([
    runReport({ metrics: ['sessions', 'totalUsers'], days: opts.days }),
    runReport({
      dimensions: ['eventName'],
      metrics: ['eventCount'],
      days: opts.days,
      limit: 100,
    }),
  ])

  const sessions = num(sessionRows[0]?.values[0])
  const counts = new Map(eventRows.map(r => [r.keys[0], num(r.values[0])]))
  const intent = INTENT_EVENTS.reduce((s, e) => s + (counts.get(e) ?? 0), 0)
  const leads = LEAD_EVENTS.reduce((s, e) => s + (counts.get(e) ?? 0), 0)

  console.log(`\nLead funnel — last ${opts.days} days`)
  console.log('─'.repeat(62))
  console.log(`  1. Sessions on site           ${String(sessions).padStart(6)}`)
  console.log(`  2. Property views (intent)    ${String(intent).padStart(6)}   ${pct(intent, sessions)} of sessions`)
  console.log(`  3. Reached out (form/WA)      ${String(leads).padStart(6)}   ${pct(leads, sessions)} of sessions`)
  console.log('─'.repeat(62))
  for (const e of [...INTENT_EVENTS, ...LEAD_EVENTS]) {
    console.log(`     ${e.padEnd(24)} ${String(counts.get(e) ?? 0).padStart(6)}`)
  }
  console.log('─'.repeat(62))
  if (sessions > 0 && leads === 0) {
    console.log('  → Traffic arrives but nobody reaches out. The loss is ON the page,')
    console.log('    not in search: check what the top landing pages offer (ga4.mjs pages).')
  }
}

// ─── main ───────────────────────────────────────────────────────────────────

const [cmd, ...rest] = process.argv.slice(2)
const opts = parseOpts(rest)

const commands = {
  auth: cmdAuth,
  overview: cmdOverview,
  sources: cmdSources,
  pages: cmdPages,
  events: cmdEvents,
  funnel: cmdFunnel,
}

if (!cmd || !commands[cmd]) {
  console.error('Usage: ga4.mjs <auth|overview|sources|pages|events|funnel> [--days=N] [--limit=N]')
  process.exit(1)
}

commands[cmd](opts).catch(e => {
  const msg = e?.response?.data?.error?.message || e.message
  if (/Analytics Data API has not been used|is disabled/i.test(msg)) {
    fail(
      `${msg}\n\nEnable it once here, then retry:\n` +
      '  https://console.cloud.google.com/apis/library/analyticsdata.googleapis.com',
    )
  }
  fail(msg)
})
