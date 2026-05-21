# AI Images for Auto-Blog Articles — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give each AI-generated blog article a topical, on-brand image (AI photo + branded overlay with the real logo) shown on the site, used as its OG image, and posted to the Telegram channel.

**Architecture:** The cron (`scripts/generate-article.mjs`) asks Gemini for an `imagePrompt`, generates a raw photo via `gemini-2.5-flash-image`, then calls a new Next route (`/api/blog-image`) that composites the branded card via `ImageResponse` (reusing the `opengraph-image.tsx` pattern + the real logo file). The composited PNG is stored under `public/images/blog/` and referenced from the article (`image` field) for the site, OG meta, and Telegram. Everything degrades gracefully to the current behaviour if image generation fails.

**Tech Stack:** Next.js 14 (`next/og` `ImageResponse`), TypeScript, Node ESM cron script, Gemini image API, Telegram Bot API.

**Spec:** `worldwise/docs/superpowers/specs/2026-05-21-article-images-design.md`

**Commands run from `worldwise/`.** If `node`/`npm` not found: `export PATH="/Users/dzhambulat/.nvm/versions/node/v24.15.0/bin:$PATH"`. Build = `SESSION_SECRET=dummy ADMIN_PASSWORD=dummy npm run build`.

---

### Task 1: Slug util (TDD) + `image` field on the article type

**Files:**
- Create: `lib/slug.ts`
- Create: `lib/slug.test.ts`
- Modify: `lib/dynamic-articles.ts` (add `image?` to `DynamicArticle`)

- [ ] **Step 1: Write the failing test** — create `lib/slug.test.ts`:

```ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sanitizeSlug, isValidSlug } from './slug.ts'

test('sanitizeSlug keeps kebab-case, strips the rest, lowercases, caps length', () => {
  assert.equal(sanitizeSlug('Dubai Marina 2BR!'), 'dubai-marina-2br')
  assert.equal(sanitizeSlug('Already-good-slug'), 'already-good-slug')
  assert.equal(sanitizeSlug('  spaces  and__under '), 'spaces-and-under')
  assert.equal(sanitizeSlug('a'.repeat(120)).length, 80)
})

test('isValidSlug accepts only kebab-case within length', () => {
  assert.equal(isValidSlug('dubai-marina'), true)
  assert.equal(isValidSlug('Bad Slug'), false)
  assert.equal(isValidSlug(''), false)
  assert.equal(isValidSlug('a'.repeat(81)), false)
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test lib/slug.test.ts`
Expected: FAIL — `Cannot find module './slug.ts'`.

- [ ] **Step 3: Implement `lib/slug.ts`:**

```ts
// Filesystem- and URL-safe slug helpers for blog article images. Pure, testable.
export function sanitizeSlug(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '')
}

export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9-]{1,80}$/.test(slug)
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test lib/slug.test.ts`
Expected: PASS — `# pass 2  # fail 0`.

- [ ] **Step 5: Add `image?` to the article type.** In `lib/dynamic-articles.ts`, change the interface:

```ts
export interface DynamicArticle {
  slug: string
  tag: string
  title: string
  excerpt: string
  readTime: string
  content: string
  publishedAt: string
  source: 'ai-generated'
  image?: string
}
```

- [ ] **Step 6: Verify the build**

Run: `SESSION_SECRET=dummy ADMIN_PASSWORD=dummy npm run build`
Expected: `✓ Compiled successfully`.

- [ ] **Step 7: Commit**

```bash
git add lib/slug.ts lib/slug.test.ts lib/dynamic-articles.ts
git commit -m "feat(blog): slug util + image field on DynamicArticle"
```

---

### Task 2: Branded compositor route `/api/blog-image`

**Files:**
- Create: `app/api/blog-image/route.tsx`  ← `.tsx` (the handler returns JSX)

- [ ] **Step 1: Implement the route.** Create `app/api/blog-image/route.tsx`:

```tsx
import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'
import { isValidSlug } from '@/lib/slug'
import fs from 'fs'
import path from 'path'

export const runtime = 'nodejs'

const NAVY = '#0D1B2A'
const GOLD = '#C9A84C'
const IVORY = '#f3ece0'
const SIZE = { width: 1200, height: 630 }

async function loadFont(family: string, weight = 400): Promise<ArrayBuffer> {
  const css = await fetch(
    `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, '+')}:wght@${weight}&display=block`,
    { headers: { 'User-Agent': 'Mozilla/5.0 (compatible)' } },
  ).then((r) => r.text())
  const url = css.match(/src:\s*url\(([^)]+)\)/)?.[1]
  if (!url) throw new Error(`No font URL for ${family}`)
  return fetch(url).then((r) => r.arrayBuffer())
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const slug = searchParams.get('slug') ?? ''
  const title = (searchParams.get('title') ?? '').slice(0, 140)
  const tag = (searchParams.get('tag') ?? '').slice(0, 40)

  if (!isValidSlug(slug)) {
    return new Response('Invalid slug', { status: 400 })
  }

  const rawPath = path.join(process.cwd(), 'public', 'images', 'blog', `${slug}-raw.png`)
  if (!fs.existsSync(rawPath)) {
    return new Response('Background not found', { status: 404 })
  }
  const bgSrc = `data:image/png;base64,${fs.readFileSync(rawPath).toString('base64')}`

  let logoSrc: string | null = null
  try {
    const buf = fs.readFileSync(path.join(process.cwd(), 'public', 'images', 'logo-dark-bg.png'))
    logoSrc = `data:image/png;base64,${buf.toString('base64')}`
  } catch {}

  let cormorant500: ArrayBuffer | null = null
  try { cormorant500 = await loadFont('Cormorant Garamond', 500) } catch {}
  const fonts = cormorant500
    ? [{ name: 'Cormorant Garamond', data: cormorant500, style: 'normal' as const, weight: 500 as const }]
    : []

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', position: 'relative', display: 'flex', backgroundColor: NAVY, fontFamily: fonts.length ? '"Cormorant Garamond"' : 'Georgia, serif' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={bgSrc} alt="" width={SIZE.width} height={SIZE.height} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        {/* scrim: dark at bottom + left for legibility */}
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(180deg, rgba(13,27,42,0.15) 0%, rgba(13,27,42,0.05) 38%, rgba(13,27,42,0.78) 78%, rgba(13,27,42,0.95) 100%)' }} />
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(90deg, rgba(13,27,42,0.55) 0%, rgba(13,27,42,0) 55%)' }} />
        {/* logo (unaltered) top-left */}
        {logoSrc && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoSrc} alt="Worldwise Real Estate" width={240} height={126} style={{ position: 'absolute', top: 44, left: 54, objectFit: 'contain' }} />
        )}
        {/* tag + title bottom-left */}
        <div style={{ position: 'absolute', left: 54, right: 64, bottom: 54, display: 'flex', flexDirection: 'column' }}>
          {tag ? (
            <div style={{ display: 'flex', alignSelf: 'flex-start', color: NAVY, backgroundColor: GOLD, fontSize: 22, fontWeight: 700, letterSpacing: 1.5, padding: '7px 18px', borderRadius: 999, marginBottom: 20, textTransform: 'uppercase' }}>
              {tag}
            </div>
          ) : null}
          <div style={{ display: 'flex', color: IVORY, fontSize: 60, fontWeight: 500, lineHeight: 1.05, maxWidth: 1000 }}>
            {title}
          </div>
        </div>
        {/* url bottom-right */}
        <div style={{ position: 'absolute', bottom: 50, right: 64, display: 'flex', color: 'rgba(255,255,255,0.78)', fontSize: 22, letterSpacing: 0.5 }}>
          worldwise.pro
        </div>
      </div>
    ),
    { ...SIZE, fonts },
  )
}
```

- [ ] **Step 2: Verify the build**

Run: `SESSION_SECRET=dummy ADMIN_PASSWORD=dummy npm run build`
Expected: `✓ Compiled successfully`; route `ƒ /api/blog-image` appears in the route list.

- [ ] **Step 3: Manual render check**

```bash
mkdir -p public/images/blog
cp /tmp/hf-sample.png public/images/blog/test-raw.png   # any landscape PNG
SESSION_SECRET=dummy ADMIN_PASSWORD=dummy npm run start &   # or npm run dev
sleep 4
curl -s "http://localhost:3000/api/blog-image?slug=test&title=Dubai%20Property%20Market%202026&tag=Market%20Update" -o /tmp/card-out.png
file /tmp/card-out.png   # expect: PNG image data, 1200 x 630
kill %1 2>/dev/null; rm -f public/images/blog/test-raw.png
```
Expected: `/tmp/card-out.png` is a 1200×630 PNG showing the photo + gold tag chip + ivory title + the real logo top-left.

- [ ] **Step 4: Commit**

```bash
git add app/api/blog-image/route.ts
git commit -m "feat(blog): branded ImageResponse compositor route /api/blog-image"
```

---

### Task 3: Cron — generate AI photo, bake card, send approval photo

**Files:**
- Modify: `scripts/generate-article.mjs`

- [ ] **Step 1: Add `imagePrompt` to the Gemini schema.** In `generateArticle()`, inside `responseSchema.properties`, add `imagePrompt` and include it in `required` and `propertyOrdering`. The properties block becomes:

```js
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
```

- [ ] **Step 2: Tell Gemini what `imagePrompt` should contain.** In BOTH prompt strings in `generateArticle()` (keyword and news variants), append this line to the JSON field description block (right after the `"content": ...` line, inside the JSON example):

```
  "imagePrompt": "One vivid sentence describing an on-topic, atmospheric Dubai real-estate photo for this article — cinematic, golden-hour, professional editorial. MUST NOT contain any text, watermark, logo, or a specific identifiable building."
```

- [ ] **Step 3: Add image constants + helpers.** Near the top of the file (after the existing `const MODE_PATH = ...` path constants) add:

```js
const BLOG_IMG_DIR = path.join(ROOT, 'public', 'images', 'blog')
const IMAGE_MODEL = 'gemini-2.5-flash-image'
const APP_URL = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || 'http://localhost:3000'
const LOCAL_APP = 'http://localhost:3000'
```

Then add these functions (after `generateArticle`):

```js
function sanitizeSlug(raw) {
  return String(raw || '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/-{2,}/g, '-').replace(/^-+|-+$/g, '').slice(0, 80).replace(/-+$/g, '')
}

// Generate the raw AI photo → public/images/blog/<slug>-raw.png. Returns true on success.
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
  return true
}

// Bake the branded card via the running app → public/images/blog/<slug>.png.
async function bakeCard(slug, title, tag) {
  const url = `${LOCAL_APP}/api/blog-image?slug=${encodeURIComponent(slug)}&title=${encodeURIComponent(title)}&tag=${encodeURIComponent(tag)}`
  const res = await fetch(url, { signal: AbortSignal.timeout(30000) })
  if (!res.ok) throw new Error(`bake ${res.status}: ${(await res.text()).slice(0, 160)}`)
  const buf = Buffer.from(await res.arrayBuffer())
  fs.writeFileSync(path.join(BLOG_IMG_DIR, `${slug}.png`), buf)
  return `/images/blog/${slug}.png`
}
```

- [ ] **Step 4: Wire image generation into `main()`.** In `main()`, AFTER the article-generation `for` loop (right after `log(\`Article generated: "${article.title}"\`)` succeeds — i.e. after the loop, before `writeFileAtomic(DRAFT_PATH, ...)`), insert:

```js
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
```

- [ ] **Step 5: Send the approval message as a photo when an image exists.** Replace `sendTelegram()` with:

```js
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
```

- [ ] **Step 6: Verify script syntax**

Run: `node --check scripts/generate-article.mjs`
Expected: no output (exit 0).

- [ ] **Step 7: Commit**

```bash
git add scripts/generate-article.mjs
git commit -m "feat(blog): cron generates AI image + branded card, sends approval photo"
```

---

### Task 4: Telegram channel post as a photo

**Files:**
- Modify: `app/api/telegram-webhook/route.ts` (`postToChannel`)

- [ ] **Step 1: Use `sendPhoto` when the published article has an image.** In `postToChannel(article)`, after building `const text = [...].join('\n')`, replace the single `sendMessage`/`fetch` send block with:

```ts
  const endpoint = article.image ? 'sendPhoto' : 'sendMessage'
  const payload: Record<string, unknown> = article.image
    ? { chat_id: channelId, photo: `${siteUrl}${article.image}`, caption: text.slice(0, 1024), parse_mode: 'MarkdownV2' }
    : { chat_id: channelId, text, parse_mode: 'MarkdownV2' }
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) console.error('[telegram-webhook] postToChannel failed', await res.text())
  } catch (e) {
    console.error('[telegram-webhook] postToChannel error', e)
  }
```

(Replace the existing `try { const res = await fetch(... sendMessage ...) } catch {}` block; keep everything above `const text = [...]` unchanged. `DynamicArticle` already has the optional `image` field from Task 1, so `article.image` type-checks.)

- [ ] **Step 2: Verify the build**

Run: `SESSION_SECRET=dummy ADMIN_PASSWORD=dummy npm run build`
Expected: `✓ Compiled successfully`.

- [ ] **Step 3: Commit**

```bash
git add app/api/telegram-webhook/route.ts
git commit -m "feat(blog): post article image to Telegram channel (sendPhoto)"
```

---

### Task 5: Website — hero, thumbnail, per-article OG image

**Files:**
- Modify: `app/blog/[slug]/page.tsx` (metadata images + hero)
- Modify: `app/blog/page.tsx` (list thumbnail)

- [ ] **Step 1: Per-article OG/twitter image.** In `app/blog/[slug]/page.tsx` `generateMetadata`, compute the image and use it. Replace the `openGraph`/`twitter` `images` so it prefers the article image:

```ts
  const ogImage = 'image' in article && article.image
    ? `https://worldwise.pro${article.image}`
    : '/opengraph-image'
```
Then in the returned metadata use `images: [{ url: ogImage, width: 1200, height: 630, alt: article.title }]` for `openGraph` and `images: [ogImage]` for `twitter`.

- [ ] **Step 2: Article hero image.** In `app/blog/[slug]/page.tsx`, inside the `{/* Header */}` `<section>`, after the `<p>` with date/readTime (and before `</div></section>`), add a hero shown only when an image exists:

```tsx
            {'image' in article && article.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={article.image}
                alt={article.title}
                className="w-full rounded-sm mt-8 aspect-[1200/630] object-cover"
              />
            )}
```

- [ ] **Step 3: Blog list thumbnail.** In `app/blog/page.tsx`, replace the placeholder thumbnail block:

```tsx
                  <div className="h-48 bg-gradient-to-br from-navy to-navy-light flex items-center justify-center">
                    <span className="font-serif text-4xl text-gold/30">W</span>
                  </div>
```
with:

```tsx
                  {'image' in a && a.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.image} alt={a.title} className="h-48 w-full object-cover" />
                  ) : (
                    <div className="h-48 bg-gradient-to-br from-navy to-navy-light flex items-center justify-center">
                      <span className="font-serif text-4xl text-gold/30">W</span>
                    </div>
                  )}
```

- [ ] **Step 4: Verify the build**

Run: `SESSION_SECRET=dummy ADMIN_PASSWORD=dummy npm run build`
Expected: `✓ Compiled successfully` (no type error on `'image' in a` / `article`).

- [ ] **Step 5: Commit**

```bash
git add "app/blog/[slug]/page.tsx" app/blog/page.tsx
git commit -m "feat(blog): per-article hero, list thumbnail and OG image"
```

---

### Task 6: Storage — gitignore + deploy excludes

**Files:**
- Modify: `.gitignore` (repo root `/Users/dzhambulat/Documents/Claude/.gitignore`)
- Modify: `CLAUDE.md` (deploy rsync snippet)

- [ ] **Step 1: Ignore generated blog images.** In the root `.gitignore`, after the `worldwise/public/files/` block, add:

```
# Server-generated per-article blog images (AI photo + branded card)
worldwise/public/images/blog/
```

- [ ] **Step 2: Exclude from deploy rsync.** In `CLAUDE.md`, in the deploy `rsync` command, add `--exclude='public/images/blog/'` to the exclude list (alongside `--exclude='public/files/'`).

- [ ] **Step 3: Commit**

```bash
git add .gitignore CLAUDE.md
git commit -m "chore(blog): gitignore + rsync-exclude generated article images"
```

---

### Task 7: Build gate, deploy, manual verification

**Files:** none (verification + deploy)

- [ ] **Step 1: Full build + script syntax + slug tests**

Run:
```bash
node --test lib/slug.test.ts
node --check scripts/generate-article.mjs
SESSION_SECRET=dummy ADMIN_PASSWORD=dummy npm run build
```
Expected: tests pass, no syntax error, `✓ Compiled successfully`.

- [ ] **Step 2: Deploy (backup first, per CLAUDE.md)**

```bash
ssh -i ~/.ssh/id_ed25519 root@62.238.35.20 \
  "cp -r /var/www/worldwise/data /var/www/worldwise/data_backup_$(date +%Y%m%d_%H%M%S)"
rsync -avz --exclude='.git' --exclude='node_modules' --exclude='.next' --exclude='data/' \
  --exclude='public/files/' --exclude='public/images/blog/' --exclude='lead-files/' --exclude='.env.local' \
  -e "ssh -i ~/.ssh/id_ed25519" worldwise/ root@62.238.35.20:/var/www/worldwise/
ssh -i ~/.ssh/id_ed25519 root@62.238.35.20 \
  "cd /var/www/worldwise && npm run build && pm2 restart worldwise --update-env"
```

- [ ] **Step 3: Manual end-to-end on the server**

```bash
ssh -i ~/.ssh/id_ed25519 root@62.238.35.20 \
  "cd /var/www/worldwise && node --env-file=.env.local scripts/generate-article.mjs"
```
Expected: the log shows `Image ready: /images/blog/<slug>.png`; the Telegram approval message arrives **as a photo** (branded card with the real logo) + Publish/Skip buttons.

- [ ] **Step 4: Approve and verify surfaces**

- Tap **✅ Опубликовать** → the Telegram **channel** post is a photo (card) + caption + link.
- Open `https://worldwise.pro/blog/<slug>` → hero image present; view-source shows `og:image` = `https://worldwise.pro/images/blog/<slug>.png`.
- Open `https://worldwise.pro/blog` → the new article's card shows the image thumbnail.

- [ ] **Step 5: Verify the fallback path**

Temporarily break image generation (e.g. run the script with an invalid image model name in a one-off local test, or confirm via code review) and confirm the article still drafts/publishes with no image, the site uses `/opengraph-image`, and Telegram falls back to text. (Code review of the `try/catch` in Task 3 Step 4 + Task 4 + Task 5 conditionals is sufficient if a live failure isn't easy to force.)
