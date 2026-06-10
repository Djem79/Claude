# Audit Report

**Date:** 2026-06-10 · **Scope:** full read-only audit of the worldwise.pro codebase (`worldwise/` Next.js 14 app: `app/` 75 files, `lib/` 52, `components/` 38, `scripts/` 8, `middleware.ts`, configs). Four parallel category passes (security / server bugs / client bugs+performance / code quality) read 180+ source files; a secret-pattern grep covered all 1,921 tracked files. No file exceeds 10,000 lines. **No hardcoded secrets, private keys, or passwords were found** (stop condition not triggered). Zero source files were modified.

## Summary

- Total issues: 42  |  Critical: 0  |  High: 3  |  Medium: 12  |  Low: 27
- Directories scanned: `worldwise/app` (75 files), `worldwise/lib` (52), `worldwise/components` (38), `worldwise/scripts` (8), root configs (`middleware.ts`, `next.config.mjs`, `tailwind.config.ts`, `tsconfig.json`, `package.json`), `types/`, plus `public/` non-binary assets, `docs/`, `.claude/` (secret scan only).
- Verified-clean areas: session crypto (dedicated `SESSION_SECRET`, timing-safe HMAC, 7-day expiry); Telegram webhook secret (timing-safe compare, 403 when unset); all 29 API route files carry correct `requireSection`/owner guards incl. every sub-route; path traversal structurally blocked (server-generated ids, regex whitelists, flat `<id>.<ext>` storage); `execFile` with arg arrays in all app code; JSON-LD escaping via `<JsonLd>` everywhere; `passwordHash` stripped from all API responses; all 7 lead forms send `_hp` + attribution with the clip-hidden honeypot; mortgage math correct; no emoji on public pages.

## Critical Issues

None found.

## High Issues

### [BUGS] Property with empty `images[]` crashes every listing grid and the detail page
- File: worldwise/components/PropertyCard.tsx : line 28 (also app/properties/[slug]/PropertyGallery.tsx : 18, app/properties/[slug]/page.tsx : 336)
- Description: `coercePropertyInput` accepts `images: []` and the detail-page JSON-LD already guards for it, but `PropertyCard` renders `<Image src={property.images[0]} />` and `PropertyGallery` renders `<Image src={images[current]} />` with no guard. `next/image` throws on undefined `src`, so a single property saved without photos (possible via `PropertyForm` or a PDF import that extracted none) takes down the homepage Featured grid, `/properties`, area pages, golden-visa and the property page itself.
- Fix:
  ```tsx
  // PropertyCard.tsx
  const img = property.images[0] ?? '/images/areas/dubai-marina.jpg'
  <Image src={img} ... />
  ```
  In `PropertyGallery` early-return a placeholder block when `images.length === 0`; optionally require ≥1 image in `PropertyForm` before submit.

### [BUGS] Unhandled promise rejection in fire-and-forget `postPlanToChannel` can crash the single PM2 process
- File: worldwise/app/api/telegram-webhook/route.ts : line 413 (root cause at lines 244–251)
- Description: `postPlanToChannel(planPost)` is called without `await` or `.catch`. Inside it the image branch is try/catch-wrapped, but the fallback text `fetch(...sendMessage)` (lines 244–250) is not — a Telegram network error there rejects a promise nobody observes. Under Node's default `--unhandled-rejections=throw` this terminates the only PM2 instance mid-request (site-wide outage until PM2 restarts it). The sibling `postToChannel` (line 400) wraps everything and is safe — the asymmetry is accidental.
- Fix: `postPlanToChannel(planPost).catch(e => console.error('[telegram-webhook] postPlanToChannel', e))` — or wrap the trailing fetch in the same try/catch as the image branch.

### [SECURITY] `next@14.2.x` carries 14 known high-severity advisories (cache poisoning, DoS, XSS, SSRF)
- File: worldwise/package.json : line 15 (`"next": "^14.2.35"`)
- Description: `npm audit` flags the installed Next.js with high-severity advisories directly relevant to this self-hosted PM2+nginx deployment: Image Optimization API DoS (GHSA-h64f-5h5j-jqjh, GHSA-9g9p-9gw9-jx7f), unbounded `next/image` disk-cache growth (GHSA-3x4c-7xq6-9pq8), cache poisoning of RSC responses (GHSA-vfv6-92ff-j949, GHSA-wfc6-r584-vfw7), App Router XSS (GHSA-ffhc-5mcf-pf4q), middleware redirect cache poisoning (GHSA-3g8h-86w9-wvmq), SSRF (GHSA-c4j6-fc7j-m34r). Cloudflare in front mitigates some DoS but not the cache-poisoning/XSS classes.
- Fix: Upgrade to the latest patched Next.js (audit's `fixAvailable` points past 16.3.0-canary.5 — a major upgrade; plan it). Interim mitigation: confirm the latest 14.2.x patch release is installed (`npm ls next`), keep Cloudflare proxying on, and cap the image cache dir size on the server. See *Dependency Vulnerabilities* below.

## Medium Issues

### [SECURITY] Deactivated-user session tokens still pass the middleware gate on `/files/leads/*`
- File: worldwise/middleware.ts : line 31–37
- Description: The legacy static lead-attachment path validates only the HMAC token, never re-checking `user.active` in the DB (unlike `lib/auth.ts getSession()`). A deactivated/deleted staff member keeps a working cookie for up to 7 days and can still download any legacy lead PII attachments under `public/files/leads/`.
- Fix: If no legacy files remain on the server, return 404 unconditionally for that prefix; otherwise migrate the files into `lead-files/<leadId>/<fileId>/` so the section-guarded download API is the only access path.

### [BUGS] `incrementKeywordIndex` can silently wipe the entire keyword bank
- File: worldwise/scripts/generate-article.mjs : line 104
- Description: It re-reads the bank via `getKeywords()`, which on ANY read/parse error swallows the error and returns `{ keywords: [], index: 0 }` (lines 96–101); the function then persists that fallback with the index advanced — permanently destroying the keyword bank (only repopulated by hand via `/add_keyword`).
- Fix:
  ```js
  function incrementKeywordIndex(currentIndex) {
    const data = JSON.parse(fs.readFileSync(KEYWORDS_PATH, 'utf-8')) // throw, don't swallow
    data.index = currentIndex + 1
    writeFileAtomic(KEYWORDS_PATH, JSON.stringify(data, null, 2))
  }
  ```

### [BUGS] `coercePropertyInput` never clears optional numeric fields, contradicting its own comment
- File: worldwise/lib/properties.ts : lines 56–63
- Description: For `pricePerSqft`/`roi`/`grossYield`, a blank/invalid value yields `undefined` from `cleanNumber` and the key is simply absent from `out`, so `{ ...existing, ...out }` retains the old value — an admin cannot remove a previously-set value by blanking the form field (the comment at line 60 claims the opposite). `lat`/`lng` (line 74) handle this correctly.
- Fix: Mirror the lat/lng handling — when `has(key)` and the value is blank/invalid, set `out[key] = undefined` so the spread clears it.

### [BUGS] "Reset filters" empty-state button resets Max Price to 25M instead of 100M
- File: worldwise/app/properties/PropertiesClient.tsx : line 158
- Description: The toolbar Reset restores `maxPrice` to `MAX_PRICE` (100,000,000), but the zero-results "Reset filters" button sets `setMaxPrice(25_000_000)` — every listing above AED 25M stays hidden while the user believes all filters were cleared, silently hiding the highest-commission inventory.
- Fix: Change `setMaxPrice(25_000_000)` to `setMaxPrice(MAX_PRICE)`.

### [BUGS] Admin fetch handlers lock UI in busy state on network failure, some fail silently
- File: worldwise/app/admin/leads/LeadsClient.tsx : lines 94–124, 274–286 (also app/admin/property/PropertyForm.tsx : 210–222; app/admin/ImportPanel.tsx : 25, 34, 43; app/admin/users/UsersClient.tsx : 65, 87; app/admin/login/page.tsx : 17–28; app/admin/AdminPropertyActions.tsx : 8–12)
- Description: These handlers do `setBusy(true)` then `await fetch(...)` with no try/catch/finally, and parse error bodies with bare `res.json()`. A rejected fetch (offline, server restart mid-deploy — realistic for the 25 MB PDF import) or a non-JSON error page (nginx 413/502) throws: the busy flag stays `true`, all buttons stay disabled until a full page reload, and `PropertyForm` loses the entire form session. `patchLead` additionally gives no feedback when `res.ok` is false — a status/note change silently disappears while the UI shows it saved; `AdminPropertyActions.handleDelete` refreshes regardless of failure. `FilesClient.tsx` (the newest admin surface) already does this correctly.
- Fix: Wrap each body in `try { … } catch { setError('Network error — try again') } finally { setBusy(false) }` and parse error bodies as `(await res.json().catch(() => ({}))).error ?? 'Failed'` — same shape as FilesClient.tsx:100–113. In `patchLead`, surface `!res.ok` and snap the select back.

### [BUGS] Static editorial articles display "published today" and emit ever-changing JSON-LD dates
- File: worldwise/app/blog/[slug]/page.tsx : line 60
- Description: `const dateISO = publishedAt ?? new Date().toISOString()` — static articles in `lib/articles.ts` have no `publishedAt`, so every static article shows the current render date as publication date, and `BlogPosting` JSON-LD `datePublished`/`dateModified` shift on every ISR revalidation (60 s). Bad for article rich results and misleading to readers.
- Fix: Add a fixed `publishedAt` to each static article entry in `lib/articles.ts`; when absent, omit the date line and the `datePublished` JSON-LD field instead of fabricating "now".

### [BUGS] Untracked WhatsApp conversion CTA on the highest-converting page
- File: worldwise/app/properties/[slug]/page.tsx : lines 361–368
- Description: The bottom "WhatsApp Now" CTA on the property detail page is a plain `<a>` with a hand-built `wa.me` URL and no `whatsapp_click` event — violating the "conversion tracking on all CTAs" invariant. Paid-traffic clicks through this prominent CTA are invisible in GA4, skewing ad ROI.
- Fix: Replace with a small client component using `waLink(waPropertyMessage(property.title))` and `onClick={() => track('whatsapp_click', { source: 'property_enquiry', property: property.title })}`.

### [PERFORMANCE] Entire `lib/areas.ts` (564 lines of prose/FAQ for 11 districts) shipped in the homepage client bundle
- File: worldwise/components/QualifyingModal.tsx : lines 7, 26
- Description: `import { areas } from '@/lib/areas'` is a value import used only for `AREA_NAMES = areas.map(a => a.name)`. QualifyingModal is mounted (closed) on the homepage, so all area marketing copy, FAQs, metrics and coords are bundled into homepage JS for the sake of 11 name strings — dead weight on the most LCP-sensitive page.
- Fix: Export a tiny `AREA_NAMES: string[]` constant from a new fs-free `lib/area-names.ts` (or hardcode the 11 names in the modal) and import that instead.

### [CODE QUALITY] Dead component: `ROICalculator.tsx` never mounted (156 lines)
- File: worldwise/components/ROICalculator.tsx : line 19
- Description: Imported nowhere in `app/`, `components/`, or `lib/` (verified by grep; the only other hits are the `'roi_calculator'` source string in LeadsClient and a marketing doc). Carries its own drifting copies of `formatAed` and LeadModal wiring.
- Fix: Delete `components/ROICalculator.tsx`. Keep the `'roi_calculator'` source string in LeadsClient (historical leads may carry it).

### [CODE QUALITY] Lead-form submit logic + honeypot JSX copy-pasted across 7 components (~190 lines, ~80% identical)
- File: worldwise/components/LeadModal.tsx : lines 66, 146 (also LeadCaptureSection.tsx:29/89, app/properties/[slug]/PropertyEnquiryForm.tsx:26, QualifyingModal.tsx:59, BrochureGate.tsx:24/75, FloorPlanGate.tsx:24/88, app/guide/GuideClient.tsx:24)
- Description: All 7 lead forms repeat the same state machine, validation, `fetch('/api/leads')` body (`...getStoredAttribution()`, `_hp`), `track('lead_form_submit')`, and the verbatim clip-hidden honeypot `<input>` whose inline style is load-bearing (replaced the iOS-Safari-breaking `left:-9999px`). Every new form re-implements two documented load-bearing invariants by hand — the exact failure mode CLAUDE.md warns about. `BrochureGate`/`FloorPlanGate` are ~85% identical end-to-end.
- Fix: Extract a `useLeadSubmit({ source, extra })` hook returning `{ hpRef, loading, success, error, submit(fields) }` that owns the POST body and `track()` call, plus a `<Honeypot hpRef={hpRef} />` component holding the canonical style. ~20 lines deleted per form; the invariants become impossible to forget.

### [CODE QUALITY] Hand-built `wa.me`/`tel:` URLs bypass the documented `lib/whatsapp.ts` helper
- File: worldwise/app/properties/[slug]/PropertyEnquiryForm.tsx : line 96 (also app/properties/[slug]/page.tsx:362/369, components/LeadCaptureSection.tsx:133/140)
- Description: CLAUDE.md mandates `waLink()`/`waPropertyMessage()` "everywhere instead of hand-built URLs", yet three public call sites hardcode `https://wa.me/971506960435?text=…` and `tel:+971506960435`. A phone-number change now requires edits in 4+ places; LeadCaptureSection even mixes both styles.
- Fix: Replace with `waLink(...)`; add `PHONE_DISPLAY`/`PHONE_TEL` exports next to `DEFAULT_WA` in `lib/whatsapp.ts` for the `tel:` links.

### [CODE QUALITY] `LeadsClient.tsx` is 739 lines; kanban card JSX duplicated verbatim (~65 lines × 2)
- File: worldwise/app/admin/leads/LeadsClient.tsx : lines 577 and 668
- Description: The lead kanban card (name/phone/source badge/property/budget + Telegram/WhatsApp/mail buttons) is copy-pasted character-for-character for the desktop grid and the mobile view, with the `wa.me`/`t.me` action-link cluster repeated a third time in the table row (lines 425, 614, 706). The file also hosts a separate `FilesSection` component (87–238).
- Fix: Extract `KanbanCard({ lead, borderClass, onOpen })` (deletes ~65 lines), move `FilesSection` to its own file, and a `LeadContactLinks` snippet for the third copy.

## Low / Improvement Suggestions

### [SECURITY] Module-level shared `FAKE_OK` Response breaks after the first honeypot hit
- File: worldwise/app/api/leads/route.ts : line 35 (used at line 49)
- Description: `NextResponse.json(...)` created once at module scope; a Response body is consumable once, so the second bot submission gets a 500 ("Body is unusable") — revealing that `_hp` is a honeypot.
- Fix: `if (_hp) return NextResponse.json({ ok: true }, { status: 201 })` per request.

### [SECURITY] CSRF defence rests solely on `SameSite=Lax` — no Origin check on mutating endpoints
- File: worldwise/app/api/auth/login/route.ts : line 60–66
- Description: Cookie flags are good (`httpOnly; secure; sameSite:'lax'`) but no mutating handler validates the `Origin` header — a single point of failure with no defence in depth.
- Fix: In `lib/auth.ts getSession()`, reject mutating requests whose `Origin` is present and not the site host (~5 lines, covers every guarded handler).

### [SECURITY] Lead attachments served `inline` with real Content-Type (inconsistent with hardened admin file manager)
- File: worldwise/app/api/leads/[id]/files/[fileId]/download/route.ts : line 33–40
- Description: This older route serves staff-uploaded files inline with true MIME, while the newer admin file-manager route forces `attachment` + `application/octet-stream`. Different safety bars for the same threat model.
- Fix: Force `attachment; application/octet-stream` like `app/api/admin/files/[id]/download/route.ts:21-27`, or keep `inline` only for the image/PDF whitelist.

### [SECURITY] Login rate-limit map never swept; successful logins consume attempt quota
- File: worldwise/app/api/auth/login/route.ts : line 8–20
- Description: `loginRateMap` grows one entry per distinct IP until PM2 restart (the leads route has `sweepExpired`, this one doesn't), and the counter increments before password verification and never resets on success — a busy shared-NAT office can lock itself out of the 5/15-min budget.
- Fix: Mirror `sweepExpired()` from `app/api/leads/route.ts:14-20`; `loginRateMap.delete(ip)` after successful login.

### [SECURITY] Admin file-manager upload has no per-request file-count cap; all files buffered in memory
- File: worldwise/app/api/admin/files/route.ts : line 51–63
- Description: Unlimited number of ≤25 MB parts in one multipart request, each buffered via `arrayBuffer()` — hundreds of MB of process memory + unbounded disk fill from one request. `/api/upload` caps at 30 files; this route forgot the cap.
- Fix: `if (files.length > 30) return NextResponse.json({ error: 'Too many files (max 30)' }, { status: 400 })`.

### [SECURITY] Google API keys sent in URL query strings
- File: worldwise/lib/property-extract.ts : line 57 (also lib/image-classify.ts : 113, lib/geocode.ts : 37)
- Description: `GEMINI_API_KEY`/`GOOGLE_GEOCODING_API_KEY` interpolated into request URLs — captured by proxy logs, error traces, APM. A thrown fetch error carries the full URL into PM2 logs.
- Fix: For Gemini use `headers: { 'x-goog-api-key': key }`. Geocoding requires the query param — never log the URL on error.

### [SECURITY] Shell-string `exec()` in GSC CLI browser opener
- File: worldwise/scripts/gsc.mjs : line 93
- Description: `exec(\`open "${url...}"\`)` — double-quote escaping doesn't neutralize backticks/`$()`. Input is a self-built URL from env today, but it's the only shell-string exec in the repo and one env-var paste away from injection on the operator's machine.
- Fix: `execFile('open', [url])`.

### [SECURITY] No password policy or input length caps on admin user creation
- File: worldwise/app/api/admin/users/route.ts : line 30–40
- Description: A 1-character password passes; `name`/`username` are uncapped in POST (PUT caps name at 120), allowing megabyte strings into `users.json`, which is re-read on every `getSession()` call.
- Fix: `if (String(password).length < 8) return 400`; `String(name).slice(0,120)` / `String(username).slice(0,60)` before `createUser`.

### [SECURITY] Imported draft assets publicly reachable before publish via guessable timestamp ids
- File: worldwise/app/api/admin/import/route.ts : lines 36, 70–73 (also lib/pdf-images.ts : 89)
- Description: `draftId = String(Date.now())` keys publicly-served paths (`public/images/properties/<draftId>/`, brochure route accepting any `\d{6,20}` id) before the admin reviews/publishes. Bracketing the import time allows brute-forcing the id (~600k requests for ±10 min) to pull unreleased developer material.
- Fix: Append 4 random digits: `` `${Date.now()}${String(crypto.randomInt(1000,9999))}` `` (17 digits, still matches `^\d{6,20}$`), or 404 the brochure route until the property exists.

### [BUGS] `post-from-plan.mjs` only ever sends the first scheduled post for a given date
- File: worldwise/scripts/post-from-plan.mjs : lines 146, 191
- Description: `findIndex(p => p.date === today && !p.sent)` resolves one post per daily run; a second post on the same date is stranded permanently unsent.
- Fix: Loop over all posts matching `today && !sent`, or enforce one-post-per-date in the plan schema.

### [BUGS] Transparent navigation never solidifies when the page loads pre-scrolled
- File: worldwise/components/Navigation.tsx : lines 10–14
- Description: `scrolled` is set only inside the scroll listener, never on mount — landing on `/#contact` or `/#areas` renders a fully transparent nav over light content until the user scrolls 1 px.
- Fix: Call the handler once on mount: `onScroll(); window.addEventListener('scroll', onScroll)`.

### [BUGS] Admin tables render locale/timezone-dependent dates during SSR → hydration mismatch
- File: worldwise/app/admin/leads/LeadsClient.tsx : lines 17–22 (same pattern UsersClient.tsx : 20–25)
- Description: `toLocaleString('en-GB', …)` formats differently on the UTC server vs the visitor's timezone → React hydration warnings flooding the console and masking real hydration errors.
- Fix: Add `timeZone: 'Asia/Dubai'` to the options, or format inside `useEffect`/`suppressHydrationWarning`.

### [BUGS] FilesClient search has a stale-response race (no abort)
- File: worldwise/app/admin/files/FilesClient.tsx : lines 69–91
- Description: Debounced 200 ms but in-flight requests aren't aborted; a slow earlier search response can overwrite a faster later one with stale results.
- Fix: `AbortController` per `load()`, abort the previous in the effect cleanup, ignore `AbortError`.

### [CODE QUALITY] Middleware NOINDEX early-return runs before the auth gate
- File: worldwise/middleware.ts : lines 11–15
- Description: The `_rsc`/`gtm_latency` check returns `NextResponse.next()` before both the `/admin` token check and the `/files/leads/` 401 check, so `?_rsc=1` skips middleware enforcement entirely. Not currently exploitable (all admin pages re-check the session server-side), but a latent footgun for any future statically-served protected path.
- Fix: Apply the auth checks first, then add the `X-Robots-Tag` header to the response.

### [CODE QUALITY] `updateUser` lost-update window spans a `bcrypt.hash` await (widest in the known race family)
- File: worldwise/lib/users.ts : lines 56–72
- Description: Read → `await bcrypt.hash(...)` (~100 ms yield) → write of stale snapshot. Same documented lost-update class as the pending per-file-mutex task, but the bcrypt await makes it the widest interleave window of the family.
- Fix: Compute the bcrypt hash BEFORE reading `getUsers()` so the read-modify-write is synchronous; prioritize `users.ts` when the shared mutex lands.

### [CODE QUALITY] `KNOWN_SOURCES` in the CRM is a stale parallel list of lead sources
- File: worldwise/app/admin/leads/LeadsClient.tsx : lines 53–61
- Description: Contains 7 of the ~30 documented `source` strings (missing `qualify`, `golden_visa`, `brochure_request`, `floor_plan`, `mobile_bar`, all `area_*`, the undocumented `developer_*`). Same class of drift the `LEAD_STATUSES` single-source rule exists to prevent. `developer_<slug>` (app/developers/[slug]/page.tsx:42) is also absent from the CLAUDE.md source registry.
- Fix: Derive the dropdown purely from `leads` (sorted), or move the canonical list to `lib/lead-sources.ts`; document `developer_*`.

### [CODE QUALITY] `btn-outline-gold` used on a light surface in the admin property form
- File: worldwise/app/admin/property/PropertyForm.tsx : line 565
- Description: Gold-on-white Cancel link (~2:1 contrast) — the styling rule reserves this class for dark backgrounds. Admin-only, but the exact pattern the rule exists to prevent.
- Fix: Change to `btn-outline-gold-light`.

### [CODE QUALITY] Carousel dots and calculator sliders lack accessible names
- File: worldwise/components/Testimonials.tsx : lines 69–75 (also MortgageCalculator.tsx : 61–69, 125–133; ROICalculator.tsx : 53–61; QualifyingModal.tsx : 192–201)
- Description: Testimonial dot buttons have no `aria-label`; mortgage/ROI range inputs have visible labels without `htmlFor`/`id` association; QualifyingModal area `<select>` is unlabeled.
- Fix: `aria-label={\`Show testimonial ${i + 1}\`}` on dots; `aria-label` or proper `htmlFor`+`id` on the sliders/select.

### [CODE QUALITY] Compact AED formatter re-implemented 5 times
- File: worldwise/components/PriceTag.tsx : line 20 (also app/properties/[slug]/page.tsx:31, app/admin/page.tsx:13, MortgageCalculator.tsx:7–14, ROICalculator.tsx:15)
- Description: Identical `AED X.XXM / AED XK` logic in 5 files; PriceTag's comment even references a PropertyCard copy that no longer exists.
- Fix: Export one `formatAedCompact(aed: number)` from a client-safe module (e.g. `lib/fx.ts`) and delete the local copies.

### [CODE QUALITY] `PropertyForm.tsx`: four near-identical upload handlers (~90 lines)
- File: worldwise/app/admin/property/PropertyForm.tsx : lines 66–157
- Description: `handleFiles`/`handleQrFile`/`handleBrochureFile`/`handleFloorPlanFiles` differ only in `kind`, busy-flag setter, success setter and error string; `removeImage`/`moveImage` duplicate `removeFloorPlan`/`moveFloorPlan`.
- Fix: One `upload(kind, files, setBusy, onOk, label, inputRef)` helper — each handler becomes a 3-line call.

### [CODE QUALITY] `as any` casts on Telegram webhook payload and CSV export
- File: worldwise/app/api/telegram-webhook/route.ts : lines 266, 336 (also app/admin/leads/LeadsClient.tsx:307)
- Description: `body.message as any` / `body.callback_query as any` make the 190-line handler untyped; `(l as any)[c]` in `exportCsv` defeats the `Lead` type. The only `any`s in otherwise-strict app code.
- Fix: Minimal local `TgMessage` type for the webhook; type `cols` as `(keyof Lead)[]` and index with `l[c]`.

### [CODE QUALITY] Telegram webhook `POST` is ~190 lines with the answer/edit fetch pair repeated 3×
- File: worldwise/app/api/telegram-webhook/route.ts : lines 253–443 (duplicated blocks at 363–374, 382–393, 425–440)
- Description: Text-command and callback routing interleaved in one function; `Promise.all([answerCallbackQuery, editMessage…])` copy-pasted three times; `postToChannel`/`postPlanToChannel` are ~85% identical.
- Fix: Extract `answerAndEdit(callbackId, chatId, messageId, answerText, newText?)`; split into `handleTextMessage` / `handleCallback`.

### [CODE QUALITY] `BUDGETS` constant duplicated in 4 lead forms
- File: worldwise/components/LeadModal.tsx : line 20 (also LeadCaptureSection.tsx:8, QualifyingModal.tsx:16, PropertyEnquiryForm.tsx:7)
- Description: CRM analytics groups by these exact strings — an edit in one place silently forks the taxonomy.
- Fix: `export const BUDGET_BRACKETS` in a pure lib module; import in all four.

### [IMPROVEMENT] Telegram `sendMessage` re-implemented in every cron script
- File: worldwise/scripts/gsc.mjs : line 200 (also seo-audit.mjs:210, generate-article.mjs:229, post-from-plan.mjs:126)
- Description: Four `.mjs` crons each define their own wrapper around `api.telegram.org/bot<token>/sendMessage` with the same env reads and error logging.
- Fix: `scripts/tg.mjs` exporting `sendTelegram(text, opts)`; import from the four scripts (~40 lines deleted).

### [IMPROVEMENT] `AreaPageClient` computes the lead source string twice
- File: worldwise/app/[area]/AreaPageClient.tsx : line 31
- Description: `leadSource` computed at line 17 and the identical expression inlined again for `MobileCtaBar` — trivial drift risk between the modal's and mobile bar's source tag.
- Fix: `enquireSource={leadSource}`.

### [IMPROVEMENT] Blog article hero image uses raw `<img>` — unoptimized LCP on article pages
- File: worldwise/app/blog/[slug]/page.tsx : lines 106–113
- Description: The article header image (LCP element) gets no AVIF/WebP, no `srcset`, no priority preload — unlike the same images on `/blog` which use `next/image`.
- Fix: `<Image src={article.image} alt={article.title} width={1200} height={630} priority className="w-full rounded-sm mt-8 object-cover" />`.

### [IMPROVEMENT] Unused dependency: `@types/bcryptjs` (misplaced in `dependencies`)
- File: worldwise/package.json : line 11
- Description: `bcryptjs@^3` ships its own types; the DefinitelyTyped stub targets v2 and is shadowed, and sits in runtime `dependencies`.
- Fix: `npm uninstall @types/bcryptjs`; confirm `npm run build` passes.

## Dependency Vulnerabilities

`npm audit` (2026-06-10): **12 vulnerabilities — 0 critical, 7 high, 5 moderate** (no `critical`).

| Package | Severity | Direct? | Affected range | Key advisories | Note |
| ------- | -------- | ------- | -------------- | -------------- | ---- |
| `next` | High | yes | 9.3.4 – 16.3.0-canary.5 | GHSA-h64f-5h5j-jqjh (Image Optimizer DoS), GHSA-3x4c-7xq6-9pq8 (unbounded image disk cache), GHSA-vfv6-92ff-j949 / GHSA-wfc6-r584-vfw7 (RSC cache poisoning), GHSA-ffhc-5mcf-pf4q (App Router XSS), GHSA-3g8h-86w9-wvmq (middleware redirect cache poisoning), GHSA-c4j6-fc7j-m34r (SSRF), +7 more | **Runtime, production-relevant** — see High issue above; fix requires major upgrade past 16.3.0 |
| `eslint-config-next` → `@next/eslint-plugin-next` → `glob` | High | yes (dev) | 14.0.5 – 15.0.0-rc.1 | GHSA-5j98-mcp5-4vw2 (glob CLI command injection) | Dev/lint-time only, not shipped; fix = `eslint-config-next@16.x` (major) |
| `@typescript-eslint/parser` → `typescript-estree` → `minimatch` | High | no (dev) | 6.16.0 – 7.5.0 / minimatch 9.0.0–9.0.6 | GHSA-3ppc-4f35-3m26, GHSA-7r86-cg39-jmmj, GHSA-23c5-xmqv-rm74 (ReDoS) | Dev-time only; `fixAvailable: true` via `npm audit fix` |
| `googleapis` → `googleapis-common` / `gaxios` → `uuid` | Moderate | yes | 33.0.0 – 149.0.0 / uuid <11.1.1 | GHSA-w5hq-g745-h8pq (uuid buffer bounds) | Used only by the GSC CLI script; low exposure; fix via `googleapis` upgrade |
| `postcss` | Moderate | no (dev) | <8.5.10 | GHSA-qx2v-qp2m-jg93 (XSS via unescaped `</style>` in stringify output) | Build-time only; `npm audit fix` |

Recommended order: (1) `npm audit fix` for the non-major transitive fixes (minimatch, postcss, uuid/gaxios); (2) plan the Next.js major upgrade (14 → latest), which also resolves `eslint-config-next`; (3) bump `googleapis` when convenient.

`requirements.txt` / `composer.json`: not present in this project.
