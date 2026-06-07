'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Property } from '@/types'
import { waLink, waPropertyMessage } from '@/lib/whatsapp'
import { track } from '@/lib/analytics'
import { qualifiesForGoldenVisa } from '@/lib/golden-visa'
import PriceTag from '@/components/PriceTag'

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
          {qualifiesForGoldenVisa(property.priceAed) && (
            <span className="badge bg-gold text-navy">Golden Visa</span>
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

        <div className="flex flex-wrap gap-2 text-sm text-gray-600 mb-4">
          {property.bedrooms && <span className="px-2 py-0.5 bg-gray-50 rounded-sm">{property.bedrooms}</span>}
          {property.pricePerSqft && <span className="px-2 py-0.5 bg-gray-50 rounded-sm">AED {property.pricePerSqft.toLocaleString('en-US')}/ft²</span>}
          {property.paymentPlan && <span className="px-2 py-0.5 bg-gray-50 rounded-sm">{property.paymentPlan} plan</span>}
          {property.completionDate && <span className="px-2 py-0.5 bg-gray-50 rounded-sm">Handover {property.completionDate}</span>}
          {property.grossYield && <span className="px-2 py-0.5 bg-gold/10 text-gold-accessible rounded-sm">{property.grossYield}% yield</span>}
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-gray-100">
          <div>
            <p className="text-xs text-gray-400">{property.status === 'rent' ? 'Annual rent' : 'From'}</p>
            <p className="font-serif text-xl text-navy font-medium">
              <PriceTag aed={property.priceAed} />{property.status === 'rent' && <span className="text-xs text-gray-400 font-sans">/yr</span>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={waLink(waPropertyMessage(property.title))}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => track('whatsapp_click', { source: 'property_card', property: property.title })}
              aria-label={`WhatsApp about ${property.title}`}
              className="flex items-center justify-center w-11 h-11 rounded-sm bg-[#25D366] text-white hover:opacity-90 transition-opacity shrink-0"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/></svg>
            </a>
            <Link
              href={`/properties/${property.slug}`}
              className="btn-outline-gold-light text-sm px-5 py-2.5"
            >
              View Details
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
