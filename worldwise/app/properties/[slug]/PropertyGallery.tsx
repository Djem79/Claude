'use client'

import { useState } from 'react'
import Image from 'next/image'

export default function PropertyGallery({ images, title }: { images: string[]; title: string }) {
  const [current, setCurrent] = useState(0)

  return (
    <div className="relative bg-navy">
      <div className="relative h-[50vh] md:h-[65vh] overflow-hidden">
        <Image
          src={images[current]}
          alt={`${title} — photo ${current + 1}`}
          fill
          className="object-cover"
          priority
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-navy/40 to-transparent" />

        {images.length > 1 && (
          <>
            <button
              onClick={() => setCurrent(i => (i - 1 + images.length) % images.length)}
              className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white w-10 h-10 rounded-full flex items-center justify-center transition-colors"
            >
              ‹
            </button>
            <button
              onClick={() => setCurrent(i => (i + 1) % images.length)}
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
