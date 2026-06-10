# Lessons

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
