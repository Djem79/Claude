# Design: Keyword-Targeted Blog Articles

**Date:** 2026-05-11
**Status:** Approved
**Files affected:**
- Modify: `scripts/generate-article.mjs`
- Modify: `app/api/telegram-webhook/route.ts`
- New (server-only, never committed): `data/article-keywords.json`
- New (server-only, never committed): `data/article-mode.json`

---

## Goal

Alternate the auto-blog cron between two modes:
- **keyword mode** — article answers a specific low-competition investor search query
- **news mode** — article summarises recent UAE property headlines (existing behaviour)

Every 3 days, the mode flips. Keyword articles target queries investors actually type into Google; news articles keep the blog topically current.

---

## Data Layer

### `data/article-keywords.json`

```json
{
  "keywords": [
    "how to buy property in Dubai as a foreigner",
    "UAE Golden Visa minimum property investment 2026",
    ...
  ],
  "index": 0
}
```

- `keywords` — ordered list of search queries; pre-seeded with ~60 items at deploy time
- `index` — position of the next keyword to use; incremented after each keyword article is generated
- When `index >= keywords.length` — bank exhausted; script sends Telegram notification and exits without generating an article or flipping the mode

New keywords appended via `/add_keyword` Telegram command. Index is never reset automatically — keywords are consumed in order once.

### `data/article-mode.json`

```json
{ "mode": "keyword" }
```

Flips between `"keyword"` and `"news"` after every successful article generation. Initial value: `"keyword"` (set at deploy).

---

## Alternating Mode Logic (`generate-article.mjs`)

```
read mode from article-mode.json

if mode === "keyword":
  read keywords.json
  if index >= keywords.length:
    send Telegram: "⚠️ Keyword bank exhausted. Add new queries with /add_keyword"
    exit 0  ← do NOT flip mode
  keyword = keywords[index]
  fetch Google News RSS (context only)
  generate keyword article
  increment keywords.index
  flip mode to "news"

if mode === "news":
  fetch Google News RSS (topic)
  generate news article (existing behaviour)
  flip mode to "keyword"
```

On Gemini failure (both retries) the mode is **not** flipped — the next cron tick retries the same mode.

---

## Keyword Article Generation

Prompt structure differs from news mode:

**System prompt:** unchanged — same UAE real estate expert persona.

**User prompt:**
```
A potential investor just searched Google for: "[keyword]"

Write a 600–800 word SEO article that directly and thoroughly answers this question for international property investors.

Use these recent UAE market headlines as supporting context to make the article timely:
[headline 1]
[headline 2]
...

Return ONLY a valid JSON object with these fields:
{
  "title": "...",
  "slug": "...",
  "tag": "[current tag]",
  "excerpt": "...",
  "readTime": "X min read",
  "content": "..."
}
```

The tag rotation (Market Update → Investment Guide → …) continues unchanged across both modes.

The Telegram preview message gains one line showing which mode was used:

```
📰 Новая статья готова к публикации
🔑 Keyword: "how to buy property in Dubai as a foreigner"

🏷 Investment Guide
📌 How to Buy Property in Dubai as a Foreigner: Complete Guide

[first 400 chars]...
```

For news-mode articles the `🔑 Keyword:` line is replaced with `📡 Source: Google News`.

---

## `/add_keyword` Telegram Command

Handled in `app/api/telegram-webhook/route.ts`.

**Detection:** incoming `update.message.text` that starts with `/add_keyword` (case-insensitive).

**Security:** `message.chat.id` must equal `TELEGRAM_CHAT_ID` (same check as webhook secret already in place).

**Action:**
1. Extract query: `text.replace(/^\/add_keyword\s*/i, '').trim()`
2. If empty: reply `❌ Usage: /add_keyword <search query>`
3. Append to `data/article-keywords.json` keywords array (read → push → write)
4. Reply: `✅ Добавлено: "[query]"\nВсего в банке: N запросов`

**No restart needed** — file is read on each cron run.

---

## Initial Keyword Bank (60 queries)

Grouped by investor intent. Seeded at deploy time into `data/article-keywords.json`.

### Buying Process (10)
1. how to buy property in Dubai as a foreigner
2. what documents are needed to buy an apartment in Dubai
3. steps to buy off-plan property in Dubai
4. freehold vs leasehold property Dubai explained
5. DLD fees when buying property in Dubai
6. how long does property purchase take in Dubai
7. property buying process Dubai non-resident guide
8. what is NOC in Dubai property purchase
9. Dubai property title deed transfer process
10. can foreigners own 100 percent property in Dubai

### Investment ROI (10)
11. is Dubai real estate a good investment in 2026
12. average rental yield Dubai apartments
13. best property types for rental income Dubai
14. off-plan vs ready property investment Dubai comparison
15. how to calculate ROI on Dubai property
16. risks of investing in Dubai real estate
17. Dubai property market forecast 2026 2027
18. why invest in Dubai property instead of stocks
19. Dubai real estate capital appreciation history
20. comparing Dubai property investment to London and Singapore

### Golden Visa & Residency (8)
21. how to get UAE Golden Visa through property investment
22. minimum property value for UAE Golden Visa 2026
23. UAE Golden Visa benefits for property investors
24. can my family get UAE residency through property purchase
25. UAE property investor visa vs Golden Visa difference
26. how long does UAE Golden Visa take to process
27. UAE retirement visa through property investment
28. Golden Visa UAE requirements and process 2026

### Areas & Projects (10)
29. best areas to invest in Dubai for high rental yield
30. Dubai Marina property investment guide
31. Downtown Dubai vs Business Bay investment comparison
32. Palm Jumeirah property prices and investment potential
33. Jumeirah Village Circle JVC rental yield and investment
34. Dubai Creek Harbour investment outlook
35. most affordable areas to buy property in Dubai
36. Dubai Hills Estate property investment review
37. which Dubai area has best capital appreciation
38. Emaar vs DAMAC which developer to choose

### Mortgage & Finance (10)
39. can foreigners get mortgage in Dubai
40. Dubai mortgage rates for non-residents 2026
41. minimum down payment property Dubai non-resident
42. how to finance off-plan property in Dubai
43. post-handover payment plan Dubai pros and cons
44. bank vs developer financing Dubai property
45. mortgage eligibility requirements Dubai expat
46. how much do I need to buy property in Dubai
47. service charges strata fees Dubai apartments
48. hidden costs when buying property Dubai

### Legal & Tax (7)
49. is there property tax in Dubai
50. capital gains tax on Dubai property for foreigners
51. inheritance laws property UAE for expats
52. RERA buyer protection rights Dubai
53. can a company LLC own property in Dubai
54. Dubai property ownership rights for non-Muslims
55. joint property ownership rules Dubai

### Market Context (5)
56. why is Dubai real estate so popular with investors
57. UAE property market stability and political risk
58. short term rental Airbnb regulations Dubai
59. property management companies Dubai for overseas investors
60. how Dubai real estate compares to other Gulf markets

---

## Acceptance Criteria

- [ ] Every other cron run generates a keyword-targeted article
- [ ] Keyword article title and content directly address the target search query
- [ ] Google News context is included in keyword articles (makes them timely)
- [ ] Mode flips correctly: keyword → news → keyword → …
- [ ] When bank exhausted: Telegram notification sent, no article generated, mode not flipped
- [ ] `/add_keyword <query>` appends to keywords.json and confirms in Telegram
- [ ] `/add_keyword` with empty text replies with usage hint
- [ ] Telegram preview shows `🔑 Keyword:` for keyword articles, `📡 Source: Google News` for news articles
- [ ] `npm run build` passes with no TypeScript errors
