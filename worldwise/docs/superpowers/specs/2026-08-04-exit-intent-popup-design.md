# Exit-Intent Popup — Design

**Date:** 2026-08-04
**Status:** Approved by user (offer + trigger model chosen via Q&A)

## Goal

Recover abandoning visitors with a free-offer popup that captures contact details.
Offer chosen by the user: **a personal property shortlist** — "five hand-picked Dubai
properties for your budget within 24 hours". This is a manual-work promise by the
team for every such lead (flagged and accepted).

## Mechanics

One new client component, `components/ExitIntentTrigger.tsx`, owns ONLY the trigger
logic and frequency capping. The form itself is the existing `LeadModal` rendered
with custom copy — name/phone/budget fields, honeypot, attribution spread, GA4
`lead_form_submit`, focus trap, and the success screen all come from
`LeadModal`/`useLeadSubmit` for free.

```tsx
<LeadModal
  isOpen={open}
  onClose={handleClose}
  source="exit_intent"
  title="Before You Go — Get a Free Shortlist"
  subtitle="Tell us your budget and our advisors will send you five hand-picked Dubai properties within 24 hours."
  ctaLabel="Send My Shortlist"
/>
```

`LeadModal` gains one optional, backwards-compatible prop `onSuccess?: () => void`,
invoked after a successful submit — the trigger uses it to set the permanent
"submitted" flag.

## Triggers

Chosen model: **desktop exit-intent + soft mobile heuristic**.

- **Desktop:** `mouseout` on `document` with `relatedTarget === null && clientY <= 0`
  (cursor leaves through the top edge), no earlier than 5 s after mount.
- **Mobile** (`matchMedia('(pointer: coarse)')`): only after real engagement —
  max scroll depth ≥ 50 % of the page — AND a rapid upward scroll (scrollY drops
  > 300 px within ~700 ms). Guard against iOS overscroll bounce (ignore negative
  scrollY).
- **Suppressed** while another modal is open — detected via
  `document.body.style.overflow === 'hidden'` (both `LeadModal` and
  `QualifyingModal` set it), zero coupling.

## Frequency capping

- Once per visit: `sessionStorage.ww_exit_shown`.
- 30-day cooldown after a dismissal: `localStorage.ww_exit_popup`
  → `{ dismissedAt: number }`.
- Never again after a successful submit: `{ submitted: true }` in the same key.
- All storage access wrapped in try/catch (Safari private mode).

## Placement

Mounted once in `app/layout.tsx` (near `UtmCapture`). The component disables
itself on `/admin*` (staff) and `/ru*` (hidden Russian Dzen section — no public
chrome there) via `usePathname()`.

## Copy (English, no emojis — brand rule)

- Title: `Before You Go — Get a Free Shortlist`
- Subtitle: `Tell us your budget and our advisors will send you five hand-picked
  Dubai properties within 24 hours. No mailing lists — just your shortlist.`
  (objection-handling line per the popups skill: reassure this is not a
  newsletter signup)
- CTA: `Send My Shortlist` (first-person CTA converts better than second-person)

## Analytics & CRM

- New lead source **`exit_intent`** — added to the source registry in CLAUDE.md;
  appears in the CRM source filter automatically.
- New GA4 event **`exit_popup_shown`** (fired at open, with `page` param) so
  popup-to-lead conversion is measurable against `lead_form_submit` with
  `source: exit_intent`.

## Error handling

- No storage available → treat as "never shown", popup may show each visit
  (acceptable degradation).
- Trigger listeners are passive; component renders `null` until triggered — zero
  LCP/CLS impact.

## Testing / verification

- `npm run build` must pass.
- Manual browser verification on localhost via Chrome DevTools MCP: desktop
  mouseout trigger, mobile scroll heuristic (emulated), frequency caps
  (session + 30-day + submitted), suppression while LeadModal is open, and one
  test lead submitted end-to-end (then deleted from the CRM).
- No unit tests: the logic is DOM-event-heavy, consistent with sibling
  conversion components.

## Out of scope

- No new PDF/asset (offer is manual work by the team).
- No timed popup on mobile (rejected — Google intrusive-interstitial risk).
- No A/B testing infrastructure.
