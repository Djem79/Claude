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
# 1. Sync (exclude git, node_modules, build artifacts, and server-only data)
rsync -avz --exclude='.git' --exclude='node_modules' --exclude='.next' --exclude='data/' \
  -e "ssh -i ~/.ssh/id_ed25519" worldwise/ root@62.238.35.20:/var/www/worldwise/

# 2. Build and restart on server
ssh -i ~/.ssh/id_ed25519 root@62.238.35.20 \
  "cd /var/www/worldwise && npm install && npm run build && pm2 restart worldwise"
```

**Critical:** `data/properties.json` and `data/leads.json` live only on the server. Never rsync them from local — they hold live leads and admin edits. Always exclude `data/`.

## Architecture

Next.js 14 App Router, TypeScript, Tailwind CSS.

### Data layer — file-based JSON, no database

`lib/properties.ts` and `lib/leads.ts` read/write `data/properties.json` and `data/leads.json` synchronously on every request. Consequences:

- Single PM2 instance only — concurrent writes from multiple processes would corrupt JSON.
- In dev, admin edits mutate `data/*.json` in place and appear in `git diff`.

`types/index.ts` is the single source of truth for `Property` and `Lead` shapes. `LeadStatus` is `'new' | 'contacted' | 'in-progress' | 'won' | 'lost'`.

### Auth — cookie-based, single password

`middleware.ts` guards `/admin/:path*` by checking the `ww_admin_session` cookie (value `"authenticated"`). Middleware does **not** run on API routes, so every mutating API handler (`POST/PUT/DELETE`) must also call `isAuthenticated()` from `lib/auth.ts` — this is defence-in-depth, not redundant.

The cookie's `Secure` flag is set only when the request uses HTTPS (`req.nextUrl.protocol === 'https:'`), so HTTP dev login works.

### Public routes

- `/` — marketing homepage; all sections are server components in `components/`
- `/properties` — client-side filtered listing (`PropertiesClient.tsx`)
- `/properties/[slug]` — ISR (`revalidate = 60`), statically pre-rendered via `generateStaticParams`

### Admin routes

- `/admin` — property table + recent leads summary
- `/admin/leads` — full CRM: filter by status/source/search, inline status change, notes, CSV export
- `/admin/property/new` and `/admin/property/[id]` — both use `PropertyForm`, which handles drag-and-drop image upload, gallery reorder, and a PERMISSION section (DLD QR + permit/project numbers)

### API routes

| Route | Purpose |
| ----- | ------- |
| `POST /api/leads` | Save lead → fire-and-forget Telegram + email notify |
| `GET /api/leads` | List leads (admin auth required) |
| `PUT /api/leads/[id]` | Update `status`, `notes`, `contactedAt` |
| `DELETE /api/leads/[id]` | Remove lead |
| `POST /api/upload?kind=gallery\|qr` | Save property images or QR codes to `public/images/` |
| `GET/POST /api/properties` | List / create properties |
| `PUT/DELETE /api/properties/[id]` | Update / delete property |

### Lead notifications (`lib/notify.ts`)

`notifyTelegram` and `notifyEmail` are called fire-and-forget from `POST /api/leads` — failures are swallowed so they never block lead capture.

Telegram supports multiple recipients: `TELEGRAM_CHAT_ID` accepts a comma-separated list of IDs (group IDs are negative, e.g. `-1001234567890`).

### Lead capture sources

`LeadModal`, `ROICalculator`, `LeadCaptureSection`, `PropertyEnquiryForm`, and `FloatingCTA` all `POST /api/leads` with a `source` field identifying the originating component. Keep source strings consistent for analytics.

### SEO / crawler layer

- `app/robots.ts` — generates `robots.txt`; blocks `/admin` and `/api`
- `app/sitemap.ts` — dynamic XML sitemap (151 URLs: homepage + /properties + all 148 property slugs)
- `app/layout.tsx` — `metadataBase`, default `og:image`, `twitter:card: summary_large_image`, JSON-LD `RealEstateAgent`
- `app/properties/[slug]/page.tsx` — per-property `og:image` from `property.images[0]`, JSON-LD `RealEstateListing` + `BreadcrumbList`
- `public/llms.txt` — plain-text site summary for AI crawlers (Claude, ChatGPT, Perplexity)

### Images

Local area images are in `public/images/areas/` — use these paths in `AreasSection.tsx`, never external Unsplash URLs. Property gallery images land in `public/images/properties/<id>/`, QR codes in `public/images/qr/`.

### Styling

Custom Tailwind palette: `navy` / `gold` (see `tailwind.config.ts`). Global button utilities `btn-primary`, `btn-outline`, `btn-outline-gold` are defined in `app/globals.css` — prefer them for all CTAs.

## Environment variables

See `.env.example`. Key vars:

- `ADMIN_PASSWORD` — admin login (no default in production; set in `.env.local`)
- `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` — lead notifications; `TELEGRAM_CHAT_ID` is comma-separated for multiple recipients
- `SMTP_HOST/PORT/USER/PASS` + `NOTIFY_EMAIL` — optional email notifications via nodemailer
- `NEXT_PUBLIC_SITE_URL` — used to build absolute URLs in Telegram messages and sitemap
- `NEXT_PUBLIC_WHATSAPP`, `NEXT_PUBLIC_PHONE`, `NEXT_PUBLIC_EMAIL` — contact details in `FloatingCTA` and `Footer`

## Target audience

All user-facing copy must be in **English**. The audience is international investors, not Russian-speaking only.
