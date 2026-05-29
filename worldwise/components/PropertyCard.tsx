import Image from 'next/image'
import Link from 'next/link'
import { Property } from '@/types'

function formatPrice(aed: number) {
  if (aed >= 1_000_000) return `AED ${(aed / 1_000_000).toFixed(2)}M`
  return `AED ${(aed / 1000).toFixed(0)}K`
}

const STATUS_COLORS: Record<string, string> = {
  'off-plan': 'bg-blue-50 text-blue-700',
  secondary: 'bg-amber-50 text-amber-700',
  rent: 'bg-purple-50 text-purple-700',
}

const STATUS_LABELS: Record<string, string> = {
  'off-plan': 'Off-Plan',
  secondary: 'Secondary',
  rent: 'For Rent',
}

export default function PropertyCard({ property }: { property: Property }) {
  return (
    <div className="bg-white rounded-sm overflow-hidden shadow-sm hover:shadow-md transition-shadow group">
      <Link href={`/properties/${property.slug}`} className="relative block h-52 overflow-hidden">
        <Image
          src={property.images[0]}
          alt={property.title}
          fill
          className={`object-cover group-hover:scale-105 transition-transform duration-500${property.rented ? ' opacity-60' : ''}`}
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        />
        <div className="absolute top-3 left-3 flex gap-2">
          <span className={`badge ${STATUS_COLORS[property.status]}`}>
            {STATUS_LABELS[property.status]}
          </span>
          {property.rented && (
            <span className="badge bg-gray-800/80 text-white">Rented</span>
          )}
          {property.badge && (
            <span className="badge bg-navy/80 text-gold">{property.badge}</span>
          )}
        </div>
        {property.roi && (
          <div className="absolute top-3 right-3 bg-gold text-navy text-xs font-bold px-2.5 py-1 rounded-sm">
            {property.roi}% ROI
          </div>
        )}
      </Link>

      <div className="p-5">
        <p className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-1">
          {property.developer} · {property.area}
        </p>
        <h3 className="font-serif text-xl text-navy mt-1 mb-3">
          <Link href={`/properties/${property.slug}`} className="hover:text-gold-accessible transition-colors">
            {property.title}
          </Link>
        </h3>
        <p className="text-sm text-gray-500 line-clamp-2 mb-4">{property.shortDescription}</p>

        <div className="flex flex-wrap gap-3 text-sm text-gray-600 mb-4">
          {property.bedrooms && <span>🛏 {property.bedrooms}</span>}
          {property.paymentPlan && <span>📋 {property.paymentPlan}</span>}
          {property.completionDate && <span>🗓 {property.completionDate}</span>}
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-gray-100">
          <div>
            <p className="text-xs text-gray-400">{property.status === 'rent' ? 'Annual rent' : 'From'}</p>
            <p className="font-serif text-xl text-navy font-medium">
              {formatPrice(property.priceAed)}{property.status === 'rent' && <span className="text-xs text-gray-400 font-sans">/yr</span>}
            </p>
          </div>
          <Link
            href={`/properties/${property.slug}`}
            className="btn-outline-gold text-sm px-5 py-2.5"
          >
            View Details
          </Link>
        </div>
      </div>
    </div>
  )
}
