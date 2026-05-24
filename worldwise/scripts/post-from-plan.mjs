import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const DATA_DIR = path.join(ROOT, 'data')
const PLAN_PATH = path.join(DATA_DIR, 'content-plan-june-2026.json')
const PLAN_DRAFT_PATH = path.join(DATA_DIR, 'plan-draft.json')
const BLOG_IMG_DIR = path.join(ROOT, 'public', 'images', 'blog')
const IMAGE_MODEL = 'gemini-2.5-flash-image'
const LOCAL_APP = 'http://localhost:3000'

const GEMINI_KEY = process.env.GEMINI_API_KEY
const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TG_CHAT_ID = (process.env.TELEGRAM_CHAT_ID ?? '').split(',')[0].trim()
const TG_CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`)
}

function writeFileAtomic(filePath, contents) {
  const tmp = `${filePath}.${process.pid}.tmp`
  fs.writeFileSync(tmp, contents, 'utf-8')
  fs.renameSync(tmp, filePath)
}

function sanitizeSlug(raw) {
  return String(raw || '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/-{2,}/g, '-').replace(/^-+|-+$/g, '').slice(0, 80).replace(/-+$/g, '')
}

function todayStr() {
  // Dubai is UTC+4 — use local wall-clock date rather than UTC
  const now = new Date(Date.now() + 4 * 60 * 60 * 1000)
  return now.toISOString().slice(0, 10)
}

function loadPlan() {
  return JSON.parse(fs.readFileSync(PLAN_PATH, 'utf-8'))
}

function markSent(plan, index) {
  plan.posts[index].sent = true
  writeFileAtomic(PLAN_PATH, JSON.stringify(plan, null, 2))
}

async function generateRawImage(slug, imagePrompt) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${IMAGE_MODEL}:generateContent?key=${GEMINI_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: imagePrompt }] }] }),
      signal: AbortSignal.timeout(60000),
    },
  )
  if (!res.ok) throw new Error(`image ${res.status}: ${(await res.text()).slice(0, 160)}`)
  const j = await res.json()
  const part = (j.candidates?.[0]?.content?.parts || []).find(p => p.inlineData)
  if (!part) throw new Error('no inlineData in image response')
  if (!fs.existsSync(BLOG_IMG_DIR)) fs.mkdirSync(BLOG_IMG_DIR, { recursive: true })
  fs.writeFileSync(path.join(BLOG_IMG_DIR, `${slug}-raw.png`), Buffer.from(part.inlineData.data, 'base64'))
}

function cardUrl(slug, title, tag) {
  return `/api/blog-image?slug=${encodeURIComponent(slug)}&title=${encodeURIComponent(title)}&tag=${encodeURIComponent(tag)}`
}

async function sendPollToChannel(post) {
  const body = {
    chat_id: TG_CHANNEL_ID,
    question: post.text,
    options: post.poll_options.map(o => ({ text: o })),
    is_anonymous: true,
  }
  const res = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendPoll`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  })
  if (!res.ok) throw new Error(`sendPoll ${res.status}: ${await res.text()}`)
}

async function sendAdminPreview(post, imagePath) {
  const preview = post.text.slice(0, 300)
  const text = [
    '📅 Плановый пост готов к публикации',
    `📆 ${post.date} · ${post.day}`,
    `🏷 ${post.tag ?? post.type}`,
    `📌 ${post.title}`,
    '',
    preview + (post.text.length > 300 ? '...' : ''),
    '',
    'Опубликовать в канал или пропустить?',
  ].join('\n')

  const keyboard = [[
    { text: '✅ Опубликовать', callback_data: 'publish_plan' },
    { text: '❌ Пропустить', callback_data: 'skip_plan' },
  ]]

  if (imagePath) {
    try {
      const r = await fetch(LOCAL_APP + imagePath, { signal: AbortSignal.timeout(20000) })
      if (r.ok) {
        const buf = Buffer.from(await r.arrayBuffer())
        const fd = new FormData()
        fd.append('chat_id', TG_CHAT_ID)
        fd.append('caption', text.slice(0, 1024))
        fd.append('reply_markup', JSON.stringify({ inline_keyboard: keyboard }))
        fd.append('photo', new Blob([buf]), `${post.slug}.png`)
        const res = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendPhoto`, {
          method: 'POST', body: fd, signal: AbortSignal.timeout(20000),
        })
        if (res.ok) return
        log(`sendPhoto failed (${res.status}), falling back to text`)
      }
    } catch (e) {
      log(`approval photo failed: ${e.message}`)
    }
  }

  const res = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TG_CHAT_ID, text, reply_markup: { inline_keyboard: keyboard } }),
    signal: AbortSignal.timeout(10000),
  })
  if (!res.ok) throw new Error(`sendMessage ${res.status}: ${await res.text()}`)
}

async function main() {
  log('Starting post-from-plan')

  if (!GEMINI_KEY) { log('ERROR: Missing GEMINI_API_KEY'); process.exit(1) }
  if (!TG_TOKEN || !TG_CHAT_ID) { log('ERROR: Missing Telegram config'); process.exit(1) }
  if (!TG_CHANNEL_ID) { log('ERROR: Missing TELEGRAM_CHANNEL_ID'); process.exit(1) }

  const today = todayStr()
  log(`Today (Dubai): ${today}`)

  const plan = loadPlan()
  const index = plan.posts.findIndex(p => p.date === today && !p.sent)
  if (index === -1) {
    log(`No unsent post scheduled for ${today}`)
    process.exit(0)
  }

  const post = { ...plan.posts[index] }
  log(`Post: "${post.title}" (${post.type})`)

  // Polls go straight to channel — no approval step needed
  if (post.type === 'poll') {
    await sendPollToChannel(post)
    log('Poll sent to channel')
    markSent(plan, index)
    log('Marked as sent')
    return
  }

  // Build a stable slug for image naming
  post.slug = sanitizeSlug(post.title)

  // Generate image: raw AI photo → branded card
  let imagePath = null
  if (post.imagePrompt) {
    try {
      await generateRawImage(post.slug, post.imagePrompt)
      const u = cardUrl(post.slug, post.title, post.tag ?? 'Market Update')
      const probe = await fetch(LOCAL_APP + u, { signal: AbortSignal.timeout(30000) })
      if (!probe.ok) throw new Error(`card render ${probe.status}`)
      imagePath = u
      post.image = u
      log(`Image ready: ${imagePath}`)
    } catch (e) {
      log(`Image step failed (continuing without image): ${e.message}`)
    }
  }
  delete post.imagePrompt

  // Save draft so the webhook callback can publish it when admin taps ✅
  writeFileAtomic(PLAN_DRAFT_PATH, JSON.stringify(post, null, 2))
  log('Plan draft saved')

  await sendAdminPreview(post, imagePath)
  log('Admin preview sent — waiting for approval')

  markSent(plan, index)
  log('Marked as sent (prevents re-send on next cron run)')
}

main().catch(e => { log(`FATAL: ${e.message}`); process.exit(1) })
