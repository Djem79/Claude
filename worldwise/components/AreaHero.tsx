'use client'

import { Area } from '@/lib/areas'

type Props = {
  area: Area
  listingCount: number
  onCtaClick: () => void
}

export default function AreaHero({ area, listingCount, onCtaClick }: Props) {
  return (
    <section
      className="relative h-[70vh] min-h-[520px] w-full flex items-end overflow-hidden"
    >
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url('${area.heroImage}')` }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-navy via-navy/60 to-navy/20" />

      <div className="relative max-w-7xl mx-auto px-6 pb-16 md:pb-24 w-full">
        <p className="text-gold text-sm font-medium uppercase tracking-widest mb-3">
          Dubai · Investment Area
        </p>
        <h1 className="font-serif text-white text-4xl md:text-6xl leading-tight max-w-3xl">
          {area.name}
        </h1>
        <p className="text-white/80 text-lg md:text-xl mt-4 max-w-2xl leading-relaxed">
          {area.tagline}
        </p>

        <div className="flex flex-wrap gap-4 md:gap-6 mt-8">
          <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-sm px-5 py-3">
            <p className="text-white/60 text-xs uppercase tracking-widest">Avg price</p>
            <p className="text-white font-serif text-lg mt-1">{area.metrics.avgPrice}</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-sm px-5 py-3">
            <p className="text-white/60 text-xs uppercase tracking-widest">Rental yield</p>
            <p className="text-gold font-serif text-lg mt-1">{area.metrics.roi}</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-sm px-5 py-3">
            <p className="text-white/60 text-xs uppercase tracking-widest">Current listings</p>
            <p className="text-white font-serif text-lg mt-1">{listingCount}</p>
          </div>
        </div>

        <div className="mt-10 flex flex-wrap gap-3">
          <button onClick={onCtaClick} className="btn-primary">
            Get Free Consultation
          </button>
          <a href="#featured" className="btn-outline-gold">
            See Properties
          </a>
        </div>
      </div>
    </section>
  )
}
