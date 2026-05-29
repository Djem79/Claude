import Link from 'next/link'
import { Property } from '@/types'
import PropertyCard from './PropertyCard'

export default function FeaturedProperties({ properties }: { properties: Property[] }) {
  return (
    <section className="py-20 bg-[#F8F8F6]">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-12">
          <div>
            <p className="text-gold-accessible text-sm font-medium uppercase tracking-widest mb-2">
              Current Listings
            </p>
            <h2 className="section-title">Handpicked Investment<br />Properties</h2>
            <p className="section-subtitle">
              Curated opportunities with strong rental yields and capital growth potential
            </p>
          </div>
          <Link href="/properties" className="btn-outline-gold whitespace-nowrap self-start md:self-end">
            View All Properties →
          </Link>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {properties.map(p => (
            <PropertyCard key={p.id} property={p} />
          ))}
        </div>
      </div>
    </section>
  )
}
