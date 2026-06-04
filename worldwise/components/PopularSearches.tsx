import Link from 'next/link'
import type { Property } from '@/types'
import { canonicalizeArea } from '@/lib/dubai-areas'

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
    const area = canonicalizeArea(p.area)
    if (!area || !TYPE_LABEL[p.type]) continue
    const key = `${area}|${p.type}`
    const g = groups.get(key)
    if (g) {
      g.count++
      g.min = Math.min(g.min, p.priceAed)
    } else {
      groups.set(key, { area, type: p.type, count: 1, min: p.priceAed })
    }
  }
  const combos = Array.from(groups.values()).sort((a, b) => b.count - a.count).slice(0, 12)
  if (combos.length === 0) return null

  const fmt = (n: number) =>
    n >= 1_000_000 ? `AED ${(n / 1_000_000).toFixed(2)}M` : `AED ${Math.round(n / 1000)}K`

  return (
    <section className="py-14 bg-[#F8F8F6] border-t border-gray-100">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-8">
          <p className="text-gold-accessible text-sm font-medium uppercase tracking-widest mb-2">Popular Searches</p>
          <h2 className="section-title">Browse by area and type</h2>
          <p className="section-subtitle">Jump straight to the listings investors look at most</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {combos.map(c => (
            <Link
              key={`${c.area}-${c.type}`}
              href={`/properties?area=${encodeURIComponent(c.area)}&type=${c.type}`}
              className="group bg-white rounded-sm border border-gray-100 shadow-sm hover:shadow-md hover:border-gold/40 transition-all p-4 flex flex-col"
            >
              <span className="block w-8 h-px bg-gold mb-2.5 transition-all group-hover:w-12" />
              <span className="font-serif text-lg text-navy leading-snug group-hover:text-gold-accessible transition-colors">
                {TYPE_LABEL[c.type]} in {c.area}
              </span>
              <span className="mt-2.5 text-sm text-gray-400">
                <span className="text-gold-accessible font-medium">from {fmt(c.min)}</span>
                <span className="mx-1.5 text-gray-300">·</span>
                {c.count} {c.count === 1 ? 'listing' : 'listings'}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
