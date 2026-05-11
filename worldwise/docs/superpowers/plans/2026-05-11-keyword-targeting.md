# Keyword-Targeting Auto-Blog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add alternating keyword/news mode to the article generator so every other article targets a specific investor search query, and allow adding keywords via Telegram `/add_keyword` command.

**Architecture:** Two new server-only data files track the current mode (`article-mode.json`) and the keyword bank with its position (`article-keywords.json`). The generator script reads mode on each run and branches to either keyword-targeted or news-based generation, then flips the mode. The Telegram webhook handler grows a text-message branch for `/add_keyword`.

**Tech Stack:** Node.js ESM script, Next.js 14 App Router Route Handler, TypeScript, `fs` (sync reads/writes), Telegram Bot API.

---

## File Map

| File | Change |
|------|--------|
| `scripts/generate-article.mjs` | Rewrite `main()` + add mode/keyword helpers + update prompts + update Telegram message |
| `app/api/telegram-webhook/route.ts` | Add `/add_keyword` text-message branch before existing callback handling |
| `data/article-keywords.json` | New — created on server at deploy (60 initial keywords + index) |
| `data/article-mode.json` | New — created on server at deploy (`{"mode":"keyword"}`) |

---

## Task 1: Update `scripts/generate-article.mjs`

**Files:**
- Modify: `scripts/generate-article.mjs` (full rewrite — every function is shown)

### Context

The existing script is a single-mode news-based generator. We're extending it to:
1. Read `data/article-mode.json` at startup → `"keyword"` or `"news"`
2. In keyword mode: pick next query from `data/article-keywords.json`, use different Gemini prompt, increment keyword index
3. In both modes: flip the mode after a successful Gemini call (not after failure)
4. Send Telegram message with `🔑 Keyword:` or `📡 Source: Google News` label

- [ ] **Step 1: Replace the file with the full updated script**

Replace the entire contents of `scripts/generate-article.mjs` with:

```js
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
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
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
        generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
      }),
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

  incrementTagIndex(tagIndex)
  if (mode === 'keyword') {
    incrementKeywordIndex(kwIndex)
    setMode('news')
  } else {
    setMode('keyword')
  }
  log(`Mode flipped to: ${mode === 'keyword' ? 'news' : 'keyword'}`)

  await sendTelegram(article, keyword)
  log('Telegram notification sent — waiting for approval')
}

main().catch(e => { log(`FATAL: ${e.message}`); process.exit(1) })
```

- [ ] **Step 2: Verify syntax**

```bash
export PATH="/Users/dzhambulat/.nvm/versions/node/v24.15.0/bin:$PATH"
node --check worldwise/scripts/generate-article.mjs
```

Expected: no output (clean).

- [ ] **Step 3: Commit**

```bash
git add worldwise/scripts/generate-article.mjs
git commit -m "feat: add keyword/news alternating mode to article generator"
```

---

## Task 2: Update `app/api/telegram-webhook/route.ts`

**Files:**
- Modify: `app/api/telegram-webhook/route.ts` (full rewrite — both old and new logic shown)

### Context

The existing handler only processes `callback_query` (the ✅/❌ buttons). We add a branch before it that handles `message.text` starting with `/add_keyword`. The security check (webhook secret header) already covers both paths.

- [ ] **Step 1: Replace the file with the updated handler**

Replace the entire contents of `app/api/telegram-webhook/route.ts` with:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { publishDraft, deleteDraft } from '@/lib/dynamic-articles'
import fs from 'fs'
import path from 'path'

async function sendMessage(chatId: number, text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN!
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  })
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-telegram-bot-api-secret-token')
  if (!secret || secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()

  // /add_keyword text command
  const message = body.message
  if (message?.text) {
    const expectedChatId = (process.env.TELEGRAM_CHAT_ID ?? '').split(',')[0].trim()
    if (String(message.chat.id) === expectedChatId) {
      const text: string = message.text
      if (text.toLowerCase().startsWith('/add_keyword')) {
        const query = text.replace(/^\/add_keyword\s*/i, '').trim()
        if (!query) {
          await sendMessage(message.chat.id, '❌ Usage: /add_keyword <search query>')
          return NextResponse.json({ ok: true })
        }
        const keywordsPath = path.join(process.cwd(), 'data', 'article-keywords.json')
        let data: { keywords: string[]; index: number } = { keywords: [], index: 0 }
        try {
          data = JSON.parse(fs.readFileSync(keywordsPath, 'utf-8'))
        } catch {}
        data.keywords.push(query)
        fs.writeFileSync(keywordsPath, JSON.stringify(data, null, 2), 'utf-8')
        await sendMessage(message.chat.id, `✅ Добавлено: "${query}"\nВсего в банке: ${data.keywords.length} запросов`)
        return NextResponse.json({ ok: true })
      }
    }
    return NextResponse.json({ ok: true })
  }

  // publish / skip callback buttons
  const callback = body.callback_query
  if (!callback) return NextResponse.json({ ok: true })

  const { id: callbackId, data, message: cbMessage } = callback
  const chatId = cbMessage.chat.id
  const messageId = cbMessage.message_id
  const token = process.env.TELEGRAM_BOT_TOKEN!

  let answerText: string
  if (data === 'publish_article') {
    const published = publishDraft()
    answerText = published ? '✅ Опубликовано' : '⚠️ Черновик не найден'
  } else if (data === 'skip_article') {
    deleteDraft()
    answerText = '❌ Пропущено'
  } else {
    return NextResponse.json({ ok: true })
  }

  await Promise.all([
    fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callback_query_id: callbackId, text: answerText }),
    }),
    fetch(`https://api.telegram.org/bot${token}/editMessageReplyMarkup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        reply_markup: { inline_keyboard: [] },
      }),
    }),
  ])

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd worldwise
export PATH="/Users/dzhambulat/.nvm/versions/node/v24.15.0/bin:$PATH"
npm run build 2>&1 | tail -5
```

Expected: `✓ Compiled successfully` and route listed as `ƒ /api/telegram-webhook`.

- [ ] **Step 3: Commit**

```bash
git add worldwise/app/api/telegram-webhook/route.ts
git commit -m "feat: add /add_keyword Telegram command to webhook handler"
```

---

## Task 3: Deploy to Server + Initialise Data Files

**Files:**
- Server: `data/article-keywords.json` (create)
- Server: `data/article-mode.json` (create)
- Server: rsync updated scripts + rebuilt app

### Context

`data/` is never rsync'd (excluded in deploy command). The two new files must be created manually on the server. `article-mode.json` starts at `"keyword"` so the very next cron run uses the first keyword. The existing test article in `articles.json` is already published, so the blog is live.

- [ ] **Step 1: Backup server data**

```bash
ssh -i ~/.ssh/id_ed25519 root@62.238.35.20 \
  "cp -r /var/www/worldwise/data /var/www/worldwise/data_backup_$(date +%Y%m%d_%H%M%S) && echo done"
```

Expected: `done`

- [ ] **Step 2: Rsync updated files**

```bash
rsync -avz --exclude='.git' --exclude='node_modules' --exclude='.next' --exclude='data/' \
  -e "ssh -i ~/.ssh/id_ed25519" \
  worldwise/ root@62.238.35.20:/var/www/worldwise/
```

Expected: output includes `scripts/generate-article.mjs` and `app/api/telegram-webhook/route.ts`.

- [ ] **Step 3: Create `data/article-mode.json` on server**

```bash
ssh -i ~/.ssh/id_ed25519 root@62.238.35.20 \
  "echo '{\"mode\":\"keyword\"}' > /var/www/worldwise/data/article-mode.json && echo done"
```

Expected: `done`

- [ ] **Step 4: Create `data/article-keywords.json` on server**

```bash
ssh -i ~/.ssh/id_ed25519 root@62.238.35.20 "cat > /var/www/worldwise/data/article-keywords.json << 'ENDJSON'
{
  \"index\": 0,
  \"keywords\": [
    \"how to buy property in Dubai as a foreigner\",
    \"what documents are needed to buy an apartment in Dubai\",
    \"steps to buy off-plan property in Dubai\",
    \"freehold vs leasehold property Dubai explained\",
    \"DLD fees when buying property in Dubai\",
    \"how long does property purchase take in Dubai\",
    \"property buying process Dubai non-resident guide\",
    \"what is NOC in Dubai property purchase\",
    \"Dubai property title deed transfer process\",
    \"can foreigners own 100 percent property in Dubai\",
    \"is Dubai real estate a good investment in 2026\",
    \"average rental yield Dubai apartments\",
    \"best property types for rental income Dubai\",
    \"off-plan vs ready property investment Dubai comparison\",
    \"how to calculate ROI on Dubai property\",
    \"risks of investing in Dubai real estate\",
    \"Dubai property market forecast 2026 2027\",
    \"why invest in Dubai property instead of stocks\",
    \"Dubai real estate capital appreciation history\",
    \"comparing Dubai property investment to London and Singapore\",
    \"how to get UAE Golden Visa through property investment\",
    \"minimum property value for UAE Golden Visa 2026\",
    \"UAE Golden Visa benefits for property investors\",
    \"can my family get UAE residency through property purchase\",
    \"UAE property investor visa vs Golden Visa difference\",
    \"how long does UAE Golden Visa take to process\",
    \"UAE retirement visa through property investment\",
    \"Golden Visa UAE requirements and process 2026\",
    \"best areas to invest in Dubai for high rental yield\",
    \"Dubai Marina property investment guide\",
    \"Downtown Dubai vs Business Bay investment comparison\",
    \"Palm Jumeirah property prices and investment potential\",
    \"Jumeirah Village Circle JVC rental yield and investment\",
    \"Dubai Creek Harbour investment outlook\",
    \"most affordable areas to buy property in Dubai\",
    \"Dubai Hills Estate property investment review\",
    \"which Dubai area has best capital appreciation\",
    \"Emaar vs DAMAC which developer to choose\",
    \"can foreigners get mortgage in Dubai\",
    \"Dubai mortgage rates for non-residents 2026\",
    \"minimum down payment property Dubai non-resident\",
    \"how to finance off-plan property in Dubai\",
    \"post-handover payment plan Dubai pros and cons\",
    \"bank vs developer financing Dubai property\",
    \"mortgage eligibility requirements Dubai expat\",
    \"how much do I need to buy property in Dubai\",
    \"service charges strata fees Dubai apartments\",
    \"hidden costs when buying property Dubai\",
    \"is there property tax in Dubai\",
    \"capital gains tax on Dubai property for foreigners\",
    \"inheritance laws property UAE for expats\",
    \"RERA buyer protection rights Dubai\",
    \"can a company LLC own property in Dubai\",
    \"Dubai property ownership rights for non-Muslims\",
    \"joint property ownership rules Dubai\",
    \"why is Dubai real estate so popular with investors\",
    \"UAE property market stability and political risk\",
    \"short term rental Airbnb regulations Dubai\",
    \"property management companies Dubai for overseas investors\",
    \"how Dubai real estate compares to other Gulf markets\"
  ]
}
ENDJSON
echo done"
```

Expected: `done`

- [ ] **Step 5: Verify data files**

```bash
ssh -i ~/.ssh/id_ed25519 root@62.238.35.20 "
  echo '--- mode ---'
  cat /var/www/worldwise/data/article-mode.json
  echo '--- keywords count ---'
  grep -c '\"' /var/www/worldwise/data/article-keywords.json
"
```

Expected: `--- mode ---` then `{"mode":"keyword"}`, then `--- keywords count ---` then a number around 130 (each keyword line has 2 quotes).

- [ ] **Step 6: Build and restart on server**

```bash
ssh -i ~/.ssh/id_ed25519 root@62.238.35.20 \
  "cd /var/www/worldwise && npm install && npm run build 2>&1 | tail -5 && pm2 restart worldwise"
```

Expected: `✓ Compiled successfully` then PM2 restart confirmation.

- [ ] **Step 7: Smoke test — run generator manually (keyword mode)**

```bash
ssh -i ~/.ssh/id_ed25519 root@62.238.35.20 \
  "cd /var/www/worldwise && node --env-file=/var/www/worldwise/.env.local scripts/generate-article.mjs 2>&1"
```

Expected log lines:
```
Mode: keyword
Keyword [0]: "how to buy property in Dubai as a foreigner"
Fetched 5 headlines
Tag: ...
Article generated: "..."
Draft saved
Mode flipped to: news
Telegram notification sent — waiting for approval
```

If Gemini API is rate-limited (429), wait a few minutes and retry. If both attempts fail, the script exits cleanly without flipping mode — the next manual run will retry the same keyword.

- [ ] **Step 8: Check mode flipped to `news`**

```bash
ssh -i ~/.ssh/id_ed25519 root@62.238.35.20 "cat /var/www/worldwise/data/article-mode.json"
```

Expected: `{"mode":"news"}`

- [ ] **Step 9: Check keyword index incremented to 1**

```bash
ssh -i ~/.ssh/id_ed25519 root@62.238.35.20 \
  "node -e \"const d=JSON.parse(require('fs').readFileSync('/var/www/worldwise/data/article-keywords.json','utf-8')); console.log('index:', d.index)\""
```

Expected: `index: 1`

- [ ] **Step 10: Test `/add_keyword` command**

Send the following text message to the Worldwise Telegram bot:
```
/add_keyword Abu Dhabi vs Dubai property investment comparison
```

Expected Telegram reply: `✅ Добавлено: "Abu Dhabi vs Dubai property investment comparison"\nВсего в банке: 61 запросов`

Then verify on server:
```bash
ssh -i ~/.ssh/id_ed25519 root@62.238.35.20 \
  "node -e \"const d=JSON.parse(require('fs').readFileSync('/var/www/worldwise/data/article-keywords.json','utf-8')); console.log('total:', d.keywords.length, '| last:', d.keywords.at(-1))\""
```

Expected: `total: 61 | last: Abu Dhabi vs Dubai property investment comparison`

- [ ] **Step 11: Commit deploy notes (optional — no code change)**

No commit needed for server-only data files. If rsync was the only change, no local commit is required.
