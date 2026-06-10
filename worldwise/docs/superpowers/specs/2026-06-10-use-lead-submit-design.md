# useLeadSubmit hook + Honeypot component — design

**Date:** 2026-06-10 · **Status:** approved (audit follow-up #3) · behavior-preserving refactor.

## Problem

Seven lead forms (LeadModal, LeadCaptureSection, PropertyEnquiryForm, QualifyingModal,
BrochureGate, FloorPlanGate, GuideClient) copy-paste the same ~25-line submit block:
name/phone validation, `fetch('/api/leads')` with `...getStoredAttribution()` + `_hp`,
`track('lead_form_submit')`, error copy, loading/success state — plus the verbatim
clip-hidden honeypot `<input>` whose inline style is load-bearing (iOS Safari overflow
bug). Two documented invariants (honeypot + attribution) are re-implemented by hand
in every new form — the exact failure mode CLAUDE.md warns about.

## Design

### `lib/useLeadSubmit.ts` (client hook)

```ts
export function useLeadSubmit(opts: {
  source: string                       // lead source string (registry in CLAUDE.md)
  trackParams?: Record<string, string> // extra GA4 params, e.g. { property: title }
  emptyError?: string                  // override "Please fill in your name and phone number."
  failError?: string                   // override "Something went wrong. Please try WhatsApp instead."
}): {
  hpRef: RefObject<HTMLInputElement | null>
  loading: boolean
  success: boolean
  error: string
  submit: (fields: { name: string; phone: string } & Record<string, unknown>) => Promise<boolean>
  resetStatus: () => void              // modals call on reopen (clears success/error)
}
```

`submit` owns the two invariants: the POST body is always
`{ ...fields, source, ...getStoredAttribution(), _hp: hpRef.current?.value ?? '' }`
and a successful POST always fires `track('lead_form_submit', { source, ...trackParams })`.
Returns `true` on success so forms can do their own post-success work (LeadModal
clears its PII fields; gates reveal content via the `success` flag as today).

### `components/Honeypot.tsx`

The canonical clip-hidden input (single source of truth for the load-bearing style):

```tsx
<Honeypot hpRef={hpRef} />
// renders: <input ref type="text" name="website" tabIndex={-1} autoComplete="off"
//          aria-hidden="true" style={clip-pattern} />
```

### Per-form notes (all seven verified to share the identical pattern)

- Error copy differs in 3 forms — preserved via `emptyError`/`failError` options.
- Extra body fields (email/budget/message/propertyType/area/propertySlug/propertyTitle)
  pass through `fields` untouched.
- LeadModal/QualifyingModal reset success/error on reopen → `resetStatus()`.
- The honeypot markup is byte-identical in all 7 (verified) → safe to centralize.

## Verification

`tsc` + `eslint` + `next build`; dev-server browser pass with `window.fetch`
interception asserting the outgoing POST body (fields + `_hp` + attribution spread +
source) for LeadModal, LeadCaptureSection, QualifyingModal and GuideClient — without
letting the request reach `/api/leads` (local `data/` must never be created).
Brochure/FloorPlan gates can't render locally (no property data) — covered by the
shared hook + tsc. CLAUDE.md honeypot/attribution invariant sections updated to point
at the hook.
