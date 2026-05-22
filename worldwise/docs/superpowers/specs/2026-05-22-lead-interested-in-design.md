# Editable "Interested In" field on CRM leads — Design

Date: 2026-05-22
Branch: `feature/lead-interested-in` (off `feature/site-ux-tweaks`)

Let an admin set or change what a lead is looking for, directly in the CRM — for leads
that arrived without a property (most non-site sources) or whose property no longer exists
on the site. The field is free text, always editable.

## Background

`Lead` already has optional `propertySlug?` and `propertyTitle?` (`types/index.ts`). Only
the on-site forms (`PropertyEnquiryForm`, `LeadModal`) populate them; leads from Telegram
intake or other sources have neither. The CRM shows `propertyTitle` in a "Property" column
and in the expanded row, but offers no way to edit it.

A free-text field (not a dropdown of real listings) is required because leads come from many
sources and the property of interest may not exist on the site at all.

## Verification

`npm run build` passes. Then, logged into `/admin/leads`: expand a lead with no property,
type into "Interested In", click away (blur) → it persists after a page reload and shows in
the table column. Changing the lead's status afterward does **not** wipe the text, and
editing the text does **not** reset the status (this proves the partial-update fix below).

## Data model — no schema change

- `propertyTitle` is reused as the free-text "what the lead is interested in".
- `propertySlug` remains the optional deep-link, set only by on-site forms.
- When an admin edits the text, `propertySlug` is cleared — a manually typed string is no
  longer guaranteed to map to that listing, so we must not render a stale link.

## Components

### 1. `lib/leads.ts` — `updateLead`

Widen the accepted `data` type from
`Partial<Pick<Lead, 'status' | 'notes' | 'contactedAt' | 'attachments' | 'source'>>`
to also include `'propertyTitle' | 'propertySlug'`.

Add an activity-log line when the title changes: push `'Interested in updated'` to `parts`
when `'propertyTitle' in data && data.propertyTitle !== prev.propertyTitle`.

No other change — the existing `{ ...prev, ...data }` merge already applies the new keys.

### 2. `PUT /api/leads/[id]` — fix partial updates, then add the field

**Root-cause fix (in scope):** the handler currently calls
`updateLead(id, { status: body.status, notes: body.notes, contactedAt: body.contactedAt }, actor)`.
When `patchLead` sends a partial body (e.g. only `notes`), `body.status` is `undefined`, and
`updateLead`'s `{ ...prev, ...data }` merge spreads that `undefined` over the existing value —
silently wiping `status` (→ renders as "new") and `contactedAt`. Rebuild the patch from only
the keys actually present in the request body:

```ts
const patch: Record<string, unknown> = {}
if ('status' in body) patch.status = body.status
if ('notes' in body) patch.notes = body.notes
if ('contactedAt' in body) patch.contactedAt = body.contactedAt
if ('propertyTitle' in body) {
  patch.propertyTitle = String(body.propertyTitle ?? '').slice(0, 200).trim() || undefined
  patch.propertySlug = undefined // editing the free text clears any stale deep-link
}
const updated = updateLead(params.id, patch, { uid: session.uid, username: session.username, name: session.name })
```

(`patch` is `Partial<...>`-compatible; keep the existing 401/404 handling.)

### 3. `app/admin/leads/LeadsClient.tsx`

- Widen `patchLead`'s `patch` param type to include `'propertyTitle' | 'propertySlug'`.
- **Expanded row:** add an "Interested In" text `<input>` near the Internal-notes textarea,
  `defaultValue={l.propertyTitle ?? ''}`, saving on blur only when changed:
  `onBlur={e => { const next = e.target.value; if (next !== (l.propertyTitle ?? '')) patchLead(l.id, { propertyTitle: next }) }}`,
  styled like the notes field, with placeholder e.g. "e.g. 2BR in Dubai Marina, off-plan under AED 2M".
- **Table header:** rename the `'Property'` column label to `'Interested In'` in the header
  array, and update the narrow-column set (which currently lists `'Property'`) to match so the
  column stays narrow.
- **Table cell + mobile cards:** unchanged behavior — render `propertyTitle` as plain text
  (`{l.propertyTitle ?? '—'}`), exactly as today. Making it a clickable link when `propertySlug`
  exists is a possible later nicety, explicitly out of scope here.

## Out of scope / non-goals

- No dropdown of real listings (rejected — leads aren't always site-originated).
- No new `Lead` field; no DB; no touching `data/` from local.
- Mobile kanban cards remain display-only (no inline editing exists there today).
