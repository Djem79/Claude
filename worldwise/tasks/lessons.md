# Lessons

## 2026-05-22 — JSON-LD: `aggregateRating`/`review` only on Google-supported host types

**What happened:** Google Search Console flagged "Invalid object type for field
`<parent_node>`" on property pages. Cause: the `RealEstateListing` JSON-LD carried an
`aggregateRating`. Google's **review-snippet** validator only accepts a rating/review when
the parent entity is one of its supported types (Product, Organization, LocalBusiness,
Movie, Recipe, Course, Event, Book, SoftwareApplication, …). `RealEstateListing` is not on
that list, so Google rejected the parent node. (`RealEstateAgent` extends LocalBusiness, so
the agency block's rating is fine — that's why only the listing errored.)

**Also a policy issue:** the rating was the agency's hard-coded 5★/4-reviews copied onto
every listing — review guidelines require ratings to be about the specific item, not the
business as a whole on every page.

**Rules to prevent repeat:**
- Only attach `aggregateRating`/`review` to a Google-supported review-snippet host type.
  Don't put ratings on `RealEstateListing`, `WebPage`, `BreadcrumbList`, etc.
- Never fabricate or borrow a site-wide rating onto per-item pages.
- After changing any JSON-LD, validate with the Rich Results Test, and treat
  "`<parent_node>`" in a Search Console error as "the item's own @type is an invalid host
  for this feature," not a named-field problem.
- `<parent_node>` errors are about host @type, not value format (e.g. `numberOfRooms: "7 Bed"`
  being a string is a separate, value-level imperfection).

## 2026-05-22 — Homepage marketing stats are duplicated in SEO metadata

**What happened:** Changed the hero/`WhyWorldwise` stats ("500+ investors" → "50+",
"AED 2B+" → "$30M+", dropped "30+ Countries"). The plan only touched the two
components. A final whole-branch review caught that `app/layout.tsx`'s `<meta
description>` and `public/llms.txt` still claimed "500+ investors from 30+ countries"
— a public contradiction with the new homepage copy that would surface in Google's
snippet and to AI crawlers.

**Root cause:** I treated the stat change as component-local. The same factual claims
live in several SEO surfaces that don't import the component, so a grep-by-number was
needed, not just editing where the JSX renders.

**Rules to prevent repeat:**
- When changing any visible marketing claim/number on a page, grep the *value* across
  the repo (`grep -rn "500+\|2B\|30+ countries" app public components`) and reconcile
  every hit: `app/layout.tsx` (description, openGraph, twitter, JSON-LD), per-page
  `metadata`, and `public/llms.txt`.
- Add "check SEO metadata + llms.txt for the same claim" to the plan whenever a task
  edits homepage/landing copy.

## 2026-05-21 — `next start` does NOT serve `public/` files created after boot

**What happened:** The article-image feature wrote generated images to
`public/images/blog/<slug>.png` and referenced them as static URLs. On the server
those URLs 404'd (build-time `public/` files like the logo served fine; runtime-added
ones did not), which broke the blog thumbnail and made Telegram's channel `sendPhoto`
fail with "failed to get HTTP URL content".

**Root cause:** Next.js `next start` only serves `public/` assets known at start; files
written there afterwards are not served (404) until a restart.

**Rules:**
- Serve runtime-generated images through a **route handler that reads the file via `fs`**
  (e.g. `/api/blog-image`), not as a static `public/` path. `fs.readFileSync` sees new
  files immediately; static serving does not.
- Add `Cache-Control: public, max-age=31536000, immutable` to such routes so Cloudflare
  caches the render.
- **Telegram `sendPhoto` by URL is stricter than browsers** — it rejected a route URL
  with query params ("Wrong port number specified in the URL"). Upload the image **bytes
  via multipart** instead (fetch the route locally → `FormData` `photo` Blob). Browsers
  and OG scrapers handle the query URL fine, so the site/og can keep using it.

## 2026-05-21 — Verify request path BEFORE locking an origin firewall

**What happened:** During H3 hardening I assumed `worldwise.pro` was proxied
through Cloudflare (orange cloud) and locked ufw to Cloudflare IP ranges only.
The domain is actually **DNS-only** — it resolves directly to the origin
`62.238.35.20`, so traffic never touches Cloudflare. The lockdown blocked all
real visitors and took the site down for ~30–60s until I rolled back.

**Why it happened:** I trusted CLAUDE.md's "DNS managed via Cloudflare" + the
presence of CF IP ranges in ufw, and inferred proxying without verifying the
actual public DNS resolution or request path.

**Rules to prevent repeat:**
- Before any origin firewall / IP-allowlist change, run `dig +short <domain>` and
  confirm whether it resolves to the proxy (Cloudflare) or the origin IP. DNS-only
  vs proxied changes everything.
- Confirm which header carries the trustworthy client IP for the *actual* topology
  (`x-real-ip` set by nginx when nginx is the edge; `cf-connecting-ip` only when
  CF is genuinely in the path AND origin is CF-locked).
- For risky prod infra changes, keep an open SSH session and a one-command rollback
  ready, and verify externally (`curl https://domain`) immediately after — which is
  how this was caught fast.
- A redundant rule below a specific allowlist (`ALLOW Anywhere`) silently negates
  the allowlist — but removing it is only safe once you've confirmed the proxy is
  actually in front.

## Access-control: guard every sub-route of a protected section, not just the index

**Context:** Adding per-section manager permissions (properties/leads/dashboard).
I guarded `/api/leads` and `/api/leads/[id]` with `requireSection('leads')` but the
plan never enumerated the lead-attachment sub-tree — `/api/leads/[id]/files`,
`.../files/[fileId]`, `.../download`, `.../log`, `.../send`. Those five kept their
old `getSession()`/401 checks, so a manager WITHOUT the leads section could still
upload, list, delete, download, and email a lead's files via API. The per-task
reviews missed it (each only saw its own diff); the final whole-feature review
caught it.

**Why it happened:** I scoped the plan from the data model down, not from the
route tree up. "Guard the leads API" silently meant "the two routes I happened to
list," not "every route under `app/api/leads/**`."

**Rules to prevent repeat:**
- When restricting access to a resource, first `find app/api/<resource> -name route.ts`
  (and the matching `app/admin/<resource>` pages) and make the guard list exhaustive
  against that output — every handler, every nested route.
- A section/role guard is only as strong as its least-guarded sibling route. UI
  hiding (nav, page redirect) is not enforcement; the API layer must independently
  guard every endpoint that touches the protected data.
- Always run a FINAL whole-feature review (not just per-task) for security-relevant
  changes — per-task reviewers can't see cross-cutting coverage gaps.
- Edge middleware can't enforce section-level rules here: the session token
  intentionally carries no `sections` (read fresh from DB in `getSession`), and
  middleware can't read the JSON store. Section enforcement must live in the route
  handlers / server pages, not middleware. The static `/files/leads/` path therefore
  stays auth-only at the middleware layer — acceptable because the app only reaches
  files through the now-section-guarded download API.
