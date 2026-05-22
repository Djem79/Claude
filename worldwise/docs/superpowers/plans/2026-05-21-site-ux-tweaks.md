# Site UX Tweaks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply five small UI/content changes — narrower admin lead columns, removal of the READY property status, a "Rented" marker for rentals, and corrected homepage hero stats.

**Architecture:** Pure edits to existing Next.js components and the shared `Property` type. The READY removal narrows the TS union and adds a single read-time migration in `lib/properties.ts` so legacy data renders as Secondary. No new files, no API changes, no DB, no `data/` writes from local.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS.

**Verification model:** This repo has **no test suite** (per CLAUDE.md). Each task is verified by `npm run build` passing plus a manual eyeball in `npm run dev`. If `npm` is missing, first run:
`export PATH="/Users/dzhambulat/.nvm/versions/node/v24.15.0/bin:$PATH"`
All commands run from `worldwise/`.

---

## Task ordering note

Task 1 (READY removal) narrows the `status` union, which turns every leftover `=== 'ready'`
into a compile error. Task 1 fixes all of them in one task, so the build is green at the
end of Task 1. Tasks 2–4 are independent and may run in any order after Task 1.

---

### Task 1: Remove the READY status everywhere

**Files:**
- Modify: `types/index.ts:8`
- Modify: `lib/properties.ts:7-10`
- Modify: `components/PropertyCard.tsx:10-21`
- Modify: `app/admin/page.tsx:62`
- Modify: `app/admin/property/PropertyForm.tsx:184`
- Modify: `app/properties/PropertiesClient.tsx:10`

- [ ] **Step 1: Narrow the status union**

In `types/index.ts`, change line 8 from:

```ts
  status: 'off-plan' | 'ready' | 'secondary' | 'rent'
```

to:

```ts
  status: 'off-plan' | 'secondary' | 'rent'
```

- [ ] **Step 2: Migrate legacy 'ready' on read**

In `lib/properties.ts`, replace `getProperties()`:

```ts
export function getProperties(): Property[] {
  const raw = fs.readFileSync(DATA_FILE, 'utf-8')
  const parsed = JSON.parse(raw) as (Omit<Property, 'status'> & { status: string })[]
  // Legacy 'ready' status was removed — render those entries as 'secondary'.
  return parsed.map(p => ({
    ...p,
    status: (p.status === 'ready' ? 'secondary' : p.status) as Property['status'],
  }))
}
```

- [ ] **Step 3: Drop 'ready' from PropertyCard maps**

In `components/PropertyCard.tsx`, remove the `ready:` line from both records:

```ts
const STATUS_COLORS: Record<string, string> = {
  'off-plan': 'bg-blue-50 text-blue-700',
  secondary: 'bg-amber-50 text-amber-700',
  rent: 'bg-purple-50 text-purple-700',
}

const STATUS_LABELS: Record<string, string> = {
  'off-plan': 'Off-Plan',
  secondary: 'Secondary',
  rent: 'For Rent',
}
```

- [ ] **Step 4: Remove the 'ready' branch from the admin badge**

In `app/admin/page.tsx:62`, change the badge class expression from:

```tsx
p.status === 'off-plan' ? 'bg-blue-50 text-blue-700' : p.status === 'ready' ? 'bg-green-50 text-green-700' : p.status === 'rent' ? 'bg-purple-50 text-purple-700' : 'bg-amber-50 text-amber-700'
```

to:

```tsx
p.status === 'off-plan' ? 'bg-blue-50 text-blue-700' : p.status === 'rent' ? 'bg-purple-50 text-purple-700' : 'bg-amber-50 text-amber-700'
```

- [ ] **Step 5: Drop 'ready' from the form dropdown**

In `app/admin/property/PropertyForm.tsx:184`, change:

```tsx
{['off-plan', 'ready', 'secondary', 'rent'].map(s => <option key={s} value={s}>{s}</option>)}
```

to:

```tsx
{['off-plan', 'secondary', 'rent'].map(s => <option key={s} value={s}>{s}</option>)}
```

- [ ] **Step 6: Drop 'ready' from the listing filter**

In `app/properties/PropertiesClient.tsx`, remove this line from the `STATUSES` array:

```ts
  { value: 'ready', label: 'Ready' },
```

- [ ] **Step 7: Build to verify no leftover 'ready' references**

Run: `npm run build`
Expected: build succeeds. (If it fails with a TS "comparison appears unintentional / no overlap with 'ready'" error, an `=== 'ready'` comparison was missed — fix it.)

- [ ] **Step 8: Commit**

```bash
git add types/index.ts lib/properties.ts components/PropertyCard.tsx app/admin/page.tsx app/admin/property/PropertyForm.tsx app/properties/PropertiesClient.tsx
git commit -m "feat(properties): remove READY status; legacy entries render as Secondary"
```

---

### Task 2: "Rented / Unavailable" marker for rentals

**Files:**
- Modify: `types/index.ts` (add field after `badge?: string`)
- Modify: `app/admin/property/PropertyForm.tsx` (checkbox after the Featured checkbox, ~L362)
- Modify: `components/PropertyCard.tsx` (badge block L33-40 + image className)

- [ ] **Step 1: Add the `rented` field to Property**

In `types/index.ts`, add a line immediately after `badge?: string`:

```ts
  badge?: string
  rented?: boolean
```

- [ ] **Step 2: Add the conditional checkbox to PropertyForm**

In `app/admin/property/PropertyForm.tsx`, immediately after the closing `</label>` of the
Featured checkbox (the block ending around L363), insert:

```tsx
      {form.status === 'rent' && (
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={form.rented ?? false}
            onChange={e => set('rented', e.target.checked)}
            className="w-4 h-4 accent-gold"
          />
          <span className="text-sm text-navy font-medium">
            Mark as Rented / Unavailable
          </span>
        </label>
      )}
```

(The submit payload already spreads `...form`, so `rented` persists with no API change.)

- [ ] **Step 3: Show the badge and dim the photo on the card**

In `components/PropertyCard.tsx`, add `rented` to the Image className. Change:

```tsx
          className="object-cover group-hover:scale-105 transition-transform duration-500"
```

to:

```tsx
          className={`object-cover group-hover:scale-105 transition-transform duration-500 ${property.rented ? 'opacity-60' : ''}`}
```

Then in the top-left badge flex block, add the Rented badge after the status badge:

```tsx
        <div className="absolute top-3 left-3 flex gap-2">
          <span className={`badge ${STATUS_COLORS[property.status]}`}>
            {STATUS_LABELS[property.status]}
          </span>
          {property.rented && (
            <span className="badge bg-gray-800/80 text-white">Rented</span>
          )}
          {property.badge && (
            <span className="badge bg-navy/80 text-gold">{property.badge}</span>
          )}
        </div>
```

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 5: Manual check**

Run `npm run dev`. In `/admin/property/new`, set Status = `rent` → the "Mark as Rented /
Unavailable" checkbox appears; set Status = `off-plan` → it disappears. (Card badge/dim is
verified visually once a rented rental exists.)

- [ ] **Step 6: Commit**

```bash
git add types/index.ts app/admin/property/PropertyForm.tsx components/PropertyCard.tsx
git commit -m "feat(properties): add Rented/Unavailable marker for rental listings"
```

---

### Task 3: Homepage hero & WhyWorldwise stats

**Files:**
- Modify: `components/Hero.tsx:54-57`
- Modify: `components/WhyWorldwise.tsx:30` and `:65-68`

- [ ] **Step 1: Update Hero stats**

In `components/Hero.tsx`, replace lines 54-57:

```tsx
              { value: '500+', label: 'Investors Served' },
              { value: 'AED 2B+', label: 'In Transactions' },
              { value: '5.0 ★', label: 'Google Rating' },
              { value: '30+', label: 'Countries' },
```

with:

```tsx
              { value: '50+', label: 'Investors Served' },
              { value: '$30M+', label: 'In Transactions' },
              { value: '5.0 ★', label: 'Google Rating' },
              { value: 'Up to 8%', label: 'Rental Yield' },
```

- [ ] **Step 2: Update WhyWorldwise stats**

In `components/WhyWorldwise.tsx`, replace lines 65-68:

```tsx
                { v: '500+', l: 'Investors Helped' },
                { v: 'AED 2B+', l: 'In Transactions' },
                { v: '8+', l: 'Developer Partners' },
                { v: '30+', l: 'Countries Represented' },
```

with:

```tsx
                { v: '50+', l: 'Investors Helped' },
                { v: '$30M+', l: 'In Transactions' },
                { v: '8+', l: 'Developer Partners' },
                { v: 'Up to 8%', l: 'Rental Yield' },
```

- [ ] **Step 3: Retitle the WhyWorldwise feature card**

In `components/WhyWorldwise.tsx:30`, change:

```tsx
    title: '30+ Countries Served',
```

to:

```tsx
    title: 'Investors Worldwide',
```

(Leave the card's `text` unchanged — it already reads "India, UK, Europe, the US and beyond".)

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 5: Manual check**

Run `npm run dev`, open `/`. Hero stat row shows `50+ / $30M+ / 5.0 ★ / Up to 8%`. The
"Why Worldwise" section shows the matching stats and the "Investors Worldwide" card. No
"AED 2B+", "500+", or "30+ Countries" remains anywhere on the homepage.

- [ ] **Step 6: Commit**

```bash
git add components/Hero.tsx components/WhyWorldwise.tsx
git commit -m "feat(home): correct hero stats ($30M+, 50+ investors, Up to 8% yield)"
```

---

### Task 4: Narrower lead-table columns

**Files:**
- Modify: `app/admin/leads/LeadsClient.tsx` (table header L374-375, body cells L394-408)

- [ ] **Step 1: Add a narrow-column set and apply it to the header**

In `app/admin/leads/LeadsClient.tsx`, the header currently maps over column names with a
fixed `px-4`. Introduce a set of the narrow columns just above the `return (` of the
component (near the other top-level consts), or inline. Then update the `<th>`:

Change the header map (L374-377) from:

```tsx
                  {['Date', 'Status', 'Name', 'Phone', 'Email', 'Source', 'Property', 'Actions'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
```

to:

```tsx
                  {['Date', 'Status', 'Name', 'Phone', 'Email', 'Source', 'Property', 'Actions'].map(h => (
                    <th key={h} className={`text-left ${['Date', 'Status', 'Source', 'Property'].includes(h) ? 'px-2' : 'px-4'} py-3 text-xs font-medium text-gray-400 uppercase tracking-wide`}>
                      {h}
                    </th>
                  ))}
```

- [ ] **Step 2: Narrow the four body cells**

In the same file, change the four `<td>`s (the body cells are explicit, not mapped):

Date cell (L394): `px-4 py-3 text-gray-500 whitespace-nowrap` → `px-2 py-3 text-gray-500 whitespace-nowrap`

```tsx
                        <td className="px-2 py-3 text-gray-500 whitespace-nowrap">{fmt(l.createdAt)}</td>
```

Status cell (L395): `px-4 py-3` → `px-2 py-3`

```tsx
                        <td className="px-2 py-3">
```

Source cell (L407): `px-4 py-3` → `px-2 py-3`

```tsx
                        <td className="px-2 py-3"><span className="badge bg-gray-100 text-gray-600 text-xs">{l.source}</span></td>
```

Property cell (L408): `px-4 py-3 text-gray-500 max-w-xs truncate` → `px-2 py-3 text-gray-500 max-w-[140px] truncate`

```tsx
                        <td className="px-2 py-3 text-gray-500 max-w-[140px] truncate">{l.propertyTitle ?? '—'}</td>
```

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Manual check**

Run `npm run dev`, log into `/admin/leads`. The Date / Status / Source / Property columns
are visibly tighter than Name / Phone / Email / Actions; long property titles truncate with
an ellipsis.

- [ ] **Step 5: Commit**

```bash
git add app/admin/leads/LeadsClient.tsx
git commit -m "style(admin): tighten Date/Status/Source/Property lead columns"
```

---

## Self-review

- **Spec coverage:** #1 columns → Task 4; #2 remove READY → Task 1; #3 rented marker →
  Task 2; #4 $30M+ → Task 3 Steps 1-2; #5 replace 30+ Countries → Task 3 Steps 1-3;
  #6 50+ investors → Task 3 Steps 1-2. All covered.
- **Placeholders:** none — every code step shows exact before/after.
- **Type consistency:** `rented?: boolean` defined in Task 2 Step 1 and used in Task 2
  Steps 2-3; narrowed `status` union (Task 1 Step 1) consistent with `Property['status']`
  cast in Step 2.
