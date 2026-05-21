# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Before starting any task

Before writing a single line of code, state in one sentence how you will verify the work is correct — for example: "I'll run `npm run build`, open `/mortgage-calculator` in the browser and confirm the monthly payment updates when sliders change." Only then proceed. This applies to every task, including small edits.

## Core principles

- **Simplicity first** — every change as simple as possible. Minimum code.
- **No lazy fixes** — find root causes. No temporary patches. Senior-engineer standard.
- **Minimal footprint** — touch only what's necessary. No side effects.

## Workflow orchestration

### 1. Default planning mode

Use Plan mode for any non-trivial task (3+ steps or architecture). If something goes wrong — STOP and replan immediately. Use the plan for verification steps, not just building. Write detailed specs upfront — eliminate ambiguity before writing a line of code.

### 2. Subagent strategy

Use subagents generously — keep main context clean. Offload research, reconnaissance, and parallel analysis to subagents. For complex tasks, throw more compute at subagents. One task per subagent for focus.

### 3. Self-improvement cycle

After ANY user correction: update `tasks/lessons.md` with the pattern. Write yourself rules that prevent repeating the mistake. Ruthlessly iterate on lessons until errors drop. Re-read lessons at session start for the relevant project.

### 4. Verification before "done"

Never mark a task done without proving it works. Compare main behavior vs your changes when relevant. Ask yourself: "Would a staff engineer approve this?" Run tests, check logs, demonstrate correctness.

### 5. Demand elegance (in moderation)

On non-trivial changes: pause and ask "is there a more elegant path?" If a fix is a hack: "knowing everything now, make it elegant." Skip this for simple obvious fixes — no over-engineering. Doubt your work before showing it.

### 6. Autonomous bug fixing

Got a bug report — just fix it. Don't ask to be led by the hand. Point to logs, errors, failing tests — and close them. Zero context switching on the user's side. Go fix failing CI tests without hints on "how."

## Task management

1. **Plan first** — write plan in `tasks/todo.md` with checkboxes
2. **Review plan** — check before starting implementation
3. **Track progress** — mark items as you go
4. **Explain changes** — brief summary at each step
5. **Document** — add a review section to `tasks/todo.md` when done
6. **Fix lessons** — update `tasks/lessons.md` after any user correction

## Repository layout

The git root is `/Users/dzhambulat/Documents/Claude/`. The actual Next.js app lives in the `worldwise/` subdirectory — all commands below must be run from there.

## Common commands

Node is managed via NVM. If `npm` is not found, run one of these:

```bash
# Option 1 — export for the current shell session
export PATH="/Users/dzhambulat/.nvm/versions/node/v24.15.0/bin:$PATH"

# Option 2 — let nvm activate the right version
source ~/.nvm/nvm.sh && nvm use 24
```

From `worldwise/`:

- `npm run dev` — local dev server on <http://localhost:3000>
- `npm run build` — production build (must pass before deploying)
- `npm run lint` — ESLint check
- `npm run start` — run production build (PM2 uses this on server)

There is no test suite. Always run `npm run build` locally before deploying.

## What NOT to do

These constraints are non-negotiable — violating them causes data loss or security issues:

- **Never touch `data/` locally.** All files in `data/` exist only on the server — this includes `leads.json`, `users.json`, `properties.json`, `articles.json`, `article-draft.json`, `article-mode.json`, `article-keywords.json`, and `article-tag-index.json`. Never create, edit, or rsync them from local — they hold live business and state data.
- **Never add a database.** The JSON file approach is intentional — simple, zero-dependency, backed up automatically. A database would require a migration and breaks the single-PM2-instance assumption.
- **Never run multiple PM2 instances.** The file-based data layer has no locking. Two processes writing simultaneously will corrupt JSON.
- **Never change the session token payload structure** (`SessionPayload` in `lib/session.ts`) without invalidating all existing sessions first — the HMAC signs the exact payload shape.
- **Never install npm packages with native bindings** (C++ addons). `middleware.ts` runs in the Edge runtime which does not support native modules.
- **Never use external image URLs** for property photos or area images. All images must be in `public/images/`. Unsplash URLs in Hero.tsx are an accepted legacy exception.
- **Never add a lead capture form without the honeypot field.** Every form must include a hidden `<input ref={hpRef} />` and send `_hp` in the POST body. See existing components for the pattern.
- **Never `git add -A` or `git add .`** — stage files by name to avoid accidentally committing `.env.local` or leftover data files.

## Production deployment

Hetzner VPS `62.238.35.20` (Ubuntu 24.04). SSH key: `~/.ssh/id_ed25519`. Project at `/var/www/worldwise/`, PM2 process `worldwise`, Nginx reverse-proxies `localhost:3000`.

```bash
# 0. Backup data on server before any deploy
ssh -i ~/.ssh/id_ed25519 root@62.238.35.20 \
  "cp -r /var/www/worldwise/data /var/www/worldwise/data_backup_$(date +%Y%m%d_%H%M%S)"

# 1. Sync (exclude git, node_modules, build artifacts, server-only data, and env secrets)
rsync -avz --exclude='.git' --exclude='node_modules' --exclude='.next' --exclude='data/' --exclude='public/files/' --exclude='public/images/blog/' --exclude='.env.local' \
  -e "ssh -i ~/.ssh/id_ed25519" worldwise/ root@62.238.35.20:/var/www/worldwise/

# 2. Build and restart on server
ssh -i ~/.ssh/id_ed25519 root@62.238.35.20 \
  "cd /var/www/worldwise && npm install && npm run build && pm2 restart worldwise"
```

The server has a separate git repo at `/var/www/worldwise/` tracking only `data/` on the `data-backup` branch (auto-commits every 6 hours via cron, pushes to GitHub).

## DNS & infrastructure

DNS is managed via **Cloudflare** (nameservers: `ainsley.ns.cloudflare.com`, `sterling.ns.cloudflare.com`). A records for `worldwise.pro` and `www` point to `62.238.35.20` and are **Proxied** (orange cloud) — all visitor traffic flows through the Cloudflare edge, not directly to the origin. Cloudflare SSL/TLS mode is **Full (strict)**. Email MX records point to `mx1.hosting.reg.ru` / `mx2.hosting.reg.ru` (reg.ru hosting handles the mailbox for `dzhambulat@worldwise.pro`).

**Origin is locked to Cloudflare.** `ufw` allows ports 80/443 only from Cloudflare IP ranges (plus SSH on 22); direct requests to `62.238.35.20` are dropped. Refresh the CF ranges from `https://www.cloudflare.com/ips-v4` + `ips-v6` if Cloudflare changes them. Because the origin is not directly reachable, the **real visitor IP** is restored by nginx's `real_ip` module — see `/etc/nginx/conf.d/cloudflare-realip.conf` (`set_real_ip_from` CF ranges + `real_ip_header CF-Connecting-IP`). App code must read the client IP from `x-real-ip` (see `lib/ip.ts`), never `cf-connecting-ip` (spoofable).

SSL certificate is issued by Let's Encrypt via certbot, auto-renewed by the `certbot.timer` systemd unit. **Renewal uses the DNS-01 challenge** (`certbot-dns-cloudflare`) — *not* `--nginx`, which would fail since port 80 is firewalled to Cloudflare only. Cloudflare API token (scope `Zone:DNS:Edit` + `Zone:Zone:Read`) lives in `/root/.secrets/cloudflare.ini` (chmod 600); a deploy hook at `/etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh` reloads nginx after renewal. Test with `certbot renew --dry-run`.

A full security & privacy audit (findings + remediation status) is in `worldwise/tasks/security-audit.md`; recurring operational lessons in `worldwise/tasks/lessons.md`.

## Project status (May 2026)

**Live and complete:**

- Public site: homepage, `/properties` listing, `/properties/[slug]` detail pages
- Blog: `/blog` listing + `/blog/[slug]` — static editorial articles in `lib/articles.ts` + AI-generated articles from `data/articles.json`
- Auto-blog pipeline: Gemini-powered article generator runs daily at 09:00 UTC, alternates keyword/news mode, Telegram approval flow
- Analytics: GA4 (consent-aware) with conversion event tracking on all lead forms and CTAs
- Tools: `/mortgage-calculator` — dedicated SEO/ads landing page with full calculator
- Admin CRM: `/admin` (stats + properties), `/admin/leads` (full CRM), `/admin/users` (owner-only)
- Multi-user auth: bcryptjs + HMAC-signed session tokens, role-based access (`owner` / `manager`)
- Activity log on leads, anti-spam on lead capture, CSV export
- SEO layer: sitemap (ISR 1h revalidation), robots, JSON-LD, per-property og:image
- Infrastructure: Cloudflare DNS, Hetzner VPS, PM2 + Nginx, Let's Encrypt SSL, git-based data backup

**Not built yet (possible next steps):**

- Area-specific landing pages (e.g. `/dubai-marina`, `/downtown-dubai`)
- WhatsApp chat widget
- Property comparison feature
- Meta Pixel integration

## Conversion & UX logic

The primary goal of the site is lead capture: getting a visitor to submit their phone number and name. Every page decision should serve this.

**Conversion hierarchy:**

1. `FloatingCTA` — persistent WhatsApp + phone buttons, present on every page. Never remove.
2. `LeadModal` — modal form triggered by CTAs throughout the site. Tracks `source` for analytics.
3. `LeadCaptureSection` — full-width section at the bottom of the homepage, last chance before footer.

**Key conversion pages:**

- `/properties/[slug]` — warmest traffic (visitor looked at a specific property). Has `PropertyEnquiryForm` embedded. This is the highest-converting page.
- `/mortgage-calculator` — designed as a Google Ads landing page. Calculator as the hook, lead form as the exit. Do not clutter with navigation distractions.
- Homepage — awareness + trust building. MortgageCalculator, Testimonials and BlogPreview support the journey to contact.

**Lead `source` strings in use** (keep consistent for CRM analytics):
`hero_cta`, `mortgage_calculator`, `property_enquiry`, `lead_capture_section`, `floating_cta`, `blog_cta`, `telegram`, `property_finder`, `bayut`, `instagram_dm`, `whatsapp`, `other`
The last six are set by the Telegram bot lead intake (an agent pastes a lead → the bot saves it and the source is chosen via inline buttons; default `telegram` until a button is tapped).

**UX rules:**

- Every page must include `<FloatingCTA />` and `<Footer />`.
- New feature pages that are meant for ads (high-intent traffic) should have minimal navigation — calculator or tool at the top, CTA at the bottom.
- Blog articles end with a CTA to consultation — do not make them dead ends.
- All copy in English. No Russian on any public-facing page.

## Architecture

Next.js 14 App Router, TypeScript, Tailwind CSS.

### Data layer — file-based JSON, no database

All JSON files live in `data/` on the server only — never committed to git, never rsynced from local. Read/written synchronously.

| File | Library | Type |
| ---- | ------- | ---- |
| `data/properties.json` | `lib/properties.ts` | `Property[]` |
| `data/leads.json` | `lib/leads.ts` | `Lead[]` |
| `data/users.json` | `lib/users.ts` | `AdminUser[]` |
| `data/articles.json` | `lib/dynamic-articles.ts` | `DynamicArticle[]` (published AI articles) |
| `data/article-draft.json` | `lib/dynamic-articles.ts` | `DynamicArticle \| null` (pending Telegram approval) |
| `data/article-mode.json` | `scripts/generate-article.mjs` | `{ mode: "keyword" \| "news" }` |
| `data/article-keywords.json` | `scripts/generate-article.mjs` | `{ keywords: string[], index: number }` |
| `data/article-tag-index.json` | `lib/dynamic-articles.ts` + script | `{ index: number }` (round-robin tag rotation) |

`types/index.ts` is the single source of truth for all shapes. Key types: `Property`, `Lead`, `LeadStatus` (`'new' | 'contacted' | 'in-progress' | 'won' | 'lost'`), `AdminUser`, `AdminRole` (`'owner' | 'manager'`), `ActivityEntry`.

Single PM2 instance only — concurrent writes from multiple processes would corrupt JSON.

### Auth — multi-user, signed session tokens

`lib/session.ts` issues and verifies signed tokens using Web Crypto (`crypto.subtle` HMAC-SHA256). Token format: `base64url(JSON(payload)).hmac-sha256`. Signed with the dedicated `SESSION_SECRET` env var (high-entropy, separate from `ADMIN_PASSWORD`). `SessionPayload` carries `uid`, `username`, `name`, `role`.

`lib/users.ts` handles user CRUD with bcryptjs password hashing. `data/users.json` stores `AdminUser[]` (passwords as bcrypt hashes).

**First-run bootstrap:** only when `data/users.json` is empty (no users exist) and the login password matches `ADMIN_PASSWORD`, the owner account is auto-created. Once any user exists, `ADMIN_PASSWORD` can no longer mint accounts. No manual seeding needed.

`middleware.ts` (Edge runtime) guards `/admin/:path*` by verifying the signed token from the `ww_admin_session` cookie. `/admin/users` additionally requires `role === 'owner'`.

Every mutating API handler also calls `isAuthenticated()` / `getSession()` from `lib/auth.ts` — defence-in-depth since middleware does not run on API routes.

`lib/auth.ts` exports:

- `getSession()` → `SessionPayload | null` — use when you need the user identity (e.g. activity log)
- `isAuthenticated()` → `boolean` — use for simple auth checks
- Both are `async` (HMAC verification).

### Admin routes

- `/admin` — property table + stats (properties count, lead counts)
- `/admin/leads` — full CRM: filter by status/source/search, inline status change, notes, activity log, CSV export
- `/admin/users` — owner-only: add/edit/deactivate/delete admin accounts, reset passwords
- `/admin/property/new` and `/admin/property/[id]` — both use `PropertyForm` (drag-and-drop gallery, DLD QR + permit/project numbers)

### API routes

| Route | Auth | Purpose |
| ----- | ---- | ------- |
| `POST /api/leads` | none | Save lead → Telegram + email notify |
| `GET /api/leads` | any admin | List all leads |
| `PUT /api/leads/[id]` | any admin | Update status/notes; appends `ActivityEntry` with actor from session |
| `DELETE /api/leads/[id]` | any admin | Remove lead |
| `GET /api/admin/users` | owner only | List users (passwordHash stripped) |
| `POST /api/admin/users` | owner only | Create user |
| `PUT /api/admin/users/[id]` | owner only | Update name/role/active/password |
| `DELETE /api/admin/users/[id]` | owner only | Delete user (cannot delete self) |
| `POST /api/upload?kind=gallery\|qr` | any admin | Save images to `public/images/` |
| `GET/POST /api/properties` | GET public | List / create properties |
| `PUT/DELETE /api/properties/[id]` | any admin | Update / delete property |
| `POST /api/telegram-webhook` | `WEBHOOK_SECRET` header | Receives Telegram callbacks: publish/skip article buttons, `/add_keyword` command |

### Activity log

`lib/leads.ts` `updateLead()` accepts an optional `actor` param `{ uid, username, name }`. When provided, it appends an `ActivityEntry` to `lead.activityLog[]` describing what changed (status transition and/or notes update). The `PUT /api/leads/[id]` handler always passes the session user as actor. The log is displayed in reverse-chronological order in the expanded lead row in `LeadsClient.tsx`.

### Anti-spam (lead capture)

`POST /api/leads` enforces: honeypot field (`_hp`) check → phone digit validation (7–15 digits) → in-memory rate limit (10 submissions/IP/hour). Rate limit is counted after validation so typos don't consume quota. The `rateMap` resets per 1-hour window and lives in module state (single PM2 instance).

All lead capture components (`LeadModal`, `MortgageCalculator`, `LeadCaptureSection`, `PropertyEnquiryForm`, `FloatingCTA`) include a hidden honeypot `<input>` and send `_hp` in the POST body. Keep `source` strings consistent across components for analytics.

### Blog / articles

Two article sources, merged by `lib/articles.ts`:

1. **Static editorial** — `articles` array in `lib/articles.ts`. Add an entry here for manually written articles. Shape: `{ slug, tag, title, excerpt, readTime, content }` where `content` is a Markdown-like string parsed by `parseContent()`.

2. **AI-generated** — `data/articles.json` on the server (server-only, never committed). Managed by `lib/dynamic-articles.ts`. Shape adds `publishedAt` and `source: 'ai-generated'`.

`getAllArticles()` in `lib/articles.ts` returns `[...dynamic, ...static]` — dynamic articles sort first (newest at top). `getArticleBySlug()` checks dynamic first, then static. Both functions are used by the blog listing page, article page, and sitemap.

`app/blog/[slug]/page.tsx` uses a custom `parseContent()` parser that converts the content string into typed blocks (h2, h3, p, ul, ol, table). `generateStaticParams()` pre-renders static article slugs at build time; dynamic article routes are rendered on demand.

### Auto-blog pipeline

Cron runs `scripts/generate-article.mjs` daily at 09:00 UTC (`0 9 * * *`). The script is a Node.js ESM module invoked with `node --env-file=.env.local scripts/generate-article.mjs`.

**Mode alternation:** `data/article-mode.json` holds `{ mode: "keyword" | "news" }`. Each successful generation flips the mode. On Gemini failure the mode is NOT flipped — the next run retries the same mode.

- **keyword mode** — picks the next query from `data/article-keywords.json` (`keywords[index]`), fetches Google News RSS for supporting context, prompts Gemini to write a 600–800 word SEO article answering that specific investor search query, increments `index`.
- **news mode** — fetches Google News RSS, prompts Gemini to summarise recent UAE property headlines.

**Keyword bank exhaustion:** when `index >= keywords.length`, the script sends a Telegram notification and exits without generating an article or flipping the mode.

**Approval flow:** generated article is saved to `data/article-draft.json`. Telegram message is sent with Publish / Skip inline buttons. `POST /api/telegram-webhook` handles button callbacks via `publishDraft()` / `deleteDraft()` from `lib/dynamic-articles.ts`. The `/add_keyword <query>` Telegram text command appends to `data/article-keywords.json` — only accepted from the first chat ID in `TELEGRAM_CHAT_ID`.

**Tag rotation:** `data/article-tag-index.json` cycles through `['Market Update', 'Investment Guide', 'Area Spotlight', 'Legal Guide', 'Visa & Residency']`. This index is shared between the script and `lib/dynamic-articles.ts` — do not rename `TAGS` or change its order without updating both files.

**To run manually on server:**

```bash
ssh -i ~/.ssh/id_ed25519 root@62.238.35.20 \
  "cd /var/www/worldwise && node --env-file=.env.local scripts/generate-article.mjs"
```

**To monitor cron logs:**

```bash
ssh -i ~/.ssh/id_ed25519 root@62.238.35.20 "tail -50 /var/log/worldwise-blog.log"
```

### Analytics

`components/Analytics.tsx` — consent-aware GA4 loader. Renders `<Script>` tags only after the user accepts cookies. Listens for the `ww_consent_accepted` custom event dispatched by `CookieBanner.tsx` (also checks `localStorage` on mount for returning visitors). Mounted in `app/layout.tsx`.

`lib/analytics.ts` — thin `track(event, params?)` helper that calls `window.gtag()` when available. Import this in any client component that needs to fire a GA4 event. Do not call `window.gtag` directly.

**Events in use:** `lead_form_submit` (source + optional property), `whatsapp_click` (source + optional property), `property_view` (property title).

### SEO / crawler layer

- `app/robots.ts` — blocks `/admin` and `/api`
- `app/sitemap.ts` — dynamic sitemap (homepage + /blog + /mortgage-calculator + /properties + all property and article slugs)
- `app/layout.tsx` — `metadataBase`, default `og:image`, `twitter:card: summary_large_image`, JSON-LD `RealEstateAgent`
- `app/properties/[slug]/page.tsx` — per-property `og:image`, JSON-LD `RealEstateListing` + `BreadcrumbList`
- `app/mortgage-calculator/page.tsx` — JSON-LD `WebApplication` + `FAQPage` (5 questions)
- `public/llms.txt` — plain-text site summary for AI crawlers

### Images

Local area images: `public/images/areas/` — never use external URLs. Property galleries: `public/images/properties/<id>/`. QR codes: `public/images/qr/`.

### Styling

Custom Tailwind palette: `navy` / `gold` (see `tailwind.config.ts`). Global button utilities `btn-primary`, `btn-outline`, `btn-outline-gold` in `app/globals.css` — use for all CTAs.

## Environment variables

See `.env.example`. Key vars:

- `ADMIN_PASSWORD` — first-run owner bootstrap password only (no longer signs tokens)
- `SESSION_SECRET` — high-entropy key that signs/verifies session tokens; must differ from `ADMIN_PASSWORD`. Rotating it logs out all admins. Generate with `openssl rand -base64 48`
- `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` — lead notifications and auto-blog approvals; comma-separated for multiple recipients. The first ID is the admin who can use `/add_keyword`.
- `WEBHOOK_SECRET` — validates `X-Telegram-Bot-Api-Secret-Token` header on `POST /api/telegram-webhook`
- `GEMINI_API_KEY` — Gemini 2.0 Flash API key used by `scripts/generate-article.mjs`
- `SMTP_HOST/PORT/USER/PASS` + `NOTIFY_EMAIL` — optional email notifications via nodemailer
- `NEXT_PUBLIC_SITE_URL` — absolute URLs in Telegram messages and sitemap
- `NEXT_PUBLIC_GA_ID` — Google Analytics 4 Measurement ID (e.g. `G-XXXXXXXXXX`); GA loads only after cookie consent
- `NEXT_PUBLIC_WHATSAPP`, `NEXT_PUBLIC_PHONE`, `NEXT_PUBLIC_EMAIL` — contact details in `FloatingCTA` and `Footer`
