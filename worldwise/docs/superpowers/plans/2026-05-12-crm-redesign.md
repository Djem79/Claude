# CRM Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `/admin/dashboard` CRM landing page, Kanban toggle on `/admin/leads`, and mobile burger nav — all using the brand navy (`#0D1B2A`) / gold (`#C9A84C`) palette.

**Architecture:** Extract the duplicated admin nav into a single `AdminNav` client component with `usePathname()` for active-link highlighting and mobile burger menu. A new `app/admin/layout.tsx` server component renders `AdminNav` + `{children}`, replacing the per-page `<header>` blocks. Dashboard and Kanban are then added as leaf-level changes.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS (custom `navy`/`gold` palette), `usePathname` from `next/navigation`.

---

## File map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `app/admin/AdminNav.tsx` | Client nav: active link, mobile burger, logout |
| Create | `app/admin/layout.tsx` | Server layout: wraps all admin pages with AdminNav |
| Create | `app/admin/dashboard/page.tsx` | Dashboard: stat cards, bar chart, funnel, recent leads |
| Modify | `app/admin/page.tsx` | Remove `<header>` + outer div |
| Modify | `app/admin/leads/page.tsx` | Remove `<header>` + outer div |
| Modify | `app/admin/users/page.tsx` | Remove `<header>` + outer div |
| Modify | `app/admin/property/[id]/page.tsx` | Remove `<header>` + outer div |
| Modify | `app/admin/property/new/page.tsx` | Remove `<header>` + outer div |
| Modify | `app/admin/leads/LeadsClient.tsx` | Add view toggle, Kanban board, mobile column selector |

---

## Setup

All `npm` commands run from `worldwise/`. If npm is not found:

```bash
export PATH="/Users/dzhambulat/.nvm/versions/node/v24.15.0/bin:$PATH"
```

---

## Task 1: AdminNav client component

**Files:**
- Create: `worldwise/app/admin/AdminNav.tsx`

- [ ] **Step 1: Create AdminNav.tsx**

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import LogoutButton from './LogoutButton'

type NavSession = { name: string; role: string } | null

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

export default function AdminNav({ session }: { session: NavSession }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  if (pathname === '/admin/login') return null

  return (
    <header className="bg-navy text-white px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6">
          <span className="font-serif text-xl tracking-widest">WORLDWISE</span>
          <span className="text-white/40 text-sm hidden sm:inline">Admin Panel</span>
          {/* Desktop nav */}
          <nav className="hidden md:flex gap-5 text-sm">
            {NAV_LINKS.map(link => (
              <Link
                key={link.href}
                href={link.href}
                className={
                  link.active(pathname)
                    ? 'text-gold border-b-2 border-gold pb-0.5 font-medium'
                    : 'text-white/60 hover:text-white'
                }
              >
                {link.label}
              </Link>
            ))}
            {session?.role === 'owner' && (
              <Link
                href="/admin/users"
                className={
                  pathname.startsWith('/admin/users')
                    ? 'text-gold border-b-2 border-gold pb-0.5 font-medium'
                    : 'text-white/60 hover:text-white'
                }
              >
                Users
              </Link>
            )}
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <span className="hidden md:inline text-white/50 text-sm">{session?.name}</span>
          <Link
            href="/"
            target="_blank"
            className="hidden md:inline text-white/60 hover:text-white text-sm"
          >
            View Site ↗
          </Link>
          <div className="hidden md:block">
            <LogoutButton />
          </div>
          {/* Burger */}
          <button
            className="md:hidden flex flex-col justify-center gap-1.5 p-1"
            onClick={() => setOpen(o => !o)}
            aria-label="Toggle menu"
          >
            {open ? (
              <span className="text-white/80 text-xl leading-none">✕</span>
            ) : (
              <>
                <span className="block w-5 h-0.5 bg-white/80 rounded" />
                <span className="block w-5 h-0.5 bg-white/80 rounded" />
                <span className="block w-5 h-0.5 bg-white/80 rounded" />
              </>
            )}
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {open && (
        <nav className="md:hidden border-t border-white/10 mt-3 pt-2 flex flex-col">
          {NAV_LINKS.map(link => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className={`py-2.5 px-1 text-sm ${
                link.active(pathname)
                  ? 'border-l-2 border-gold pl-3 text-gold font-medium'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              {link.label}
            </Link>
          ))}
          {session?.role === 'owner' && (
            <Link
              href="/admin/users"
              onClick={() => setOpen(false)}
              className={`py-2.5 px-1 text-sm ${
                pathname.startsWith('/admin/users')
                  ? 'border-l-2 border-gold pl-3 text-gold font-medium'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              Users
            </Link>
          )}
          <div className="pt-3 mt-2 border-t border-white/10 flex items-center justify-between">
            <span className="text-white/50 text-sm">{session?.name}</span>
            <div className="flex items-center gap-3">
              <Link
                href="/"
                target="_blank"
                className="text-white/60 hover:text-white text-sm"
              >
                View Site ↗
              </Link>
              <LogoutButton />
            </div>
          </div>
        </nav>
      )}
    </header>
  )
}
```

- [ ] **Step 2: Verify the file compiles**

```bash
cd worldwise && npm run build 2>&1 | tail -20
```

Expected: build succeeds (AdminNav is not yet imported anywhere, so no regressions).

- [ ] **Step 3: Commit**

```bash
git add worldwise/app/admin/AdminNav.tsx
git commit -m "feat: add AdminNav client component with active-link and mobile burger"
```

---

## Task 2: Admin shared layout

**Files:**
- Create: `worldwise/app/admin/layout.tsx`

- [ ] **Step 1: Create layout.tsx**

```tsx
import { getSession } from '@/lib/auth'
import AdminNav from './AdminNav'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSession()
  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav session={session} />
      {children}
    </div>
  )
}
```

- [ ] **Step 2: Run build to confirm layout does not break anything**

```bash
cd worldwise && npm run build 2>&1 | tail -20
```

Expected: build succeeds. The layout now wraps all `/admin/*` pages. Each page still renders its own `<div className="min-h-screen bg-gray-50"><header>...</header>...</div>` inside the layout — this double-wrapping looks wrong visually but does not break the build. We fix it in Task 3.

- [ ] **Step 3: Commit**

```bash
git add worldwise/app/admin/layout.tsx
git commit -m "feat: add admin shared layout with AdminNav"
```

---

## Task 3: Strip headers from existing admin pages

**Files:**
- Modify: `worldwise/app/admin/page.tsx`
- Modify: `worldwise/app/admin/leads/page.tsx`
- Modify: `worldwise/app/admin/users/page.tsx`
- Modify: `worldwise/app/admin/property/[id]/page.tsx`
- Modify: `worldwise/app/admin/property/new/page.tsx`

Each page has an outer `<div className="min-h-screen bg-gray-50">` wrapper and a `<header>` block to remove. The layout now provides both. The inner content div stays untouched.

- [ ] **Step 1: Strip `app/admin/page.tsx`**

Replace the entire file content with:

```tsx
import Link from 'next/link'
import { getProperties } from '@/lib/properties'
import { getLeads } from '@/lib/leads'
import AdminPropertyActions from './AdminPropertyActions'

export const dynamic = 'force-dynamic'

function formatPrice(aed: number) {
  return aed >= 1_000_000
    ? `AED ${(aed / 1_000_000).toFixed(2)}M`
    : `AED ${(aed / 1000).toFixed(0)}K`
}

export default function AdminPage() {
  const properties = getProperties()
  const leads = getLeads()

  const stats = [
    { label: 'Total Properties', value: properties.length },
    { label: 'Featured', value: properties.filter(p => p.featured).length },
    { label: 'Total Leads', value: leads.length },
    {
      label: 'New Leads (7d)',
      value: leads.filter(
        l => Date.now() - new Date(l.createdAt).getTime() < 7 * 86400_000
      ).length,
    },
  ]

  return (
    <div className="max-w-7xl mx-auto px-8 py-10 space-y-12">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map(s => (
          <div
            key={s.label}
            className="bg-white rounded-sm p-5 shadow-sm border border-gray-100"
          >
            <p className="text-gray-400 text-xs font-medium uppercase tracking-wide">
              {s.label}
            </p>
            <p className="font-serif text-3xl text-navy mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-serif text-2xl text-navy">Properties</h2>
          <Link href="/admin/property/new" className="btn-primary text-sm px-4 py-2">
            + Add Property
          </Link>
        </div>

        <div className="bg-white rounded-sm shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Title', 'Price', 'Type', 'Status', 'Actions'].map(h => (
                    <th
                      key={h}
                      className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {properties.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-navy">{p.title}</td>
                    <td className="px-4 py-3 font-medium text-navy">
                      {formatPrice(p.priceAed)}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{p.type}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`badge text-xs ${
                          p.status === 'off-plan'
                            ? 'bg-blue-50 text-blue-700'
                            : p.status === 'ready'
                            ? 'bg-green-50 text-green-700'
                            : p.status === 'rent'
                            ? 'bg-purple-50 text-purple-700'
                            : 'bg-amber-50 text-amber-700'
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-3 items-center">
                        <Link
                          href={`/admin/property/${p.id}`}
                          className="text-xs text-navy hover:underline"
                        >
                          Edit
                        </Link>
                        <Link
                          href={`/properties/${p.slug}`}
                          target="_blank"
                          className="text-gray-400 hover:text-navy text-xs"
                        >
                          View ↗
                        </Link>
                        <AdminPropertyActions propertyId={p.id} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Strip `app/admin/leads/page.tsx`**

Replace entire file content with:

```tsx
import { getLeads, leadStats } from '@/lib/leads'
import { getSession } from '@/lib/auth'
import LeadsClient from './LeadsClient'

export const dynamic = 'force-dynamic'

export default async function LeadsPage() {
  const session = await getSession()
  const leads = getLeads()
  const stats = leadStats(leads)

  const cards = [
    { label: 'Total Leads', value: stats.total },
    { label: 'New (24h)', value: stats.new24h },
    { label: 'New (7 days)', value: stats.new7d },
    { label: 'In Progress', value: stats.byStatus['in-progress'] + stats.byStatus.contacted },
    { label: 'Won', value: stats.byStatus.won },
  ]

  return (
    <div className="max-w-7xl mx-auto px-8 py-10 space-y-8">
      <div>
        <h1 className="font-serif text-3xl text-navy mb-1">Leads CRM</h1>
        <p className="text-gray-500 text-sm">Track and manage all enquiries from the website.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {cards.map(c => (
          <div key={c.label} className="bg-white rounded-sm p-5 shadow-sm border border-gray-100">
            <p className="text-gray-400 text-xs font-medium uppercase tracking-wide">{c.label}</p>
            <p className="font-serif text-3xl text-navy mt-1">{c.value}</p>
          </div>
        ))}
      </div>

      <LeadsClient initialLeads={leads} isOwner={session?.role === 'owner'} />
    </div>
  )
}
```

- [ ] **Step 3: Strip `app/admin/users/page.tsx`**

Replace entire file content with:

```tsx
import { getSession } from '@/lib/auth'
import { getUsers } from '@/lib/users'
import { redirect } from 'next/navigation'
import UsersClient from './UsersClient'
import { AdminUser } from '@/types'

export const dynamic = 'force-dynamic'

type SafeUser = Omit<AdminUser, 'passwordHash'>

function safeUser(u: AdminUser): SafeUser {
  const { passwordHash, ...rest } = u
  return rest
}

export default async function UsersPage() {
  const session = await getSession()
  if (!session || session.role !== 'owner') redirect('/admin')

  const users = getUsers().map(safeUser)

  return (
    <div className="max-w-5xl mx-auto px-8 py-10">
      <UsersClient initialUsers={users} currentUsername={session.username} />
    </div>
  )
}
```

- [ ] **Step 4: Strip `app/admin/property/[id]/page.tsx`**

Replace entire file content with:

```tsx
import { getPropertyById } from '@/lib/properties'
import { notFound } from 'next/navigation'
import PropertyForm from '../PropertyForm'

export const dynamic = 'force-dynamic'

export default function EditPropertyPage({ params }: { params: { id: string } }) {
  const property = getPropertyById(params.id)
  if (!property) notFound()

  return (
    <div className="max-w-3xl mx-auto px-8 py-10">
      <PropertyForm property={property} />
    </div>
  )
}
```

- [ ] **Step 5: Strip `app/admin/property/new/page.tsx`**

Replace entire file content with:

```tsx
import PropertyForm from '../PropertyForm'

export default function NewPropertyPage() {
  return (
    <div className="max-w-3xl mx-auto px-8 py-10">
      <PropertyForm />
    </div>
  )
}
```

- [ ] **Step 6: Build and confirm**

```bash
cd worldwise && npm run build 2>&1 | tail -30
```

Expected: build succeeds with no TypeScript errors. All five pages now use the layout's `AdminNav` and `bg-gray-50` wrapper.

- [ ] **Step 7: Commit**

```bash
git add worldwise/app/admin/page.tsx \
        worldwise/app/admin/leads/page.tsx \
        worldwise/app/admin/users/page.tsx \
        "worldwise/app/admin/property/[id]/page.tsx" \
        worldwise/app/admin/property/new/page.tsx
git commit -m "refactor: extract admin nav to shared layout, strip per-page headers"
```

---

## Task 4: Dashboard page

**Files:**
- Create: `worldwise/app/admin/dashboard/page.tsx`

- [ ] **Step 1: Create dashboard page**

```tsx
import { getLeads, leadStats } from '@/lib/leads'
import { Lead, LeadStatus } from '@/types'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

const STATUS_BADGE: Record<LeadStatus, string> = {
  new: 'bg-blue-50 text-blue-700',
  contacted: 'bg-amber-50 text-amber-700',
  'in-progress': 'bg-purple-50 text-purple-700',
  won: 'bg-green-50 text-green-700',
  lost: 'bg-red-100 text-red-700',
}

const STATUS_LABEL: Record<LeadStatus, string> = {
  new: 'New',
  contacted: 'Contacted',
  'in-progress': 'In Progress',
  won: 'Won',
  lost: 'Lost',
}

const FUNNEL: { status: LeadStatus; fill: string }[] = [
  { status: 'new', fill: 'bg-navy' },
  { status: 'contacted', fill: 'bg-navy opacity-75' },
  { status: 'in-progress', fill: 'bg-navy opacity-60' },
  { status: 'won', fill: 'bg-gold' },
  { status: 'lost', fill: 'bg-gray-300' },
]

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function buildChartData(leads: Lead[]): { date: string; count: number }[] {
  const buckets: Record<string, number> = {}
  const now = new Date()
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    buckets[d.toISOString().slice(0, 10)] = 0
  }
  for (const l of leads) {
    const key = l.createdAt.slice(0, 10)
    if (key in buckets) buckets[key]++
  }
  return Object.entries(buckets).map(([date, count]) => ({ date, count }))
}

export default async function DashboardPage() {
  const leads = getLeads()
  const stats = leadStats(leads)
  const chartData = buildChartData(leads)
  const maxCount = Math.max(...chartData.map(d => d.count), 1)
  const today = new Date().toISOString().slice(0, 10)
  const convPct = stats.total > 0 ? Math.round((stats.byStatus.won / stats.total) * 100) : 0

  const recentLeads = [...leads]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5)

  const statCards = [
    { label: 'Total Leads', value: stats.total, valCls: 'text-navy', cardCls: 'bg-white border-gray-100', labelCls: 'text-gray-400' },
    { label: 'New (24h)', value: stats.new24h, valCls: 'text-navy', cardCls: 'bg-white border-gray-100', labelCls: 'text-gray-400' },
    { label: 'In Progress', value: stats.byStatus['in-progress'], valCls: 'text-navy', cardCls: 'bg-white border-gray-100', labelCls: 'text-gray-400' },
    { label: 'Won', value: stats.byStatus.won, valCls: 'text-gold', cardCls: 'bg-white border-gray-100', labelCls: 'text-gray-400' },
    { label: 'Conversion', value: `${convPct}%`, valCls: 'text-gold', cardCls: 'bg-navy border-navy', labelCls: 'text-white/60' },
  ]

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      <div>
        <h1 className="font-serif text-3xl text-navy">Dashboard</h1>
        <p className="text-gray-400 text-sm mt-1">
          {new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {statCards.map(c => (
          <div key={c.label} className={`${c.cardCls} border rounded-sm p-4`}>
            <p className={`text-xs font-semibold uppercase tracking-wide ${c.labelCls}`}>
              {c.label}
            </p>
            <p className={`font-serif text-3xl mt-1 ${c.valCls}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Chart + Funnel */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Bar chart */}
        <div className="bg-white border border-gray-100 rounded-sm p-4">
          <p className="font-serif text-navy text-sm font-semibold mb-3">
            Lead Acquisition · Last 30 days
          </p>
          <div className="flex items-end gap-0.5 h-24">
            {chartData.map(d => (
              <div
                key={d.date}
                className={`flex-1 rounded-t-sm ${d.date === today ? 'bg-gold' : 'bg-navy/15'}`}
                style={{ height: `${Math.max(4, (d.count / maxCount) * 100)}%` }}
              />
            ))}
          </div>
          <div className="flex justify-between mt-2">
            <span className="text-gray-400 text-xs">
              {chartData[0]?.date.slice(5).replace('-', ' ')}
            </span>
            <span className="text-gray-400 text-xs">Today</span>
          </div>
        </div>

        {/* Funnel */}
        <div className="bg-white border border-gray-100 rounded-sm p-4">
          <p className="font-serif text-navy text-sm font-semibold mb-3">Lead Funnel</p>
          <div className="space-y-3">
            {FUNNEL.map(row => {
              const count = stats.byStatus[row.status]
              const pct = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0
              return (
                <div key={row.status} className="flex items-center gap-3">
                  <span className="text-slate-600 text-xs w-[72px] shrink-0">
                    {STATUS_LABEL[row.status]}
                  </span>
                  <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`${row.fill} h-full rounded-full`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-gray-400 text-xs w-4 text-right">{count}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Recent leads */}
      <div className="bg-white border border-gray-100 rounded-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="font-serif text-navy text-sm font-semibold">Recent Leads</p>
          <Link href="/admin/leads" className="text-gold text-xs hover:underline">
            View all →
          </Link>
        </div>
        <table className="w-full text-sm">
          <tbody className="divide-y divide-gray-50">
            {recentLeads.length === 0 && (
              <tr>
                <td colSpan={4} className="py-6 text-center text-gray-400 text-sm">
                  No leads yet.
                </td>
              </tr>
            )}
            {recentLeads.map(l => {
              const status = (l.status ?? 'new') as LeadStatus
              return (
                <tr key={l.id}>
                  <td className="py-2 font-medium text-navy text-sm">{l.name}</td>
                  <td className="py-2 text-gray-500 text-xs">{l.phone}</td>
                  <td className="py-2">
                    <span className={`badge text-xs ${STATUS_BADGE[status]}`}>
                      {STATUS_LABEL[status]}
                    </span>
                  </td>
                  <td className="py-2 text-gray-400 text-xs text-right">
                    {timeAgo(l.createdAt)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Build and confirm**

```bash
cd worldwise && npm run build 2>&1 | tail -30
```

Expected: build succeeds. `/admin/dashboard` route is now available.

- [ ] **Step 3: Commit**

```bash
git add worldwise/app/admin/dashboard/page.tsx
git commit -m "feat: add /admin/dashboard with stat cards, bar chart, funnel, recent leads"
```

---

## Task 5: Kanban toggle + board in LeadsClient

**Files:**
- Modify: `worldwise/app/admin/leads/LeadsClient.tsx`

The changes:
1. Add two new constants: `CARD_BORDER` and `COLUMN_BADGE` for kanban styling.
2. Add `view` state (`'table' | 'kanban'`) and `mobileColumn` state (`LeadStatus`).
3. Add view-toggle UI above the filter bar.
4. Replace the table section with a conditional: table OR kanban board.
5. Kanban board: desktop 5-column grid + mobile pill-selector with single column.

Clicking a kanban card sets `view = 'table'` and `openId = lead.id` so the expanded detail panel appears in the table. This reuses all existing detail panel markup without any duplication.

- [ ] **Step 1: Add kanban style constants after the existing `KNOWN_SOURCES` array (line 47)**

Insert after line 47 (after the closing `]` of `KNOWN_SOURCES`):

```tsx
const CARD_BORDER: Record<LeadStatus, string> = {
  new: 'border-l-blue-400',
  contacted: 'border-l-amber-400',
  'in-progress': 'border-l-purple-400',
  won: 'border-l-gold',
  lost: 'border-l-gray-300',
}

const COLUMN_BADGE: Record<LeadStatus, string> = {
  new: 'bg-blue-50 text-blue-700',
  contacted: 'bg-amber-50 text-amber-800',
  'in-progress': 'bg-purple-50 text-purple-700',
  won: 'bg-amber-50 text-gold border border-gold/30',
  lost: 'bg-gray-100 text-gray-500',
}

const COLUMN_HEADER_COLOR: Record<LeadStatus, string> = {
  new: 'text-navy',
  contacted: 'text-navy',
  'in-progress': 'text-navy',
  won: 'text-gold',
  lost: 'text-gray-400',
}
```

- [ ] **Step 2: Add `view` and `mobileColumn` state inside `LeadsClient` component**

In `LeadsClient`, after the existing `const [savingId, setSavingId] = useState<string | null>(null)` line, add:

```tsx
const [view, setView] = useState<'table' | 'kanban'>('table')
const [mobileColumn, setMobileColumn] = useState<LeadStatus>('new')
```

- [ ] **Step 3: Add view-toggle UI**

The `LeadsClient` return currently starts with `<div className="space-y-6">`. Change it to add the toggle as the first child:

```tsx
return (
  <div className="space-y-6">
    {/* View toggle */}
    <div className="flex justify-end">
      <div className="flex border border-gray-200 rounded overflow-hidden">
        <button
          onClick={() => setView('table')}
          className={`px-4 py-2 text-sm ${
            view === 'table' ? 'bg-navy text-white' : 'bg-white text-gray-500 hover:bg-gray-50'
          }`}
        >
          ☰ Table
        </button>
        <button
          onClick={() => setView('kanban')}
          className={`px-4 py-2 text-sm ${
            view === 'kanban' ? 'bg-navy text-white' : 'bg-white text-gray-500 hover:bg-gray-50'
          }`}
        >
          ▦ Kanban
        </button>
      </div>
    </div>

    {/* Filters & search — keep exactly as-is */}
    ...
```

- [ ] **Step 4: Wrap the table section in `{view === 'table' && ...}` and add kanban section**

The current table section starts at `{/* Table */}` and ends with the closing `</div>` of the table wrapper. Wrap it:

```tsx
{/* Table view */}
{view === 'table' && (
  <div className="bg-white rounded-sm shadow-sm border border-gray-100 overflow-hidden">
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        {/* ... all existing table content unchanged ... */}
      </table>
    </div>
  </div>
)}

{/* Kanban view */}
{view === 'kanban' && (
  <>
    {/* Desktop: 5-column grid */}
    <div className="hidden md:grid grid-cols-5 gap-3">
      {STATUS_ORDER.map(status => {
        const columnLeads = filtered.filter(l => (l.status ?? 'new') === status)
        return (
          <div key={status}>
            {/* Column header */}
            <div className="flex items-center justify-between mb-2 px-0.5">
              <span className={`text-xs font-bold uppercase tracking-wider ${COLUMN_HEADER_COLOR[status]}`}>
                {STATUS_META[status].label}
              </span>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${COLUMN_BADGE[status]}`}>
                {columnLeads.length}
              </span>
            </div>
            {/* Cards */}
            {columnLeads.map(l => (
              <div
                key={l.id}
                onClick={() => { setView('table'); setOpenId(l.id) }}
                className={`border-l-[3px] ${CARD_BORDER[(l.status ?? 'new') as LeadStatus]} bg-white border border-gray-100 rounded-sm p-3 mb-2 cursor-pointer hover:shadow-sm transition-shadow`}
              >
                <p className="font-semibold text-navy text-sm leading-tight">{l.name}</p>
                <p className="text-gray-500 text-xs mt-0.5">{l.phone}</p>
                {l.email && <p className="text-gray-500 text-xs">{l.email}</p>}
                <span className="bg-green-50 text-green-800 text-[10px] px-1.5 py-0.5 rounded inline-block my-1">
                  {l.source}
                </span>
                {(l.propertyTitle || l.budget) && (
                  <div className="border-t border-gray-100 pt-1.5 mt-1 space-y-0.5">
                    {l.propertyTitle && (
                      <p className="text-gray-400 text-[10px]">{l.propertyTitle}</p>
                    )}
                    {l.budget && (
                      <p className="text-gray-400 text-[10px]">Budget: {l.budget}</p>
                    )}
                  </div>
                )}
                <div className="flex gap-1.5 mt-2" onClick={e => e.stopPropagation()}>
                  <a
                    href={`https://wa.me/${digitsOnly(l.phone)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-6 h-6 bg-[#25D366] rounded flex items-center justify-center text-white text-xs"
                  >
                    W
                  </a>
                  {l.email && (
                    <a
                      href={`mailto:${l.email}`}
                      className="w-6 h-6 bg-blue-500 rounded flex items-center justify-center text-white text-xs"
                    >
                      ✉
                    </a>
                  )}
                </div>
              </div>
            ))}
            {columnLeads.length === 0 && (
              <p className="text-gray-300 text-xs text-center py-4">—</p>
            )}
          </div>
        )
      })}
    </div>

    {/* Mobile: pill column selector + single column */}
    <div className="md:hidden">
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
        {STATUS_ORDER.map(status => {
          const count = filtered.filter(l => (l.status ?? 'new') === status).length
          return (
            <button
              key={status}
              onClick={() => setMobileColumn(status)}
              className={`shrink-0 text-xs px-3 py-1.5 rounded-full font-medium ${
                mobileColumn === status
                  ? 'bg-navy text-white'
                  : 'bg-white text-gray-500 border border-gray-200'
              }`}
            >
              {STATUS_META[status].label} {count}
            </button>
          )
        })}
      </div>
      <div>
        {filtered
          .filter(l => (l.status ?? 'new') === mobileColumn)
          .map(l => (
            <div
              key={l.id}
              onClick={() => { setView('table'); setOpenId(l.id) }}
              className={`border-l-[3px] ${CARD_BORDER[(l.status ?? 'new') as LeadStatus]} bg-white border border-gray-100 rounded-sm p-3 mb-2 cursor-pointer hover:shadow-sm transition-shadow`}
            >
              <p className="font-semibold text-navy text-sm">{l.name}</p>
              <p className="text-gray-500 text-xs mt-0.5">{l.phone}</p>
              {l.email && <p className="text-gray-500 text-xs">{l.email}</p>}
              <span className="bg-green-50 text-green-800 text-[10px] px-1.5 py-0.5 rounded inline-block my-1">
                {l.source}
              </span>
              {(l.propertyTitle || l.budget) && (
                <div className="border-t border-gray-100 pt-1.5 mt-1 space-y-0.5">
                  {l.propertyTitle && (
                    <p className="text-gray-400 text-[10px]">{l.propertyTitle}</p>
                  )}
                  {l.budget && (
                    <p className="text-gray-400 text-[10px]">Budget: {l.budget}</p>
                  )}
                </div>
              )}
              <div className="flex gap-1.5 mt-2" onClick={e => e.stopPropagation()}>
                <a
                  href={`https://wa.me/${digitsOnly(l.phone)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-6 h-6 bg-[#25D366] rounded flex items-center justify-center text-white text-xs"
                >
                  W
                </a>
                {l.email && (
                  <a
                    href={`mailto:${l.email}`}
                    className="w-6 h-6 bg-blue-500 rounded flex items-center justify-center text-white text-xs"
                  >
                    ✉
                  </a>
                )}
              </div>
            </div>
          ))}
        {filtered.filter(l => (l.status ?? 'new') === mobileColumn).length === 0 && (
          <p className="text-gray-400 text-sm text-center py-8">No leads in this column.</p>
        )}
      </div>
    </div>
  </>
)}
```

**Note on card status type:** `l.status` can be `undefined` (defaults to `'new'`). Cast using `(l.status ?? 'new') as LeadStatus` when indexing into maps.

- [ ] **Step 5: Also wrap table in `overflow-x-auto` for mobile scrolling**

The table wrapper already has `overflow-x-auto` (check `app/admin/leads/LeadsClient.tsx` line 312 — `<div className="overflow-x-auto">`). No change needed here.

- [ ] **Step 6: Build and confirm**

```bash
cd worldwise && npm run build 2>&1 | tail -30
```

Expected: build succeeds with no TypeScript errors.

- [ ] **Step 7: Commit**

```bash
git add worldwise/app/admin/leads/LeadsClient.tsx
git commit -m "feat: add kanban toggle with board view and mobile column selector to leads CRM"
```

---

## Final verification

- [ ] **Deploy to server and smoke-test**

```bash
# 1. Backup
ssh -i ~/.ssh/id_ed25519 root@62.238.35.20 \
  "cp -r /var/www/worldwise/data /var/www/worldwise/data_backup_$(date +%Y%m%d_%H%M%S)"

# 2. Sync
rsync -avz --exclude='.git' --exclude='node_modules' --exclude='.next' --exclude='data/' --exclude='public/files/' \
  -e "ssh -i ~/.ssh/id_ed25519" worldwise/ root@62.238.35.20:/var/www/worldwise/

# 3. Build and restart
ssh -i ~/.ssh/id_ed25519 root@62.238.35.20 \
  "cd /var/www/worldwise && npm install && npm run build && pm2 restart worldwise"
```

Check:
- `/admin/dashboard` — stat cards, chart, funnel, recent leads
- `/admin/leads` — toggle switches between Table and Kanban; kanban cards click through to table with expanded row
- Mobile (< 768px): burger nav opens/closes; kanban shows pill selector
