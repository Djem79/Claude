# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

The git root is `/Users/dzhambulat/Documents/Claude/`. The actual Next.js app lives in the `worldwise/` subdirectory — all commands below must be run from there.

## Common commands

Node is managed via NVM; the binary is not on the default PATH. Prefix or export before running npm:

```bash
export PATH="/Users/dzhambulat/.nvm/versions/node/v24.15.0/bin:$PATH"
```

From `worldwise/`:

- `npm run dev` — local dev server on <http://localhost:3000>
- `npm run build` — production build (must pass before deploying)
- `npm run lint` — ESLint check
- `npm run start` — run production build (PM2 uses this on server)

There is no test suite.

## Production deployment

Hetzner VPS `62.238.35.20` (Ubuntu 24.04). SSH key: `~/.ssh/id_ed25519`. Project at `/var/www/worldwise/`, PM2 process `worldwise`, Nginx reverse-proxies `localhost:3000`.

```bash
# 0. Backup data on server before any deploy
ssh -i ~/.ssh/id_ed25519 root@62.238.35.20 \
  "cp -r /var/www/worldwise/data /var/www/worldwise/data_backup_$(date +%Y%m%d_%H%M%S)"

# 1. Sync (exclude git, node_modules, build artifacts, and server-only data)
rsync -avz --exclude='.git' --exclude='node_modules' --exclude='.next' --exclude='data/' \
  -e "ssh -i ~/.ssh/id_ed25519" worldwise/ root@62.238.35.20:/var/www/worldwise/

# 2. Build and restart on server
ssh -i ~/.ssh/id_ed25519 root@62.238.35.20 \
  "cd /var/www/worldwise && npm install && npm run build && pm2 restart worldwise"
```

**Critical:** `data/` lives only on the server. Never rsync it from local — it holds live leads, properties, and user accounts. Always exclude `data/`.

The server has a separate git repo at `/var/www/worldwise/` tracking only `data/` on the `data-backup` branch (auto-commits every 6 hours via cron, pushes to GitHub).

## DNS & infrastructure

DNS is managed via **Cloudflare** (nameservers: `ainsley.ns.cloudflare.com`, `sterling.ns.cloudflare.com`). A records for `worldwise.pro` and `www` point to `62.238.35.20`. Email MX records point to `mx1.hosting.reg.ru` / `mx2.hosting.reg.ru` (reg.ru hosting handles the mailbox for `dzhambulat@worldwise.pro`).

SSL certificate on the Hetzner server is issued by Let's Encrypt via certbot, valid until August 2026. To renew: `certbot renew --nginx` on the server, then `systemctl reload nginx`.

## Architecture

Next.js 14 App Router, TypeScript, Tailwind CSS.

### Data layer — file-based JSON, no database

Three JSON files, all read/written synchronously by their respective `lib/` modules:

| File | Library | Type |
| ---- | ------- | ---- |
| `data/properties.json` | `lib/properties.ts` | `Property[]` |
| `data/leads.json` | `lib/leads.ts` | `Lead[]` |
| `data/users.json` | `lib/users.ts` | `AdminUser[]` |

`types/index.ts` is the single source of truth for all shapes. Key types: `Property`, `Lead`, `LeadStatus` (`'new' | 'contacted' | 'in-progress' | 'won' | 'lost'`), `AdminUser`, `AdminRole` (`'owner' | 'manager'`), `ActivityEntry`.

Single PM2 instance only — concurrent writes from multiple processes would corrupt JSON.

### Auth — multi-user, signed session tokens

`lib/session.ts` issues and verifies signed tokens using Web Crypto (`crypto.subtle` HMAC-SHA256). Token format: `base64url(JSON(payload)).hmac-sha256`. Signed with `ADMIN_PASSWORD` env var. `SessionPayload` carries `uid`, `username`, `name`, `role`.

`lib/users.ts` handles user CRUD with bcryptjs password hashing. `data/users.json` stores `AdminUser[]` (passwords as bcrypt hashes).

**First-run bootstrap:** if `data/users.json` is empty and the login password matches `ADMIN_PASSWORD`, the owner account is auto-created. No manual seeding needed.

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

### Activity log

`lib/leads.ts` `updateLead()` accepts an optional `actor` param `{ uid, username, name }`. When provided, it appends an `ActivityEntry` to `lead.activityLog[]` describing what changed (status transition and/or notes update). The `PUT /api/leads/[id]` handler always passes the session user as actor. The log is displayed in reverse-chronological order in the expanded lead row in `LeadsClient.tsx`.

### Anti-spam (lead capture)

`POST /api/leads` enforces: honeypot field (`_hp`) check → phone digit validation (7–15 digits) → in-memory rate limit (10 submissions/IP/hour). Rate limit is counted after validation so typos don't consume quota. The `rateMap` resets per 1-hour window and lives in module state (single PM2 instance).

All lead capture components (`LeadModal`, `ROICalculator`, `LeadCaptureSection`, `PropertyEnquiryForm`, `FloatingCTA`) include a hidden honeypot `<input>` and send `_hp` in the POST body. Keep `source` strings consistent across components for analytics.

### Blog / articles

Static editorial content lives in `lib/articles.ts` as a plain array of `Article` objects (no database, no CMS). Each article has `slug`, `tag`, `title`, `excerpt`, `readTime`, and `content` (Markdown-like string).

- `app/blog/page.tsx` — listing of all articles
- `app/blog/[slug]/page.tsx` — individual article; uses a custom `parseContent()` parser that converts the content string into typed blocks (h2, h3, p, ul, ol, table) and renders them with Tailwind styling. `generateStaticParams()` pre-renders all slugs at build time.

To add a new article: push an entry to the `articles` array in `lib/articles.ts`. The listing page, article page and sitemap all pick it up automatically.

### SEO / crawler layer

- `app/robots.ts` — blocks `/admin` and `/api`
- `app/sitemap.ts` — dynamic sitemap (homepage + /blog + /properties + all property and article slugs)
- `app/layout.tsx` — `metadataBase`, default `og:image`, `twitter:card: summary_large_image`, JSON-LD `RealEstateAgent`
- `app/properties/[slug]/page.tsx` — per-property `og:image`, JSON-LD `RealEstateListing` + `BreadcrumbList`
- `public/llms.txt` — plain-text site summary for AI crawlers

### Images

Local area images: `public/images/areas/` — never use external URLs. Property galleries: `public/images/properties/<id>/`. QR codes: `public/images/qr/`.

### Styling

Custom Tailwind palette: `navy` / `gold` (see `tailwind.config.ts`). Global button utilities `btn-primary`, `btn-outline`, `btn-outline-gold` in `app/globals.css` — use for all CTAs.

## Environment variables

See `.env.example`. Key vars:

- `ADMIN_PASSWORD` — used to sign/verify session tokens and for first-run owner bootstrap
- `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` — lead notifications; comma-separated for multiple recipients
- `SMTP_HOST/PORT/USER/PASS` + `NOTIFY_EMAIL` — optional email notifications via nodemailer
- `NEXT_PUBLIC_SITE_URL` — absolute URLs in Telegram messages and sitemap
- `NEXT_PUBLIC_WHATSAPP`, `NEXT_PUBLIC_PHONE`, `NEXT_PUBLIC_EMAIL` — contact details in `FloatingCTA` and `Footer`

## Target audience

All user-facing copy must be in **English**. The audience is international investors.
