import Link from 'next/link'
import { Property } from '@/types'
import PropertyCard from './PropertyCard'

type Props = {
  areaName: string
  properties: Property[]
  /** Optional custom heading. When omitted the default area-page wording is used. */
  heading?: string
}

export default function AreaFeaturedProperties({ areaName, properties, heading }: Props) {
  if (properties.length === 0) {
    return (
      <section id="featured" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <p className="text-gold-accessible text-sm font-medium uppercase tracking-widest mb-2">
            Listings
          </p>
          <h2 className="section-title">{heading ?? `Currently Sourcing ${areaName} Inventory`}</h2>
          <p className="section-subtitle">
            We&apos;re between active listings in {areaName} right now. Browse the wider catalogue
            or contact us for off-market opportunities.
          </p>
          <Link href="/properties" className="btn-outline inline-block mt-6">
            Browse all properties
          </Link>
        </div>
      </section>
    )
  }

  return (
    <section id="featured" className="py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-12">
          <p className="text-gold-accessible text-sm font-medium uppercase tracking-widest mb-2">
            Available Now
          </p>
          <h2 className="section-title">{heading ?? `Featured Properties in ${areaName}`}</h2>
          <p className="section-subtitle">
            Curated by our investment team. Updated weekly.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {properties.map(p => (
            <PropertyCard key={p.id} property={p} />
          ))}
        </div>

        <div className="text-center mt-10">
          <Link
            href={`/properties?area=${encodeURIComponent(areaName)}`}
            className="btn-outline inline-block"
          >
            View all in {areaName}
          </Link>
        </div>
      </div>
    </section>
  )
}
