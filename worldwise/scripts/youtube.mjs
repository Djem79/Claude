#!/usr/bin/env node
// YouTube CLI for @worldwiserealestate — bulk description updates via YouTube Data API v3.
//
// Why this exists: Google blocks sign-in inside CDP-automated browsers, so the
// P2 description pass (docs/marketing/2026-07-16-youtube-geo-audit.md) cannot be
// applied through browser automation. The Data API path needs no browser at all.
//
// Auth mirrors scripts/gsc.mjs: the SAME OAuth Desktop client (GCP project
// worldwise-497520, GSC_OAUTH_CLIENT_ID/SECRET) but a SEPARATE refresh token
// (YT_REFRESH_TOKEN, scope youtube.force-ssl) — the working GSC/GA4 tokens are
// never touched. Requires "YouTube Data API v3" enabled once in that project.
//
// Commands (run from worldwise/):
//   node --env-file=.env.local scripts/youtube.mjs auth
//   node --env-file=.env.local scripts/youtube.mjs list
//   node --env-file=.env.local scripts/youtube.mjs apply --file=<driver.json> [--wave=1] [--dry-run]
//
// Driver file format: [{ id, title, wave, new_description }, ...]
// apply fetches each video's current snippet and replaces ONLY description —
// title, tags, categoryId, language fields are sent back unchanged (the API
// replaces the whole snippet, so omitting tags would silently wipe them).
// Quota: videos.list = 1 unit, videos.update = 50 units; 42 videos ≈ 2.2k of 10k/day.

import { google } from 'googleapis'
import http from 'node:http'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { execFile } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url))
const REPO_DIR = path.resolve(SCRIPT_DIR, '..')
const ENV_FILE = path.join(REPO_DIR, '.env.local')
const OAUTH_SCOPE = 'https://www.googleapis.com/auth/youtube.force-ssl'

function fail(msg) {
  console.error(`Error: ${msg}`)
  process.exit(1)
}

function getEnv(name, required = true) {
  const value = process.env[name]
  if (!value && required) fail(`Missing env var ${name}. Expected in ${ENV_FILE}.`)
  return value
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

function makeOAuthClient(redirectUri) {
  return new google.auth.OAuth2(
    getEnv('GSC_OAUTH_CLIENT_ID'),
    getEnv('GSC_OAUTH_CLIENT_SECRET'),
    redirectUri,
  )
}

function getAuthedClient() {
  const refreshToken = getEnv('YT_REFRESH_TOKEN', false)
  if (!refreshToken) {
    fail('No refresh token found. Run first: node --env-file=.env.local scripts/youtube.mjs auth')
  }
  const client = makeOAuthClient('http://127.0.0.1')
  client.setCredentials({ refresh_token: refreshToken })
  return client
}

function openInBrowser(url) {
  execFile('open', [url], (err) => {
    if (err) console.error('(could not auto-open browser — open the URL manually)')
  })
}

// ─── auth ───────────────────────────────────────────────────────────────────

async function cmdAuth() {
  const port = 8766 // gsc.mjs uses its own port; keep them distinct
  const redirectUri = `http://127.0.0.1:${port}/callback`
  const client = makeOAuthClient(redirectUri)
  const authUrl = client.generateAuthUrl({
    access_type: 'offline',
    scope: [OAUTH_SCOPE],
    prompt: 'consent', // force refresh token issuance on every auth run
  })

  const code = await new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const u = new URL(req.url, redirectUri)
      if (u.pathname !== '/callback') { res.writeHead(404).end(); return }
      const c = u.searchParams.get('code')
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end('<h2>YouTube auth OK — вернитесь в терминал.</h2>')
      server.close()
      c ? resolve(c) : reject(new Error('No code in callback'))
    })
    server.listen(port, '127.0.0.1', () => {
      console.error('Opening browser for consent (pick the CHANNEL account @worldwiserealestate):')
      console.error(authUrl)
      openInBrowser(authUrl)
    })
  })

  const { tokens } = await client.getToken(code)
  if (!tokens.refresh_token) {
    fail('No refresh_token returned. Revoke access at myaccount.google.com/permissions and re-run.')
  }
  upsertEnvVar('YT_REFRESH_TOKEN', tokens.refresh_token)
  console.log(`YT_REFRESH_TOKEN saved to ${ENV_FILE}`)
}

// ─── list ───────────────────────────────────────────────────────────────────

async function cmdList() {
  const yt = google.youtube({ version: 'v3', auth: getAuthedClient() })
  const ch = await yt.channels.list({ part: 'contentDetails,snippet', mine: true })
  const channel = ch.data.items?.[0]
  if (!channel) fail('No channel for this account — did you pick the right account during auth?')
  console.log(`Channel: ${channel.snippet.title} (${channel.id})`)
  const uploads = channel.contentDetails.relatedPlaylists.uploads
  let pageToken
  do {
    const res = await yt.playlistItems.list({ part: 'snippet', playlistId: uploads, maxResults: 50, pageToken })
    for (const it of res.data.items) {
      const s = it.snippet
      console.log(`${s.resourceId.videoId}  desc:${(s.description || '').length}ch  ${s.title}`)
    }
    pageToken = res.data.nextPageToken
  } while (pageToken)
}

// ─── apply ──────────────────────────────────────────────────────────────────

async function cmdApply(args) {
  const fileArg = args.find((a) => a.startsWith('--file='))?.slice(7)
  if (!fileArg) fail('Usage: apply --file=<driver.json> [--wave=N] [--dry-run]')
  const wave = args.find((a) => a.startsWith('--wave='))?.slice(7)
  const dryRun = args.includes('--dry-run')

  let items = JSON.parse(readFileSync(fileArg, 'utf8'))
  const bad = items.filter((it) => !it.id || typeof it.new_description !== 'string' || !it.new_description.trim())
  if (bad.length) fail(`Driver file has ${bad.length} item(s) without id/new_description — refusing (would wipe descriptions)`)
  if (wave) items = items.filter((it) => String(it.wave) === wave)
  if (!items.length) fail('Nothing to apply (check --wave filter)')
  console.log(`${dryRun ? 'DRY-RUN' : 'APPLY'}: ${items.length} video(s)${wave ? ` (wave ${wave})` : ''}`)

  const yt = google.youtube({ version: 'v3', auth: getAuthedClient() })

  // Fetch current snippets in batches of 50 (1 quota unit per call).
  const byId = new Map()
  for (let i = 0; i < items.length; i += 50) {
    const ids = items.slice(i, i + 50).map((it) => it.id)
    const res = await yt.videos.list({ part: 'snippet', id: ids.join(',') })
    for (const v of res.data.items) byId.set(v.id, v.snippet)
  }

  let ok = 0, skipped = 0, failed = 0
  for (const it of items) {
    const snippet = byId.get(it.id)
    if (!snippet) {
      console.error(`SKIP ${it.id} — not found via API (wrong channel account?)`)
      skipped++
      continue
    }
    if ((snippet.description || '') === it.new_description) {
      console.log(`SKIP ${it.id} — already up to date`)
      skipped++
      continue
    }
    if (dryRun) {
      console.log(`WOULD UPDATE ${it.id} (${snippet.title}) desc ${(snippet.description || '').length} -> ${it.new_description.length}ch`)
      ok++
      continue
    }
    try {
      // Send the WHOLE current snippet back with only description replaced —
      // update replaces the snippet, so dropping fields would wipe tags etc.
      const res = await yt.videos.update({
        part: 'snippet',
        requestBody: { id: it.id, snippet: { ...snippet, description: it.new_description } },
      })
      const got = res.data.snippet.description
      if (got === it.new_description) {
        console.log(`OK ${it.id} (${snippet.title})`)
        ok++
      } else {
        console.error(`VERIFY-MISMATCH ${it.id} — API accepted but returned different text`)
        failed++
      }
    } catch (e) {
      console.error(`FAIL ${it.id} — ${e.message}`)
      failed++
    }
  }
  console.log(`\nDone: ${ok} ${dryRun ? 'would update' : 'updated'}, ${skipped} skipped, ${failed} failed`)
  if (failed) process.exit(1)
}

// ─── main ───────────────────────────────────────────────────────────────────

const [cmd, ...rest] = process.argv.slice(2)
switch (cmd) {
  case 'auth': await cmdAuth(); break
  case 'list': await cmdList(); break
  case 'apply': await cmdApply(rest); break
  default:
    console.log(`Usage (from worldwise/):
  node --env-file=.env.local scripts/youtube.mjs auth
  node --env-file=.env.local scripts/youtube.mjs list
  node --env-file=.env.local scripts/youtube.mjs apply --file=<driver.json> [--wave=N] [--dry-run]`)
}
