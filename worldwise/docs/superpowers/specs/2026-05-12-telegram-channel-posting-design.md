# Telegram Channel Auto-Posting Design

## Goal

After an article is approved via the Telegram approval flow (Publish button), automatically post a formatted announcement to the public Telegram channel `@WorldwisePro`.

## Scope

Two files change. No new infrastructure. Same bot, same token.

---

## Files Changed

| File | Change |
|------|--------|
| `lib/dynamic-articles.ts` | `publishDraft()` returns `DynamicArticle \| null` instead of `boolean` |
| `app/api/telegram-webhook/route.ts` | Add `postToChannel(article)` helper; call it after successful publish |
| `.env.example` | Add `TELEGRAM_CHANNEL_ID` |

---

## `publishDraft()` return type change

**Before:** `publishDraft(): boolean`
**After:** `publishDraft(): DynamicArticle | null`

Returns the published article on success, `null` if no draft found. The webhook handler uses the returned article to build the channel post. All other call sites (none currently) would need to handle the new type, but there are no other callers.

---

## Channel post format

```
📌 Investment Guide

**How to Buy Off-Plan Property in Dubai as a Foreigner**

Investing in Dubai's off-plan market offers 8–10% yields and flexible payment plans. Here's what international buyers need to know before signing.

#DubaiRealEstate #OffPlan #InvestmentGuide

👉 https://worldwise.pro/blog/how-to-buy-off-plan-dubai
```

**Structure:**
1. Tag emoji + tag name (first line)
2. Blank line
3. `**Title**` (bold via Markdown)
4. Blank line
5. Excerpt (from `article.excerpt`)
6. Blank line
7. Hashtags: fixed `#DubaiRealEstate` + tag-derived hashtag (see mapping below)
8. Blank line
9. Article URL: `${NEXT_PUBLIC_SITE_URL}/blog/${article.slug}`

**Tag → hashtag mapping** (derived by removing spaces):

| Tag | Hashtag |
|-----|---------|
| Market Update | `#MarketUpdate` |
| Investment Guide | `#InvestmentGuide` |
| Area Spotlight | `#AreaSpotlight` |
| Legal Guide | `#LegalGuide` |
| Visa & Residency | `#VisaResidency` |

**Tag → emoji mapping:**

| Tag | Emoji |
|-----|-------|
| Market Update | 📊 |
| Investment Guide | 📌 |
| Area Spotlight | 📍 |
| Legal Guide | ⚖️ |
| Visa & Residency | 🛂 |

Telegram parse mode: `MarkdownV2` — bold title using `*Title*`. Special characters in title/excerpt must be escaped (`_`, `*`, `[`, `]`, `(`, `)`, `~`, `` ` ``, `>`, `#`, `+`, `-`, `=`, `|`, `{`, `}`, `.`, `!`).

---

## Error handling

- If `postToChannel()` fails (network error or Telegram API error): log the error, do **not** throw. The article is already published to the site — channel post failure must not affect publish confirmation to the user.
- `answerCallbackQuery` text stays `'✅ Опубликовано'` regardless of channel post result.
- `postToChannel` uses `AbortSignal.timeout(10000)` (10s) consistent with other Telegram calls in the codebase.

---

## Environment variables

| Variable | Value | Notes |
|----------|-------|-------|
| `TELEGRAM_CHANNEL_ID` | `@WorldwisePro` | Public channel username |

Added to `.env.example`. Set on server in `.env.local`.

---

## Manual prerequisite (one-time, done by user)

Add the bot (`TELEGRAM_BOT_TOKEN`) as administrator of `@WorldwisePro` with **"Post Messages"** permission. Without this, `sendMessage` returns 403.

---

## What is NOT in scope

- Editing or deleting channel posts (skip remains skip — no channel action)
- Images/media in channel posts (text-only)
- Retry logic for failed channel posts
- Posting older articles retroactively
