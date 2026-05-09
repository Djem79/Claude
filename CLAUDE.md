# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

The git root is `/Users/dzhambulat/Documents/Claude/`. The actual Next.js app lives in the `worldwise/` subdirectory — all commands below must be run from there (`cd worldwise` first).

## Common commands

From `worldwise/`:
- `npm run dev` — local dev server on http://localhost:3000
- `npm run build` — production build (must succeed before deploying)
- `npm run start` — run the production build (used by PM2 in production)
- `npm run lint` — Next.js / ESLint check

There is no test suite configured.

## Production deployment

The site is deployed on a Hetzner VPS at `62.238.35.20` (Ubuntu 24.04). Project lives at `/var/www/worldwise/` on the server, runs under PM2 (`pm2 list` shows the `worldwise` process), and is fronted by Nginx (`/etc/nginx/sites-available/worldwise`) reverse-proxying to `localhost:3000`. PM2 is set to autostart via systemd (`pm2-root.service`).

Typical redeploy flow:
1. `rsync -avz --exclude='.git' --exclude='node_modules' --exclude='.next' -e "ssh -i ~/.ssh/id_ed25519" worldwise/ root@62.238.35.20:/var/www/worldwise/`
2. SSH in, `cd /var/www/worldwise && npm install && npm run build && pm2 restart worldwise`

The data files (`data/properties.json`, `data/leads.json`) live on the server and must NOT be overwritten by rsync from local — exclude them or use `--update` carefully, since admin edits and captured leads only exist on the server.

## Architecture

Next.js 14 App Router project with TypeScript and Tailwind. The whole app revolves around two flows: **public marketing → lead capture**, and **admin → property CRUD**.

### Data layer (file-based, not a database)

`lib/properties.ts` and `lib/leads.ts` read/write JSON files in `data/`:
- `data/properties.json` — array of `Property` (see `types/index.ts`). Mutated by the admin via API routes.
- `data/leads.json` — captured form submissions, prepended (newest first).

This means **every server start reads from disk**, and writes happen synchronously inside API route handlers. Two consequences:
1. The site cannot be horizontally scaled — single PM2 instance only, since concurrent writes would race.
2. In dev mode, edits via the admin panel update `data/*.json` in place, so they show up in git diffs.

### Auth (cookie-based, single password)

`middleware.ts` matches `/admin/:path*` and redirects to `/admin/login` if the `ww_admin_session` cookie is not `authenticated`. `lib/auth.ts` checks `process.env.ADMIN_PASSWORD` (fallback hardcoded in source — change in production via `.env.local`). `isAuthenticated()` is also called inside mutating API routes (`POST/PUT/DELETE /api/properties/*`) for defence-in-depth, since middleware doesn't run on API routes by default.

### Routes

- `/` — marketing homepage composed from `components/` (Hero, FeaturedProperties, ROICalculator, LeadCaptureSection, etc.)
- `/properties` — listing, filterable client-side (`PropertiesClient.tsx`)
- `/properties/[slug]` — detail page, statically generated for known slugs (`generateStaticParams`)
- `/admin` — property list with edit/delete actions
- `/admin/login` — password form, sets the session cookie
- `/admin/property/new` and `/admin/property/[id]` — both render the same `PropertyForm` component, which POSTs/PUTs to the API

### Lead capture

Multiple components (`LeadModal`, `ROICalculator`, `LeadCaptureSection`, `PropertyEnquiryForm`, `FloatingCTA`) all submit to `POST /api/leads`. That route saves the lead to JSON and, if SMTP env vars are set, sends an email notification via `nodemailer`. Each submission carries a `source` string identifying which component triggered it — useful for conversion analytics.

### Styling

Tailwind with a custom navy/gold palette (see `tailwind.config.ts`). Reusable button classes (`btn-primary`, `btn-outline`, `btn-outline-gold`) are defined in `app/globals.css` — prefer these over inline class soup for CTAs.

## Environment variables

See `.env.example`. The important ones:
- `ADMIN_PASSWORD` — admin login password
- `SMTP_*` and `NOTIFY_EMAIL` — optional, enables email notifications when leads are captured
- `NEXT_PUBLIC_WHATSAPP`, `NEXT_PUBLIC_PHONE`, `NEXT_PUBLIC_EMAIL` — used in `FloatingCTA` and `Footer`

## Memory context

The user's auto-memory at `~/.claude/projects/-Users-dzhambulat-Documents-Claude/memory/` contains project notes about target audience: **international investors (not Russian-speaking only)** — keep all user-facing copy in English.
