# Conversion Wave 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a developers directory, a data-driven Popular-Searches grid with a URL-filterable catalog, and thematic grouping of the homepage areas — to deepen internal linking and organic reach.

**Architecture:** One new pure, unit-tested module (`lib/developers.ts`) canonicalizes the messy free-text `developer` field (curated list + aliases, mirroring `lib/areas.ts`). New `/developers` index + `/developers/[slug]` detail mirror the existing area-page pattern. Popular Searches is computed server-side from real properties (so links always match real `area` strings) and deep-links into `/properties`, which reads initial filters from server `searchParams` (no `useSearchParams`, to keep static rendering). Area themes are added to `AreasSection`'s local array.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind, node:test (type-stripping) for pure helpers.

**Spec:** `docs/superpowers/specs/2026-06-04-conversion-wave-2-design.md`

**Path note:** Repo parent dir contains a non-breaking space. In every shell step resolve:
`GD="$(dirname "$(find /Users/dzhambulat/Documents -maxdepth 3 -name .git -type d 2>/dev/null | grep '/Claude/.git')")"; cd "$GD/worldwise"`
Read/Edit/Write tools hit a phantom tree — make edits via `python3`/heredoc against `"$GD/worldwise/..."`; confirm with `git -C "$GD" status --short`.
Run commands with: `export PATH="/Users/dzhambulat/.nvm/versions/node/v24.15.0/bin:$PATH"`.

**Read-time is already implemented (static + AI articles carry `readTime`, rendered in BlogPreview/blog/article) — NOT in this plan.**

---

## File Structure

- **Create** `lib/developers.ts` — canonical developer list + `propertyMatchesDeveloper`, `developerSlugs`, `getDeveloper`.
- **Create** `lib/developers.test.ts` — node:test.
- **Create** `app/developers/page.tsx` — developers index (server).
- **Create** `app/developers/[slug]/page.tsx` — developer detail (server, mirrors area page).
- **Create** `app/developers/[slug]/DeveloperPageClient.tsx` — client wrapper (LeadModal + MobileCtaBar).
- **Create** `components/PopularSearches.tsx` — data-driven area×type grid.
- **Modify** `app/properties/page.tsx` — read `searchParams`, pass initial filters.
- **Modify** `app/properties/PropertiesClient.tsx` — accept initial filter props.
- **Modify** `components/AreasSection.tsx` — group areas by theme.
- **Modify** `app/page.tsx` — mount `<PopularSearches>`.
- **Modify** `app/sitemap.ts` — add `/developers` + developer slugs.

---

## Task 1: Canonical developers module (TDD)

**Files:** Create `lib/developers.ts`, Test `lib/developers.test.ts`

- [ ] **Step 1: Write the failing test** — create `lib/developers.test.ts`:

```ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { developers, developerSlugs, getDeveloper, propertyMatchesDeveloper } from './developers.ts'

test('every developer has a unique slug and ships >=12 brands', () => {
  assert.equal(new Set(developerSlugs).size, developerSlugs.length)
  assert.ok(developers.length >= 12)
})

test('matches case/spacing variants via aliases', () => {
  const sobha = getDeveloper('sobha')!
  assert.ok(propertyMatchesDeveloper('SOBHA REALTY', sobha))
  assert.ok(propertyMatchesDeveloper('Sobha', sobha))
  assert.ok(propertyMatchesDeveloper('  sobha   group ', sobha))
})

test('MAG merges its four spelling variants', () => {
  const mag = getDeveloper('mag')!
  for (const v of ['MAG Properties', 'MAG Property', 'Mag Properties', 'Mag Lifestyle']) {
    assert.ok(propertyMatchesDeveloper(v, mag), v)
  }
})

test('does NOT match a different brand (no substring false-positive)', () => {
  assert.equal(propertyMatchesDeveloper('Prestige Harbour', getDeveloper('prestige-one')!), false)
})

test('empty developer never matches', () => {
  assert.equal(propertyMatchesDeveloper('', getDeveloper('emaar')!), false)
})
```

- [ ] **Step 2: Run test, verify it fails**

Run: `export PATH="/Users/dzhambulat/.nvm/versions/node/v24.15.0/bin:$PATH"; node --test --experimental-strip-types lib/developers.test.ts`
Expected: FAIL (cannot find module './developers.ts').

- [ ] **Step 3: Write the implementation** — create `lib/developers.ts`:

```ts
export interface Developer {
  slug: string
  name: string
  aliases?: string[]
  blurb: string
  logo?: string // path under /public, e.g. /images/developers/emaar.png
}

// Curated canonical developers with >=2 properties in the catalog (after merging
// the messy free-text variants below). Aliases cover the live distinct values in
// data/properties.json. Mirrors the lib/areas.ts aliases pattern.
export const developers: Developer[] = [
  { slug: 'emaar', name: 'Emaar Properties', aliases: ['EMAAR', 'Emaar'], logo: '/images/developers/emaar.png',
    blurb: "Dubai's largest master-developer — behind Downtown Dubai, Dubai Marina, Emaar Beachfront and Dubai Hills Estate. A byword for on-time delivery and strong resale liquidity." },
  { slug: 'damac', name: 'DAMAC Properties', aliases: ['DAMAC'], logo: '/images/developers/damac.png',
    blurb: 'A leading luxury developer known for branded residences and large lifestyle communities such as DAMAC Hills and DAMAC Islands, often with flexible payment plans.' },
  { slug: 'ellington', name: 'Ellington Properties', aliases: ['ELLINGTON', 'Ellington Properties', 'Ellington'], logo: '/images/developers/ellington.png',
    blurb: "A design-led boutique developer focused on architecture and finish quality across Dubai's most sought-after districts." },
  { slug: 'danube', name: 'Danube Properties', aliases: ['Danube Properties', 'Danube'],
    blurb: 'A high-volume developer popular with investors for accessible entry prices and 1% monthly payment plans.' },
  { slug: 'samana', name: 'Samana Developers', aliases: ['Samana'],
    blurb: 'A fast-growing developer known for resort-style residences with private pools and investor-friendly payment plans.' },
  { slug: 'sobha', name: 'Sobha Realty', aliases: ['SOBHA REALTY', 'Sobha', 'Sobha Group'], logo: '/images/developers/sobha.svg',
    blurb: 'A premium developer with full in-house construction (backward integration), known for Sobha Hartland and exceptional build quality.' },
  { slug: 'dar-global', name: 'DarGlobal', aliases: ['DarGlobal', 'DAR GLOBAL'],
    blurb: 'The international arm of Dar Al Arkan, delivering luxury branded residences in partnership with global names.' },
  { slug: 'prestige-one', name: 'Prestige One Developments', aliases: ['Prestige One'],
    blurb: 'A boutique Dubai developer focused on contemporary mid- and high-rise residences.' },
  { slug: 'expo-city', name: 'Expo City Dubai', aliases: ['Expo City Dubai', 'Expo Dubai Group', 'Expo City'],
    blurb: 'Master-developer of Expo City Dubai — a sustainable, mixed-use district built on the legacy of Expo 2020.' },
  { slug: 'igo', name: 'Invest Group Overseas (IGO)', aliases: ['IGO', 'Invest Group Overseas (IGO)', 'Invest Group Overseas'],
    blurb: 'A developer of premium villa and apartment communities with a focus on craftsmanship.' },
  { slug: 'mag', name: 'MAG', aliases: ['MAG Properties', 'MAG Property', 'Mag Properties', 'Mag Lifestyle', 'MAG'],
    blurb: 'The real-estate arm of the MAG Group, delivering accessible and wellness-focused residences across Dubai.' },
  { slug: 'meraas', name: 'Meraas', aliases: ['Meraas', 'MERAAS'], logo: '/images/developers/meraas.png',
    blurb: 'A Dubai master-developer behind landmark waterfront and lifestyle destinations such as Bluewaters and City Walk.' },
  { slug: 'aqua-properties', name: 'Aqua Properties', aliases: ['Aqua Properties', 'Aqua properties'],
    blurb: 'A Dubai developer delivering contemporary residential projects.' },
]

export const developerSlugs = developers.map(d => d.slug)

export function getDeveloper(slug: string): Developer | undefined {
  return developers.find(d => d.slug === slug)
}

function norm(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim()
}

// Exact normalized match against the canonical name or any alias (NOT substring,
// so "Prestige One" never catches "Prestige Harbour").
export function propertyMatchesDeveloper(propDeveloper: string, dev: Developer): boolean {
  if (!propDeveloper) return false
  const p = norm(propDeveloper)
  if (p === norm(dev.name)) return true
  return (dev.aliases ?? []).some(a => norm(a) === p)
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `node --test --experimental-strip-types lib/developers.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
GD="$(dirname "$(find /Users/dzhambulat/Documents -maxdepth 3 -name .git -type d 2>/dev/null | grep '/Claude/.git')")"
git -C "$GD" add worldwise/lib/developers.ts worldwise/lib/developers.test.ts
git -C "$GD" commit -m "feat(developers): canonical developer list + matcher (lib/developers)"
```

---

## Task 2: Developer detail page + client wrapper

**Files:** Create `app/developers/[slug]/DeveloperPageClient.tsx`, `app/developers/[slug]/page.tsx`

- [ ] **Step 1: Create the client wrapper** `app/developers/[slug]/DeveloperPageClient.tsx`:

```tsx
'use client'

import { useState, ReactNode } from 'react'
import LeadModal from '@/components/LeadModal'
import MobileCtaBar from '@/components/MobileCtaBar'
import type { Developer } from '@/lib/developers'

export default function DeveloperPageClient({
  developer,
  listingCount,
  children,
}: {
  developer: Developer
  listingCount: number
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const source = `developer_${developer.slug.replace(/-/g, '_')}`
  return (
    <>
      <section className="pt-32 pb-14 bg-navy text-white">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <p className="text-gold text-sm font-medium uppercase tracking-widest mb-3">Developer</p>
          <h1 className="font-serif text-4xl md:text-5xl mb-4">{developer.name}</h1>
          <p className="text-gray-300 max-w-2xl mx-auto leading-relaxed">{developer.blurb}</p>
          <p className="text-gray-400 text-sm mt-4">
            {listingCount} {listingCount === 1 ? 'property' : 'properties'} available
          </p>
          <button onClick={() => setOpen(true)} className="btn-primary mt-6">
            Request {developer.name} availability
          </button>
        </div>
      </section>
      {children}
      <LeadModal
        isOpen={open}
        onClose={() => setOpen(false)}
        source={source}
        title={`Interested in ${developer.name}?`}
        subtitle="Tell us what you're looking for — we'll send curated options within 24 hours."
      />
      <MobileCtaBar
        enquireSource={source}
        enquireLabel={`Enquire about ${developer.name}`}
        waMessage={`Hi Worldwise, I'm interested in ${developer.name} projects in Dubai.`}
      />
    </>
  )
}
```

- [ ] **Step 2: Create the detail page** `app/developers/[slug]/page.tsx`:

```tsx
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Navigation from '@/components/Navigation'
import Footer from '@/components/Footer'
import FloatingCTA from '@/components/FloatingCTA'
import LeadCaptureSection from '@/components/LeadCaptureSection'
import PropertyCard from '@/components/PropertyCard'
import JsonLd from '@/components/JsonLd'
import DeveloperPageClient from './DeveloperPageClient'
import { getDeveloper, developerSlugs, propertyMatchesDeveloper } from '@/lib/developers'
import { getProperties } from '@/lib/properties'

const BASE = 'https://worldwise.pro'
export const revalidate = 60

export function generateStaticParams() {
  return developerSlugs.map(slug => ({ slug }))
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const dev = getDeveloper(params.slug)
  if (!dev) return {}
  const title = `${dev.name} Projects in Dubai | Worldwise Real Estate`
  const url = `${BASE}/developers/${dev.slug}`
  return {
    title,
    description: dev.blurb,
    alternates: { canonical: url },
    openGraph: { title, description: dev.blurb, url, type: 'website' },
  }
}

export default function DeveloperPage({ params }: { params: { slug: string } }) {
  const dev = getDeveloper(params.slug)
  if (!dev) notFound()
  const matched = getProperties().filter(p => propertyMatchesDeveloper(p.developer, dev))
  const source = `developer_${dev.slug.replace(/-/g, '_')}`

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: BASE },
      { '@type': 'ListItem', position: 2, name: 'Developers', item: `${BASE}/developers` },
      { '@type': 'ListItem', position: 3, name: dev.name, item: `${BASE}/developers/${dev.slug}` },
    ],
  }
  const orgJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: dev.name,
    description: dev.blurb,
    url: `${BASE}/developers/${dev.slug}`,
    ...(dev.logo ? { logo: `${BASE}${dev.logo}` } : {}),
  }

  return (
    <>
      <Navigation />
      <JsonLd data={breadcrumbJsonLd} />
      <JsonLd data={orgJsonLd} />
      <DeveloperPageClient developer={dev} listingCount={matched.length}>
        <section className="py-16 bg-[#F8F8F6]">
          <div className="max-w-7xl mx-auto px-6">
            <h2 className="section-title text-center mb-10">Available {dev.name} properties</h2>
            {matched.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {matched.map(p => <PropertyCard key={p.id} property={p} />)}
              </div>
            ) : (
              <p className="text-center text-gray-500">
                New {dev.name} launches are added regularly — contact us for current availability.
              </p>
            )}
          </div>
        </section>
        <LeadCaptureSection source={source} />
      </DeveloperPageClient>
      <FloatingCTA />
      <Footer />
    </>
  )
}
```

- [ ] **Step 3: Build**

Run: `export PATH="/Users/dzhambulat/.nvm/versions/node/v24.15.0/bin:$PATH"; npm run build 2>&1 | grep -iE "Compiled successfully|Failed|error" | head`
Expected: "Compiled successfully" (developer pages prerender; locally `data/` is absent so 0 listings, that's fine).

- [ ] **Step 4: Commit**

```bash
GD="$(dirname "$(find /Users/dzhambulat/Documents -maxdepth 3 -name .git -type d 2>/dev/null | grep '/Claude/.git')")"
git -C "$GD" add "worldwise/app/developers/[slug]/DeveloperPageClient.tsx" "worldwise/app/developers/[slug]/page.tsx"
git -C "$GD" commit -m "feat(developers): per-developer page with matched listings + lead capture"
```

---

## Task 3: Developers index page

**Files:** Create `app/developers/page.tsx`

- [ ] **Step 1: Create the index** `app/developers/page.tsx`:

```tsx
import type { Metadata } from 'next'
import Link from 'next/link'
import Navigation from '@/components/Navigation'
import Footer from '@/components/Footer'
import FloatingCTA from '@/components/FloatingCTA'
import JsonLd from '@/components/JsonLd'
import { developers, propertyMatchesDeveloper } from '@/lib/developers'
import { getProperties } from '@/lib/properties'

const BASE = 'https://worldwise.pro'
export const revalidate = 60

export const metadata: Metadata = {
  title: 'Dubai Property Developers | Worldwise Real Estate',
  description: "Browse Dubai's leading developers — Emaar, DAMAC, Sobha, Ellington, Danube and more. See available projects and request developer pricing.",
  alternates: { canonical: `${BASE}/developers` },
}

export default function DevelopersIndex() {
  const props = getProperties()
  const cards = developers
    .map(d => ({ d, count: props.filter(p => propertyMatchesDeveloper(p.developer, d)).length }))
    .sort((a, b) => b.count - a.count)

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: BASE },
      { '@type': 'ListItem', position: 2, name: 'Developers', item: `${BASE}/developers` },
    ],
  }

  return (
    <>
      <Navigation />
      <JsonLd data={breadcrumbJsonLd} />
      <main className="pt-24 min-h-screen bg-[#F8F8F6]">
        <div className="max-w-7xl mx-auto px-6 pb-20">
          <div className="py-10 text-center">
            <p className="text-gold-accessible text-sm font-medium uppercase tracking-widest mb-2">Developers</p>
            <h1 className="font-serif text-4xl md:text-5xl text-navy">Dubai&apos;s Leading Developers</h1>
            <p className="text-gray-500 mt-2 max-w-2xl mx-auto">
              We work directly with Dubai&apos;s top developers for priority access to new launches and developer pricing.
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {cards.map(({ d, count }) => (
              <Link
                key={d.slug}
                href={`/developers/${d.slug}`}
                className="bg-white rounded-sm border border-gray-200 p-6 flex flex-col items-center text-center gap-3 hover:border-gold hover:shadow-md transition-all"
              >
                <div className="h-12 flex items-center justify-center">
                  {d.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={d.logo} alt={d.name} className="max-h-12 w-auto object-contain" />
                  ) : (
                    <span className="font-serif text-2xl text-navy">
                      {d.name.split(' ').map(w => w[0]).slice(0, 2).join('')}
                    </span>
                  )}
                </div>
                <span className="font-serif text-lg text-navy leading-tight">{d.name}</span>
                <span className="text-xs text-gray-500">{count} {count === 1 ? 'property' : 'properties'}</span>
              </Link>
            ))}
          </div>
        </div>
      </main>
      <FloatingCTA />
      <Footer />
    </>
  )
}
```

- [ ] **Step 2: Build** — `npm run build 2>&1 | grep -iE "Compiled successfully|Failed|error" | head` → "Compiled successfully".

- [ ] **Step 3: Commit**

```bash
GD="$(dirname "$(find /Users/dzhambulat/Documents -maxdepth 3 -name .git -type d 2>/dev/null | grep '/Claude/.git')")"
git -C "$GD" add worldwise/app/developers/page.tsx
git -C "$GD" commit -m "feat(developers): /developers index with logos/initials and counts"
```

---

## Task 4: Sitemap — add developer URLs

**Files:** Modify `app/sitemap.ts`

- [ ] **Step 1: Add the import.** After `import { areaSlugs } from '@/lib/areas'` add:
`import { developerSlugs } from '@/lib/developers'`

- [ ] **Step 2: Build the developer entries.** After the `areaPages` block, add:

```ts
  const developerPages: MetadataRoute.Sitemap = [
    { url: `${BASE}/developers`, lastModified: new Date(), changeFrequency: 'weekly' as const, priority: 0.7 },
    ...developerSlugs.map(slug => ({
      url: `${BASE}/developers/${slug}`,
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    })),
  ]
```

- [ ] **Step 3: Include them in the return.** Change the final return to:
`  return [...staticPages, ...areaPages, ...developerPages, ...propertyPages, ...blogPages]`

- [ ] **Step 4: Build** → "Compiled successfully".

- [ ] **Step 5: Commit**

```bash
GD="$(dirname "$(find /Users/dzhambulat/Documents -maxdepth 3 -name .git -type d 2>/dev/null | grep '/Claude/.git')")"
git -C "$GD" add worldwise/app/sitemap.ts
git -C "$GD" commit -m "feat(seo): add /developers and developer pages to sitemap"
```

---

## Task 5: URL-filterable catalog

**Files:** Modify `app/properties/PropertiesClient.tsx`, `app/properties/page.tsx`

- [ ] **Step 1: Accept initial filter props in PropertiesClient.** Change the signature + the three `useState` lines.

Replace:
```tsx
export default function PropertiesClient({ properties }: { properties: Property[] }) {
  const areas = useMemo(
    () => ['All Areas', ...Array.from(new Set(properties.map(p => p.area).filter(Boolean))).sort()],
    [properties]
  )
  const [area, setArea] = useState('All Areas')
  const [status, setStatus] = useState('all')
  const [type, setType] = useState('all')
```
with:
```tsx
export default function PropertiesClient({
  properties,
  initialArea = 'All Areas',
  initialType = 'all',
  initialStatus = 'all',
}: {
  properties: Property[]
  initialArea?: string
  initialType?: string
  initialStatus?: string
}) {
  const areas = useMemo(
    () => ['All Areas', ...Array.from(new Set(properties.map(p => p.area).filter(Boolean))).sort()],
    [properties]
  )
  const validTypes = ['all', 'apartment', 'villa', 'townhouse', 'penthouse']
  const validStatuses = ['all', 'off-plan', 'secondary', 'rent']
  const [area, setArea] = useState(areas.includes(initialArea) ? initialArea : 'All Areas')
  const [status, setStatus] = useState(validStatuses.includes(initialStatus) ? initialStatus : 'all')
  const [type, setType] = useState(validTypes.includes(initialType) ? initialType : 'all')
```

- [ ] **Step 2: Read searchParams on the server and pass them in.** In `app/properties/page.tsx`, change the function signature and the `<PropertiesClient .../>` call.

Replace:
```tsx
export default function PropertiesPage() {
  const properties = getProperties()
```
with:
```tsx
export default function PropertiesPage({
  searchParams,
}: {
  searchParams: { area?: string; type?: string; status?: string }
}) {
  const properties = getProperties()
```
And replace:
```tsx
          <PropertiesClient properties={properties} />
```
with:
```tsx
          <PropertiesClient
            properties={properties}
            initialArea={searchParams.area ?? 'All Areas'}
            initialType={searchParams.type ?? 'all'}
            initialStatus={searchParams.status ?? 'all'}
          />
```

- [ ] **Step 3: Build** → "Compiled successfully" (no `useSearchParams`, so no Suspense warning).

- [ ] **Step 4: Commit**

```bash
GD="$(dirname "$(find /Users/dzhambulat/Documents -maxdepth 3 -name .git -type d 2>/dev/null | grep '/Claude/.git')")"
git -C "$GD" add worldwise/app/properties/PropertiesClient.tsx worldwise/app/properties/page.tsx
git -C "$GD" commit -m "feat(catalog): /properties reads area/type/status from URL params"
```

---

## Task 6: Popular Searches grid

**Files:** Create `components/PopularSearches.tsx`, Modify `app/page.tsx`

- [ ] **Step 1: Create the component** `components/PopularSearches.tsx`:

```tsx
import Link from 'next/link'
import type { Property } from '@/types'

const TYPE_LABEL: Record<string, string> = {
  apartment: 'Apartments',
  villa: 'Villas',
  townhouse: 'Townhouses',
  penthouse: 'Penthouses',
}

// Server component: builds the most common area x type combinations from the live
// catalog, so links always match real `area` strings and counts grow with inventory.
export default function PopularSearches({ properties }: { properties: Property[] }) {
  const groups = new Map<string, { area: string; type: string; count: number; min: number }>()
  for (const p of properties) {
    if (!p.area || !TYPE_LABEL[p.type]) continue
    const key = `${p.area}|${p.type}`
    const g = groups.get(key)
    if (g) {
      g.count++
      g.min = Math.min(g.min, p.priceAed)
    } else {
      groups.set(key, { area: p.area, type: p.type, count: 1, min: p.priceAed })
    }
  }
  const combos = Array.from(groups.values()).sort((a, b) => b.count - a.count).slice(0, 12)
  if (combos.length === 0) return null

  const fmt = (n: number) =>
    n >= 1_000_000 ? `AED ${(n / 1_000_000).toFixed(2)}M` : `AED ${Math.round(n / 1000)}K`

  return (
    <section className="py-16 bg-[#F8F8F6]">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-10">
          <p className="text-gold-accessible text-sm font-medium uppercase tracking-widest mb-2">Popular Searches</p>
          <h2 className="section-title">Browse by area and type</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {combos.map(c => (
            <Link
              key={`${c.area}-${c.type}`}
              href={`/properties?area=${encodeURIComponent(c.area)}&type=${c.type}`}
              className="flex items-center justify-between bg-white rounded-sm border border-gray-200 px-4 py-3 hover:border-gold transition-colors"
            >
              <span className="text-navy">{TYPE_LABEL[c.type]} in {c.area}</span>
              <span className="text-xs text-gray-500 shrink-0 ml-3">{c.count} · from {fmt(c.min)}</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Mount on the homepage.** In `app/page.tsx`:
  - Change `import { getFeaturedProperties } from '@/lib/properties'` to `import { getFeaturedProperties, getProperties } from '@/lib/properties'`.
  - Add `import PopularSearches from '@/components/PopularSearches'` with the other imports.
  - In the body, change `const featured = getFeaturedProperties()` to:
    ```tsx
  const featured = getFeaturedProperties()
  const allProperties = getProperties()
    ```
  - Insert the section right after the `<AreasSection />` Reveal block:
    ```tsx
        <Reveal>
          <PopularSearches properties={allProperties} />
        </Reveal>
    ```

- [ ] **Step 3: Build** → "Compiled successfully".

- [ ] **Step 4: Commit**

```bash
GD="$(dirname "$(find /Users/dzhambulat/Documents -maxdepth 3 -name .git -type d 2>/dev/null | grep '/Claude/.git')")"
git -C "$GD" add worldwise/components/PopularSearches.tsx worldwise/app/page.tsx
git -C "$GD" commit -m "feat(home): data-driven Popular Searches grid linking to filtered catalog"
```

---

## Task 7: Thematic area groups

**Files:** Modify `components/AreasSection.tsx`

- [ ] **Step 1: Add a `theme` to the card type and each entry, and render grouped.** Replace the whole file body from `type AreaCard = {` to the end with:

```tsx
type AreaCard = {
  name: string
  avgPrice: string
  roi: string
  img: string
  slug: string
  theme: 'Waterfront & Beachfront' | 'City & Business' | 'Family & Lifestyle'
}

const slugByName = new Map(areaData.map(a => [a.name, a.slug]))

const homepageAreas: AreaCard[] = [
  { name: 'Dubai Marina',     avgPrice: 'AED 1,850/sqft', roi: '7–8%', img: '/images/areas/dubai-marina.jpg',     slug: slugByName.get('Dubai Marina')!,     theme: 'Waterfront & Beachfront' },
  { name: 'Palm Jumeirah',    avgPrice: 'AED 2,800/sqft', roi: '6–8%', img: '/images/areas/palm-jumeirah.jpg',    slug: slugByName.get('Palm Jumeirah')!,    theme: 'Waterfront & Beachfront' },
  { name: 'Emaar Beachfront', avgPrice: 'AED 2,500/sqft', roi: '7–8%', img: '/images/areas/emaar-beachfront.jpg', slug: slugByName.get('Emaar Beachfront')!, theme: 'Waterfront & Beachfront' },
  { name: 'Creek Harbour',    avgPrice: 'AED 1,700/sqft', roi: '7–8%', img: '/images/areas/creek-harbour.jpg',    slug: slugByName.get('Creek Harbour')!,    theme: 'Waterfront & Beachfront' },
  { name: 'Downtown Dubai',   avgPrice: 'AED 2,200/sqft', roi: '6–7%', img: '/images/areas/downtown-dubai.jpg',   slug: slugByName.get('Downtown Dubai')!,   theme: 'City & Business' },
  { name: 'Business Bay',     avgPrice: 'AED 1,600/sqft', roi: '7–9%', img: '/images/areas/business-bay.jpg',     slug: slugByName.get('Business Bay')!,     theme: 'City & Business' },
  { name: 'JLT',              avgPrice: 'AED 1,200/sqft', roi: '7–9%', img: '/images/areas/jlt.jpg',              slug: slugByName.get('JLT')!,              theme: 'City & Business' },
  { name: 'Dubai Hills',      avgPrice: 'AED 1,400/sqft', roi: '6–7%', img: '/images/areas/dubai-hills.jpg',      slug: slugByName.get('Dubai Hills')!,      theme: 'Family & Lifestyle' },
]

const THEMES: AreaCard['theme'][] = ['Waterfront & Beachfront', 'City & Business', 'Family & Lifestyle']

export default function AreasSection() {
  return (
    <section id="areas" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-12">
          <p className="text-gold-accessible text-sm font-medium uppercase tracking-widest mb-2">
            Dubai Locations
          </p>
          <h2 className="section-title">Explore Dubai&apos;s Best<br />Investment Areas</h2>
          <p className="section-subtitle">Market data updated regularly based on DLD transactions</p>
        </div>

        <div className="space-y-12">
          {THEMES.map(theme => (
            <div key={theme}>
              <h3 className="font-serif text-xl text-navy mb-4">{theme}</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {homepageAreas.filter(a => a.theme === theme).map(area => (
                  <Link
                    key={area.name}
                    href={`/${area.slug}`}
                    className="group relative overflow-hidden rounded-sm aspect-[4/3] cursor-pointer"
                  >
                    <div
                      className="absolute inset-0 bg-cover bg-center group-hover:scale-105 transition-transform duration-500"
                      style={{ backgroundImage: `url('${area.img}')` }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-navy/90 via-navy/30 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-4">
                      <p className="text-white font-serif text-lg leading-tight">{area.name}</p>
                      <div className="flex justify-between items-center mt-1">
                        <span className="text-white/60 text-xs">{area.avgPrice}</span>
                        <span className="text-gold text-xs font-medium">{area.roi} ROI</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Build** → "Compiled successfully".

- [ ] **Step 3: Commit**

```bash
GD="$(dirname "$(find /Users/dzhambulat/Documents -maxdepth 3 -name .git -type d 2>/dev/null | grep '/Claude/.git')")"
git -C "$GD" add worldwise/components/AreasSection.tsx
git -C "$GD" commit -m "feat(home): group area hub by theme (waterfront / city / family)"
```

---

## Task 8: Full verification

- [ ] **Step 1: Unit tests** — `node --test --experimental-strip-types lib/*.test.ts` → all pass (incl. developers).
- [ ] **Step 2: Build + lint** — `npm run build` "Compiled successfully"; `npx eslint lib/developers.ts components/PopularSearches.tsx components/AreasSection.tsx app/developers/page.tsx "app/developers/[slug]/page.tsx" "app/developers/[slug]/DeveloperPageClient.tsx" app/properties/PropertiesClient.tsx app/properties/page.tsx app/page.tsx app/sitemap.ts` → 0 errors (img warning on the index is expected/eslint-disabled).
- [ ] **Step 3: Manual** — note developer/popular-search counts populate only with server `data/`, so confirm after deploy: `/developers` lists brands (logos for emaar/damac/ellington/sobha/meraas, initials for the rest) with counts; a developer page (e.g. `/developers/emaar`) shows matched cards + lead form; `/properties?area=Dubai Marina&type=apartment` opens pre-filtered; homepage shows Popular Searches (non-empty combos only) and the three area theme groups; `/sitemap.xml` contains `/developers` URLs.
- [ ] **Step 4:** Report. Deploy is a SEPARATE step on explicit request (backup → rsync → markers → build → restart).

---

## Self-Review (done)

- **Spec coverage:** Developers directory — T1 (module), T2 (detail), T3 (index), T4 (sitemap). Popular Searches — T5 (URL filters), T6 (grid). Area themes — T7. Read-time — already implemented, correctly excluded.
- **Type consistency:** `propertyMatchesDeveloper(propDeveloper, dev)`, `Developer`, `developerSlugs`, `getDeveloper` used identically across T1–T4; PropertiesClient props `initialArea/initialType/initialStatus` match the page call in T5; `theme` literal union matches `THEMES` in T7.
- **No placeholders:** every code step is complete and copy-paste ready.
- **Decisions baked in:** server `searchParams` (not `useSearchParams`) to keep static rendering; Popular Searches computed from real data so links match real `area` strings; `<img>` + eslint-disable for logos with initials fallback (logos exist for 5 of 13).
