# LinkedIn autopost via blog RSS feed — design

**Date:** 2026-06-11
**Status:** approved (option A chosen over direct LinkedIn API / Zapier webhook)

## Goal

The daily AI news digest (and any blog article) that is published to the site after
Telegram approval should also appear on the Worldwise LinkedIn **Company Page**
automatically, with no manual reposting.

## Decision

No LinkedIn API integration in our code. Instead:

1. The site exposes an RSS 2.0 feed of the blog.
2. A third-party autoposter (Zapier, free plan — account already exists) polls the
   feed and creates a share on the LinkedIn Company Page for each new item.

Rejected alternatives:

- **Direct LinkedIn API (Community Management API)** — requires LinkedIn app review
  (may be refused), 60-day access tokens with manual re-auth forever, more code and
  secrets. Can be adopted later; the RSS feed stays useful regardless.
- **Zapier Catch Hook from the publish flow** — instant + custom post text, but
  Webhooks by Zapier is a premium trigger (paid plan).

## Component 1 — RSS feed `app/blog/rss.xml/route.ts`

- Route handler (same family as `app/sitemap.ts`), `revalidate = 3600`.
- Source: `getAllArticles()` from `lib/articles.ts` — already merges static
  editorial + AI-generated articles and collapses slug collisions; the feed
  inherits that behaviour for free.
- Take the newest ~20 items (dynamic articles first — `getAllArticles()` already
  orders dynamic-newest-first).
- Per `<item>`: `title`, `link` = `https://worldwise.pro/blog/<slug>`,
  `description` = excerpt, `guid isPermaLink="true"` = link (autoposter dedup key),
  `pubDate` = `publishedAt` for dynamic articles (`'publishedAt' in a` discriminates,
  as in `sitemap.ts`); static articles have no date → omit `pubDate`. Autoposters
  only post items that appear after the feed is connected, so the undated static
  backlog is never posted.
- **XML escaping is load-bearing**: titles/excerpts of AI articles are untrusted
  (same threat class as the JSON-LD invariant). All interpolated text goes through
  a local `escapeXml()` helper (`& < > " '`). No raw string interpolation.
- Channel metadata: title "Worldwise Dubai Real Estate Blog", link `/blog`,
  description, `language: en`, `atom:link rel="self"` to the feed URL.
- Discovery: add `<link rel="alternate" type="application/rss+xml" ...>` via the
  `alternates.types` field of the root metadata in `app/layout.tsx`.

## Component 2 — Zapier Zap (manual setup, UI)

- Trigger: **RSS by Zapier → New Item in Feed**, feed URL
  `https://worldwise.pro/blog/rss.xml` (free trigger, ~15-min polling).
- Action: **LinkedIn Pages → Create Share Update** on the Worldwise Company Page.
  Post body: item title + link; LinkedIn unfurls the preview card from the article
  page's existing og tags.
- OAuth to LinkedIn is done by the page admin (user) in the Zapier UI.
- Volume: 1 article/day ≈ 30 tasks/month — fits the free plan's 100 tasks/month.

## Out of scope (YAGNI)

- No server-side LinkedIn code, tokens, or env vars.
- No custom post copy / hashtags (that is the future "option B" upgrade).
- No `enclosure` images in v1 — LinkedIn takes the og:image from the page.

## Verification

1. `npm run build` passes locally.
2. `curl localhost:3000/blog/rss.xml` → well-formed XML (`xmllint --noout`),
   items match `/blog`.
3. Deploy (backup `data/` first, rsync from `main`, server build, pm2 restart).
4. `curl https://worldwise.pro/blog/rss.xml` + W3C Feed Validator.
5. Connect the Zap, run its built-in test on the latest item.
6. Next day's digest: press Publish in Telegram → post appears on the LinkedIn
   page within ~15 minutes.
