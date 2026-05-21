---
name: worldwise-context
description: Project context for worldwise.pro. Load automatically for all tasks. Contains stack, conventions, and business rules.
---

## Project: worldwise.pro

- Dubai real estate investment agency site
- Stack: Next.js 14 App Router, TypeScript strict, Tailwind CSS, Hetzner VPS + PM2 + Nginx
- Business: off-plan and ready properties, AED pricing, RERA-certified agency
- Key pages: /properties (listings), / (landing), /properties/[slug] (detail), /mortgage-calculator, /blog
- Leads go to Telegram and email via contact form
- All prices in AED, areas in sqft and sqm
- Target audience: international investors (English UI only — no Russian on public pages)

## Stack Details

- **Runtime**: Node.js via NVM (`~/.nvm/versions/node/v24.15.0`)
- **Auth**: HMAC-SHA256 signed session tokens, bcryptjs passwords, roles: `owner` / `manager`
- **Data layer**: JSON files in `data/` on server only — never commit, never rsync from local
- **Styling**: Custom Tailwind palette — `navy` (`#0D1B2A`) and `gold` (`#C9A84C`); use `btn-primary`, `btn-outline`, `btn-outline-gold`
- **Analytics**: GA4 via `lib/analytics.ts` `track()` helper — consent-aware
- **Blog**: Static articles in `lib/articles.ts` + AI-generated in `data/articles.json`; auto-pipeline via Gemini + Telegram approval
- **Deployment**: `rsync` to `root@62.238.35.20:/var/www/worldwise/`, then `npm run build && pm2 restart worldwise`

## Critical Rules

- Never touch `data/` locally
- Never `git add -A` — stage files by name
- Always backup server data before deploy: `cp -r /var/www/worldwise/data /var/www/worldwise/data_backup_$(date +%Y%m%d_%H%M%S)`
- Every lead form must include honeypot field (`_hp`)
- `FloatingCTA` and `Footer` on every public page
- Never use external image URLs (exception: Unsplash in Hero.tsx legacy)
- Run `npm run build` locally before deploying

## Key Files

- `types/index.ts` — all TypeScript types (`Property`, `Lead`, `LeadStatus`, `AdminUser`)
- `lib/session.ts` — auth token sign/verify
- `lib/leads.ts` — lead CRUD + activity log
- `lib/analytics.ts` — GA4 event tracking
- `app/globals.css` — button utilities
- `tailwind.config.ts` — custom palette

## Conversion Priorities

1. `FloatingCTA` — WhatsApp + phone, every page
2. `LeadModal` — modal form, tracks `source`
3. `LeadCaptureSection` — bottom of homepage

Lead source strings: `hero_cta`, `mortgage_calculator`, `property_enquiry`, `lead_capture_section`, `floating_cta`, `blog_cta`, `telegram`, `property_finder`, `bayut`, `instagram_dm`, `whatsapp`, `other` (last six = Telegram bot lead intake)
