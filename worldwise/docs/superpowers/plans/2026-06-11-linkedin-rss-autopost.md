# Blog RSS Feed + LinkedIn Autopost Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose the blog (static + AI digest articles) as an RSS 2.0 feed at `/blog/rss.xml` so a Zapier Zap can auto-share each newly published article on the Worldwise LinkedIn Company Page.

**Architecture:** A pure, dependency-free XML builder in `lib/rss.ts` (node:test-covered, following the `lib/slug.ts` pattern) + a thin route handler `app/blog/rss.xml/route.ts` that feeds it from `getAllArticles()`. No LinkedIn code server-side — Zapier polls the feed. Spec: `docs/superpowers/specs/2026-06-11-linkedin-rss-autopost-design.md`.

**Tech Stack:** Next.js 16 route handler (ISR `revalidate = 3600`), TypeScript, `node --test --experimental-strip-types`.

---

### Task 1: Pure RSS builder `lib/rss.ts` (TDD)

**Files:**
- Test: `lib/rss.test.ts`
- Create: `lib/rss.ts`

Constraint (CLAUDE.md): pure lib modules under node:test must use relative imports **with extension** (`./rss.ts`), never `@/`.

- [ ] **Step 1: Write the failing test**

```ts
// lib/rss.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { escapeXml, buildRssXml } from './rss.ts'

test('escapeXml escapes all five XML special characters', () => {
  assert.equal(escapeXml(`<a href="x">&'</a>`), '&lt;a href=&quot;x&quot;&gt;&amp;&apos;&lt;/a&gt;')
})

test('buildRssXml neutralises hostile AI-generated titles', () => {
  const xml = buildRssXml({
    title: 'Blog', link: 'https://worldwise.pro/blog',
    selfUrl: 'https://worldwise.pro/blog/rss.xml', description: 'd',
    items: [{ title: '</script><script>alert(1)</script>', link: 'https://worldwise.pro/blog/x', description: 'a & b <c>' }],
  })
  assert.ok(!xml.includes('<script>'))
  assert.ok(xml.includes('&lt;/script&gt;'))
  assert.ok(xml.includes('a &amp; b &lt;c&gt;'))
})

test('item with pubDate renders RFC-822 date; without pubDate omits the tag', () => {
  const base = {
    title: 'Blog', link: 'https://worldwise.pro/blog',
    selfUrl: 'https://worldwise.pro/blog/rss.xml', description: 'd',
  }
  const dated = buildRssXml({ ...base, items: [{ title: 't', link: 'l', description: 'd', pubDate: '2026-06-10T09:00:00.000Z' }] })
  assert.ok(dated.includes('<pubDate>Wed, 10 Jun 2026 09:00:00 GMT</pubDate>'))
  const undated = buildRssXml({ ...base, items: [{ title: 't', link: 'l', description: 'd' }] })
  assert.ok(!undated.includes('<pubDate>'))
})

test('channel skeleton: xml declaration, guid permalink, atom self link', () => {
  const xml = buildRssXml({
    title: 'Blog', link: 'https://worldwise.pro/blog',
    selfUrl: 'https://worldwise.pro/blog/rss.xml', description: 'd',
    items: [{ title: 't', link: 'https://worldwise.pro/blog/x', description: 'd' }],
  })
  assert.ok(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>'))
  assert.ok(xml.includes('<guid isPermaLink="true">https://worldwise.pro/blog/x</guid>'))
  assert.ok(xml.includes('<atom:link href="https://worldwise.pro/blog/rss.xml" rel="self" type="application/rss+xml"/>'))
  assert.ok(xml.includes('<language>en</language>'))
})
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `worldwise/`): `node --test --experimental-strip-types lib/rss.test.ts`
Expected: FAIL — `Cannot find module './rss.ts'`

- [ ] **Step 3: Write the implementation**

```ts
// lib/rss.ts
// Pure RSS 2.0 XML builder — no fs/next imports so it stays node:test-able.
// escapeXml is load-bearing: article titles/excerpts include AI-generated text
// (same untrusted-content class as the JSON-LD invariant in lib/jsonld.ts).

export interface RssItem {
  title: string
  link: string
  description: string
  /** ISO date string; static editorial articles have no date — tag is omitted */
  pubDate?: string
}

export interface RssChannel {
  title: string
  link: string
  selfUrl: string
  description: string
  items: RssItem[]
}

export function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export function buildRssXml(channel: RssChannel): string {
  const items = channel.items
    .map(item => {
      const pubDate = item.pubDate
        ? `\n      <pubDate>${new Date(item.pubDate).toUTCString()}</pubDate>`
        : ''
      return `    <item>
      <title>${escapeXml(item.title)}</title>
      <link>${escapeXml(item.link)}</link>
      <description>${escapeXml(item.description)}</description>
      <guid isPermaLink="true">${escapeXml(item.link)}</guid>${pubDate}
    </item>`
    })
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(channel.title)}</title>
    <link>${escapeXml(channel.link)}</link>
    <description>${escapeXml(channel.description)}</description>
    <language>en</language>
    <atom:link href="${escapeXml(channel.selfUrl)}" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>
`
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test --experimental-strip-types lib/rss.test.ts`
Expected: PASS, 4/4

- [ ] **Step 5: Commit**

```bash
git add worldwise/lib/rss.ts worldwise/lib/rss.test.ts
git commit -m "feat(blog): pure RSS 2.0 builder with XML escaping (node:test'd)"
```

### Task 2: Feed route + discovery link

**Files:**
- Create: `app/blog/rss.xml/route.ts`
- Modify: `app/layout.tsx` (alternates block, ~line 45)

- [ ] **Step 1: Create the route handler**

```ts
// app/blog/rss.xml/route.ts
import { getAllArticles } from '@/lib/articles'
import { buildRssXml } from '@/lib/rss'

export const revalidate = 3600

const BASE = 'https://worldwise.pro'

export function GET() {
  const items = getAllArticles()
    .slice(0, 20)
    .map(a => ({
      title: a.title,
      link: `${BASE}/blog/${a.slug}`,
      description: a.excerpt,
      pubDate: 'publishedAt' in a ? a.publishedAt : undefined,
    }))

  const xml = buildRssXml({
    title: 'Worldwise — Dubai Real Estate Blog',
    link: `${BASE}/blog`,
    selfUrl: `${BASE}/blog/rss.xml`,
    description:
      'Dubai property market news, investment guides and area insights from Worldwise.',
    items,
  })

  return new Response(xml, {
    headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' },
  })
}
```

Note: `getAllArticles()` already returns dynamic (dated) articles first and dedupes slugs — no extra sorting needed; static undated articles sit in the tail and are never picked up by the autoposter.

- [ ] **Step 2: Add feed discovery to root metadata**

In `app/layout.tsx`, extend the existing `alternates` block:

```ts
  alternates: {
    canonical: 'https://worldwise.pro',
    types: { 'application/rss+xml': 'https://worldwise.pro/blog/rss.xml' },
  },
```

- [ ] **Step 3: Verify locally**

```bash
npm run build                                  # must pass
node --test --experimental-strip-types lib/*.test.ts   # all suites still green
```

Then against the dev server (beware lessons.md: kill any stale process on :3000 first):

```bash
npm run dev &
sleep 5
curl -s http://localhost:3000/blog/rss.xml | xmllint --noout - && echo XML-OK
curl -s http://localhost:3000/blog/rss.xml | head -30   # eyeball items
curl -s http://localhost:3000/ | grep -o 'application/rss+xml[^>]*'   # discovery link present
kill %1
```

Expected: `XML-OK`, items match `/blog`, `<link rel="alternate" type="application/rss+xml" ...>` in the homepage head.

- [ ] **Step 4: Commit**

```bash
git add worldwise/app/blog/rss.xml/route.ts worldwise/app/layout.tsx
git commit -m "feat(blog): RSS 2.0 feed at /blog/rss.xml + discovery link"
```

### Task 3: Deploy and verify on prod

- [ ] **Step 1: Push to the primary remote**

```bash
git push claude main
```

- [ ] **Step 2: Backup server data (non-negotiable)**

```bash
ssh -i ~/.ssh/id_ed25519 root@62.238.35.20 \
  "cp -r /var/www/worldwise/data /var/www/worldwise/data_backup_$(date +%Y%m%d_%H%M%S)"
```

- [ ] **Step 3: Rsync from main working tree** (deploying from `main`, tree clean)

```bash
rsync -avz --exclude='.git' --exclude='node_modules' --exclude='.next' --exclude='data/' --exclude='public/files/' --exclude='public/images/blog/' --exclude='.env.local' --exclude='AGENTS.md' --exclude='CLAUDE.md' --exclude='ruvector.db' --exclude='file-storage/' \
  -e "ssh -i ~/.ssh/id_ed25519" worldwise/ root@62.238.35.20:/var/www/worldwise/
```

- [ ] **Step 4: Post-rsync clobber check, then server build**

```bash
ssh -i ~/.ssh/id_ed25519 root@62.238.35.20 "ls /var/www/worldwise/app/blog/rss.xml/route.ts && ls /var/www/worldwise/lib/rss.ts"
ssh -i ~/.ssh/id_ed25519 root@62.238.35.20 "cd /var/www/worldwise && npm install && npm run build && pm2 restart worldwise"
```

- [ ] **Step 5: Verify prod feed**

```bash
curl -s https://worldwise.pro/blog/rss.xml | xmllint --noout - && echo PROD-XML-OK
curl -s https://worldwise.pro/blog/rss.xml | head -30
```

Optionally run https://validator.w3.org/feed/ on the URL.

### Task 4: Zapier Zap (manual, user-driven — OAuth must be done by the page admin)

- [ ] **Step 1:** In Zapier: Create Zap → Trigger **RSS by Zapier → New Item in Feed**, Feed URL `https://worldwise.pro/blog/rss.xml`, leave username/password empty, "Different GUID/URL" as the trigger condition. Test trigger — it should pull the latest article.
- [ ] **Step 2:** Action **LinkedIn Pages → Create Share Update** (NOT plain "LinkedIn", which posts to the personal profile). Connect the LinkedIn account that admins the Worldwise page, pick the Company Page. Comment field: `{{Title}}` + newline + `{{Link}}`; LinkedIn unfurls the og:image card from the article URL automatically.
- [ ] **Step 3:** Test the action (posts the latest article once — acceptable as the visible "feature live" post), publish the Zap.
- [ ] **Step 4:** End-to-end check after the next digest: press Publish in Telegram → article on site → LinkedIn post within ~15 min of the next Zapier poll.
