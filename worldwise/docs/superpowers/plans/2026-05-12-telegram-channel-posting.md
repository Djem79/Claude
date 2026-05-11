# Telegram Channel Auto-Posting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After a blog article is approved via the Telegram Publish button, automatically post a formatted announcement to the Telegram channel `@WorldwisePro`.

**Architecture:** `publishDraft()` in `lib/dynamic-articles.ts` is changed to return the published `DynamicArticle | null` instead of `boolean`. The webhook handler in `app/api/telegram-webhook/route.ts` receives that article and calls a new `postToChannel(article)` helper which formats and sends a MarkdownV2 message to the channel. Channel post failures are logged but never surface to the user — the publish action is already complete.

**Tech Stack:** Next.js 14 App Router, TypeScript, Telegram Bot API (`sendMessage` with `parse_mode: MarkdownV2`).

---

## Files

| File | Change |
|------|--------|
| `worldwise/lib/dynamic-articles.ts` | `publishDraft()` returns `DynamicArticle \| null` |
| `worldwise/app/api/telegram-webhook/route.ts` | Add `TAG_EMOJI`, `escapeMarkdownV2`, `postToChannel`; update publish handler |
| `worldwise/.env.example` | Add `TELEGRAM_CHANNEL_ID` line |

---

### Task 1: Change `publishDraft()` return type

**Files:**
- Modify: `worldwise/lib/dynamic-articles.ts:50-58`

Current `publishDraft` returns `boolean`. Change it to return the article on success so the webhook handler can pass it to `postToChannel`.

- [ ] **Step 1: Replace `publishDraft` function body**

Open `worldwise/lib/dynamic-articles.ts` and replace the entire `publishDraft` function (lines 50–58):

```typescript
export function publishDraft(): DynamicArticle | null {
  const draft = getDraft()
  if (!draft) return null
  const existing = getDynamicArticles()
  existing.unshift(draft)
  fs.writeFileSync(ARTICLES_PATH, JSON.stringify(existing, null, 2), 'utf-8')
  deleteDraft()
  return draft
}
```

- [ ] **Step 2: Verify build passes**

```bash
cd worldwise && npm run build 2>&1 | grep -E "error|Error|✓|Route"
```

Expected: no TypeScript errors. The only caller of `publishDraft` is `app/api/telegram-webhook/route.ts` — it currently assigns the result to nothing (line 73: `publishDraft()`), so this change is non-breaking until Task 2 updates the caller.

- [ ] **Step 3: Commit**

```bash
git add worldwise/lib/dynamic-articles.ts
git commit -m "refactor: publishDraft returns DynamicArticle|null instead of boolean"
```

---

### Task 2: Add `postToChannel` and wire it in the webhook handler

**Files:**
- Modify: `worldwise/app/api/telegram-webhook/route.ts`

Add the channel posting helper and update the `publish_article` callback branch to use it.

- [ ] **Step 1: Update the import line at the top of the file**

The current import (line 2):
```typescript
import { publishDraft, deleteDraft } from '@/lib/dynamic-articles'
```

Replace with:
```typescript
import { publishDraft, deleteDraft, DynamicArticle } from '@/lib/dynamic-articles'
```

- [ ] **Step 2: Add `TAG_EMOJI`, `escapeMarkdownV2`, and `postToChannel` after the existing `sendMessage` function (after line 18)**

Insert the following block between `sendMessage` and the `POST` export:

```typescript
const TAG_EMOJI: Record<string, string> = {
  'Market Update': '📊',
  'Investment Guide': '📌',
  'Area Spotlight': '📍',
  'Legal Guide': '⚖️',
  'Visa & Residency': '🛂',
}

function escapeMarkdownV2(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&')
}

async function postToChannel(article: DynamicArticle) {
  const channelId = process.env.TELEGRAM_CHANNEL_ID
  if (!channelId) return
  const token = process.env.TELEGRAM_BOT_TOKEN!
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://worldwise.pro').replace(/\/$/, '')
  const emoji = TAG_EMOJI[article.tag] ?? '📄'
  const tagHashtag = '\\#' + article.tag.replace(/[^a-zA-Z]/g, '')
  const url = `${siteUrl}/blog/${article.slug}`
  const text = [
    `${emoji} ${escapeMarkdownV2(article.tag)}`,
    '',
    `*${escapeMarkdownV2(article.title)}*`,
    '',
    escapeMarkdownV2(article.excerpt),
    '',
    `\\#DubaiRealEstate ${tagHashtag}`,
    '',
    `👉 [Читать статью](${url})`,
  ].join('\n')
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: channelId, text, parse_mode: 'MarkdownV2' }),
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) console.error('[telegram-webhook] postToChannel failed', await res.text())
  } catch (e) {
    console.error('[telegram-webhook] postToChannel error', e)
  }
}
```

- [ ] **Step 3: Update the `publish_article` branch in the `POST` handler**

Find the current block (around line 72–74):
```typescript
  if (data === 'publish_article') {
    const published = publishDraft()
    answerText = published ? '✅ Опубликовано' : '⚠️ Черновик не найден'
```

Replace with:
```typescript
  if (data === 'publish_article') {
    const published = publishDraft()
    answerText = published ? '✅ Опубликовано' : '⚠️ Черновик не найден'
    if (published) await postToChannel(published)
```

The `await postToChannel(published)` runs before `answerCallbackQuery` is sent, but since it has a 10s timeout it won't block the response for long. The `answerCallbackQuery` and `editMessageReplyMarkup` calls at the end of the handler are unchanged.

- [ ] **Step 4: Verify build passes**

```bash
cd worldwise && npm run build 2>&1 | grep -E "error|Error|✓|Route"
```

Expected: no TypeScript errors, `/api/telegram-webhook` appears in route list.

- [ ] **Step 5: Commit**

```bash
git add 'worldwise/app/api/telegram-webhook/route.ts'
git commit -m "feat: post article to @WorldwisePro channel on Publish"
```

---

### Task 3: Add `TELEGRAM_CHANNEL_ID` to `.env.example`

**Files:**
- Modify: `worldwise/.env.example`

- [ ] **Step 1: Add the new variable**

Find the Telegram block in `.env.example`:
```
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
```

Add the new line immediately after `TELEGRAM_CHAT_ID=`:
```
TELEGRAM_CHANNEL_ID=@WorldwisePro
```

- [ ] **Step 2: Commit**

```bash
git add worldwise/.env.example
git commit -m "chore: add TELEGRAM_CHANNEL_ID to .env.example"
```

---

### Task 4: Deploy and smoke test

- [ ] **Step 1: Backup data on server**

```bash
ssh -i ~/.ssh/id_ed25519 root@62.238.35.20 \
  "cp -r /var/www/worldwise/data /var/www/worldwise/data_backup_$(date +%Y%m%d_%H%M%S)"
```

- [ ] **Step 2: Confirm bot is admin on @WorldwisePro**

In Telegram: open `@WorldwisePro` → Edit channel → Administrators → check the bot is listed with "Post Messages" permission. If not, add it now before deploying.

- [ ] **Step 3: Set `TELEGRAM_CHANNEL_ID` on server**

```bash
ssh -i ~/.ssh/id_ed25519 root@62.238.35.20 \
  "grep TELEGRAM_CHANNEL_ID /var/www/worldwise/.env.local || echo 'TELEGRAM_CHANNEL_ID=@WorldwisePro' >> /var/www/worldwise/.env.local"
```

Verify it was added:
```bash
ssh -i ~/.ssh/id_ed25519 root@62.238.35.20 \
  "grep TELEGRAM_CHANNEL_ID /var/www/worldwise/.env.local"
```

Expected: `TELEGRAM_CHANNEL_ID=@WorldwisePro`

- [ ] **Step 4: Rsync and build on server**

```bash
rsync -avz --exclude='.git' --exclude='node_modules' --exclude='.next' --exclude='data/' \
  -e "ssh -i ~/.ssh/id_ed25519" \
  worldwise/ root@62.238.35.20:/var/www/worldwise/

ssh -i ~/.ssh/id_ed25519 root@62.238.35.20 \
  "cd /var/www/worldwise && npm run build 2>&1 | tail -10 && pm2 restart worldwise"
```

Expected: build succeeds, PM2 shows `online`.

- [ ] **Step 5: Smoke test**

Trigger the approval flow by running the article generator manually on the server:

```bash
ssh -i ~/.ssh/id_ed25519 root@62.238.35.20 \
  "cd /var/www/worldwise && node --env-file=.env.local scripts/generate-article.mjs"
```

You will receive a Telegram message with Publish / Skip buttons. Press **Publish**.

Expected results:
1. The bot replies `✅ Опубликовано` (callback answer popup)
2. The inline buttons disappear from the approval message
3. A new post appears in `@WorldwisePro` with emoji, bold title, excerpt, hashtags, and link
4. The article appears at `https://worldwise.pro/blog/<slug>`

- [ ] **Step 6: If channel post fails (403)**

The bot is not yet admin on the channel. Add it:
- Open `@WorldwisePro` in Telegram
- Channel settings → Administrators → Add Administrator → find the bot by username → enable "Post Messages" → Save

Then verify by running the generator again and pressing Publish.
