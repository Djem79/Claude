# Exit-Intent Popup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An exit-intent popup (free personalised property shortlist offer) that captures name/phone/budget, reusing `LeadModal` for the form.

**Architecture:** One new client component `ExitIntentTrigger` owns trigger detection + frequency capping and renders the existing `LeadModal` with custom copy (`source: exit_intent`). `LeadModal` gains an optional `onSuccess` callback. Mounted once in `app/layout.tsx`; self-disables on `/admin*` and `/ru*`.

**Tech Stack:** Next.js 16 App Router client component, existing `LeadModal`/`useLeadSubmit`/`track` infrastructure. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-08-04-exit-intent-popup-design.md`

---

### Task 1: `onSuccess` prop on LeadModal

**Files:**
- Modify: `components/LeadModal.tsx`

- [ ] **Step 1: Add the optional prop to the interface and destructure it**

In `components/LeadModal.tsx`, extend `Props` (after `ctaLabel?: string`):

```tsx
  ctaLabel?: string
  /** Called once after a successful submit (used by ExitIntentTrigger to set its permanent "submitted" flag). */
  onSuccess?: () => void
```

And destructure it in the component signature (after `ctaLabel = 'Request Consultation'`):

```tsx
  ctaLabel = 'Request Consultation',
  onSuccess,
```

- [ ] **Step 2: Invoke it after a successful submit**

In `handleSubmit`, inside the `if (await submit(...))` block, after the field-clearing line:

```tsx
      setName(''); setPhone(''); setEmail(''); setBudget('')
      onSuccess?.()
```

- [ ] **Step 3: Commit**

```bash
git add worldwise/components/LeadModal.tsx
git commit -m "feat(popup): optional onSuccess callback on LeadModal"
```

### Task 2: ExitIntentTrigger component

**Files:**
- Create: `components/ExitIntentTrigger.tsx`

- [ ] **Step 1: Write the component (complete file)**

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { track } from '@/lib/analytics'
import LeadModal from '@/components/LeadModal'

// Exit-intent popup — spec: docs/superpowers/specs/2026-08-04-exit-intent-popup-design.md
// Desktop: cursor leaves through the top edge (≥5 s dwell). Mobile (coarse pointer):
// ≥50% max scroll depth + rapid upward scroll. Caps: once per session, 30-day
// cooldown after dismissal, never again after a successful submit.

const STORAGE_KEY = 'ww_exit_popup'
const SESSION_KEY = 'ww_exit_shown'
const DISMISS_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000
const MIN_DWELL_MS = 5000
const SCROLL_DEPTH_THRESHOLD = 0.5
const SCROLL_UP_PX = 300
const SCROLL_UP_WINDOW_MS = 700

type ExitState = { dismissedAt?: number; submitted?: boolean }

function readState(): ExitState {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as ExitState
  } catch {
    return {}
  }
}

function writeState(patch: ExitState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...readState(), ...patch }))
  } catch {
    // Storage unavailable (private mode) — degrade to per-pageview capping.
  }
}

export default function ExitIntentTrigger() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const submittedRef = useRef(false)
  const disabled =
    pathname.startsWith('/admin') || pathname === '/ru' || pathname.startsWith('/ru/')

  useEffect(() => {
    if (disabled) return
    try {
      if (sessionStorage.getItem(SESSION_KEY)) return
    } catch {
      // No sessionStorage — fall through, localStorage checks still apply.
    }
    const state = readState()
    if (state.submitted) return
    if (state.dismissedAt && Date.now() - state.dismissedAt < DISMISS_COOLDOWN_MS) return

    const mountedAt = Date.now()
    let fired = false
    let maxDepth = 0
    let lastY = window.scrollY
    let lastT = Date.now()
    let upDistance = 0

    function cleanup() {
      window.removeEventListener('scroll', onScroll)
      document.removeEventListener('mouseout', onMouseOut)
    }

    function fire() {
      if (fired) return
      fired = true
      try {
        sessionStorage.setItem(SESSION_KEY, '1')
      } catch {
        // Session capping degrades gracefully without sessionStorage.
      }
      track('exit_popup_shown', { page: window.location.pathname })
      setOpen(true)
      cleanup()
    }

    function onMouseOut(e: MouseEvent) {
      if (e.relatedTarget !== null || e.clientY > 0) return
      if (Date.now() - mountedAt < MIN_DWELL_MS) return
      if (document.body.style.overflow === 'hidden') return // another modal is open
      fire()
    }

    function onScroll() {
      const y = window.scrollY
      if (y < 0) return // iOS overscroll bounce
      const depth = (y + window.innerHeight) / document.documentElement.scrollHeight
      if (depth > maxDepth) maxDepth = depth
      const now = Date.now()
      if (y < lastY) {
        upDistance = now - lastT <= SCROLL_UP_WINDOW_MS ? upDistance + (lastY - y) : lastY - y
        if (
          maxDepth >= SCROLL_DEPTH_THRESHOLD &&
          upDistance >= SCROLL_UP_PX &&
          document.body.style.overflow !== 'hidden'
        ) {
          fire()
        }
      } else {
        upDistance = 0
      }
      lastY = y
      lastT = now
    }

    if (window.matchMedia('(pointer: coarse)').matches) {
      window.addEventListener('scroll', onScroll, { passive: true })
    } else {
      document.addEventListener('mouseout', onMouseOut)
    }
    return cleanup
  }, [disabled])

  if (disabled) return null

  function handleClose() {
    setOpen(false)
    if (!submittedRef.current) writeState({ dismissedAt: Date.now() })
  }

  function handleSuccess() {
    submittedRef.current = true
    writeState({ submitted: true })
  }

  return (
    <LeadModal
      isOpen={open}
      onClose={handleClose}
      source="exit_intent"
      title="Before You Go — Get a Free Shortlist"
      subtitle="Tell us your budget and our advisors will send you five hand-picked Dubai properties within 24 hours. No mailing lists — just your shortlist."
      ctaLabel="Send My Shortlist"
      onSuccess={handleSuccess}
    />
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add worldwise/components/ExitIntentTrigger.tsx
git commit -m "feat(popup): exit-intent trigger with desktop + soft mobile heuristics"
```

### Task 3: Mount in root layout

**Files:**
- Modify: `app/layout.tsx`

- [ ] **Step 1: Import and mount**

Add to imports:

```tsx
import ExitIntentTrigger from '@/components/ExitIntentTrigger'
```

In the body, after `<UtmCapture />`:

```tsx
        <UtmCapture />
        <ExitIntentTrigger />
```

- [ ] **Step 2: Commit**

```bash
git add worldwise/app/layout.tsx
git commit -m "feat(popup): mount ExitIntentTrigger site-wide"
```

### Task 4: Documentation (CLAUDE.md registry)

**Files:**
- Modify: `CLAUDE.md` (repo root) — source list, GA4 events list, anti-spam component list

- [ ] **Step 1: Add `exit_intent` to the lead source registry**

In the source strings list, after `qualify`, insert `exit_intent`. In the group (1) sentence, mention the exit popup.

- [ ] **Step 2: Add the GA4 event**

In "Events in use", append: `exit_popup_shown` (page — fired when the exit-intent popup opens).

- [ ] **Step 3: Add the component to the lead-capture component list**

In the anti-spam section's component enumeration, add `ExitIntentTrigger` (renders `LeadModal` with `source: exit_intent`).

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: register exit_intent source + exit_popup_shown event"
```

### Task 5: Build + lint gate

- [ ] **Step 1: Run the production build**

Run from `worldwise/`: `npm run build`
Expected: build completes with no type errors.

- [ ] **Step 2: Run ESLint**

Run: `npm run lint`
Expected: no new warnings/errors in changed files.

### Task 6: Browser verification (dev server + Chrome DevTools MCP)

- [ ] **Step 1: Start dev server** — `npm run dev`, open `http://localhost:3000`.
- [ ] **Step 2: Desktop trigger** — wait >5 s, dispatch `document.dispatchEvent(new MouseEvent('mouseout', { relatedTarget: null, clientY: 0 }))` (or move cursor out through the top). Expected: popup opens, `sessionStorage.ww_exit_shown === '1'`.
- [ ] **Step 3: Session cap** — dispatch again after closing. Expected: no popup. Reload page → still no popup (localStorage `dismissedAt` within 30 days).
- [ ] **Step 4: Reset + submit flow** — clear both storage keys, trigger popup, submit name `TEST Claude Exit` + phone. Expected: success screen; `localStorage.ww_exit_popup` contains `"submitted":true`; POST /api/leads returned 200. Re-trigger after reload → no popup ever.
- [ ] **Step 5: Mobile heuristic** — emulate a mobile device (coarse pointer) with cleared storage, scroll to 60% depth, scroll up >300 px quickly. Expected: popup opens.
- [ ] **Step 6: Admin/ru exclusion** — navigate to `/admin/login` and `/ru`, dispatch the desktop trigger. Expected: nothing renders (component returns null).
- [ ] **Step 7: Modal suppression** — open `LeadModal` via any CTA, dispatch mouseout. Expected: no second popup while `body.overflow === 'hidden'`.
- [ ] **Step 8: Delete the local test lead** — remove the `TEST Claude Exit` entry from the LOCAL `data/leads.json` (local file only, never the server's).

### Task 7: PR

- [ ] **Step 1: Push branch and open PR against `claude` remote**

```bash
git push -u claude feat/exit-intent-popup
gh pr create --repo Djem79/Claude --title "feat: exit-intent popup (free shortlist offer)" --body "..."
```
