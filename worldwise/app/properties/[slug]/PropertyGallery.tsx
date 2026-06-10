'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { track } from '@/lib/analytics'

export default function PropertyGallery({ images, title }: { images: string[]; title: string }) {
  const [current, setCurrent] = useState(0)

  useEffect(() => {
    track('property_view', { property: title })
  }, [title])

  // Guard: a property can have zero images (draft/import edge cases) —
  // render a neutral block with the same height instead of crashing <Image>.
  if (images.length === 0) {
    return (
      <div className="relative bg-navy">
        <div className="relative h-[50vh] md:h-[65vh] overflow-hidden bg-navy/5" />
      </div>
    )
  }

  return (
    <div className="relative bg-navy">
      <div className="relative h-[50vh] md:h-[65vh] overflow-hidden">
        <Image
          src={images[current]}
          alt={`${title} — photo ${current + 1}`}
          fill
          className="object-contain"
          priority
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-navy/40 to-transparent" />

        {images.length > 1 && (
          <>
            <button
              onClick={() => setCurrent(i => (i - 1 + images.length) % images.length)}
              aria-label="Previous photo"
              className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white w-10 h-10 rounded-full flex items-center justify-center transition-colors"
            >
              ‹
            </button>
            <button
              onClick={() => setCurrent(i => (i + 1) % images.length)}
              aria-label="Next photo"
              className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white w-10 h-10 rounded-full flex items-center justify-center transition-colors"
            >
              ›
            </button>
          </>
        )}
      </div>

      {/* Thumbnails */}
      {images.length > 1 && (
        <div className="flex gap-2 p-3 bg-navy-dark overflow-x-auto">
          {images.map((img, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              aria-label={`View photo ${i + 1}`}
              aria-current={i === current}
              className={`relative w-20 h-14 flex-shrink-0 overflow-hidden rounded-sm transition-all ${
                i === current ? 'ring-2 ring-gold' : 'opacity-60 hover:opacity-90'
              }`}
            >
              <Image src={img} alt="" fill className="object-cover" sizes="80px" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
