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
const BLOG_IMG_DIR = path.join(ROOT, 'public', 'images', 'blog')
const IMAGE_MODEL = 'gemini-2.5-flash-image'
const LOCAL_APP = 'http://localhost:3000'

const TAGS =['Market Update', 'Investment Guide', 'Area Spotlight', 'Legal Guide', 'Visa & Residency']

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

// Atomic write: temp file + rename, so a crash mid-write can't corrupt data files.
function writeFileAtomic(filePath, contents) {
  const tmp = `${filePath}.${process.pid}.tmp`
  fs.writeFileSync(tmp, contents, 'utf-8')
  fs.renameSync(tmp, filePath)
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
  writeFileAtomic(TAG_INDEX_PATH, JSON.stringify({ index: (current + 1) % TAGS.length }))
}

function getMode() {
  try {
    if (!fs.existsSync(MODE_PATH)) return 'keyword'
    return JSON.parse(fs.readFileSync(MODE_PATH, 'utf-8')).mode ?? 'keyword'
  } catch { return 'keyword' }
}

function setMode(mode) {
  writeFileAtomic(MODE_PATH, JSON.stringify({ mode }))
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
  writeFileAtomic(KEYWORDS_PATH, JSON.stringify(data, null, 2))
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
  "content": "Full article in markdown: use ## for h2 headings, ### for h3, - for bullet lists, plain paragraphs otherwise. End with a paragraph inviting readers to contact Worldwise Real Estate for a free consultation.",
  "imagePrompt": "One vivid sentence describing a photo that visually represents THIS article's specific subject — e.g. a visa/residency article → residency documents & investor lifestyle; an area spotlight → that exact neighbourhood; a mortgage/finance article → keys, contracts or financial imagery; a market update → skyline/cityscape. Cinematic, golden-hour, professional editorial, Dubai real-estate context. MUST NOT contain any text, watermark, logo, or a specific identifiable building."
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
  "content": "Full article in markdown: use ## for h2 headings, ### for h3, - for bullet lists, plain paragraphs otherwise. End with a paragraph inviting readers to contact Worldwise Real Estate for a free consultation.",
  "imagePrompt": "One vivid sentence describing a photo that visually represents THIS article's specific subject — e.g. a visa/residency article → residency documents & investor lifestyle; an area spotlight → that exact neighbourhood; a mortgage/finance article → keys, contracts or financial imagery; a market update → skyline/cityscape. Cinematic, golden-hour, professional editorial, Dubai real-estate context. MUST NOT contain any text, watermark, logo, or a specific identifiable building."
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
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 8192,
          thinkingConfig: { thinkingBudget: 0 },
          // Structured output: API guarantees valid JSON with properly escaped
          // string values, so the long markdown `content` field can never break
          // the parse. Replaces the previous hand-rolled control-char escaper.
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'OBJECT',
            properties: {
              title: { type: 'STRING' },
              slug: { type: 'STRING' },
              tag: { type: 'STRING' },
              excerpt: { type: 'STRING' },
              readTime: { type: 'STRING' },
              content: { type: 'STRING' },
              imagePrompt: { type: 'STRING' },
            },
            required: ['title', 'slug', 'tag', 'excerpt', 'readTime', 'content', 'imagePrompt'],
            propertyOrdering: ['title', 'slug', 'tag', 'excerpt', 'readTime', 'content', 'imagePrompt'],
          },
        },
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
  return JSON.parse(raw.trim())
}

function sanitizeSlug(raw) {
  return String(raw || '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/-{2,}/g, '-').replace(/^-+|-+$/g, '').slice(0, 80).replace(/-+$/g, '')
}

// Generate the raw AI photo → public/images/blog/<slug>-raw.png.
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

// Bake the branded card via the running app → public/images/blog/<slug>.png. Returns the public path.
async function bakeCard(slug, title, tag) {
  const url = `${LOCAL_APP}/api/blog-image?slug=${encodeURIComponent(slug)}&title=${encodeURIComponent(title)}&tag=${encodeURIComponent(tag)}`
  const res = await fetch(url, { signal: AbortSignal.timeout(30000) })
  if (!res.ok) throw new Error(`bake ${res.status}: ${(await res.text()).slice(0, 160)}`)
  fs.writeFileSync(path.join(BLOG_IMG_DIR, `${slug}.png`), Buffer.from(await res.arrayBuffer()))
  return `/images/blog/${slug}.png`
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
  const keyboard = [[
    { text: '✅ Опубликовать', callback_data: 'publish_article' },
    { text: '❌ Пропустить', callback_data: 'skip_article' },
  ]]

  const imgPath = article.image ? path.join(ROOT, 'public', article.image.replace(/^\//, '')) : null
  if (imgPath && fs.existsSync(imgPath)) {
    const fd = new FormData()
    fd.append('chat_id', TG_CHAT_ID)
    fd.append('caption', text.slice(0, 1024))
    fd.append('reply_markup', JSON.stringify({ inline_keyboard: keyboard }))
    fd.append('photo', new Blob([fs.readFileSync(imgPath)]), `${article.slug}.png`)
    const res = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendPhoto`, { method: 'POST', body: fd, signal: AbortSignal.timeout(20000) })
    if (res.ok) return
    log(`sendPhoto failed (${res.status}), falling back to text`)
  }
  await sendTelegramMessage(text, keyboard)
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

  // Per-article image (non-blocking): AI photo → branded card. Falls back silently.
  try {
    const slug = sanitizeSlug(article.slug)
    article.slug = slug
    await generateRawImage(slug, article.imagePrompt)
    article.image = await bakeCard(slug, article.title, article.tag)
    log(`Image ready: ${article.image}`)
  } catch (e) {
    log(`Image step failed (continuing without image): ${e.message}`)
    delete article.image
  }
  delete article.imagePrompt

  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
  writeFileAtomic(DRAFT_PATH, JSON.stringify(article, null, 2))
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
