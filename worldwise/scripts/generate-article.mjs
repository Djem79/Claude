import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const DATA_DIR = path.join(ROOT, 'data')
const DRAFT_PATH = path.join(DATA_DIR, 'article-draft.json')
const TAG_INDEX_PATH = path.join(DATA_DIR, 'article-tag-index.json')
const KEYWORDS_PATH = path.join(DATA_DIR, 'article-keywords.json')
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

// Current date is injected into the prompt so the model anchors the article to
// the real present, not its training-cutoff year (which defaulted articles to
// "2024" even when running in 2026). Computed at run time, never hard-coded.
const NOW = new Date()
const CURRENT_YEAR = NOW.getFullYear()
const CURRENT_DATE = NOW.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

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

function getKeywords() {
  try {
    if (!fs.existsSync(KEYWORDS_PATH)) return { keywords: [], index: 0 }
    return JSON.parse(fs.readFileSync(KEYWORDS_PATH, 'utf-8'))
  } catch { return { keywords: [], index: 0 } }
}

function incrementKeywordIndex(currentIndex) {
  // Read raw and THROW on any read/parse failure — getKeywords()' empty fallback
  // must never be persisted here, or a transient error permanently wipes the
  // keyword bank (only repopulated by hand via /add_keyword).
  const data = JSON.parse(fs.readFileSync(KEYWORDS_PATH, 'utf-8'))
  data.index = currentIndex + 1
  writeFileAtomic(KEYWORDS_PATH, JSON.stringify(data, null, 2))
}

async function generateArticle(tag, headlines, keyword) {
  const prompt = keyword
    ? `Today's date is ${CURRENT_DATE}. The current year is ${CURRENT_YEAR}. Write the article for ${CURRENT_YEAR}. When you mention "this year", "current", or recent market activity, it MUST refer to ${CURRENT_YEAR}. Never present an earlier year as the present — only cite past years for explicit historical comparison grounded in the headlines below.

A potential investor just searched Google for: "${keyword}"

Write a thorough, genuinely useful 900–1300 word SEO article that directly answers this search for international investors buying in DUBAI. Open with a direct answer in the first paragraph, then go deep. Requirements:
- Be specific and concrete — real numbers, AED thresholds, timeframes, step-by-step where relevant. No filler or generic "Dubai is a great market" padding.
- Structure with ## h2 sections (### h3 where useful); include a markdown table when comparing options (payment plans, areas, visa tiers, etc.).
- Add a "## Frequently Asked Questions" section with 3–4 concise Q&As.
- Add 1–2 contextual internal links inline, using ONLY these exact paths and never inventing others: /properties, /golden-visa, /mortgage-calculator, /guide. Markdown syntax: [anchor text](/path).
- Keep the focus on Dubai; if the query names another emirate, still answer but anchor the advice to Dubai, where the firm operates.

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
    : `Today's date is ${CURRENT_DATE}. The current year is ${CURRENT_YEAR}. Write the article for ${CURRENT_YEAR}. When you mention "this year", "current", or recent market activity, it MUST refer to ${CURRENT_YEAR}. Never present an earlier year as the present — only cite past years for explicit historical comparison grounded in the headlines below.

Write a 600–800 word SEO article about UAE real estate for international investors.
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
            text: `You are a UAE real estate expert writing SEO blog articles for Worldwise Real Estate, a Dubai-based agency serving international investors. The current year is ${CURRENT_YEAR}; write everything as of ${CURRENT_YEAR} and never refer to an earlier year as the present. Write in English. Be informative and factual. Do not invent statistics — use only what is grounded in the news context provided.`,
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
// The branded card is served on-demand by the /api/blog-image route (it reads the
// raw photo from disk via fs — Next does NOT serve public/ files added after start).
function cardUrl(slug, title, tag) {
  return `/api/blog-image?slug=${encodeURIComponent(slug)}&title=${encodeURIComponent(title)}&tag=${encodeURIComponent(tag)}`
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

  if (article.image) {
    try {
      const r = await fetch(LOCAL_APP + article.image, { signal: AbortSignal.timeout(20000) })
      if (r.ok) {
        const buf = Buffer.from(await r.arrayBuffer())
        const fd = new FormData()
        fd.append('chat_id', TG_CHAT_ID)
        fd.append('caption', text.slice(0, 1024))
        fd.append('reply_markup', JSON.stringify({ inline_keyboard: keyboard }))
        fd.append('photo', new Blob([buf]), `${article.slug}.png`)
        const res = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendPhoto`, { method: 'POST', body: fd, signal: AbortSignal.timeout(20000) })
        if (res.ok) return
        log(`sendPhoto failed (${res.status}), falling back to text`)
      }
    } catch (e) {
      log(`approval photo failed: ${e.message}`)
    }
  }
  await sendTelegramMessage(text, keyboard)
}

async function main() {
  log('Starting article generation')

  if (!GEMINI_KEY) { log('ERROR: Missing GEMINI_API_KEY'); process.exit(1) }
  if (!TG_TOKEN || !TG_CHAT_ID) { log('ERROR: Missing Telegram config'); process.exit(1) }

  // Keyword-only pipeline (news mode retired 2026-06-23): keyword-targeted
  // articles rank and convert; generic news roundups did neither. Quality over
  // cadence — when the bank is exhausted we skip the day (and nudge /add_keyword)
  // rather than fall back to a low-value news summary.
  const { keywords, index } = getKeywords()
  if (index >= keywords.length) {
    log('Keyword bank exhausted, notifying via Telegram')
    await sendTelegramMessage('⚠️ Банк ключевых слов исчерпан. Добавьте новые запросы командой /add_keyword <запрос>')
    process.exit(0)
  }
  const keyword = keywords[index]
  const kwIndex = index
  log(`Keyword [${index}]: "${keyword}"`)

  const [feed1, feed2] = await Promise.all(RSS_FEEDS.map(fetchRss))
  const seen = new Set()
  const headlines = [...feed1, ...feed2].filter(h => {
    if (seen.has(h)) return false
    seen.add(h)
    return true
  }).slice(0, 5)

  // News headlines are optional supporting context for keyword articles — a flaky
  // Google News RSS must not skip the day now that this is the sole pipeline.
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
    const u = cardUrl(slug, article.title, article.tag)
    const probe = await fetch(LOCAL_APP + u, { signal: AbortSignal.timeout(30000) })
    if (!probe.ok) throw new Error(`card render ${probe.status}`)
    article.image = u
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
  incrementKeywordIndex(kwIndex)
  log(`Advanced keyword index to ${kwIndex + 1}`)
}

main().catch(e => { log(`FATAL: ${e.message}`); process.exit(1) })
