# Next.js 14 → 16 Upgrade Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Upgrade next 14.2.35 → 16.2.9 (+ react 19.2.7, eslint 9 flat config), closing the 14 high-severity advisories from the 2026-06-10 audit, with zero behavior change on the live site.

**Architecture:** Codemod-driven (`@next/codemod upgrade`) + targeted manual fixes. Research basis: official v15/v16 upgrade guides + Next 16 blog (subagent report 2026-06-10). Pin `next@16.2.9` (16.2.x is the maintained backport line; 16.3 still canary).

**Verified preconditions:** server Node v20.20.2 ≥ 20.9 ✓; local Node 24 ✓; TS ^5 ✓; no `useRef()`-no-arg / `forwardRef` / `JSX.*` / `useFormState` / `revalidateTag` / parallel routes / `generateSitemaps` / dynamic og-images; no custom webpack config (Turbopack-default build safe); `/api/fx` uses explicit `revalidate` (survives new caching defaults).

---

### Task 1: Branch + codemod upgrade

- [ ] `git checkout -b feat/next16-upgrade`
- [ ] From `worldwise/`: `npx @next/codemod@canary upgrade latest` — accept: async-request-API codemod, middleware→proxy codemod, next-lint-to-eslint-cli codemod. Then pin exact versions: `npm install next@16.2.9 react@19.2.7 react-dom@19.2.7 eslint-config-next@16.2.9 && npm install -D @types/react@19 @types/react-dom@19`.
- [ ] Review the full diff before continuing (codemods can over- or under-reach).

### Task 2: Manual fixes the codemod may miss

- [ ] `lib/auth.ts`: `const h = await headers()` (in `originAllowed` → becomes async, await at call site) and `const cookieStore = await cookies()`.
- [ ] Sweep leftovers: `grep -rn 'params }: { params: {' app` and `grep -rn 'searchParams' app --include=page.tsx` — all must be `Promise<...>` + awaited. 21 pages + 17 route handlers + 2 searchParams pages expected.
- [ ] `proxy.ts`: confirm rename (exported `proxy` function, matcher unchanged). Runtime is now Node — `crypto.subtle` HMAC works on Node ≥ 20. Update the file's comments mentioning "Edge".
- [ ] `next.config.mjs`: add `qualities: [40, 75]` to `images` (PropertyLocation uses `quality={40}`; new default `[75]` would silently coerce).
- [ ] ESLint 9 flat config: replace `.eslintrc.json` with `eslint.config.mjs` (`import next from 'eslint-config-next'` core-web-vitals flat preset per eslint-config-next@16 README); `npm install -D eslint@^9`; `"lint"` script = `eslint .` (or what the codemod produced) with appropriate ignores (`.next`, `node_modules`).

### Task 3: Verify locally

- [ ] `npx tsc --noEmit` — fix type fallout (React 19 types).
- [ ] `npm run lint` — parity with old output (only known `<img>` warnings).
- [ ] `node --test --experimental-strip-types lib/*.test.ts` — 91/91.
- [ ] `npm run build` (Turbopack default) — must pass; if Turbopack chokes on anything, fall back to `next build --webpack` in the build script and note it.
- [ ] `npm run dev` + browser pass (agent-browser): `/`, `/properties`, one `/properties/[slug]`, `/blog` + one article, `/dubai-marina`, `/mortgage-calculator` (slider math), `/api/fx` JSON, `/api/properties` JSON, `/admin/leads` → 307 login, honeypot POST ×2 → 201. Check console for hydration errors.
- [ ] CSP invariant intact: global headers unchanged; `frame-src 'self'` preserved (admin PDF preview).

### Task 4: Ship

- [ ] Commits by logical blocks; push; PR to `claude`; merge to main.
- [ ] Deploy per protocol: data backup → rsync → marker grep (`proxy.ts` present on server, `grep -c 'await cookies' lib/auth.ts`) → server `npm install && npm run build && pm2 restart` → smoke (10 URLs) → honeypot 201×2 → owner confirms one admin mutation.
- [ ] `npm audit` after: the 14 next advisories must be gone.

**Rollback:** old build serves until server `npm run build` succeeds; if the new build fails on the server, redeploy from the pre-upgrade main (`git checkout <sha> -- .` + rsync) and rebuild.
