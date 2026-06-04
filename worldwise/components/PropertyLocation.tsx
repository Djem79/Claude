'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { ResolvedCoords } from '@/lib/property-coords'

type Props = {
  title: string
  area: string
  /** Resolved map centre + zoom; null → render the text block only, no map. */
  coords: ResolvedCoords | null
  /** Area landing-page slug, when the property's area maps to one. */
  areaSlug?: string
}

export default function PropertyLocation({ title, area, coords, areaSlug }: Props) {
  const [show, setShow] = useState(false)

  const embedSrc = coords
    ? `https://www.google.com/maps?q=${coords.lat},${coords.lng}(${encodeURIComponent(title)})&z=${coords.zoom}&output=embed`
    : null
  const externalHref = coords
    ? `https://www.google.com/maps/search/?api=1&query=${coords.lat},${coords.lng}`
    : null

  return (
    <div className="border-t border-gray-100 pt-8">
      <h2 className="font-serif text-2xl text-navy mb-2">Location</h2>
      <p className="text-gray-500 text-sm mb-5">
        {area}, Dubai.
        {areaSlug && (
          <>
            {' '}
            <Link href={`/${areaSlug}`} className="text-gold-accessible hover:underline">
              Explore {area} →
            </Link>
          </>
        )}
        {coords?.level === 'area' && ' Map shows the district; exact building location available on request.'}
      </p>

      {embedSrc && (
        show ? (
          <div className="rounded-sm overflow-hidden bg-[#F8F8F6]">
            <iframe
              title={`Map of ${title}`}
              src={embedSrc}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className="w-full h-[360px] border-0"
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShow(true)}
            className="w-full h-[200px] rounded-sm bg-[#F1F1ED] border border-gray-200 flex flex-col items-center justify-center gap-2 text-navy hover:bg-[#E9E9E3] transition-colors"
            aria-label="Show map"
          >
            <span className="font-serif text-lg">Show map</span>
            <span className="text-xs text-gray-500">{area}, Dubai · loads Google Maps</span>
          </button>
        )
      )}

      {externalHref && (
        <a
          href={externalHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block mt-3 text-sm text-gold-accessible hover:underline"
        >
          Open in Google Maps →
        </a>
      )}
    </div>
  )
}
