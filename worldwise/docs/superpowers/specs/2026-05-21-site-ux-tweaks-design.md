# Site UX Tweaks — Design

Date: 2026-05-21
Branch: `feature/article-images`

Five small UI/content changes across the admin CRM, property model, and homepage.

## Verification

`npm run build` must pass (the status-union narrowing in #2 forces cleanup of every
`=== 'ready'` comparison — a green build proves none were missed). Then `npm run dev`
and eyeball: leads-table columns narrower; property cards show no "Ready" badge;
rented rental units show a "Rented" badge and dimmed photo; homepage hero shows
"$30M+ / In Transactions", "50+ / Investors Served", "Up to 8% / Rental Yield".

## 1. Narrower lead-table columns

File: `app/admin/leads/LeadsClient.tsx` (table at L371–415).

`Date`, `Status`, `Source`, `Property` columns get `px-2` (instead of `px-4`) on both
`<th>` and matching `<td>`. `Property` cell additionally `max-w-[140px] truncate`.
`Name / Phone / Email / Actions` unchanged. Implemented via a per-column-name class
lookup so the header `.map` and body cells share one source of truth — no duplication.

## 2. Remove the READY status everywhere

- Narrow the union in `types/index.ts:8` to `'off-plan' | 'secondary' | 'rent'`.
  This is the forcing function: any remaining `=== 'ready'` becomes a compile error.
- Single migration chokepoint: `getProperties()` in `lib/properties.ts` maps any legacy
  `status === 'ready'` → `'secondary'` on read. Old server-side `properties.json` entries
  render as Secondary; `'ready'` never reaches the rest of the code.
- Remove `ready` from: `PropertyForm` status dropdown (L184), `PropertiesClient` filter
  options (L10), `PropertyCard` `STATUS_COLORS`/`STATUS_LABELS` (L11, L19), and the
  admin badge ternary (`app/admin/page.tsx:62`).

## 3. "Rented / Unavailable" marker for rentals

- New optional field `rented?: boolean` on `Property` (`types/index.ts`).
- `PropertyForm`: a "Rented / Unavailable" checkbox, shown **only when** `status === 'rent'`.
  Submit already posts `{...form}`, so the field persists with no API change
  (`createProperty`/`updateProperty` spread the payload).
- `PropertyCard`: when `rented` is true, show a "Rented" badge and dim the photo
  (`opacity-60`). The card **stays in the listing** (chosen behavior) — no filtering/sorting change.

## 4. "AED 2B+" → "$30M+"

`Hero.tsx:55` and `WhyWorldwise.tsx:66`: value becomes `$30M+`, label "In Transactions"
unchanged.

## 5. Replace "30+ Countries" stat

- Hero stat (`Hero.tsx:57`) and WhyWorldwise stat (`WhyWorldwise.tsx:68`):
  `30+ / Countries` → `Up to 8% / Rental Yield`. Concrete investor motivator, fits the
  number+label format, and does not duplicate the "0% Tax" headline.
- WhyWorldwise feature card "30+ Countries Served" (`WhyWorldwise.tsx:30`): retitle to
  **"Investors Worldwide"**, keep the existing descriptive text (already mentions
  "India, UK, Europe, the US and beyond"). Removes the "30+ countries" claim consistently.

## 6. Consistency fix: "500+ Investors" → "50+ Investors"

At "$30M+" in transactions, 500+ investors implied ~$60k each (implausibly low). Lower to
`50+` (~$600k/investor — realistic for premium property). Update `Hero.tsx:54`
("Investors Served") and `WhyWorldwise.tsx:65` ("Investors Helped").

## Notes / non-goals

- Hero stats are on-page text — indexed, but **not** the SERP snippet (that comes from
  `<title>`/meta/og in `app/layout.tsx`). These changes target on-screen conversion, not
  the search-result hook.
- No database, no touching `data/` locally, no new external image URLs — per project rules.
