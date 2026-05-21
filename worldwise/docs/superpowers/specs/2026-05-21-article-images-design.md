# AI images for auto-blog articles — design

Date: 2026-05-21
Status: approved (pending implementation plan)

## Problem

Auto-generated blog articles (and their Telegram channel posts) have no per-article
image. The website uses one static site-wide OG card for every article, and the
Telegram channel post is text + link only. We want a topical, on-brand image per
article — shown on the site, used as the article's OG/social image, and posted to
the Telegram channel.

## Decisions (locked during brainstorming)

- **Image kind:** AI-generated illustration, **on-topic per article**.
- **Provider:** Gemini `gemini-2.5-flash-image` (same `GEMINI_API_KEY` already on the
  server; verified the key has access). ~$0.04/image → ~$1–2/month at one article/day.
  (Higgsfield was evaluated but needs its own API key on the server for the unattended
  cron — can be added later behind a switch.)
- **Treatment:** AI photo as background + **brand overlay** (navy→gold scrim, tag chip,
  article title, and the **real logo file `public/images/logo-dark-bg.png` used
  unaltered**). One branded card, used everywhere.
- **Compositing:** reuse Next `ImageResponse` (`next/og`) — the project already does this
  in `app/opengraph-image.tsx`. No native image libs (sharp/canvas) added.
- **Surfaces:** article hero on the page, `/blog` list thumbnail, article `og:image` /
  `twitter:image`, Telegram approval message photo, Telegram channel post photo.
- **Scope:** new AI-generated articles only. Static editorial articles and existing
  articles keep the current static OG (no retrofit).
- **Failure = non-blocking:** if image generation or compositing fails, the article still
  publishes with `image` unset → site falls back to the static `/opengraph-image`,
  Telegram falls back to the current text post.

## End-to-end flow (`scripts/generate-article.mjs`, cron)

1. Gemini generates the article JSON — the response schema gains a required field
   **`imagePrompt`**: a short visual description on the article's topic, with the rule
   *"atmospheric Dubai real-estate scene; no text, no watermarks, no logos; not a
   specific identifiable building."*
2. Sanitize the Gemini `slug` to `^[a-z0-9-]+$` (filesystem-safe).
3. Call `gemini-2.5-flash-image` (`generateContent`) with `imagePrompt`; take the inline
   image data → save the raw photo to `public/images/blog/<slug>-raw.png`.
4. Bake the branded card: `GET http://localhost:3000/api/blog-image?slug=<slug>&title=<t>&tag=<tag>`
   → save the returned PNG to `public/images/blog/<slug>.png`. Set `draft.image =
   "/images/blog/<slug>.png"`.
5. Any failure in steps 3–4 → log and continue with `image` unset (article still drafts).

## Components

### `lib/dynamic-articles.ts` — type
- `DynamicArticle` gains `image?: string` (public path, e.g. `/images/blog/<slug>.png`).

### `app/api/blog-image/route.ts` (new) — branded compositor
- `GET /api/blog-image?slug=<slug>&title=<title>&tag=<tag>`.
- Validate `slug` against `^[a-z0-9-]{1,80}$`; 400 otherwise.
- Read `public/images/blog/<slug>-raw.png`; if missing → 404.
- Render `ImageResponse` (1200×630):
  - background: the raw photo, full-bleed `object-fit: cover`;
  - scrim: navy bottom + left gradient (matches the approved preview);
  - tag chip (gold), article title (Cormorant Garamond, ivory) — reuse `loadFont()` from
    `app/opengraph-image.tsx`;
  - **logo**: read `public/images/logo-dark-bg.png` and place it **unaltered** as
    `<img>` (data URL), same as `opengraph-image.tsx` (do not re-typeset a wordmark).
- Returns `image/png`. Only consumed by the cron (localhost); not used at page-serve time.

### `scripts/generate-article.mjs`
- Add `imagePrompt` to the Gemini response schema + a one-line prompt instruction.
- Add `generateImage(slug, imagePrompt)` → writes `<slug>-raw.png`, returns true/false.
- Add `bakeCard(slug, title, tag)` → fetch the compositor route, write `<slug>.png`.
- Wire into `main()` after the article is generated, before saving the draft; set
  `article.image` on success. Reuse `writeFileAtomic` only for JSON, not the PNGs.

### `app/api/telegram-webhook/route.ts` — channel post
- `postToChannel(article)`: if `article.image` is set, use **`sendPhoto`** with
  `photo = ${siteUrl}${article.image}` (Telegram fetches the public URL), `caption` = the
  current MarkdownV2 text (truncate caption to ≤1024 chars), `parse_mode: MarkdownV2`.
  If no image → current `sendMessage` text behaviour.

### `scripts/generate-article.mjs` — Telegram approval
- `sendTelegram(article, keyword)`: if `article.image` is set, send the approval as a
  **`sendPhoto`** (multipart upload of the local `public/images/blog/<slug>.png`) with the
  preview text as `caption` and the existing Publish/Skip `reply_markup`. If no image →
  current text message with buttons.

### Website
- `app/blog/[slug]/page.tsx`:
  - `generateMetadata`: if `article.image`, set `openGraph.images` / `twitter.images` to
    the absolute `https://worldwise.pro<article.image>`; else keep `/opengraph-image`.
  - Render a hero `<img src={article.image}>` at the top of the article when present.
- `app/blog/page.tsx` (listing): use `article.image` as the card thumbnail when present;
  keep the current placeholder/treatment when absent.

### Storage / deploy
- `public/images/blog/` is server-generated PII-free content but must not be committed or
  clobbered by local deploys → add `worldwise/public/images/blog/` to `.gitignore` and
  `--exclude='public/images/blog/'` to the deploy `rsync` (and CLAUDE.md deploy snippet).

## Edge cases & rules

- Gemini image model may return ~1:1; the compositor's `object-fit: cover` at 1200×630
  crops to the card — acceptable for skylines/atmospheric shots.
- The cron depends on the app being up at `localhost:3000` (PM2 always-on) to bake the
  card; if the fetch fails, fall back (no image).
- Telegram caption hard limit 1024 chars — truncate the excerpt portion if needed.
- The image prompt forbids text/watermarks/specific buildings to avoid misrepresenting a
  real listing (RERA/trust) and to keep the title legible from the overlay.
- Logo is used **as-is** from `public/images/logo-dark-bg.png` — never recoloured,
  stretched, or re-typeset.

## Verification

- Unit: slug sanitizer (pure) — valid/invalid inputs.
- Build passes; the `/api/blog-image` route compiles.
- Local: drop a raw PNG into `public/images/blog/test-raw.png`, hit
  `/api/blog-image?slug=test&title=...&tag=...`, confirm a branded 1200×630 PNG with the
  real logo.
- Server manual run of `generate-article.mjs`: approval message arrives **with image**;
  on Publish the channel post is a photo; the blog article page shows the hero and the
  per-article og:image; fallback path works when image generation is forced to fail.
