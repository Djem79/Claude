# Lessons

## 2026-07-15 — Браузерные задачи — через основной Chrome юзера, не изолированный Chromium

**Что случилось:** публиковал Дзен-статью через agent-browser (собственный Chromium-профиль) — юзеру пришлось логиниться в Яндекс заново, хотя в его основном Chrome сессия живая. Юзер: «Почему ты в хромиум, а не в основном хроме? На будущее работай через хром».

**The rule:** перед браузерной задачей на площадке, где у юзера есть аккаунт, сначала брать **MCP `chrome-devtools`** (уже в `~/.claude.json`; юзер подключил его ~13–14.07 — я забыл, потому что не записал в память: заметки — сразу при подключении инструмента, не «потом»). Если сервер висит в «connecting» и тулы не поднялись (так было 15.07) — просить юзера сделать `/mcp` reconnect, а не молча уходить в Chromium. Изолированный agent-browser — осознанный fallback (напр., чтобы не перехватывать фокус окна юзера — реальная гоча от 12.07), с предупреждением, что потребуется логин.

## 2026-07-05 — Идентификаторы брать из боевого конфига, не из .env.example

**Context:** Заполняя описания VK/ОК/Дзена и заявку в TGStat, я взял юзернейм TG-канала из `.env.example` (`@WorldwisePro`) — а боевой канал называется `@worldwisellc` (серверный `.env.local`). Неправильная ссылка растиражировалась на 4 площадки + статью, юзер поймал уже после публикаций.

**The rule:** Любой идентификатор, который уходит наружу (юзернеймы каналов, URL, телефоны, email), проверяй по БОЕВОМУ источнику: серверный `.env.local`, живой сайт, реальный аккаунт — `.env.example` и доки могут содержать заглушки. Одна ssh-проверка (`grep VAR /var/www/worldwise/.env.local`) дешевле каскада правок по всем площадкам.

## 2026-06-24 — SEO/keyword data pipelines: live dry-run + budget tuning rounds

**Context:** Built 3 DataForSEO-backed pipelines (keyword-discovery, ads-feed, competitor-gap). Every one's FIRST live output was noisy and needed 1–3 tuning rounds before trustworthy (discovery: trend-clamp saturation + theme dupes; competitor-gap: classifieds/navigational/rental/building-name flood).

**The rule:** For any keyword/SEO data pipeline, build a `--dry-run` and run it on REAL data before enabling the cron; budget tuning rounds. Recurring noise classes + fixes: (1) "contains dubai" ≠ on-topic — require buyer/info-intent tokens; (2) short tokens matched as substrings hit inside words ('roi'→"detROIt") — word-bound them; (3) building-name suffixes ("X Residency"/"Residences") and classifieds domains (dubizzle = cars/jobs/gov) flood results — exclude; (4) morphological variants ("buy/buying apartment(s)") escape theme-dedup unless stop-words include 'buying'/'an'; (5) rental-search ≠ a sales/investor buyer (deny ` rent `, keep 'yield'). Keep the decision logic in a PURE core so tuning is fast and `node:test`'d.

## 2026-06-24 — Verify third-party pricing/specs live, never from memory

**Context:** I quoted Keywords Everywhere at "$15" from stale memory while designing the ads-feed provider. The user checked: it was $90/year — over budget — forcing a provider re-evaluation mid-build.

**The rule:** Before designing around any paid third-party (pricing tiers, minimum deposit, API limits/response shapes), scrape/verify the CURRENT values (firecrawl/web) — never state prices or API shapes from memory. The same discipline (scraping DataForSEO docs first) correctly surfaced its keyword-length limit and endpoint shapes.

**Repeat 2026-06-25 (access cost ≠ per-call price):** I called DataForSEO's Backlinks API "pay-as-you-go ~$0.02–0.05/call" and proposed an audit; the user's screenshot showed access actually needs a **$100/mo minimum commitment** (a separate subscription) — the per-request price only applies once you're in. So the per-unit number is NOT the cost of access. Before calling a paid feature "cheap"/"pay-as-you-go", check the **activation tier** (minimum commitment, separate subscription, gating) — and look for a trial / no-commit channel (here: a 14-day trial covered the one-off audit for ~$0.28).

## 2026-06-23 — Grep the repo before asking "where does X live"

**Context:** User pasted a "K.O Conveyancing" logo and said "replace Zhanna Rean with this logo." The unfamiliar brand made me assume it might be a separate site, so I asked two clarifying rounds (where is it → what platform). The user cut in: "стоп, стоп, наша команда на нашем сайте worldwise." "Zhanna Rean" was in `components/TeamSection.tsx` the whole time — a 2-second grep would have shown it.

**The rule:** When the user references a named entity (a person, section label, brand, or string) and asks to change it, FIRST grep the current repo (`grep -rn 'Zhanna' app components lib`) before asking where it lives. Search collapses clarifying round-trips; only ask about location after the grep comes up empty.

**How to apply:** ambiguity about *where* something is → grep first. Ambiguity about *what to do* (visual treatment, copy wording) → that's the legitimate question to ask. Here the only real question was the avatar treatment, not the location.

## 2026-06-08 — `title.template` does NOT brand og:title / twitter:title

**Context:** Fixing doubled-brand page titles (`… | Worldwise Real Estate | Worldwise Real Estate Dubai`), I stripped the brand from the `title` variable in `generateMetadata`. But that same variable was reused for `openGraph.title` and `twitter.title` — so social-card titles went brandless. Caught only by the self code-review workflow, after the doc `<title>` looked correct.

**The rule:** Next.js App Router `title.template` (`%s | Brand` in `app/layout.tsx`) applies **only to the document `<title>`**. It is NOT inherited by `openGraph.title` / `twitter.title` — those are emitted verbatim unless the layout defines a separate `openGraph.title.{default,template}` object (it doesn't here). Resolver proof: `resolve-metadata.js` derives the OG/twitter template from the parent's *OG/twitter* title template, which is `null` for a plain-string OG title.

**How to apply:** when a page's `metadata.title` is brandless (to let the template add the brand once), give `openGraph.title`/`twitter.title` an **explicit branded string** (e.g. `const ogTitle = \`${title} | Worldwise Real Estate\``). Verify with `curl … | grep -oE '<meta property="og:title"[^>]*>'`, not just `<title>`. Fixed in `app/[area]/page.tsx`, `app/golden-visa/page.tsx`, `app/developers/[slug]/page.tsx`.

## 2026-06-08 — `sharp` PNG `palette: true` posterizes photographic PNGs

**Context:** Wrote `scripts/recompress-images.cjs` to downscale/recompress oversized images in place. For PNGs I used `.png({ palette: true })` for max compression. Self-review flagged it BEFORE shipping: property photos stored as PNG (screenshot-style) would be quantised to ≤256 colours → visible banding/posterization. The `--apply` run had already overwritten 626 files; restored every one with `git checkout -- public/images`, removed `palette`, re-ran.

**The rule:** `palette: true` (PNG8 quantization) is only safe for flat-colour graphics/logos, NOT photographic content. When batch-processing a mixed set where you can't tell photos from graphics, use full-colour PNG (`.png({ compressionLevel: 9, effort: 8 })`) — the savings come from the **downscale**, not palette. You can't switch a photographic PNG to JPEG either: image filenames are referenced by extension in `data/properties.json` + galleries, so changing the extension breaks links. Keep format, downscale, full colour.

**Bonus:** in-place batch image edits are reversible only because the files are git-tracked — `git checkout -- <dir>` undoes a bad run instantly. Always dry-run first and keep the originals in git before an `--apply`.

## 2026-05-30 — Mobile horizontal-overflow ("can scroll right into an empty strip, won't snap back")

A page-wide right-side empty strip = something makes `document.documentElement.scrollWidth > clientWidth`. Took three fixes because it had three independent causes and I kept testing at the wrong width.

- **Test at NARROW widths, not iPhone-14.** The decisive bug only reproduced at ≤375px (iPhone SE/mini/360, narrow Chrome window). At 390px (iPhone 14) everything measured clean, so two earlier "fixed + verified" claims were false. Always sweep **320 / 360 / 375 / 390** and compare `scrollWidth` vs `clientWidth`; scrolling right and reading `scrollingElement.scrollLeft` confirms real overflow.
- **It's cross-browser, not just iOS.** Don't assume "looks fine in headless Chrome" means fixed — set the exact viewport.
- **Root-cause classes seen (all real, all shipped):**
  1. **Honeypot `position:absolute; left:-9999px`** → iOS Safari makes the page scrollable into a huge empty band (Chrome clamps it, won't reproduce). Use the clipped visually-hidden pattern (`width:1px;height:1px;clip:rect(0,0,0,0);overflow:hidden`) instead.
  2. **A `<select>` with no width** sizes to its *widest option* (Chrome). The `/properties` Area filter had a 50-char area name → ~422px select. Cap filter selects (`w-40 max-w-full truncate`).
  3. **A non-wrapping flex row** wider than the viewport — the footer's 5 social links (`flex gap-4`, no `flex-wrap`) forced the footer ~381px wide; in a 1-col grid that stretches *every* footer column, so an unrelated `<li>` is what the scanner flags. Add `flex-wrap`.
- **Diagnose by enumerating elements** where `getBoundingClientRect().right > clientWidth || left < -1`, then walk the parent chain (the flagged element is often a symptom of a wider ancestor/sibling). Fix the root width driver, not the symptom.

## 2026-05-26 — `/properties?area=` deep-link is silently broken (filter is local state, not URL-driven)

**Context:** During the area-landing-pages rollout (Task 3), code review flagged that
`<Link href="/properties?area=<name>">` opens the listing without applying the filter.
`app/properties/PropertiesClient.tsx` initialises the area filter from local `useState`
(default `'All Areas'`) and ignores `window.location.search` / `useSearchParams`. The
existing homepage `AreasSection` has been generating these links for months, so the
issue is pre-existing — but the new area landing pages amplify it (every page has a
"View all in {area}" CTA).

**Why it happened:** the URL pattern looked like a real filtered route, no one tested
the deep-link in isolation. UI tests of the filter went through the dropdown, not the URL.

**Rules to prevent repeat:**

- Whenever a `Link` carries query params, verify the target reads them. Quick
  smoke-test: open the URL directly in an incognito window — does the UI reflect
  the param?
- For listing pages with filter state, prefer `useSearchParams()` over `useState` so
  the URL is the source of truth. This also makes filters shareable and back-button
  friendly.

**To fix in a follow-up:** make `PropertiesClient` initialise `area` from
`useSearchParams().get('area') ?? 'All Areas'` and push state changes to the URL via
`router.replace(...)`. Out of scope for the area-pages PR.

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

## Always pass the current date to AI content generators (2026-05-30)

`scripts/generate-article.mjs` produced articles saying "In 2024…" while running in
2026 — the Gemini prompt never stated the date, so the model fell back to its
training-cutoff year as "the present". Fix: compute `CURRENT_DATE`/`CURRENT_YEAR`
from `new Date()` at run time and inject them into both prompts **and** the system
instruction ("write for ${CURRENT_YEAR}, never present an earlier year as the
present"). **Rule:** any LLM that writes time-sensitive copy must be told today's
date explicitly — never assume the model knows the current year. Also: an already-
published AI article lives in server-only `data/articles.json`; fixing it requires
editing on the server **and** a server `npm run build` (SSG is prerendered, a
`pm2 restart` alone serves the stale build).

## Always reply in Russian (2026-06-01)

The user works in Russian and has asked more than once to **always respond in
Russian** regardless of the language of code/logs/quotes. **Rule:** all
conversational replies, summaries, plans, and questions to this user must be in
Russian. Code, identifiers, commit messages, and file contents stay in their
natural language; only the prose addressed to the user is Russian.

## No emojis on public-facing pages (2026-06-04)

**Mistake:** Added emoji icons (🏙🎯📊🛂 in IntentRouter, 📐 on the property card) while building Conversion Wave 1.

**Rule:** NO emojis anywhere on public-facing pages. The luxury/premium brand uses words, typographic glyphs (→ ← ✕ ★ ✓) or SVG/line icons instead. This applies to new components AND copy.

**How to apply:** Before shipping any public UI, scan for pictographic emoji (U+1F000–1FAFF, regional-indicator flags, ✉/💬/📞/🔒, etc.). Admin CRM and Telegram-bot messages are NOT the public site and may keep their glyphs. Typographic arrows/stars/checks are fine.

## Never let a pipe mask a build's exit code in a deploy chain (2026-06-04)

**Mistake:** Ran `npm run build 2>&1 | tail -5 && pm2 restart worldwise` on the
server. A pipeline's exit status is the **last** command's (`tail`, always 0), so
`&&` fired `pm2 restart` even though `next build` had failed (ENOENT on a `.next`
manifest) — risking serving a broken/half-written build. The site happened to stay
up, but only by luck.

**Rule:** in any build-then-restart/deploy chain, branch on the **build's real exit
code**, never on a piped tail. Pattern: `npm run build > /tmp/build.log 2>&1; code=$?;
if [ $code -eq 0 ]; then pm2 restart …; else echo "BUILD FAILED - not restarting"; fi`.
Don't `&&` a restart onto a piped build.

**How to apply:** When the build fails mid-deploy, do a CLEAN rebuild (`rm -rf .next`)
and restart **only** on exit 0. Also: this repo is sometimes built by **two sessions
sharing the same working tree / `.next`** — concurrent `next build`s corrupt each
other's manifests (ENOENT on `pages-manifest.json`, `_ssgManifest.js`,
`export/500.html`). Before building locally or on the server, confirm no other
`next build` process is running (`ps aux | grep 'next build'`), then `rm -rf .next`
and build once. The server's `.next` is isolated from local, so a local collision
never blocks the prod build — the server build is the real gate.

## Don't widen a global pre-filter to catch a minority case — it buries the primary one (2026-06-04)

**Mistake:** To auto-extract small unit floor plans (line art, 19–45 KB) from developer
brochures, I lowered the global `MIN_PHOTO_BYTES` image gate from 50 KB to 12 KB. On the
DAMAC Islands 2 brochure that exploded the candidate set **35 → 232**; `CLASSIFY_MAX=120`
then truncated to the front-section junk (people/section covers) in document order and
**dropped the real exterior/interior renders AND the late floor-plan pages**. The gallery
(the user's PRIMARY need) broke; the secondary feature still didn't work. The user's words:
"теперь окончательно сломалось всё… нет экстерьеров и интерьеров, а это самое главное."

**Rule:** A coarse pre-filter that protects the PRIMARY output (here: the 50 KB gate that
keeps the gallery to real renders and the classify set under its cap) must NOT be widened
to serve a SECONDARY output. Widening floods the shared budget (the classify cap) and the
loudest/earliest junk wins. When a secondary need wants the items the primary filter
rejects, give it a **separate, narrowly-scoped pass** over exactly those rejects (here:
small images + a floor-plan **geometry** gate → its own classify call), leaving the primary
pipeline byte-for-byte unchanged.

**How to apply:** Before touching a shared filter/threshold/cap, ask "what PRIMARY thing
relies on this staying as it is?" If the change serves a minority case, build a parallel
path instead. And always re-verify the PRIMARY output (not just the new feature) on real
data after the change — I only checked floor plans, not the gallery, and shipped a regression.

---

## 2026-06-04 — Geocoding by project name needs a title-quality gate

**Context:** The property location-map feature geocodes `"<title>, <area>, Dubai, UAE"`
via Google Geocoding to drop a building-level pin. A dry-run over 146 properties accepted
137 (ROOFTOP/GEOMETRIC_CENTER inside a Dubai bbox).

**Mistake avoided (caught in dry-run review, not shipped):** the confidence gate
(location_type + bounding box) is NOT enough. Listings whose **title has no building name**
— generic resale entries like "3-Bedroom Apartment in Dubai Hills Estate" — geocode
*confidently but wrongly*: several Dubai Hills / Dubai Harbour units resolved to **Dubai
Marina** (Google matched the apartment words, not the district). A confident pin in the
WRONG district is worse than no pin — the district fallback is the only honest location for
a building you can't identify.

**Rule:** When geocoding by a free-text name (not a real postal address), add a
**title-quality gate** before trusting the result: skip entries whose title is a generic
description rather than a proper-noun building/project name (regex on leading tokens like
`\d+-bedroom|studio|apartment|retail|…`). Skipped ones fall back to the area centroid.
Branded project titles never start with those tokens, so they're unaffected.

**How to apply:** For any name-based geocode, separate "named place" from "described unit"
and only trust building-level coords for the former. Always **dry-run + eyeball the
location_type=GEOMETRIC_CENTER bucket** (the imprecise ones) before `--apply` — that's where
the wrong-district matches hide. Residual single-listing errors on named projects (e.g. one
ROOFTOP that lands on the wrong street) are fixed per-row via the admin lat/lng fields.

---

## 2026-06-05 — A lazy/third-party `<iframe>` needs `frame-src` in the CSP

**Bug:** The Google Maps embed on `/properties/[slug]` (PropertyLocation) was blank — on
"Show map" the placeholder cleared but the map never loaded. No console error was obvious
at first glance.

**Root cause (confirmed, not guessed):** the site CSP in `next.config.mjs` is
`default-src 'self'` with **no `frame-src`**. Per the CSP spec, a missing `frame-src` falls
back to `default-src` → the browser refuses to load ANY cross-origin `<iframe>` (`Refused to
frame 'https://www.google.com' … violates default-src 'self'`). The React state flipped and
the iframe element rendered; the browser just blocked its navigation, so it showed blank.

**Fix:** add `"frame-src https://www.google.com https://maps.google.com"` to the CSP array.
Only `frame-src` is needed — the iframe's *internal* tile/script loads run in Google's own
document context, governed by Google's CSP, not ours. The keyless `?output=embed` URL works
fine once the frame is permitted.

**How to apply:** Whenever you add a third-party `<iframe>` (maps, video, payments, widgets)
to a site that ships a strict CSP, add its origin to **`frame-src`** in the SAME change.
`X-Frame-Options`/`frame-ancestors 'none'` (who can frame US) is unrelated — don't confuse
the two directions. Verify in a REAL browser (the iframe is cross-origin, so JS can't read
its contents — confirm by screenshot + absence of a "Refused to frame" console error), not
just by curling headers. `agent-browser`'s synthetic `click` may not fire React's onClick;
a native `element.click()` via `eval` does.

---

## 2026-06-05 — Shared HEAD: a dispatched subagent committed to the WRONG branch

**What happened:** Mid-task I created `feat/homepage-image-optimization`, committed the spec +
plan, then dispatched an implementer subagent for the first code change. Between those two
moments a **parallel Claude session** (working on `feat/geocode-on-import` in the SAME single
working tree) switched the branch out from under me. My implementer ran on the parallel
session's branch, so its commit (`9d31ae8`, BlogPreview → next/image) landed in the MIDDLE of
their history, and they then committed their geocoder on top of it.

**Root cause:** This repo is a normal (non-worktree) checkout — there is exactly ONE working
tree and ONE shared `HEAD`. Two concurrent sessions both `git checkout`/commit against it.
`git` has no per-session branch isolation here; whoever ran `checkout` last wins, and a
subagent dispatched earlier has no idea the branch moved. The reflog told the whole story
(`checkout: moving from feat/homepage-image-optimization to main`, then to the sibling branch,
then my commit, then theirs).

**How it was resolved (non-destructive):** Did NOT rewrite the other session's branch or yank
the working tree mid-run. The other session later merged its work (carrying my stray commit)
into `main` and parked the tree on `main`. Then: `git checkout` my branch → `git rebase main`
(picked up the merged state, the duplicate `fix(property)` commit auto-dropped via
`skipped previously applied commit`) → continued the remaining tasks → fast-forward merged
back to `main`. Nothing lost; history ended linear.

**How to apply (prevention):**

1. **Every implementer/subagent prompt that commits MUST first assert the branch:**
   `git branch --show-current` and STOP with BLOCKED if it isn't the expected one. (Tasks 2-3
   of this plan added exactly that guard.) It's cheap insurance against a moved HEAD.
2. **Before dispatching a subagent, re-check `git branch --show-current` in the controller** —
   don't trust the branch you were on N tool-calls ago when another session may share the tree.
3. **Coordinate via AGENTS.md** (who's lead / who owns the tree right now). A shared HEAD is a
   single mutex; only one session should be doing checkouts/commits at a time. If you find the
   tree on someone else's branch, that's a hard signal to PAUSE, not to push through.
4. **Recovery is almost always non-destructive:** a stray commit sitting in another branch is
   safe in history — cherry-pick/rebase it onto the right branch when the tree is free; never
   rewrite a branch you don't own to "clean up" while the other session may still be on it.

---

## 2026-06-10 — "It works" claimed from a test that didn't replicate the live CSP; and Safari won't render a sandboxed PDF iframe

**What happened:** Built an admin file-preview lightbox that frames PDFs via
`<iframe src="/api/admin/files/[id]/preview">`. The preview route set
`Content-Security-Policy: sandbox` on the PDF response. I "verified" PDF preview
worked by serving the same PDF from a throwaway local server and loading it in an
iframe — it rendered, so I reported it working. In production it was **blank/blocked**
for the user. Two separate bugs:
1. The site has a **global CSP** (`next.config.mjs`, `source: '/(.*)'`) with
   `frame-src https://www.google.com https://maps.google.com` (no `'self'`) and
   `frame-ancestors 'none'`. The parent `/admin/files` page therefore could not frame
   the same-origin preview, and the preview couldn't be framed at all → Chrome showed
   "Этот контент заблокирован". My local test had **no global CSP on the parent page**,
   so it never reproduced the block.
2. After fixing the CSP (`frame-src 'self'`, `frame-ancestors 'self'` — consistent with
   the existing `X-Frame-Options: SAMEORIGIN`), Chrome rendered the PDF but **Safari
   still showed a blank/dark iframe**. WebKit refuses to render a PDF inside a *sandboxed*
   iframe — tested all variants in real Safari: `sandbox`, `sandbox allow-same-origin`,
   and `sandbox allow-same-origin allow-scripts` all fail; only **no `sandbox` header**
   renders (Chrome renders either way). Fix: drop the `Content-Security-Policy: sandbox`
   on the preview route. Safety preserved via auth gate + `isPreviewable` whitelist
   (never HTML/SVG inline) + `nosniff` + global CSP + the browser's own PDF-JS isolation.

**How to apply (prevention):**

1. **Reproduce the REAL environment, not a stripped-down stand-in.** For anything touching
   security headers (CSP, X-Frame-Options, CORS), the test must replicate the *actual*
   response headers on BOTH the parent page and the sub-resource. A local server with no
   CSP "proves" nothing about a site that ships a global CSP. When in doubt, check the live
   header: `curl -sD - -o /dev/null <url> | grep -i content-security-policy`.
2. **iframes are governed by TWO directives in opposite directions:** the *parent's*
   `frame-src` (what it may embed) and the *framed response's* `frame-ancestors` /
   `X-Frame-Options` (who may embed it). Same-origin framing needs `frame-src 'self'` AND
   `frame-ancestors 'self'` (not `'none'`). Keep `frame-ancestors` consistent with
   `X-Frame-Options`.
3. **Inline PDF rendering is browser-specific — test Chrome AND Safari/WebKit.** WebKit
   will not render a PDF in a `sandbox`ed iframe at all. Playwright WebKit is unavailable
   on macOS 13, so when you can't drive Safari headless, stand up a local multi-variant
   page and have the user open it in their real Safari — one round-trip beats guessing.
4. **A passing isolated test is not "done" for a browser-rendered feature.** Confirm on the
   real deployed page, in the real browser, on the user's actual file before claiming it works.

---

## 2026-06-10 — Осиротевший dev/prod-сервер на :3000 маскируется под сломанную гидрацию

**Симптом, который чуть не увёл в ложный дебаг:** после рефактора лид-форм локальная
проверка показала «React не гидрируется» — модалка не открывается, эффекты не бегут,
`localStorage` пуст, при этом консоль ЧИСТАЯ и `window.next` существует. Выглядело как
регрессия Next 16.

**Причина:** свежий `npm run start` упал с `EADDRINUSE` (порт 3000 держал осиротевший
сервер из прошлой проверки), а ошибка ушла в фоновый лог и осталась незамеченной.
Старый сервер отдавал HTML старого билда, чьи JS-чанки уже были перезаписаны на диске
новой сборкой → хэши не совпали, клиентский бандл не подгрузился → «мёртвая» страница
без единой ошибки в консоли.

**How to apply (prevention):**

1. Перед локальным стендом: `lsof -ti :3000 | xargs kill` — и только потом `npm run start`.
2. Запустил сервер в фоне — сразу проверь лог запуска (`tail /tmp/…log`): `✓ Ready` или
   `EADDRINUSE`. Код 200 от curl НЕ доказывает, что отвечает твой свежий процесс.
3. Диагноз «гидрация сломана» при чистой консоли → первым делом проверь, чей это сервер
   и тот ли билд: `Object.keys(domNode).some(k => k.startsWith('__react'))` — нет fiber-ключей
   при чистой консоли = чанки не загрузились, а не «React сломался».

## 2026-06-12 — данные CRM ≠ операционная правда без проверки происхождения

Построил вывод «54 из 66 лидов не обработаны — главная дыра воронки» на статусах
`new` в data/leads.json. Оказалось: базу разово засеяли СТАРЫМИ контактами для учёта —
они давно отработаны, статусы при импорте просто не выставляли.

Правило: перед анализом CRM/аналитики СНАЧАЛА спросить у юзера, как данные попали
в систему (ручной импорт? массовый засев? тест?). Распределения дат createdAt
(все 66 «за 30 дней» = признак разового импорта, я его видел и не среагировал),
статусов и источников интерпретировать только после этого.

## 2026-06-19 — slug из заголовка ДОЛЖЕН переживать кириллицу (TG-канал русскоязычный)

Автопостер канала (`scripts/post-from-plan.mjs`) слал русские «новости» БЕЗ картинки.

**Причина:** `sanitizeSlug` делал `.replace(/[^a-z0-9]+/g,'-')` — у полностью
кириллического заголовка не оставалось ни символа → slug = `''` →
`/api/blog-image?slug=` → роут отвечал 400 (`isValidSlug = /^[a-z0-9-]{1,80}$/`) →
скрипт ловил ошибку и постил без фото. Посты с латиницей/годом в заголовке
(«Off-plan… 2026», «JVC…») случайно работали → баг выглядел плавающим.

**How to apply (prevention):**

1. Любой `title → slug` на русскоязычной поверхности: СНАЧАЛА транслитерация
   кириллица→латиница, ПОТОМ strip; плюс fallback (`plan-<date>` / хэш), чтобы
   slug НИКОГДА не был пустым. Пустой slug = скрытый 400/404 ниже по течению.
2. «Плавающий» баг (часть постов ок, часть нет) на тексте — первым делом сравни
   входные строки working vs broken по алфавиту/скрипту, а не по типу/тегу.
3. Тихий `catch → continue without X` маскирует корень: лог писал «card render 400»
   5 дней подряд — читай cron-логи (`/var/log/worldwise-*.log`) при любом «оно
   молча деградирует».

## 2026-07-06 — Фикс лимита размера: сначала выясни реальный размер payload'а

**Что случилось:** импорт PDF падал из-за дефолтного 10MB-лимита тела в Next 16
(`proxyClientMaxBodySize`). Первый фикс выровнял Next под nginx (50mb == 50M) —
логично выглядящая симметрия слоёв. Но реальный PDF юзера весил 70MB → тут же
второй раунд той же ошибки (413 уже от nginx), юзеру пришлось возвращаться.

**Корень:** я выравнивал лимиты слоёв друг под друга, не спросив данные о
фактической нагрузке — хотя улика лежала рядом: nginx error log пишет точный
размер («client intended to send too large body: 73401385 bytes»).

**How to apply (prevention):**

1. Любой фикс лимита (body size, timeout, quota): ПЕРВЫМ шагом выяснить реальный
   рабочий размер/длительность — nginx error log (`intended to send ... bytes`),
   PM2-лог, или прямо спросить юзера «какого размера файл?». Лимит ставить от
   p99 реальной нагрузки, а не от соседнего слоя.
2. Проверять ВСЮ цепочку лимитов разом: Cloudflare (100MB free, жёсткий потолок)
   → nginx `client_max_body_size` → Next `experimental.proxyClientMaxBodySize`.
   Фикс одного слоя двигает ошибку в следующий, а не убирает её.
3. Смоук-тест — телом РЕАЛЬНОГО размера (dd 70MB), а не «чуть больше старого
   лимита»: 15MB-тест первый фикс «подтвердил», хотя проблему юзера он не решал.

## 2026-07-08 — VK fan-out молчал 4 дня: ошибку глотали, а платформа отозвала право

**Что случилось:** VK-зеркало канала умерло 05.07 — VK перестал признавать
приложение 5282478 standalone и зарезал user-токену ВСЮ семью `wall.*`
([15/1134]), хотя фото-аплоад тем же токеном работал. Заметили только 08.07:
ошибка `wall.post` ловилась в `fanOutPost` и не логировалась, а единственная
поверхность — эфемерный тост callback-ответа без текста причины.

**Корни (два):**
1. Наблюдаемость: «non-fatal by design» выродилось в «invisible by design» —
   catch сохранял ошибку в результат, но ни лог, ни постоянное сообщение её
   не показывали.
2. Внешняя платформа может отозвать половину прав токена молча: «токен жив»
   (users.get ✓, upload ✓) ≠ «токен может постить».

**How to apply (prevention):**

1. Любой внешний fan-out/интеграция: КАЖДАЯ ошибка → `console.error` (след в
   PM2) + постоянная поверхность (сообщение в TG-чат, не только тост). Правило:
   если провал виден только в момент нажатия кнопки — он не виден вообще.
2. Диагностика «почему не постит»: read-only проверки токена (scopes, admin,
   getUploadServer) НЕ доказывают право на запись — точный вердикт даёт только
   живой вызов записи. Просить санкцию юзера сразу, не строить теорий.
3. VK-специфика: права user-токена и community-ключа зеркальны
   (user = фото ✓ / wall ✗ [15/1134]; community = wall ✓ / фото ✗ [27];
   `wall.delete` недоступен ОБОИМ — тест-посты удалять вручную). Гибрид
   VK_ACCESS_TOKEN+VK_WALL_TOKEN — см. lib/social-post.ts `vkConfig`.

## 2026-07-09 — Инструмент из маркетингового письма ≠ инструмент для нас (AI Visibility Tracker)

**Что случилось:** из Q2-рассылки DataForSEO я порекомендовал юзеру «включить
бесплатный AI Visibility Tracker — закроет наш бэклог AI-visibility». Когда юзер
попросил ссылку и шаги, живая проверка показала: трекер индексирует ТОЛЬКО
софтверные продукты по G2-категориям, кнопки «добавить бренд» нет, даже
bayut/propertyfinder в нём отсутствуют (404). Рекомендация была невыполнима.

**Корень:** совет дан по описанию из письма вендора, без проверки применимости
к нашей нише (агентство ≠ SaaS-продукт).

**How to apply:** прежде чем рекомендовать юзеру сторонний сервис/фичу — открыть
её вживую и проверить наш конкретный кейс (есть ли наша категория, есть ли форма
добавления, есть ли конкуренты в индексе). Маркетинговое «track your brand» без
проверки — не основание для рекомендации. Если уже порекомендовал и опровергнул —
исправить и память (что и сделано в reference_dataforseo).

## 2026-07-10 — Telegram-алерты нового скрипта: только первый chat ID (ЛС бота), не вся рассылка

**Что случилось:** первый вариант `scripts/mail-watch.py` слал алерты во ВСЕ id
из `TELEGRAM_CHAT_ID` (комма-список). Тестовый алерт упал и в групповой чат —
юзер поправил: «В группу не нужно слать, только в бота» (PR #93).

**Корень:** скопировал паттерн рассылки лид-нотификаций (там группа уместна),
не подумав, что операционные/служебные алерты — личные.

**How to apply:** для нового скрипта с Telegram-уведомлениями по умолчанию
слать ТОЛЬКО в `chat_ids[0]` (ЛС админа); в полный список — лишь когда алерт
осознанно предназначен всем получателям (лиды, аппрувы контента). При деплое
нового алерта — первый тест смотреть глазами юзера: куда реально упало.

## 2026-07-12 — Не предлагать работу, не проверив данными, что она нужна

**Что случилось:** по итогам контент-аудита я вынес в бэклог два массовых
проекта — «рерайт 47 старых AI-статей без FAQ/ссылок» и «прунинг 9 тонких
(<500 слов)» — на основании ОДНОГО лишь анализа текста, ни разу не заглянув в
GSC. Когда юзер спросил «а стоит ли это делать», я наконец поднял данные, и они
сказали: большинство этих 47 статей получает 1–5 показов за 90 дней (мёртвые,
рерайт ничего не даст), а бутылочное горлышко — авторитет (0 ссылок), а не FAQ.

**Чуть не сломал работающее:** прунинг «тонких» по word count удалил бы
`dubai-property-market-q2-2026` — 169 слов, формально «тонкая», а по факту
ТРЕТЬЯ по трафику страница сайта (488 показов, 9 кликов, поз. 6.2). Объём
текста ≠ ценность. Скажи юзер «делай» — я бы вырезал живой трафик.

**Та же ошибка в тот же день:** расширил промо-кластер `/invest` на 3 лендинга
«по аналогии» с ипотечным, не проверив спрос. По факту: off-plan — 773 показа
(оправдано), buy-apartment — 106 показов на поз. 43 (спорно), buy-villa — **5
показов за 90 дней** (работа впустую, 4 ретрофит-ссылки в никуда).

**Корень:** выводил ценность работы из свойств КОДА/КОНТЕНТА («нет FAQ»,
«мало слов», «нет внутренних ссылок»), а не из ПОВЕДЕНИЯ страницы в поиске.
Аудит показывает, что технически «не так», но не показывает, кому это вообще
нужно.

**How to apply — правило ОБЩЕЕ.** Юзер 2026-07-12 распространил его на ЛЮБЫЕ мои
предложения, не только контентные: «прежде чем что-то предлагать, делай ресёрч,
насколько это будет полезно и нужно».

**Главный принцип:** ценность работы доказывается данными о РЕАЛЬНОМ МИРЕ
(поведение, метрики, живая проверка), а НЕ свойствами артефакта («нет FAQ»,
«мало слов», «код некрасивый», «фичи не хватает», «у конкурента есть»). Ресёрч —
ДО предложения. Цифры показывать юзеру ВМЕСТЕ с предложением, а не после его
вопроса «а стоит ли».

Где брать доказательство под тип предложения:
- **Существующие страницы / контент / SEO** → GSC:
  `node --env-file=.env.local scripts/gsc.mjs pages --days=90 --limit=300`
  (+ `queries`). ~0 показов = рерайт бесполезен, проблема в авторитете.
- **Новые страницы / лендинги** → есть ли спрос: DataForSEO (объёмы),
  competitor-gap, rank-tracker. Не плодить страницы «на всякий случай».
- **Фичи / UI** → есть ли поведение под них: GA4-события, источники лидов в CRM,
  реальные обращения. Перед «давайте построим X» — доказать, что X кому-то нужен.
- **Мониторинг / автоматизация** → а проблема вообще случается? (построил
  проверку страниц-«сирот» — их оказалось 0; проверять надо БЫЛО до, не после).
- **Маркетинговые каналы** → канал уже конвертит? (Google Ads выключили именно
  по данным: 0 лидов за 3 недели, а не «по ощущению»).
- **Сторонние сервисы** → открыть вживую и проверить НАШ кейс (урок DataForSEO
  2026-07-09).
- **Рефакторинг / техдолг** → проблема реально проявляется (баг, регрессия,
  инцидент), а не «мне не нравится, как написано».

Жёсткие запреты:
- **Удалять / резать / массово переписывать — ТОЛЬКО после проверки ценности
  КАЖДОГО конкретного объекта.** Никогда по формальному признаку (длина,
  отсутствие поля, возраст). Массовое действие по признаку = массовый риск.
- **Не расширять сделанное «по аналогии»** на соседние сущности, не проверив
  каждую по данным.
- **Нет данных → так и сказать** («не знаю, вот что проверю»), а не предлагать
  наугад. Честное «не проверял» лучше уверенного предложения из воздуха.

## 2026-07-12 — Путь «ответить ОК и ничего не сделать» обязан быть виден в логе

**Что случилось:** honeypot в `POST /api/leads` при заполненном скрытом поле
возвращал ФАЛЬШИВЫЙ `201 {ok:true}` и молча выбрасывал заявку. Посетитель видел
«спасибо, скоро свяжемся». В роуте не было НИ ОДНОГО `console` — потери были
невидимы принципиально. Первопричина ложных срабатываний: поле называлось
`name="website"` — ровно то, что автозаполнение и менеджеры паролей заполняют у
ЖИВЫХ людей (`autocomplete="off"` они игнорируют).

**Сколько это стоило:** со ВСЕХ он-сайт форм (гайд, брошюра, планировки, форма
объекта, hero-CTA, квалификация) в CRM за всю историю — 0 лидов. GA4 при этом
показал 2 УСПЕШНЫЕ отправки на `/guide` (событие `lead_form_submit` шлётся только
после 2xx). Два пути ответить 2xx: реальное сохранение и фальшивый 201 honeypot'а.
Третьего нет → минимум 2 подтверждённо потерянных клиента, реальное число
неизвестно, потому что никто не считал.

**Как нашли:** только подключив GA4 и сверив его с CRM. Ни один тест, ни один
код-ревью этого бы не поймал — код «работал», ошибок не было, метрик не было.

**Корень (класс ошибки):** «отбросить по-тихому, чтобы не подсказать боту»
выродилось в «отбросить по-тихому и никогда об этом не узнать». Тот же класс, что
VK-инцидент 08.07 («non-fatal by design → invisible by design»).

**How to apply:**
1. **Любая ветка, которая отвечает успехом и НЕ выполняет действие** (анти-спам,
   дедуп, фича-флаг, тихий скип), ОБЯЗАНА писать `console.warn` с контекстом.
   Молчаливый сброс пользовательского ввода недопустим.
2. **Никогда молча не выбрасывать возможного клиента/деньги.** Fail-safe:
   если payload проходит обычную валидацию (человеческий) — СОХРАНИТЬ с флагом
   (`suspectedSpam`) и уведомить. Ложное срабатывание должно стоить пометки в CRM,
   а не потерянной сделки. Отбрасывать — только заведомый мусор, и то с логом.
3. **Honeypot: имя поля не должно притягивать автозаполнение.** Никогда
   `website`/`url`/`company`/`address`/`email`. Ставить опт-ауты вендоров:
   `data-1p-ignore`, `data-lpignore`, `data-bwignore`, `data-form-type="other"`.
4. **Сверяй сквозные счётчики между системами.** «Фронт говорит N успехов, а в
   базе M записей» — самый дешёвый детектор тихих потерь. Заводить такую сверку
   для любой конверсионной воронки.

---

## 2026-07-16 · День видео: четыре урока одной сессии

**1. Контент на утверждение — ДО AskUserQuestion, и убедиться, что он виден.**
Сценарий ролика был в теле сообщения прямо перед вызовом AskUserQuestion — юзер
ответил «не вижу сценария»: диалог выбора перекрыл/оттеснил текст. Правило: если
решение требует прочитать длинный контент (сценарий, план, макет) — сначала
отдельное сообщение с контентом и обычным текстовым вопросом; AskUserQuestion —
только для коротких выборов, где всё умещается в опции.

**2. QA кадров — это и композиция, а не только содержимое.**
«Чек» в ролике был технически безупречен, но висел в верхней половине кадра с
пустотой снизу — юзер вернул на доработку («не по центру, выглядит неправильно»).
Проверять кадры глазами на баланс/центровку ВСЕГО кадра 9:16, а не только «текст
читается, элементы на месте». То же — коллизии оверлеев с лицом (плашка закрыла
глаза аватару) и с впечатанным текстом рендеров.

**3. Рендеры из галерей объектов — грязный источник.**
В брошюрных рендерах бывает впечатанный маркетинговый текст застройщика
(«greenspoint», «ELO 3») и даже «Activate Windows» в углу. Каждый still смотреть
глазами ДО сборки видео; выбирать ≥1200px по ширине (мельче — мыло при 9:16-кропе).

**4. Никаких локальных merge в main — даже fast-forward.**
Сам споткнулся: после создания PR сделал локальный `git merge --ff-only` в main
«чтобы бейджик погас». Это ломает squash-флоу (после сквоша на GitHub локальный
main разъезжается по SHA). Откатил через `reset --hard claude/main` + штатный
`gh pr merge --squash` + `git pull`. main двигается ТОЛЬКО через `git pull` после
мержа PR на GitHub.

---

## 2026-07-20 · CMYK-брошюры импортировались негативом (PDF-импорт)

**Симптом (баг-репорт юзера):** фото объекта после импорта PDF — в негативном
цвете (тёмное небо, фиолетовые деревья, инвертированные башни). Юзер думал, что
затронут «только новый файл», но скан показал негатив в 4 объектах — просто
галереи остальных он не открывал. Проверять объективно (`identify %[colorspace]`),
а не по «вроде нормальные».

**Корень:** брошюры застройщиков — полиграфия, встроенные растры это **CMYK JPEG**
(`pdfimages -list` → color=cmyk). `pdfimages -all` дампит их сырым потоком, теряя
Adobe APP14-инверсию → пиксели остаются перевёрнутыми; финальный ImageMagick
`resize` сохранял CMYK без ICC-профиля → браузер рисует негатив.

**Ключевой факт:** простой `-colorspace sRGB` НЕ лечит (IM читает инвертированный
CMYK как есть). Нужен `-negate` ДО конверсии: `convert src -negate -colorspace sRGB`.
Проверено визуально на реальной брошюре. Альтернатива `pdfimages -png` (poppler сам
декодирует цвет верно) — но раздувает 50 КБ-гейт lossless-PNG'ами, поэтому оставили
`-all` и чиним цвет на конверсии.

**Фикс (PR #118):** в `lib/pdf-images.ts` — `imageColorspace()` через identify +
`colourFixArgs()`: для CMYK добавляет `-negate -colorspace sRGB`, для остального —
нормализация в sRGB. Применено в thumbnail (классификатор) и финальном resize.
Существующие битые файлы исправлены in-place на сервере (только CMYK, идемпотентно):
`for f in .../*.jpg; identify %[colorspace]==CMYK → convert -negate -colorspace sRGB`.
После — `rm -rf .next/cache/images` + pm2 restart (оптимизатор перегенерит из
исправленных исходников).

**Правило:** любой веб-вывод картинки ОБЯЗАН быть sRGB. Источник из PDF/печати —
всегда проверять colorspace и приводить к sRGB; CMYK из PDF почти всегда
Adobe-инвертирован → нужен negate.
