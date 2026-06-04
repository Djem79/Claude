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
