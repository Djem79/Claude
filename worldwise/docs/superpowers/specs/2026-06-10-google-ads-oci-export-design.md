# Google Ads OCI export from CRM — design

**Date:** 2026-06-10 · **Status:** approved · **Context:** `docs/marketing/2026-06-09-google-ads-fixes-and-conversion-tracking.md` §C

## Goal

A one-click "Export Google Ads" button in `/admin/leads` that downloads a ready-to-upload Offline Conversion Import (OCI) file for Google Ads → Goals → Conversions → Uploads. Counts every ad lead via `gclid` (captured consent-independently by `UtmCapture`), including visitors who declined cookies and are invisible to GA4.

Decisions made with the owner:
- Delivery: **CRM button** (no cron; owner uploads weekly by hand).
- Funnel stages: **CRM Lead + CRM Qualified + CRM Deal** (3 conversion actions).
- Conversion Value: **always 0**, currency AED (no deal-value field in CRM yet; can be hand-edited in the file before upload).

## Module: `lib/oci-export.ts` (pure — no fs/next imports, node:test-able)

```ts
export const OCI_ACTIONS = { lead: 'CRM Lead', qualified: 'CRM Qualified', deal: 'CRM Deal' } as const
export function buildOciCsv(leads: Lead[], now: Date): {
  csv: string
  counts: { lead: number; qualified: number; deal: number }
}
```

Rules:
- Include only leads with a non-empty `gclid` AND `createdAt` within **90 days** of `now` (Google's click window; the click time ≈ lead creation).
- Up to three rows per lead:
  - `CRM Lead` — always; time = `createdAt`.
  - `CRM Qualified` — if the lead ever reached `in-progress` or `won`; time = the `at` of the first `activityLog` entry whose `action` contains `→ in-progress`, falling back to the `→ won` entry, then `updatedAt`, then `createdAt`.
  - `CRM Deal` — if `status === 'won'`; time = the first `→ won` activity entry, falling back to `updatedAt`, then `createdAt`.
- Output format (exactly Google's template):

  ```
  Parameters:TimeZone=+0400
  Google Click ID,Conversion Name,Conversion Time,Conversion Value,Conversion Currency
  <gclid>,CRM Lead,2026-06-15 14:30:00,0,AED
  ```

  Times converted from ISO UTC to **Asia/Dubai** (`+04:00`, no DST) and formatted `yyyy-MM-dd HH:mm:ss`. No quoting needed: gclid is URL-safe, action names are fixed constants — but assert/strip commas from gclid defensively.
- A conversion time must not precede the click: clamp stage times to ≥ `createdAt`.
- Statelessness: the button regenerates the full window every time. Safe because Google Ads deduplicates identical (gclid, conversion name, time) rows on upload.

## UI: `app/admin/leads/LeadsClient.tsx`

- Button "Export Google Ads" next to the existing "Export CSV"; same visual style.
- Operates on **all** `leads` (NOT the filtered view) — active CRM filters must not silently drop deals.
- When `counts` are all zero → `alert('No leads with gclid in the last 90 days')` instead of an empty file.
- Download as `google-ads-oci-<yyyy-MM-dd>.csv` (same Blob mechanism as `exportCsv`).

## Tests: `lib/oci-export.test.ts` (node:test, run via `node --test --experimental-strip-types`)

- gclid filter + 90-day window boundary.
- Stage mapping: new/contacted → Lead only; in-progress → +Qualified; won → +Qualified+Deal (even if it skipped in-progress).
- Time extraction from `activityLog` action strings, with fallbacks; clamp to ≥ createdAt.
- Timezone conversion (UTC ISO → Dubai +04) and exact header/Parameters lines.

## Out of scope

- Google Ads API automation, upload-state tracking, deal-value field in CRM (future), cron/Telegram delivery.

## Owner's follow-up after deploy (one-time, in Google Ads UI)

1. Create 3 conversion actions: Import → CRMs, files or other data sources → Track conversions from clicks, named **exactly** `CRM Lead`, `CRM Qualified`, `CRM Deal` (Count: One; window 90 days; `CRM Deal` with value enabled, AED).
2. Separately: run §A of the marketing doc (fix the "Misconfigured" GA4 import) in browser Claude with Google Ads access.
3. Weekly ritual: CRM → Export Google Ads → Ads → Conversions → Uploads → Preview → Apply.
