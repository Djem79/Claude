# Design: Auto-Publishing UAE Real Estate Insights

**Date:** 2026-05-11
**Status:** Approved
**Files affected:**
- New: `scripts/generate-article.mjs`
- New: `app/api/telegram-webhook/route.ts`
- New: `data/articles.json` (server-only, like leads.json)
- New: `data/article-draft.json` (server-only)
- Modify: `lib/articles.ts`
- Modify: `app/blog/page.tsx`
- Modify: `app/blog/[slug]/page.tsx`
- Modify: `app/sitemap.ts`
- Modify: `.env.example`

---

## Goal

Every 3 days, automatically:
1. Fetch latest UAE real estate news from RSS feeds
2. Generate a 600–800 word SEO article via Gemini API
3. Send preview to Telegram with Publish / Skip buttons
4. On approval — publish to `/blog` instantly (no rebuild required)

---

## Content Pipeline

### RSS Sources

Two feeds, fetched in parallel. If a feed fails, the other provides context. Minimum 3 headlines required to proceed; if both fail, script exits silently (retries next cron tick).

| Feed | URL |
|---|---|
| Gulf News Property | `https://gulfnews.com/rss/property` |
| Arabian Business Real Estate | `https://www.arabianbusiness.com/rss/real-estate` |

Script takes the 5 most recent items (title + description) from the combined feed, deduplicated by title.

### Gemini API

Model: `gemini-1.5-flash` (free tier: 1500 req/day, 15 req/min — sufficient for 1 article per 3 days).

**System prompt:**
```
You are a UAE real estate expert writing SEO blog articles for Worldwise Real Estate,
a Dubai-based agency serving international investors. Write in English.
Articles must be informative, factual, and end with a call-to-action to contact Worldwise
for a free consultation. Do not invent statistics — use only what is grounded in the news context provided.
```

**User prompt:**
```
Write a 600–800 word SEO article about UAE real estate for international investors.
Use these recent news headlines as context:
[headline 1]
[headline 2]
...

Return ONLY a valid JSON object with these fields:
{
  "title": "Article title (max 70 chars, SEO-optimised)",
  "slug": "url-slug-kebab-case",
  "tag": "<one of: Market Update | Investment Guide | Area Spotlight | Legal Guide | Visa & Residency>",
  "excerpt": "2-3 sentence summary (max 200 chars)",
  "readTime": "X min read",
  "content": "Full article in markdown (h2/h3/p/ul)"
}
```

Tag rotates in order across consecutive runs: Market Update → Investment Guide → Area Spotlight → Legal Guide → Visa & Residency → Market Update → ...

Current tag index is stored as a single integer in `data/article-tag-index.json`.

### Article format

Generated articles follow the same `Article` interface as static articles, plus two additional fields:

```ts
interface DynamicArticle extends Article {
  publishedAt: string  // ISO date string
  source: 'ai-generated'
}
```

---

## Data Storage

Follows the existing file-based pattern (same as `leads.json`, `properties.json`). All files are server-only — never synced from local, never committed to git.

| File | Purpose |
|---|---|
| `data/articles.json` | Array of published AI-generated articles, newest first |
| `data/article-draft.json` | Single pending draft awaiting Telegram approval. Overwritten each cycle. |
| `data/article-tag-index.json` | `{ "index": 0 }` — current position in tag rotation |

---

## Telegram Approval Flow

Uses the existing `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` environment variables.

**Message sent by generator script:**
```
📰 Новая статья готова к публикации

🏷 Market Update
📌 Dubai Property Prices Rise 8% in Q1 2026

[First 400 chars of content]...

Опубликовать или пропустить?
```

Inline keyboard: `[ ✅ Опубликовать ]  [ ❌ Пропустить ]`

Callback data: `publish_article` / `skip_article`

**Webhook handler** (`/api/telegram-webhook`):
- Validates request comes from Telegram (checks `secret_token` header set during webhook registration)
- `publish_article`: reads `data/article-draft.json`, prepends to `data/articles.json`, deletes draft, answers callback with «✅ Опубликовано»
- `skip_article`: deletes draft, answers callback with «❌ Пропущено»
- Both actions edit the original Telegram message to remove the inline keyboard (prevents double-tap)

**Webhook registration** — run once on server setup:
```bash
curl -X POST "https://api.telegram.org/bot{TOKEN}/setWebhook" \
  -d "url=https://worldwise.pro/api/telegram-webhook" \
  -d "secret_token={WEBHOOK_SECRET}"
```

`WEBHOOK_SECRET` is a new env var (random 32-char string) used to verify that webhook calls come from Telegram.

---

## Blog Integration

### `lib/articles.ts`

Exports a new function `getAllArticles()` that merges static and dynamic articles:

```ts
export function getAllArticles(): Article[] {
  const dynamic = readDynamicArticles()  // reads data/articles.json safely
  return [...dynamic, ...articles]       // dynamic first (newest), then static
}
```

Static `articles` array remains unchanged — it is the fallback if `data/articles.json` doesn't exist yet.

`getArticleBySlug(slug)` checks dynamic articles first, then static.

### `app/blog/page.tsx`

Change `articles` import to `getAllArticles()`. Add `export const revalidate = 60` — Next.js re-reads the file every 60 seconds without a full rebuild. New articles appear within 1 minute of Telegram approval.

### `app/blog/[slug]/page.tsx`

`generateStaticParams` returns slugs from both static and dynamic articles. Since dynamic articles are added at runtime, the page uses `dynamicParams = true` (default) and falls back to SSR for unknown slugs — no rebuild needed for new articles.

### `app/sitemap.ts`

Reads dynamic articles via `getAllArticles()` — already handles the merge. No change needed to sitemap logic, only the import.

---

## Cron Setup (Hetzner server)

System cron (not PM2 — PM2 cron restarts the process, which is wrong for a script):

```
0 9 */3 * * node /var/www/worldwise/scripts/generate-article.mjs >> /var/log/worldwise-blog.log 2>&1
```

Runs at 09:00 every 3 days. Output logged to `/var/log/worldwise-blog.log`.

---

## Environment Variables

New variables to add to `.env.local` (server) and `.env.example`:

| Variable | Value |
|---|---|
| `GEMINI_API_KEY` | Google AI Studio key |
| `WEBHOOK_SECRET` | Random 32-char string (generate with `openssl rand -hex 16`) |

Existing variables used: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`.

---

## SEO / Indexation

- Each article gets its own URL `/blog/{slug}` with full metadata (title, description, canonical, og:image)
- Dynamic articles are included in `/sitemap.xml` via `getAllArticles()`
- `public/llms.txt` references `/blog` and `/sitemap.xml` — AI crawlers discover articles via sitemap automatically
- Articles end with CTA: «Contact Worldwise for a free consultation» → link to `/#contact`

---

## Acceptance Criteria

- [ ] Cron runs every 3 days and generates a draft without manual intervention
- [ ] Telegram message arrives with article preview and two buttons
- [ ] ✅ button publishes article to `/blog` within 60 seconds, no rebuild
- [ ] ❌ button deletes draft, no article published
- [ ] Published article appears in `/sitemap.xml`
- [ ] Published article has correct canonical, og:title, og:description
- [ ] If both RSS feeds fail, script exits silently with log message
- [ ] If Gemini returns invalid JSON, script retries once then exits
- [ ] `npm run build` passes with no TypeScript errors
