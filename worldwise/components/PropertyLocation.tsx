'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
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
            className="group relative block w-full h-[320px] rounded-sm overflow-hidden border border-gray-200"
            aria-label="Show map"
          >
            {/* District backdrop (real area photo) with a graceful navy fallback */}
            {areaSlug ? (
              <Image
                src={`/images/areas/${areaSlug}.jpg`}
                alt=""
                fill
                sizes="(max-width: 1024px) 100vw, 66vw"
                className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
              />
            ) : (
              <span className="absolute inset-0 bg-gradient-to-br from-navy to-[#0d1726]" />
            )}
            {/* Dark wash for legibility + premium depth */}
            <span className="absolute inset-0 bg-gradient-to-t from-navy/90 via-navy/55 to-navy/25" />

            {/* Centre content */}
            <span className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center text-white">
              {/* Glowing location pin */}
              <span className="relative flex items-center justify-center">
                <span className="absolute h-12 w-12 rounded-full bg-gold/40 motion-safe:animate-ping" />
                <span className="relative flex h-11 w-11 items-center justify-center rounded-full bg-gold text-navy shadow-lg ring-4 ring-gold/20">
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z" />
                  </svg>
                </span>
              </span>

              <span className="font-serif text-xl tracking-wide drop-shadow-sm">{area}, Dubai</span>

              <span className="inline-flex items-center gap-2 rounded-full bg-gold px-6 py-2.5 text-sm font-medium text-navy shadow-md transition-transform duration-300 group-hover:scale-105">
                View map
                <span aria-hidden="true">→</span>
              </span>

              <span className="text-[11px] uppercase tracking-wider text-white/70">Interactive Google Maps</span>
            </span>
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
