# Editable "Interested In" Field on CRM Leads — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an admin set or change a lead's free-text "Interested In" (what they're looking for) in the CRM, including leads that arrived without a property.

**Architecture:** Reuse the existing `Lead.propertyTitle` as free text — no schema change. Widen the `updateLead` whitelist and the `PUT /api/leads/[id]` handler to accept it (and fix a partial-update bug in that handler), then add an editable input to the expanded lead row.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS.

**Verification model:** No test suite (per CLAUDE.md). Each task is verified by `npm run build` passing plus a manual check in `npm run dev`. If `npm` is missing: `export PATH="/Users/dzhambulat/.nvm/versions/node/v24.15.0/bin:$PATH"`. All commands run from `worldwise/`. Stage files by name — never `git add -A`.

---

### Task 1: Backend — accept `propertyTitle`, fix partial updates

**Files:**
- Modify: `lib/leads.ts` (`updateLead`, ~L41-87)
- Modify: `app/api/leads/[id]/route.ts` (PUT handler)

- [ ] **Step 1: Widen the `updateLead` data whitelist**

In `lib/leads.ts`, change the `data` parameter type of `updateLead` from:

```ts
  data: Partial<Pick<Lead, 'status' | 'notes' | 'contactedAt' | 'attachments' | 'source'>>,
```

to:

```ts
  data: Partial<Pick<Lead, 'status' | 'notes' | 'contactedAt' | 'attachments' | 'source' | 'propertyTitle' | 'propertySlug'>>,
```

- [ ] **Step 2: Log the change in the activity log**

In `lib/leads.ts`, inside the `if (actor) {` block, after the existing `source` check
(`if (data.source && data.source !== prev.source) { parts.push(...) }`), add:

```ts
    if ('propertyTitle' in data && data.propertyTitle !== prev.propertyTitle) {
      parts.push('Interested in updated')
    }
```

- [ ] **Step 3: Rebuild the PUT patch from only-present keys (bug fix) + handle propertyTitle**

In `app/api/leads/[id]/route.ts`, add `Lead` to the types import at the top:

```ts
import { Lead } from '@/types'
```

Then replace the body-read + `updateLead` call in `PUT` (currently
`const body = await req.json()` followed by the `const updated = updateLead(... { status: body.status, notes: body.notes, contactedAt: body.contactedAt } ...)` call) with:

```ts
  const body = await req.json()
  // Build the patch from only the keys actually present, so a partial update
  // (e.g. notes only) never spreads `undefined` over an existing value.
  const patch: Partial<Pick<Lead, 'status' | 'notes' | 'contactedAt' | 'propertyTitle' | 'propertySlug'>> = {}
  if ('status' in body) patch.status = body.status
  if ('notes' in body) patch.notes = body.notes
  if ('contactedAt' in body) patch.contactedAt = body.contactedAt
  if ('propertyTitle' in body) {
    patch.propertyTitle = String(body.propertyTitle ?? '').slice(0, 200).trim() || undefined
    patch.propertySlug = undefined // editing the free text clears any stale deep-link
  }
  const updated = updateLead(
    params.id,
    patch,
    { uid: session.uid, username: session.username, name: session.name }
  )
```

Leave the existing `if (!updated) { 404 }` and `return NextResponse.json(updated)` lines unchanged.

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: build succeeds, no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add lib/leads.ts "app/api/leads/[id]/route.ts"
git commit -m "feat(crm): accept propertyTitle on lead update; fix partial-update overwrite"
```

End the commit body with:
`Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`

---

### Task 2: Frontend — editable "Interested In" input + column rename

**Files:**
- Modify: `app/admin/leads/LeadsClient.tsx` (`patchLead` ~L260, header map ~L374, expanded row ~L457)

- [ ] **Step 1: Widen the `patchLead` patch type**

In `app/admin/leads/LeadsClient.tsx`, change the `patchLead` signature from:

```ts
  async function patchLead(id: string, patch: Partial<Pick<Lead, 'status' | 'notes' | 'contactedAt'>>) {
```

to:

```ts
  async function patchLead(id: string, patch: Partial<Pick<Lead, 'status' | 'notes' | 'contactedAt' | 'propertyTitle' | 'propertySlug'>>) {
```

- [ ] **Step 2: Rename the table column "Property" → "Interested In"**

In the header map, change the column-name array from:

```tsx
                  {['Date', 'Status', 'Name', 'Phone', 'Email', 'Source', 'Property', 'Actions'].map(h => (
```

to:

```tsx
                  {['Date', 'Status', 'Name', 'Phone', 'Email', 'Source', 'Interested In', 'Actions'].map(h => (
```

And in the same `<th>`, update the narrow-column set so the renamed column stays narrow —
change `['Date', 'Status', 'Source', 'Property'].includes(h)` to:

```tsx
                    <th key={h} className={`text-left ${['Date', 'Status', 'Source', 'Interested In'].includes(h) ? 'px-2' : 'px-4'} py-3 text-xs font-medium text-gray-400 uppercase tracking-wide`}>
```

(The body cell that renders `{l.propertyTitle ?? '—'}` is positional — leave it as-is.)

- [ ] **Step 3: Add the "Interested In" input to the expanded row**

In the expanded-row editor, immediately **before** the `<div>` that contains the
`Internal notes` label/textarea, insert:

```tsx
                                <div>
                                  <label className="text-xs text-gray-500 font-medium block mb-1">Interested In</label>
                                  <input
                                    defaultValue={l.propertyTitle ?? ''}
                                    onBlur={e => {
                                      const next = e.target.value
                                      if (next !== (l.propertyTitle ?? '')) patchLead(l.id, { propertyTitle: next })
                                    }}
                                    placeholder="e.g. 2BR in Dubai Marina, off-plan under AED 2M"
                                    className="w-full border border-gray-200 px-3 py-2 rounded-sm text-sm focus:outline-none focus:border-gold"
                                  />
                                  <p className="text-xs text-gray-400 mt-1">What the lead is looking for. Saved on blur.</p>
                                </div>
```

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 5: Manual check**

Run `npm run dev`, log into `/admin/leads`. Expand a lead with no property → the
"Interested In" input is empty; type text and click away → on reload the text persists and
appears in the renamed "Interested In" table column. Change that lead's status → the text
remains. Edit the text again → the status is unchanged. (Confirms the Task-1 partial-update fix.)

- [ ] **Step 6: Commit**

```bash
git add app/admin/leads/LeadsClient.tsx
git commit -m "feat(crm): editable 'Interested In' field on leads; rename Property column"
```

End the commit body with:
`Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`

---

## Self-review

- **Spec coverage:** no schema change (Task 1 reuses `propertyTitle`); `updateLead` whitelist +
  activity log (Task 1 Steps 1-2); PUT partial-update fix + propertyTitle/clear-slug (Task 1
  Step 3); `patchLead` type (Task 2 Step 1); expanded-row input saving on blur (Task 2 Step 3);
  column rename + narrow-set update (Task 2 Step 2); cell/mobile unchanged (left as-is). All covered.
- **Placeholders:** none — every code step shows exact before/after.
- **Type consistency:** `propertyTitle`/`propertySlug` keys match `Lead` in `types/index.ts`;
  the `Partial<Pick<Lead, …>>` patch type in the PUT handler (Task 1 Step 3) is the same shape
  accepted by `updateLead` (Task 1 Step 1); `patchLead`'s widened type (Task 2 Step 1) is a
  subset of it.
