# CRM Redesign — Design Spec

**Goal:** Add `/admin/dashboard` as the CRM landing page, Kanban toggle on `/admin/leads`, and basic mobile responsiveness across all admin pages.

**Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS. Custom palette: `navy` = `#0D1B2A`, `gold` = `#C9A84C`.

---

## 1. Shared Admin Layout (`app/admin/layout.tsx`)

Currently the nav header is duplicated in every admin page (`page.tsx` in `/admin`, `/admin/leads`, `/admin/users`, `/admin/property/[id]`, `/admin/property/new`). Before adding the Dashboard link, extract the nav into a shared layout.

**What the layout does:**
- Renders the `<header>` with the nav (currently copy-pasted across pages)
- Wraps children in `min-h-screen bg-gray-50`
- Receives `session` from `getSession()` to show the user name and conditionally render the Users link
- Adds **Dashboard** link to the nav (new, before Properties)

**Nav links (order):** Dashboard → Leads → Properties → Users (owner-only)

**Active link styling:** The active link uses `text-gold border-b-2 border-gold pb-0.5 font-medium`. All other links use `text-white/60 hover:text-white`. The layout cannot know which page is active server-side without reading the URL, so each individual page passes a prop OR we use a client component for the nav that reads `usePathname()`.

**Decision:** The nav becomes a `AdminNav` client component (`app/admin/AdminNav.tsx`) that uses `usePathname()` to highlight the active link. The layout imports and renders it. Individual pages no longer render their own `<header>`.

**Pages to strip the `<header>` from:**
- `app/admin/page.tsx`
- `app/admin/leads/page.tsx`
- `app/admin/users/page.tsx`
- `app/admin/property/[id]/page.tsx`
- `app/admin/property/new/page.tsx`

---

## 2. Dashboard Page (`app/admin/dashboard/page.tsx`)

New server component at `/admin/dashboard`. This becomes the default CRM landing — the nav Dashboard link points here.

**Data needed (from existing lib functions):**
- `getLeads()` — for all stat calculations
- No new API routes needed; all data is read server-side

**Layout:** Standard `bg-gray-50` background, `max-w-7xl mx-auto px-6 py-8` content wrapper.

### 2.1 Stat Cards Row

Five cards in a `grid grid-cols-2 md:grid-cols-5 gap-3` row.

| Card | Value | Style |
|------|-------|-------|
| Total Leads | `leads.length` | White card, navy number |
| New (24h) | leads where `createdAt` > 24h ago | White card, navy number |
| In Progress | leads with status `in-progress` | White card, navy number |
| Won | leads with status `won` | White card, gold number |
| Conversion | `won / total * 100`% | Navy bg card, gold number |

Card anatomy: `bg-white border border-gray-100 rounded-sm p-4` (or navy bg for Conversion). Label: `text-gray-400 text-xs font-semibold uppercase tracking-wide`. Number: `font-serif text-3xl text-navy mt-1` (gold for Won/Conversion).

### 2.2 Bar Chart — Lead Acquisition (Last 30 Days)

Pure HTML/CSS bar chart, no external charting library. Group leads by calendar day for the last 30 days, render one bar per day.

- Container: `flex items-end gap-0.5 h-24`
- Each bar: `flex-1 rounded-t-sm` with height set as inline `style` percentage of the max day count
- All bars except today: `bg-navy/15`
- Today's bar: `bg-gold`
- Below: labels "1 May" left, "Today" right in `text-gray-400 text-xs`

**Server-side calculation:** build an array of 30 day-buckets, count leads per bucket, return `{ date, count }[]`.

### 2.3 Lead Funnel

Progress bars for each status showing count relative to total leads.

Statuses in order: `new → contacted → in-progress → won → lost`

Each row: status label (72px wide, `text-slate-600 text-xs`), progress bar (`flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden` with inner fill), count number right-aligned.

Fill colors: New → `bg-navy`, Contacted → `bg-navy opacity-75`, In Progress → `bg-navy opacity-60`, Won → `bg-gold`, Lost → `bg-gray-300`.

### 2.4 Recent Leads Table

Last 5 leads sorted by `createdAt` descending.

Columns: Name (navy, font-medium) · Phone (text-gray-500) · Status badge · Time ago (text-gray-400 text-xs, right-aligned).

Status badge colors match existing `LeadsClient.tsx` badge styles.

"View all →" link in gold at top-right of the section → `/admin/leads`.

---

## 3. Kanban Toggle on `/admin/leads`

### 3.1 View Toggle UI

In `LeadsClient.tsx`, add a toggle above the existing filters row. Two segments: **Table** and **Kanban**. Active segment: `bg-navy text-white`. Inactive: `bg-white text-gray-500`. The toggle is a `useState<'table'|'kanban'>` defaulting to `'table'`. State is local (resets on navigation — no persistence needed).

Button group markup: `flex border border-gray-200 rounded overflow-hidden` wrapping two `button` elements.

### 3.2 Kanban Board

Rendered when `view === 'kanban'`. Five columns in `grid grid-cols-5 gap-3` (desktop) / `flex overflow-x-auto` hidden on mobile (mobile uses column selector, see §4.2).

**Column header:** status label in `text-xs font-bold uppercase tracking-wider` + count badge. Colors:
- New → `text-navy`, badge `bg-blue-50 text-blue-700`
- Contacted → `text-navy`, badge `bg-amber-50 text-amber-800`
- In Progress → `text-navy`, badge `bg-purple-50 text-purple-700`
- Won → `text-gold`, badge border `border-gold/30 text-gold bg-amber-50`
- Lost → `text-gray-400`, badge `bg-gray-100 text-gray-500`

**Card anatomy** (detailed variant — all fields that exist on the lead):
```
border-l-[3px] bg-white border border-gray-100 rounded-sm p-3 mb-2 cursor-pointer hover:shadow-sm
```
Left border color per status: New → `border-blue-400`, Contacted → `border-amber-400`, In Progress → `border-purple-400`, Won → `border-gold`, Lost → `border-gray-300`.

Card content (from top):
1. Name — `font-semibold text-navy text-sm`
2. Phone — `text-gray-500 text-xs`
3. Email (if present) — `text-gray-500 text-xs`
4. Source badge — `bg-green-50 text-green-800 text-[10px] px-1.5 py-0.5 rounded inline-block my-1`
5. Separator line
6. Property info (if `lead.propertyTitle` present) — `text-gray-400 text-[10px]` — `lead.propertyTitle`
7. Budget (if `lead.budget` present) — `text-gray-400 text-[10px]` — `Budget: {lead.budget}`
8. Action buttons row: WhatsApp (green) + Email (blue) — `w-6 h-6 rounded flex items-center justify-center text-white text-xs`

**Note:** Property info is already denormalized on the `Lead` type (`propertyTitle?`, `propertySlug?`). No extra data fetching or prop changes needed in `LeadsClient`.

**Clicking a card** opens the existing expanded row view (the same panel used in Table view). Implement by setting the same `expanded` state that the table rows use.

**No drag-and-drop** — out of scope. Status changes happen in the expanded card panel (same as table view).

---

## 4. Mobile Responsiveness

### 4.1 Burger Nav

`AdminNav.tsx` (client component from §1) handles responsive nav:
- On `md+`: horizontal nav links as today
- On `< md`: hide nav links, show hamburger button (`flex flex-col gap-1` with three `bg-white/80` bars). Clicking toggles `mobileOpen` state (local `useState`).
- When open: full-width dropdown below the header with links stacked vertically. Active link has gold left border (`border-l-2 border-gold pl-2 text-gold`). Clicking any link closes the menu (`setMobileOpen(false)` in `onClick`).

Header height stays consistent — dropdown slides below, pushes content down (no overlay/absolute positioning, to avoid z-index issues with page content).

### 4.2 Mobile Kanban

On `< md` screens, the 5-column grid is hidden. Instead, render:
- A horizontal scrollable row of pill buttons, one per status, showing name + count. Active pill: `bg-navy text-white`. Inactive: `bg-white text-gray-500 border`.
- `mobileColumn` state (local `useState`) defaults to `'new'`.
- Below the pills: cards for the active column only, full-width single-column.

### 4.3 Mobile Table

The existing table in `LeadsClient.tsx` gets `overflow-x-auto` on its wrapper. No column hiding — the horizontal scroll handles it. Minimum column widths stay as-is.

---

## 5. Routing Change

The current `/admin` page shows properties. This does NOT change — `/admin` stays as the properties page.

The Dashboard link in the nav points to `/admin/dashboard` (new route).

The nav active-link logic in `AdminNav.tsx`:
- `/admin/dashboard` → Dashboard active
- `/admin/leads` → Leads active
- `/admin` (exact) or `/admin/property/*` → Properties active
- `/admin/users` → Users active

---

## 6. Out of Scope

- Drag-and-drop between Kanban columns
- Persisting the table/kanban view preference across sessions
- Real-time updates / polling
- Any changes to the public-facing site
