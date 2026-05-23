#!/usr/bin/env node
// Weekly SEO audit — runs from cron on the server.
// Sends a single Telegram message with the result (or prints to stdout when
// SEO_AUDIT_DRY_RUN=1 or no Telegram token is set).

import fs from 'node:fs'
import path from 'node:path'
import tls from 'node:tls'

const SITE = process.env.SEO_AUDIT_SITE ?? 'https://worldwise.pro'
const HOST = new URL(SITE).hostname

const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TG_CHAT_ID = (process.env.TELEGRAM_CHAT_ID ?? '').split(',')[0].trim()
const DRY = process.env.SEO_AUDIT_DRY_RUN === '1' || !TG_TOKEN || !TG_CHAT_ID

const ARTICLES_FILE = path.join(process.cwd(), 'data', 'articles.json')

const URLS = ['/', '/properties', '/blog', '/mortgage-calculator', '/sitemap.xml', '/robots.txt', '/llms.txt']

const SSL_WARN_DAYS = 14
const AUTO_BLOG_WARN_DAYS = 7

// --- helpers ----------------------------------------------------------------

async function httpGet(urlPath, { method = 'GET' } = {}) {
  const url = SITE + urlPath
  const res = await fetch(url, { method, signal: AbortSignal.timeout(15000), redirect: 'manual' })
  // We treat 3xx on /robots.txt etc. as a problem; the site shouldn't redirect those.
  const text = method === 'GET' && res.ok ? await res.text() : ''
  return { status: res.status, text, url }
}

// --- 1. URL reachability ----------------------------------------------------

async function checkUrls() {
  const results = await Promise.all(URLS.map(async p => {
    try {
      const r = await httpGet(p, { method: 'HEAD' })
      return { path: p, status: r.status, ok: r.status === 200 }
    } catch (e) {
      return { path: p, status: 0, ok: false, error: e.message }
    }
  }))
  const failed = results.filter(r => !r.ok)
  return {
    ok: failed.length === 0,
    summary: failed.length === 0
      ? `${URLS.length}/${URLS.length} 200 OK`
      : `${failed.length} failed: ${failed.map(f => `${f.path} → ${f.status || f.error}`).join(', ')}`,
  }
}

// --- 2. robots.txt clean (no Cloudflare AI managed block) -------------------

async function checkRobots() {
  try {
    const { text } = await httpGet('/robots.txt')
    const hasCfManaged = /BEGIN Cloudflare Managed content/i.test(text)
    const hasAiBlock = /(GPTBot|ClaudeBot|Google-Extended|CCBot|Bytespider)[\s\S]{0,40}Disallow:\s*\//i.test(text)
    if (hasCfManaged || hasAiBlock) {
      return { ok: false, summary: 'Cloudflare AI-block reappeared in robots.txt' }
    }
    return { ok: true, summary: 'clean (no AI block, no Cloudflare-managed overlay)' }
  } catch (e) {
    return { ok: false, summary: `fetch error: ${e.message}` }
  }
}

// --- 3. SSL days-to-expiry via TLS handshake --------------------------------

function checkSsl() {
  return new Promise(resolve => {
    const socket = tls.connect({ host: HOST, port: 443, servername: HOST, timeout: 10000 }, () => {
      const cert = socket.getPeerCertificate()
      socket.end()
      if (!cert || !cert.valid_to) {
        resolve({ ok: false, summary: 'no certificate info' })
        return
      }
      const days = Math.floor((new Date(cert.valid_to).getTime() - Date.now()) / 86400000)
      resolve({
        ok: days >= SSL_WARN_DAYS,
        summary: days >= SSL_WARN_DAYS
          ? `${days} days left`
          : `${days} days left — renew soon (certbot)`,
        days,
      })
    })
    socket.on('error', e => resolve({ ok: false, summary: `TLS error: ${e.message}` }))
    socket.on('timeout', () => { socket.destroy(); resolve({ ok: false, summary: 'TLS timeout' }) })
  })
}

// --- 4. sitemap.xml: parses, has URLs, has fresh lastmod --------------------

async function checkSitemap() {
  try {
    const { text } = await httpGet('/sitemap.xml')
    const urlCount = (text.match(/<url>/g) ?? []).length
    if (urlCount === 0) return { ok: false, summary: 'no <url> entries' }
    const lastmods = [...text.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)]
      .map(m => new Date(m[1]).getTime())
      .filter(t => Number.isFinite(t))
    const newest = lastmods.length ? Math.max(...lastmods) : 0
    const hoursAgo = newest ? Math.round((Date.now() - newest) / 3600000) : null
    return {
      ok: true,
      summary: `${urlCount} URLs${hoursAgo !== null ? `, freshest lastmod ${formatAge(hoursAgo)}` : ''}`,
    }
  } catch (e) {
    return { ok: false, summary: `fetch error: ${e.message}` }
  }
}

// --- 5. Homepage title + meta description -----------------------------------

async function checkHomepageMeta() {
  try {
    const { text } = await httpGet('/')
    const title = (text.match(/<title>([^<]+)<\/title>/i)?.[1] ?? '').trim()
    const desc = (text.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i)?.[1] ?? '').trim()
    const issues = []
    if (!title) issues.push('title missing')
    else if (title.length < 10) issues.push(`title too short (${title.length})`)
    if (!desc) issues.push('meta description missing')
    else if (desc.length < 50) issues.push(`description too short (${desc.length})`)
    return issues.length
      ? { ok: false, summary: issues.join('; ') }
      : { ok: true, summary: `title ${title.length}c, description ${desc.length}c` }
  } catch (e) {
    return { ok: false, summary: `fetch error: ${e.message}` }
  }
}

// --- 6. JSON-LD on homepage -------------------------------------------------

async function checkHomepageJsonLd() {
  try {
    const { text } = await httpGet('/')
    const scripts = [...text.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
    if (scripts.length === 0) return { ok: false, summary: 'no JSON-LD found' }
    const types = []
    for (const s of scripts) {
      try {
        const data = JSON.parse(s[1].trim())
        const t = data['@type'] ?? data['@graph']?.[0]?.['@type']
        if (t) types.push(Array.isArray(t) ? t.join('/') : t)
      } catch { /* malformed JSON-LD */ return { ok: false, summary: 'malformed JSON-LD' } }
    }
    return { ok: true, summary: `${scripts.length} block(s): ${types.join(', ') || '(types not found)'}` }
  } catch (e) {
    return { ok: false, summary: `fetch error: ${e.message}` }
  }
}

// --- 7. auto-blog freshness (reads data/articles.json) ----------------------

function checkAutoBlog() {
  try {
    if (!fs.existsSync(ARTICLES_FILE)) {
      return { ok: false, summary: `${ARTICLES_FILE} not found` }
    }
    const articles = JSON.parse(fs.readFileSync(ARTICLES_FILE, 'utf-8'))
    if (!Array.isArray(articles) || articles.length === 0) {
      return { ok: false, summary: 'articles.json empty' }
    }
    const dates = articles.map(a => new Date(a.publishedAt).getTime()).filter(Number.isFinite)
    if (dates.length === 0) return { ok: false, summary: 'no publishedAt timestamps' }
    const newest = Math.max(...dates)
    const days = Math.floor((Date.now() - newest) / 86400000)
    return {
      ok: days < AUTO_BLOG_WARN_DAYS,
      summary: days < AUTO_BLOG_WARN_DAYS
        ? `latest ${days}d ago (${articles.length} total)`
        : `latest ${days}d ago — cron broken?`,
    }
  } catch (e) {
    return { ok: false, summary: `read error: ${e.message}` }
  }
}

// --- formatting -------------------------------------------------------------

function formatAge(hours) {
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

function buildReport(checks) {
  const failed = checks.filter(c => !c.result.ok)
  const today = new Date().toISOString().slice(0, 10)
  const header = failed.length === 0
    ? `🔍 SEO Audit · ${today}\n✅ All checks passed (${checks.length}/${checks.length})`
    : `⚠️ SEO Audit · ${today} · ${failed.length}/${checks.length} failed`

  // When everything is OK we still show concise lines (one per check).
  // When something failed, show failures first, then the OK lines compressed.
  const lines = []
  if (failed.length === 0) {
    for (const c of checks) lines.push(`  · ${c.label}: ${c.result.summary}`)
  } else {
    for (const c of failed) lines.push(`❌ ${c.label}: ${c.result.summary}`)
    const passed = checks.filter(c => c.result.ok)
    if (passed.length) lines.push('', `✅ OK: ${passed.map(c => c.label).join(', ')}`)
  }
  return [header, ...lines].join('\n')
}

async function sendTelegram(text) {
  const res = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TG_CHAT_ID, text }),
    signal: AbortSignal.timeout(10000),
  })
  if (!res.ok) throw new Error(`Telegram ${res.status}: ${await res.text()}`)
}

// --- main -------------------------------------------------------------------

async function main() {
  const checks = [
    { label: 'URLs',        result: await checkUrls() },
    { label: 'robots.txt',  result: await checkRobots() },
    { label: 'SSL',         result: await checkSsl() },
    { label: 'sitemap',     result: await checkSitemap() },
    { label: 'title/meta',  result: await checkHomepageMeta() },
    { label: 'JSON-LD',     result: await checkHomepageJsonLd() },
    { label: 'auto-blog',   result: checkAutoBlog() },
  ]

  const text = buildReport(checks)

  if (DRY) {
    console.log('[DRY RUN — not sent]')
    console.log(text)
    return
  }

  await sendTelegram(text)
  console.log('Sent to Telegram:')
  console.log(text)
}

main().catch(err => {
  // Last-resort: try to notify failure too, but never crash the cron silently.
  console.error('SEO audit failed:', err)
  if (!DRY) {
    sendTelegram(`⚠️ SEO Audit crashed: ${err.message}`).catch(() => {})
  }
  process.exit(1)
})
