# Manager Section Permissions — Design

**Date:** 2026-05-22
**Status:** Approved

## Problem

The admin panel has two roles: `owner` (full access incl. Users) and `manager` (sees
all working tabs — Dashboard, Leads, Properties — with no way to differentiate). The
owner needs to grant managers access to specific sections only. Example: manager A can
work with Properties only; manager B with Properties + Leads.

## Decisions

- **Granularity:** section-level. Having a section grants full view + edit/delete within
  it. No separate read-only/read-write split.
- **Gated sections:** `properties`, `leads`, `dashboard`. The **Users** section stays
  owner-only and is never part of `sections`.
- **New manager default:** `['properties']`. Owner grants Leads/Dashboard explicitly.
- **Existing managers (migration):** keep full access — no breakage. Achieved by treating
  a missing `sections` field as "all sections".

## Data model

`types/index.ts`:

```ts
export type AdminSection = 'dashboard' | 'leads' | 'properties'

export interface AdminUser {
  // ...existing fields...
  sections: AdminSection[]   // sections a manager may access; ignored for owner
}
```

`owner` ignores `sections` (always full access). The `users` section does not exist as a
value — Users remains owner-only via the existing role check.

## Permissions module — `lib/permissions.ts` (single source of truth)

```ts
export type { AdminSection }            // re-export for convenience
export const ALL_SECTIONS: AdminSection[] = ['properties', 'leads', 'dashboard']
export const DEFAULT_SECTIONS: AdminSection[] = ['properties']

// Section → admin route used for nav + redirects
export const SECTION_PATH: Record<AdminSection, string> = {
  properties: '/admin',
  leads: '/admin/leads',
  dashboard: '/admin/dashboard',
}

type Principal = { role: AdminRole; sections?: AdminSection[] }

// Legacy users (no sections field) → treated as full access
export function effectiveSections(user: Principal): AdminSection[]

export function canAccess(user: Principal, section: AdminSection): boolean
// owner → true; otherwise section ∈ effectiveSections(user)

export function landingPath(user: Principal): string | null
// path of first accessible section in ALL_SECTIONS order, or null if none
```

`effectiveSections` returns `user.sections ?? ALL_SECTIONS`. This is the only place the
"missing = all" rule lives; both the server checks and the Users UI seed from it.

## Enforcement (three layers)

### 1. Navigation — UX only
`app/admin/AdminNav.tsx`: filter `NAV_LINKS` so only accessible sections render.
`NavSession` gains `sections?: AdminSection[]`. Each `NAV_LINK` gets a `section` key;
links are shown when `canAccess(session, link.section)`. The Users link keeps its existing
`role === 'owner'` condition.

### 2. Pages — real protection (server components)
Each guarded server page reads the session and redirects when access is missing. Because
`getSession()` reads `role`/`sections` fresh from the DB, revoking access takes effect
immediately (not after token expiry).

- `app/admin/page.tsx` (Properties) → require `properties`
- `app/admin/property/new/page.tsx` and `app/admin/property/[id]/page.tsx` → require `properties`
- `app/admin/leads/page.tsx` → require `leads`
- `app/admin/dashboard/page.tsx` → require `dashboard`

Guard pattern:

```ts
const session = await getSession()
if (!session) redirect('/admin/login')
if (!canAccess(session, 'leads')) redirect(landingPath(session) ?? '/admin')
```

`landingPath` always returns an accessible section, so no redirect loop. A manager whose
`sections` is explicitly `[]` (owner removed everything) gets `landingPath === null`; those
guards fall back to `/admin`. `/admin` (Properties page) is the single terminal: when the
user has no accessible sections it renders a small "You don't have access to any section —
contact the owner" message instead of redirecting. This avoids any loop.

### 3. API — real protection
Add a small guard helper (in `lib/auth.ts` or `lib/permissions.ts`) for route handlers:

```ts
// returns SessionPayload on success, or null when access denied
async function sessionWithSection(section: AdminSection)
```

Handlers return `403 Forbidden` when it returns null.

- `GET /api/leads`, `PUT /api/leads/[id]`, `DELETE /api/leads/[id]` → require `leads`
- `POST /api/properties`, `PUT /api/properties/[id]`, `DELETE /api/properties/[id]` → require `properties`
- `POST /api/upload` (gallery/qr) → require `properties`
- `GET /api/properties` → **stays public** (used by the public site) — unchanged
- Users APIs (`/api/admin/users*`) → stay owner-only — unchanged

## Session / token — unchanged

`SessionPayload` and the token byte shape are **not** modified (per CLAUDE.md: never change
the payload structure without invalidating all sessions). `sections` is **not** put in the
token. `getSession()` already re-reads the DB user; it will additionally surface `sections`
in its return so pages/nav can call `canAccess`. Concretely, `getSession` returns
`SessionPayload & { sections?: AdminSection[] }` populated from the DB user. No forced
logout on deploy; permission changes apply immediately.

`middleware.ts` is unchanged: it keeps the auth gate and the owner-only `/admin/users` gate.
Section gating is done by the pages, which can read the DB.

## Login redirect

`app/admin/login/page.tsx` currently always `router.push('/admin')`. Change so the login API
response (or a follow-up) sends the user to `landingPath`. Simplest: the login endpoint that
sets the cookie returns `{ redirect: landingPath(user) ?? '/admin' }`, and the client pushes
that. (If login currently has no JSON body, push to `/admin` and let the page-level guard
redirect a Leads-only manager onward — acceptable fallback; preferred is returning the path.)

## Users management UI

`app/admin/users/page.tsx` + `app/admin/users/UsersClient.tsx`:
- Create/edit forms gain three checkboxes (Properties / Leads / Dashboard) seeded from
  `effectiveSections(user)`.
- Checkboxes are shown only when the selected role is `manager` (hidden for `owner`).
- New-user form defaults to `DEFAULT_SECTIONS` (`['properties']`).

`app/api/admin/users/route.ts` (POST) and `app/api/admin/users/[id]/route.ts` (PUT):
- Accept and validate `sections` (subset of `ALL_SECTIONS`); ignore for `owner`.

`lib/users.ts`:
- `createUser` accepts `sections` (default `DEFAULT_SECTIONS`).
- `updateUser` accepts `sections` in its patch.

## Out of scope

- No view/edit sub-permissions.
- No change to the Telegram bot, lead intake, or auto-blog.
- No new role beyond owner/manager.

## Verification

- `npm run build` passes.
- Create a manager with `sections: ['properties']`: AdminNav shows only Properties; visiting
  `/admin/leads` redirects to `/admin`; `GET /api/leads` returns 403.
- Grant that manager `leads`: Leads tab appears, `/admin/leads` loads, API returns 200.
- An existing manager (no `sections` in `users.json`) still sees all tabs.
- Owner sees all tabs incl. Users; no section checkboxes affect them.
