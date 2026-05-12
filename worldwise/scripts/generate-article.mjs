import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const DATA_DIR = path.join(ROOT, 'data')
const DRAFT_PATH = path.join(DATA_DIR, 'article-draft.json')
const TAG_INDEX_PATH = path.join(DATA_DIR, 'article-tag-index.json')
const KEYWORDS_PATH = path.join(DATA_DIR, 'article-keywords.json')
const MODE_PATH = path.join(DATA_DIR, 'article-mode.json')

const TAGS = ['Market Update', 'Investment Guide', 'Area Spotlight', 'Legal Guide', 'Visa & Residency']

const RSS_FEEDS = [
  'https://news.google.com/rss/search?q=UAE+real+estate+property+Dubai&hl=en-US&gl=US&ceid=US:en',
  'https://news.google.com/rss/search?q=Dubai+property+market+investment+2026&hl=en-US&gl=US&ceid=US:en',
]

const GEMINI_KEY = process.env.GEMINI_API_KEY
const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TG_CHAT_ID = (process.env.TELEGRAM_CHAT_ID ?? '').split(',')[0].trim()

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`)
}

async function fetchRss(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
    if (!res.ok) return []
    const text = await res.text()
    const items = []
    const re = /<item>([\s\S]*?)<\/item>/g
    let m
    while ((m = re.exec(text)) !== null && items.length < 5) {
      const block = m[1]
      const title = (
        block.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/s)?.[1] ||
        block.match(/<title>(.*?)<\/title>/s)?.[1] ||
        ''
      ).trim()
      const desc = (
        block.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/s)?.[1] ||
        block.match(/<description>(.*?)<\/description>/s)?.[1] ||
        ''
      ).replace(/<[^>]+>/g, '').trim().slice(0, 200)
      if (title) items.push(desc ? `${title}: ${desc}` : title)
    }
    return items
  } catch (e) {
    log(`RSS fetch failed for ${url}: ${e.message}`)
    return []
  }
}

// Tag index format must stay in sync with lib/dynamic-articles.ts
function getTagIndex() {
  try {
    if (!fs.existsSync(TAG_INDEX_PATH)) return 0
    return JSON.parse(fs.readFileSync(TAG_INDEX_PATH, 'utf-8')).index ?? 0
  } catch { return 0 }
}

function incrementTagIndex(current) {
  fs.writeFileSync(TAG_INDEX_PATH, JSON.stringify({ index: (current + 1) % TAGS.length }), 'utf-8')
}

function getMode() {
  try {
    if (!fs.existsSync(MODE_PATH)) return 'keyword'
    return JSON.parse(fs.readFileSync(MODE_PATH, 'utf-8')).mode ?? 'keyword'
  } catch { return 'keyword' }
}

function setMode(mode) {
  fs.writeFileSync(MODE_PATH, JSON.stringify({ mode }), 'utf-8')
}

function getKeywords() {
  try {
    if (!fs.existsSync(KEYWORDS_PATH)) return { keywords: [], index: 0 }
    return JSON.parse(fs.readFileSync(KEYWORDS_PATH, 'utf-8'))
  } catch { return { keywords: [], index: 0 } }
}

function incrementKeywordIndex(currentIndex) {
  const data = getKeywords()
  data.index = currentIndex + 1
  fs.writeFileSync(KEYWORDS_PATH, JSON.stringify(data, null, 2), 'utf-8')
}

async function generateArticle(tag, headlines, keyword) {
  const prompt = keyword
    ? `A potential investor just searched Google for: "${keyword}"

Write a 600–800 word SEO article that directly and thoroughly answers this question for international property investors.

Use these recent UAE market headlines as supporting context to make the article timely:
${headlines.map((h, i) => `${i + 1}. ${h}`).join('\n')}

Return ONLY a valid JSON object with these exact fields (no markdown wrapper):
{
  "title": "Article title (max 70 chars, SEO-optimised)",
  "slug": "url-slug-kebab-case-no-special-chars",
  "tag": "${tag}",
  "excerpt": "2-3 sentence summary (max 200 chars)",
  "readTime": "X min read",
  "content": "Full article in markdown: use ## for h2 headings, ### for h3, - for bullet lists, plain paragraphs otherwise. End with a paragraph inviting readers to contact Worldwise Real Estate for a free consultation."
}`
    : `Write a 600–800 word SEO article about UAE real estate for international investors.
Use these recent news headlines as context:
${headlines.map((h, i) => `${i + 1}. ${h}`).join('\n')}

Return ONLY a valid JSON object with these exact fields (no markdown wrapper):
{
  "title": "Article title (max 70 chars, SEO-optimised)",
  "slug": "url-slug-kebab-case-no-special-chars",
  "tag": "${tag}",
  "excerpt": "2-3 sentence summary (max 200 chars)",
  "readTime": "X min read",
  "content": "Full article in markdown: use ## for h2 headings, ### for h3, - for bullet lists, plain paragraphs otherwise. End with a paragraph inviting readers to contact Worldwise Real Estate for a free consultation."
}`

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: {
          parts: [{
            text: 'You are a UAE real estate expert writing SEO blog articles for Worldwise Real Estate, a Dubai-based agency serving international investors. Write in English. Be informative and factual. Do not invent statistics — use only what is grounded in the news context provided.',
          }],
        },
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 8192, thinkingConfig: { thinkingBudget: 0 } },
      }),
      signal: AbortSignal.timeout(30000),
    }
  )

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Gemini ${res.status}: ${err.slice(0, 200)}`)
  }

  const data = await res.json()
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''

  let jsonStr = raw.trim()
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '')
  }
  if (!jsonStr.startsWith('{')) {
    const m = jsonStr.match(/\{[\s\S]*\}/)
    if (m) jsonStr = m[0]
  }
  return JSON.parse(jsonStr.trim())
}

async function sendTelegramMessage(text, inlineKeyboard) {
  const body = { chat_id: TG_CHAT_ID, text }
  if (inlineKeyboard) body.reply_markup = { inline_keyboard: inlineKeyboard }
  const res = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  })
  if (!res.ok) throw new Error(`Telegram ${res.status}: ${await res.text()}`)
}

async function sendTelegram(article, keyword) {
  const preview = article.content.replace(/#{1,3} /g, '').slice(0, 400)
  const sourceLine = keyword ? `🔑 Keyword: "${keyword}"` : '📡 Source: Google News'
  const text = [
    '📰 Новая статья готова к публикации',
    sourceLine,
    '',
    `🏷 ${article.tag}`,
    `📌 ${article.title}`,
    '',
    preview + '...',
    '',
    'Опубликовать или пропустить?',
  ].join('\n')

  await sendTelegramMessage(text, [[
    { text: '✅ Опубликовать', callback_data: 'publish_article' },
    { text: '❌ Пропустить', callback_data: 'skip_article' },
  ]])
}

async function main() {
  log('Starting article generation')

  if (!GEMINI_KEY) { log('ERROR: Missing GEMINI_API_KEY'); process.exit(1) }
  if (!TG_TOKEN || !TG_CHAT_ID) { log('ERROR: Missing Telegram config'); process.exit(1) }

  const mode = getMode()
  log(`Mode: ${mode}`)

  let keyword = null
  let kwIndex = -1

  if (mode === 'keyword') {
    const { keywords, index } = getKeywords()
    if (index >= keywords.length) {
      log('Keyword bank exhausted, notifying via Telegram')
      await sendTelegramMessage('⚠️ Банк ключевых слов исчерпан. Добавьте новые запросы командой /add_keyword <запрос>')
      process.exit(0)
    }
    keyword = keywords[index]
    kwIndex = index
    log(`Keyword [${index}]: "${keyword}"`)
  }

  const [feed1, feed2] = await Promise.all(RSS_FEEDS.map(fetchRss))
  const seen = new Set()
  const headlines = [...feed1, ...feed2].filter(h => {
    if (seen.has(h)) return false
    seen.add(h)
    return true
  }).slice(0, 5)

  if (headlines.length < 3) {
    log('Not enough RSS headlines (need ≥3), aborting')
    process.exit(0)
  }
  log(`Fetched ${headlines.length} headlines`)

  const tagIndex = getTagIndex()
  const tag = TAGS[tagIndex]
  log(`Tag: ${tag}`)

  let article
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      article = await generateArticle(tag, headlines, keyword)
      article.publishedAt = new Date().toISOString()
      article.source = 'ai-generated'
      log(`Article generated: "${article.title}"`)
      break
    } catch (e) {
      log(`Gemini attempt ${attempt} failed: ${e.message}`)
      if (attempt === 2) { log('Both attempts failed, exiting'); process.exit(0) }
      await new Promise(r => setTimeout(r, 5000))
    }
  }

  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
  fs.writeFileSync(DRAFT_PATH, JSON.stringify(article, null, 2), 'utf-8')
  log('Draft saved')

  await sendTelegram(article, keyword)
  log('Telegram notification sent — waiting for approval')

  incrementTagIndex(tagIndex)
  const newMode = mode === 'keyword' ? 'news' : 'keyword'
  if (mode === 'keyword') {
    incrementKeywordIndex(kwIndex)
  }
  setMode(newMode)
  log(`Mode flipped to: ${newMode}`)
}

main().catch(e => { log(`FATAL: ${e.message}`); process.exit(1) })
