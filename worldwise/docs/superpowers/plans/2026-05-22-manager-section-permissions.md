# Manager Section Permissions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the owner restrict each manager to specific admin sections (Properties / Leads / Dashboard); managers without a section can't see its tab, can't open its pages, and its APIs return 403.

**Architecture:** A new `sections: AdminSection[]` field on `AdminUser`, a pure `lib/permissions.ts` as the single source of truth (`canAccess`, `effectiveSections`, `landingPath`), and three enforcement layers — nav links, server-page redirects, and API guards. The session token is NOT changed; `getSession()` reads `sections` fresh from the DB so revocation is instant.

**Tech Stack:** Next.js 14 App Router, TypeScript, file-based JSON store (`lib/users.ts`). No test suite in this repo — **verification per task is `npm run build`** (run from `worldwise/`) plus targeted manual checks. There is no unit-test framework; do not invent one.

**Note on commands:** all `npm`/build commands run from `/Users/dzhambulat/Documents/Claude/worldwise`. If `npm` is missing: `export PATH="/Users/dzhambulat/.nvm/versions/node/v24.15.0/bin:$PATH"`.

**Migration safety:** existing managers in `data/users.json` have no `sections` field. `effectiveSections()` treats a missing field as "all sections", so they keep full access until the owner edits them. New managers default to `['properties']`.

---

### Task 1: Types + permissions module (foundation)

**Files:**
- Modify: `types/index.ts` (around line 73-86)
- Create: `lib/permissions.ts`

- [ ] **Step 1: Add the section type and field to `types/index.ts`**

Find:

```ts
export type AdminRole = 'owner' | 'manager'

export interface AdminUser {
  id: string
  name: string
  username: string
  passwordHash: string
  role: AdminRole
  active: boolean
  createdAt: string
  lastLoginAt?: string
}
```

Replace with:

```ts
export type AdminRole = 'owner' | 'manager'

export type AdminSection = 'properties' | 'leads' | 'dashboard'

export interface AdminUser {
  id: string
  name: string
  username: string
  passwordHash: string
  role: AdminRole
  active: boolean
  /** Sections a manager may access. Absent on legacy users → treated as all sections. Ignored for owner. */
  sections?: AdminSection[]
  createdAt: string
  lastLoginAt?: string
}
```

- [ ] **Step 2: Create `lib/permissions.ts`**

This module is **pure** (no `fs`, no `next/headers`) so it can be imported by client components and server code alike.

```ts
import { AdminRole, AdminSection } from '@/types'

export const ALL_SECTIONS: AdminSection[] = ['properties', 'leads', 'dashboard']

/** Default sections granted to a newly-created manager. */
export const DEFAULT_SECTIONS: AdminSection[] = ['properties']

/** Section → its admin route. Used for nav rendering and redirects. */
export const SECTION_PATH: Record<AdminSection, string> = {
  properties: '/admin',
  leads: '/admin/leads',
  dashboard: '/admin/dashboard',
}

type Principal = { role: AdminRole; sections?: AdminSection[] }

/** Legacy users (no `sections`) are treated as having every section. */
export function effectiveSections(user: Principal): AdminSection[] {
  if (user.role === 'owner') return ALL_SECTIONS
  return user.sections ?? ALL_SECTIONS
}

export function canAccess(user: Principal, section: AdminSection): boolean {
  if (user.role === 'owner') return true
  return effectiveSections(user).includes(section)
}

/** First accessible section's path (in ALL_SECTIONS order), or null if none. */
export function landingPath(user: Principal): string | null {
  const first = ALL_SECTIONS.find(s => canAccess(user, s))
  return first ? SECTION_PATH[first] : null
}
```

- [ ] **Step 3: Verify it compiles**

Run: `npm run build`
Expected: build succeeds (no type errors). The new field is optional and unused so far, so nothing breaks.

- [ ] **Step 4: Commit**

```bash
git add types/index.ts lib/permissions.ts
git commit -m "feat(admin): add AdminSection type and permissions module

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: `getSession()` surfaces sections + `requireSection` API guard

**Files:**
- Modify: `lib/auth.ts`

- [ ] **Step 1: Replace `lib/auth.ts` with the version that exposes `sections`**

Full new content:

```ts
import { cookies } from 'next/headers'
import { verifySessionToken, SESSION_COOKIE, SessionPayload } from '@/lib/session'
import { getUserById } from '@/lib/users'
import { AdminSection } from '@/types'
import { canAccess, effectiveSections } from '@/lib/permissions'

export { SESSION_COOKIE }

/** Session payload enriched with the user's effective sections (read fresh from DB). */
export type Session = SessionPayload & { sections: AdminSection[] }

export async function getSession(): Promise<Session | null> {
  const cookieStore = cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (!token) return null
  const payload = await verifySessionToken(token)
  if (!payload) return null
  const user = getUserById(payload.uid)
  if (!user || !user.active) return null
  // Use role/name/sections from the DB, not the (up to 7-day-old) token, so a demoted,
  // renamed, or section-restricted user can't keep stale privileges until expiry. See audit M1.
  return {
    ...payload,
    name: user.name,
    role: user.role,
    sections: effectiveSections(user),
  }
}

export async function isAuthenticated(): Promise<boolean> {
  return (await getSession()) !== null
}

/**
 * For API route handlers: returns the session if it can access `section`, else null.
 * Owner always passes. Caller returns 403 on null.
 */
export async function requireSection(section: AdminSection): Promise<Session | null> {
  const session = await getSession()
  if (!session) return null
  return canAccess(session, section) ? session : null
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: succeeds. Note `getSession()` now returns `Session` (a superset of `SessionPayload`); existing callers reading `name`/`role`/`username`/`uid` are unaffected.

- [ ] **Step 3: Commit**

```bash
git add lib/auth.ts
git commit -m "feat(admin): surface effective sections in getSession + requireSection guard

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: `lib/users.ts` — persist sections on create/update

**Files:**
- Modify: `lib/users.ts`

- [ ] **Step 1: Import the default and `AdminSection`**

Find:

```ts
import { AdminUser, AdminRole } from '@/types'
import { writeFileAtomic } from '@/lib/atomic-write'
```

Replace with:

```ts
import { AdminUser, AdminRole, AdminSection } from '@/types'
import { writeFileAtomic } from '@/lib/atomic-write'
import { DEFAULT_SECTIONS } from '@/lib/permissions'
```

- [ ] **Step 2: Accept `sections` in `createUser`**

Find:

```ts
export async function createUser(data: {
  name: string
  username: string
  password: string
  role: AdminRole
}): Promise<AdminUser> {
  const users = getUsers()
  if (users.some(u => u.username === data.username)) {
    throw new Error('Username already taken')
  }
  const passwordHash = await bcrypt.hash(data.password, 10)
  const user: AdminUser = {
    id: String(Date.now()),
    name: data.name,
    username: data.username,
    passwordHash,
    role: data.role,
    active: true,
    createdAt: new Date().toISOString(),
  }
  saveUsers([...users, user])
  return user
}
```

Replace with:

```ts
export async function createUser(data: {
  name: string
  username: string
  password: string
  role: AdminRole
  sections?: AdminSection[]
}): Promise<AdminUser> {
  const users = getUsers()
  if (users.some(u => u.username === data.username)) {
    throw new Error('Username already taken')
  }
  const passwordHash = await bcrypt.hash(data.password, 10)
  const user: AdminUser = {
    id: String(Date.now()),
    name: data.name,
    username: data.username,
    passwordHash,
    role: data.role,
    active: true,
    sections: data.sections ?? DEFAULT_SECTIONS,
    createdAt: new Date().toISOString(),
  }
  saveUsers([...users, user])
  return user
}
```

- [ ] **Step 3: Accept `sections` in `updateUser`'s patch type**

Find:

```ts
export async function updateUser(
  id: string,
  patch: Partial<{ name: string; role: AdminRole; active: boolean; password: string; lastLoginAt: string }>
): Promise<AdminUser | null> {
```

Replace with:

```ts
export async function updateUser(
  id: string,
  patch: Partial<{ name: string; role: AdminRole; active: boolean; password: string; lastLoginAt: string; sections: AdminSection[] }>
): Promise<AdminUser | null> {
```

(The function body spreads `...rest` over the existing user, so `sections` flows through automatically.)

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 5: Commit**

```bash
git add lib/users.ts
git commit -m "feat(admin): persist sections on createUser/updateUser

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Users API — accept & validate `sections`

**Files:**
- Modify: `app/api/admin/users/route.ts` (POST)
- Modify: `app/api/admin/users/[id]/route.ts` (PUT)

- [ ] **Step 1: POST — parse, validate, and pass `sections`**

In `app/api/admin/users/route.ts`, find:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getUsers, createUser } from '@/lib/users'
import { AdminUser } from '@/types'
```

Replace with:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getUsers, createUser } from '@/lib/users'
import { AdminUser, AdminSection } from '@/types'
import { ALL_SECTIONS, DEFAULT_SECTIONS } from '@/lib/permissions'

function sanitizeSections(input: unknown): AdminSection[] {
  if (!Array.isArray(input)) return DEFAULT_SECTIONS
  return ALL_SECTIONS.filter(s => input.includes(s))
}
```

Then find:

```ts
  const { name, username, password, role } = await req.json()
  if (!name || !username || !password || !role) {
    return NextResponse.json({ error: 'All fields required' }, { status: 400 })
  }
  if (role !== 'owner' && role !== 'manager') {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
  }
  try {
    const user = await createUser({ name, username, password, role })
```

Replace with:

```ts
  const { name, username, password, role, sections } = await req.json()
  if (!name || !username || !password || !role) {
    return NextResponse.json({ error: 'All fields required' }, { status: 400 })
  }
  if (role !== 'owner' && role !== 'manager') {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
  }
  // Owner always has every section; managers get the validated subset.
  const userSections = role === 'owner' ? ALL_SECTIONS : sanitizeSections(sections)
  try {
    const user = await createUser({ name, username, password, role, sections: userSections })
```

- [ ] **Step 2: PUT — accept `sections` in the patch**

In `app/api/admin/users/[id]/route.ts`, find:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { updateUser, deleteUser, getUserById } from '@/lib/users'
import { AdminUser } from '@/types'
```

Replace with:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { updateUser, deleteUser, getUserById } from '@/lib/users'
import { AdminUser } from '@/types'
import { ALL_SECTIONS } from '@/lib/permissions'
```

Then find:

```ts
  const { name, role, active, password } = await req.json()
  const patch: Parameters<typeof updateUser>[1] = {}
  if (name !== undefined) patch.name = name
  if (role !== undefined) patch.role = role
  if (active !== undefined) patch.active = active
  if (password) patch.password = password
```

Replace with:

```ts
  const { name, role, active, password, sections } = await req.json()
  const patch: Parameters<typeof updateUser>[1] = {}
  if (name !== undefined) patch.name = name
  if (role !== undefined) patch.role = role
  if (active !== undefined) patch.active = active
  if (password) patch.password = password
  if (Array.isArray(sections)) {
    patch.sections = ALL_SECTIONS.filter(s => sections.includes(s))
  }
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 4: Commit**

```bash
git add "app/api/admin/users/route.ts" "app/api/admin/users/[id]/route.ts"
git commit -m "feat(admin): accept and validate sections in users API

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Users UI — section checkboxes (add + edit forms)

**Files:**
- Modify: `app/admin/users/UsersClient.tsx`

- [ ] **Step 1: Import section constants and add form state**

Find:

```ts
import { useState } from 'react'
import { AdminUser, AdminRole } from '@/types'

type SafeUser = Omit<AdminUser, 'passwordHash'>
```

Replace with:

```ts
import { useState } from 'react'
import { AdminUser, AdminRole, AdminSection } from '@/types'
import { ALL_SECTIONS, DEFAULT_SECTIONS, effectiveSections } from '@/lib/permissions'

type SafeUser = Omit<AdminUser, 'passwordHash'>

const SECTION_LABEL: Record<AdminSection, string> = {
  properties: 'Properties',
  leads: 'Leads',
  dashboard: 'Dashboard',
}

function toggle(list: AdminSection[], s: AdminSection): AdminSection[] {
  return list.includes(s) ? list.filter(x => x !== s) : [...list, s]
}
```

- [ ] **Step 2: Add `sections` state for both forms**

Find:

```ts
  // Add form state
  const [addName, setAddName] = useState('')
  const [addUsername, setAddUsername] = useState('')
  const [addPassword, setAddPassword] = useState('')
  const [addRole, setAddRole] = useState<AdminRole>('manager')

  // Edit form state
  const [editName, setEditName] = useState('')
  const [editRole, setEditRole] = useState<AdminRole>('manager')
  const [editActive, setEditActive] = useState(true)
  const [editPassword, setEditPassword] = useState('')
```

Replace with:

```ts
  // Add form state
  const [addName, setAddName] = useState('')
  const [addUsername, setAddUsername] = useState('')
  const [addPassword, setAddPassword] = useState('')
  const [addRole, setAddRole] = useState<AdminRole>('manager')
  const [addSections, setAddSections] = useState<AdminSection[]>(DEFAULT_SECTIONS)

  // Edit form state
  const [editName, setEditName] = useState('')
  const [editRole, setEditRole] = useState<AdminRole>('manager')
  const [editActive, setEditActive] = useState(true)
  const [editPassword, setEditPassword] = useState('')
  const [editSections, setEditSections] = useState<AdminSection[]>(DEFAULT_SECTIONS)
```

- [ ] **Step 3: Seed `editSections` when opening the edit row**

Find:

```ts
  function startEdit(u: SafeUser) {
    setEditingId(u.id)
    setEditName(u.name)
    setEditRole(u.role)
    setEditActive(u.active)
    setEditPassword('')
    setError('')
  }
```

Replace with:

```ts
  function startEdit(u: SafeUser) {
    setEditingId(u.id)
    setEditName(u.name)
    setEditRole(u.role)
    setEditActive(u.active)
    setEditPassword('')
    setEditSections(effectiveSections(u))
    setError('')
  }
```

- [ ] **Step 4: Send `sections` in the add request and reset on success**

Find:

```ts
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: addName, username: addUsername, password: addPassword, role: addRole }),
    })
    if (res.ok) {
      const user: SafeUser = await res.json()
      setUsers(prev => [...prev, user])
      setShowAdd(false)
      setAddName(''); setAddUsername(''); setAddPassword(''); setAddRole('manager')
    } else {
```

Replace with:

```ts
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: addName, username: addUsername, password: addPassword, role: addRole, sections: addSections }),
    })
    if (res.ok) {
      const user: SafeUser = await res.json()
      setUsers(prev => [...prev, user])
      setShowAdd(false)
      setAddName(''); setAddUsername(''); setAddPassword(''); setAddRole('manager'); setAddSections(DEFAULT_SECTIONS)
    } else {
```

- [ ] **Step 5: Send `sections` in the edit request**

Find:

```ts
    const body: Record<string, unknown> = { name: editName, role: editRole, active: editActive }
    if (editPassword.trim()) body.password = editPassword
```

Replace with:

```ts
    const body: Record<string, unknown> = { name: editName, role: editRole, active: editActive, sections: editSections }
    if (editPassword.trim()) body.password = editPassword
```

- [ ] **Step 6: Render the checkboxes in the ADD form (managers only)**

In the add form, find the Role `<div>` block:

```tsx
            <div>
              <label className="text-xs text-gray-500 font-medium block mb-1">Role</label>
              <select
                className="input-field"
                value={addRole}
                onChange={e => setAddRole(e.target.value as AdminRole)}
              >
                <option value="manager">Manager</option>
                <option value="owner">Owner</option>
              </select>
            </div>
            <div className="md:col-span-2 flex gap-3">
```

Replace with:

```tsx
            <div>
              <label className="text-xs text-gray-500 font-medium block mb-1">Role</label>
              <select
                className="input-field"
                value={addRole}
                onChange={e => setAddRole(e.target.value as AdminRole)}
              >
                <option value="manager">Manager</option>
                <option value="owner">Owner</option>
              </select>
            </div>
            {addRole === 'manager' && (
              <div className="md:col-span-2">
                <label className="text-xs text-gray-500 font-medium block mb-2">Section access</label>
                <div className="flex flex-wrap gap-4">
                  {ALL_SECTIONS.map(s => (
                    <label key={s} className="flex items-center gap-2 text-sm text-navy">
                      <input
                        type="checkbox"
                        checked={addSections.includes(s)}
                        onChange={() => setAddSections(prev => toggle(prev, s))}
                      />
                      {SECTION_LABEL[s]}
                    </label>
                  ))}
                </div>
              </div>
            )}
            <div className="md:col-span-2 flex gap-3">
```

- [ ] **Step 7: Render the checkboxes in the EDIT form (managers only)**

In the edit row, find the Status `<div>` block followed by the save buttons:

```tsx
                        <div>
                          <label className="text-xs text-gray-500 font-medium block mb-1">Status</label>
                          <select
                            className="input-field"
                            value={editActive ? 'active' : 'inactive'}
                            onChange={e => setEditActive(e.target.value === 'active')}
                          >
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                          </select>
                        </div>
                        <div className="md:col-span-4 flex gap-3">
```

Replace with:

```tsx
                        <div>
                          <label className="text-xs text-gray-500 font-medium block mb-1">Status</label>
                          <select
                            className="input-field"
                            value={editActive ? 'active' : 'inactive'}
                            onChange={e => setEditActive(e.target.value === 'active')}
                          >
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                          </select>
                        </div>
                        {editRole === 'manager' && (
                          <div className="md:col-span-4">
                            <label className="text-xs text-gray-500 font-medium block mb-2">Section access</label>
                            <div className="flex flex-wrap gap-4">
                              {ALL_SECTIONS.map(s => (
                                <label key={s} className="flex items-center gap-2 text-sm text-navy">
                                  <input
                                    type="checkbox"
                                    checked={editSections.includes(s)}
                                    onChange={() => setEditSections(prev => toggle(prev, s))}
                                  />
                                  {SECTION_LABEL[s]}
                                </label>
                              ))}
                            </div>
                          </div>
                        )}
                        <div className="md:col-span-4 flex gap-3">
```

- [ ] **Step 8: Verify build**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 9: Commit**

```bash
git add app/admin/users/UsersClient.tsx
git commit -m "feat(admin): section-access checkboxes in user add/edit forms

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: AdminNav — show only accessible tabs

**Files:**
- Modify: `app/admin/AdminNav.tsx`
- Modify: `app/admin/layout.tsx` (only if a type mismatch surfaces — see Step 4)

- [ ] **Step 1: Update imports, `NavSession`, and tag each link with its section**

Find:

```tsx
import { AdminRole } from '@/types'
import LogoutButton from './LogoutButton'

type NavSession = { name: string; role: AdminRole } | null

const NAV_LINKS = [
  {
    href: '/admin/dashboard',
    label: 'Dashboard',
    active: (p: string) => p === '/admin/dashboard',
  },
  {
    href: '/admin/leads',
    label: 'Leads',
    active: (p: string) => p.startsWith('/admin/leads'),
  },
  {
    href: '/admin',
    label: 'Properties',
    active: (p: string) => p === '/admin' || p.startsWith('/admin/property'),
  },
]
```

Replace with:

```tsx
import { AdminRole, AdminSection } from '@/types'
import { canAccess } from '@/lib/permissions'
import LogoutButton from './LogoutButton'

type NavSession = { name: string; role: AdminRole; sections?: AdminSection[] } | null

const NAV_LINKS: {
  href: string
  label: string
  section: AdminSection
  active: (p: string) => boolean
}[] = [
  {
    href: '/admin/dashboard',
    label: 'Dashboard',
    section: 'dashboard',
    active: (p: string) => p === '/admin/dashboard',
  },
  {
    href: '/admin/leads',
    label: 'Leads',
    section: 'leads',
    active: (p: string) => p.startsWith('/admin/leads'),
  },
  {
    href: '/admin',
    label: 'Properties',
    section: 'properties',
    active: (p: string) => p === '/admin' || p.startsWith('/admin/property'),
  },
]
```

- [ ] **Step 2: Compute the visible links once inside the component**

Find:

```tsx
export default function AdminNav({ session }: { session: NavSession }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
```

Replace with:

```tsx
export default function AdminNav({ session }: { session: NavSession }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  const visibleLinks = session
    ? NAV_LINKS.filter(link => canAccess(session, link.section))
    : []
```

- [ ] **Step 3: Render `visibleLinks` instead of `NAV_LINKS` in both navs**

There are two `{NAV_LINKS.map(link => (` occurrences (desktop nav and mobile dropdown). Change **both** to `{visibleLinks.map(link => (`. Leave the inner JSX of each map unchanged. The owner-only Users link blocks are unchanged.

- [ ] **Step 4: Verify layout passes the right shape**

`app/admin/layout.tsx` passes the full `getSession()` result (now `Session`, which has `name`, `role`, and `sections`) to `<AdminNav session={session} />`. `Session` is assignable to `NavSession`. Run the build to confirm; only edit `layout.tsx` if TypeScript complains.

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 5: Commit**

```bash
git add app/admin/AdminNav.tsx
git commit -m "feat(admin): hide nav tabs the manager can't access

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Server-page guards + no-access terminal

**Files:**
- Modify: `app/admin/page.tsx` (Properties — also the no-access terminal)
- Modify: `app/admin/dashboard/page.tsx`
- Modify: `app/admin/leads/page.tsx`
- Modify: `app/admin/property/new/page.tsx`
- Modify: `app/admin/property/[id]/page.tsx`

- [ ] **Step 1: Guard the Properties page and add the no-access message**

In `app/admin/page.tsx`, find:

```tsx
import Link from 'next/link'
import { getProperties } from '@/lib/properties'
import { getLeads } from '@/lib/leads'
import AdminPropertyActions from './AdminPropertyActions'

export const dynamic = 'force-dynamic'
```

Replace with:

```tsx
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getProperties } from '@/lib/properties'
import { getLeads } from '@/lib/leads'
import { getSession } from '@/lib/auth'
import { canAccess, landingPath } from '@/lib/permissions'
import AdminPropertyActions from './AdminPropertyActions'

export const dynamic = 'force-dynamic'
```

Then find:

```tsx
export default function AdminPage() {
  const properties = getProperties()
  const leads = getLeads()
```

Replace with:

```tsx
export default async function AdminPage() {
  const session = await getSession()
  if (!session) redirect('/admin/login')
  if (!canAccess(session, 'properties')) {
    const dest = landingPath(session)
    if (dest) redirect(dest)
    return (
      <div className="max-w-7xl mx-auto px-8 py-20 text-center">
        <h1 className="font-serif text-2xl text-navy mb-2">No section access</h1>
        <p className="text-gray-500 text-sm">
          Your account has no sections enabled. Please contact the owner.
        </p>
      </div>
    )
  }

  const properties = getProperties()
  const leads = getLeads()
```

- [ ] **Step 2: Guard the Dashboard page**

In `app/admin/dashboard/page.tsx`, find the import block at the top:

```tsx
import { getLeads, leadStats } from '@/lib/leads'
import { Lead, LeadStatus } from '@/types'
import Link from 'next/link'
```

Replace with:

```tsx
import { getLeads, leadStats } from '@/lib/leads'
import { Lead, LeadStatus } from '@/types'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { canAccess, landingPath } from '@/lib/permissions'
```

Then find:

```tsx
export default function DashboardPage() {
```

Replace with:

```tsx
export default async function DashboardPage() {
  const session = await getSession()
  if (!session) redirect('/admin/login')
  if (!canAccess(session, 'dashboard')) redirect(landingPath(session) ?? '/admin')
```

Note: the rest of the function body stays exactly the same; only the signature and the three guard lines are added immediately after the `{`.

- [ ] **Step 3: Guard the Leads page**

In `app/admin/leads/page.tsx`, find:

```tsx
import { getLeads, leadStats } from '@/lib/leads'
import { getSession } from '@/lib/auth'
import LeadsClient from './LeadsClient'

export const dynamic = 'force-dynamic'

export default async function LeadsPage() {
  const session = await getSession()
  const leads = getLeads()
```

Replace with:

```tsx
import { getLeads, leadStats } from '@/lib/leads'
import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { canAccess, landingPath } from '@/lib/permissions'
import LeadsClient from './LeadsClient'

export const dynamic = 'force-dynamic'

export default async function LeadsPage() {
  const session = await getSession()
  if (!session) redirect('/admin/login')
  if (!canAccess(session, 'leads')) redirect(landingPath(session) ?? '/admin')
  const leads = getLeads()
```

- [ ] **Step 4: Guard the New Property page**

Replace the entire contents of `app/admin/property/new/page.tsx` with:

```tsx
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { canAccess, landingPath } from '@/lib/permissions'
import PropertyForm from '../PropertyForm'

export const dynamic = 'force-dynamic'

export default async function NewPropertyPage() {
  const session = await getSession()
  if (!session) redirect('/admin/login')
  if (!canAccess(session, 'properties')) redirect(landingPath(session) ?? '/admin')

  return (
    <div className="max-w-3xl mx-auto px-8 py-10">
      <PropertyForm />
    </div>
  )
}
```

- [ ] **Step 5: Guard the Edit Property page**

Replace the entire contents of `app/admin/property/[id]/page.tsx` with:

```tsx
import { getPropertyById } from '@/lib/properties'
import { notFound, redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { canAccess, landingPath } from '@/lib/permissions'
import PropertyForm from '../PropertyForm'

export const dynamic = 'force-dynamic'

export default async function EditPropertyPage({ params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) redirect('/admin/login')
  if (!canAccess(session, 'properties')) redirect(landingPath(session) ?? '/admin')

  const property = getPropertyById(params.id)
  if (!property) notFound()

  return (
    <div className="max-w-3xl mx-auto px-8 py-10">
      <PropertyForm property={property} />
    </div>
  )
}
```

- [ ] **Step 6: Verify build**

Run: `npm run build`
Expected: succeeds. (All five pages are now `async`; that's valid for App Router server components.)

- [ ] **Step 7: Commit**

```bash
git add app/admin/page.tsx app/admin/dashboard/page.tsx app/admin/leads/page.tsx "app/admin/property/new/page.tsx" "app/admin/property/[id]/page.tsx"
git commit -m "feat(admin): redirect managers away from sections they lack

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: API guards — enforce section on data routes

**Files:**
- Modify: `app/api/leads/route.ts` (GET)
- Modify: `app/api/leads/[id]/route.ts` (PUT, DELETE, GET)
- Modify: `app/api/properties/route.ts` (POST only — GET stays public)
- Modify: `app/api/properties/[id]/route.ts` (PUT, DELETE)
- Modify: `app/api/upload/route.ts` (POST)

The pattern: replace `if (!(await isAuthenticated()))` with a `requireSection` check. Keep `getSession()`-based handlers (leads PUT/DELETE) as-is for the session but add a section gate.

- [ ] **Step 1: Leads list (GET) — require `leads`**

In `app/api/leads/route.ts`, find:

```ts
import { isAuthenticated } from '@/lib/auth'
```

Replace with:

```ts
import { isAuthenticated, requireSection } from '@/lib/auth'
```

Then find the GET handler:

```ts
export async function GET() {
  if (!(await isAuthenticated())) {
```

Replace with:

```ts
export async function GET() {
  if (!(await requireSection('leads'))) {
```

(Leave the `POST` handler — public lead capture — untouched. If `isAuthenticated` becomes unused after this edit, remove it from the import; the build will flag an unused import only as a lint warning, not an error, but prefer removing it. POST does not use it, so the import of `isAuthenticated` is now unused — change the import to just `import { requireSection } from '@/lib/auth'`.)

- [ ] **Step 2: Leads item (PUT/DELETE/GET) — require `leads`**

In `app/api/leads/[id]/route.ts`, find:

```ts
import { getSession, isAuthenticated } from '@/lib/auth'
```

Replace with:

```ts
import { requireSection } from '@/lib/auth'
```

(Both `getSession` and `isAuthenticated` become unused once the handlers below switch to `requireSection`, so the import drops to just `requireSection`. `requireSection('leads')` returns the full `Session` — including `uid`/`username`/`name` — so the activity-log actor in `PUT` keeps working.)

In the `PUT` handler, find:

```ts
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
```

Replace with:

```ts
  const session = await requireSection('leads')
  if (!session) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
```

In the `DELETE` handler, find the same `getSession()` + `if (!session)` block (it reads `const session = await getSession()` then returns 401) and replace it identically with the `requireSection('leads')` version returning 403.

In the `GET` handler, find:

```ts
  if (!(await isAuthenticated())) {
```

Replace with:

```ts
  if (!(await requireSection('leads'))) {
```

- [ ] **Step 3: Properties create (POST) — require `properties`; GET stays public**

In `app/api/properties/route.ts`, find:

```ts
import { isAuthenticated } from '@/lib/auth'
```

Replace with:

```ts
import { requireSection } from '@/lib/auth'
```

Then find the POST guard:

```ts
export async function POST(req: NextRequest) {
  if (!(await isAuthenticated())) {
```

Replace with:

```ts
export async function POST(req: NextRequest) {
  if (!(await requireSection('properties'))) {
```

Leave `GET` exactly as-is (it does not check auth — the public site uses it).

- [ ] **Step 4: Properties item (PUT/DELETE) — require `properties`**

In `app/api/properties/[id]/route.ts`, find:

```ts
import { isAuthenticated } from '@/lib/auth'
```

Replace with:

```ts
import { requireSection } from '@/lib/auth'
```

Then replace **both** occurrences of:

```ts
  if (!(await isAuthenticated())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
```

with:

```ts
  if (!(await requireSection('properties'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
```

(Leave `GET` as-is.)

- [ ] **Step 5: Upload (POST) — require `properties`**

In `app/api/upload/route.ts`, find:

```ts
import { isAuthenticated } from '@/lib/auth'
```

Replace with:

```ts
import { requireSection } from '@/lib/auth'
```

Then find:

```ts
export async function POST(req: NextRequest) {
  if (!(await isAuthenticated())) {
```

Replace with:

```ts
export async function POST(req: NextRequest) {
  if (!(await requireSection('properties'))) {
```

- [ ] **Step 6: Verify build**

Run: `npm run build`
Expected: succeeds with no unused-import errors. If the build fails on an unused `isAuthenticated`/`getSession` import, remove that name from the offending import statement.

- [ ] **Step 7: Commit**

```bash
git add app/api/leads/route.ts "app/api/leads/[id]/route.ts" app/api/properties/route.ts "app/api/properties/[id]/route.ts" app/api/upload/route.ts
git commit -m "feat(admin): enforce section access on leads/properties/upload APIs

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Login redirect to the user's landing section

**Files:**
- Modify: `app/api/auth/login/route.ts`
- Modify: `app/admin/login/page.tsx`

- [ ] **Step 1: Return the landing path from the login API**

In `app/api/auth/login/route.ts`, find:

```ts
import { SESSION_COOKIE, createSessionToken } from '@/lib/session'
import { verifyPassword, createUser, getUsers, updateUser } from '@/lib/users'
import { getClientIp } from '@/lib/ip'
```

Replace with:

```ts
import { SESSION_COOKIE, createSessionToken } from '@/lib/session'
import { verifyPassword, createUser, getUsers, updateUser } from '@/lib/users'
import { getClientIp } from '@/lib/ip'
import { landingPath } from '@/lib/permissions'
```

Then find:

```ts
  const res = NextResponse.json({ success: true, name: user.name, role: user.role })
```

Replace with:

```ts
  const redirectTo = landingPath(user) ?? '/admin'
  const res = NextResponse.json({ success: true, name: user.name, role: user.role, redirect: redirectTo })
```

(`landingPath` accepts `{ role, sections? }`; `user` is an `AdminUser` with both, so a legacy user with no `sections` lands on `/admin`.)

- [ ] **Step 2: Use the returned path in the login page**

In `app/admin/login/page.tsx`, find:

```tsx
    if (res.ok) {
      router.push('/admin')
    } else {
      setError('Invalid username or password.')
    }
```

Replace with:

```tsx
    if (res.ok) {
      const data = await res.json()
      router.push(data.redirect ?? '/admin')
    } else {
      setError('Invalid username or password.')
    }
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 4: Commit**

```bash
git add app/api/auth/login/route.ts app/admin/login/page.tsx
git commit -m "feat(admin): send each user to their first accessible section after login

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: End-to-end manual verification

No code changes — this task proves the feature works against a running dev server. **Do not** touch `data/` files on the server; this is local only. The local `data/users.json` does not exist locally per repo rules, so create a throwaway local one only if needed for testing and delete it after, OR run the checks on a safe local copy. If no local users exist, the first login with `ADMIN_PASSWORD` bootstraps an owner.

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`
Expected: server on http://localhost:3000.

- [ ] **Step 2: As owner, create a Properties-only manager**

Log in as owner → `/admin/users` → Add User, role Manager, check **Properties** only. Save.
Expected: user row created; the stored `sections` is `['properties']`.

- [ ] **Step 3: Log in as that manager — verify nav**

Expected: only the **Properties** tab is visible (no Dashboard, no Leads, no Users). Landing page is `/admin` (Properties).

- [ ] **Step 4: Verify page guards**

Visit `/admin/leads` and `/admin/dashboard` directly in the URL bar.
Expected: both redirect to `/admin`.

- [ ] **Step 5: Verify API guards**

In the browser devtools console while logged in as the manager:

```js
await fetch('/api/leads').then(r => r.status)   // expect 403
```

Expected: `403`. Then confirm a property action still works (the Properties page loads its list).

- [ ] **Step 6: Grant Leads, re-verify**

As owner, edit the manager → check **Leads** too → Save. Log back in as the manager.
Expected: Leads tab now visible; `/admin/leads` loads; `await fetch('/api/leads').then(r=>r.status)` returns `200`.

- [ ] **Step 7: Legacy manager keeps full access**

If a pre-existing manager (no `sections` field) is available, log in as them.
Expected: all tabs (Dashboard, Leads, Properties) visible — no regression.

- [ ] **Step 8: Owner unaffected**

Log in as owner.
Expected: all tabs incl. Users; section checkboxes hidden for the owner role in forms.

- [ ] **Step 9: Update lessons if any correction occurred**

If anything needed rework during verification, add the pattern to `tasks/lessons.md`.

---

## Deployment note (after all tasks pass)

Per CLAUDE.md: back up server `data/` before deploy, then rsync (excluding `data/`) and rebuild. No data migration script is needed — `effectiveSections()` handles legacy users with no `sections` field at runtime. Existing managers keep full access until the owner edits them.
