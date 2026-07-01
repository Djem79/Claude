import Link from 'next/link'
import Image from 'next/image'
import { areas as areaData } from '@/lib/areas'

type Theme = 'Waterfront & Beachfront' | 'City & Business' | 'Family & Lifestyle'
type AreaCard = { name: string; avgPrice: string; roi: string; img: string; slug: string; theme: Theme }

// Homepage-specific: display order + theme grouping ONLY. Price / ROI / image / slug
// are DERIVED from lib/areas.ts (the single source of truth) so the homepage cards
// can never drift from the landing pages — as the rental-yield figures had before
// the 2026 yield review.
const byName = new Map(areaData.map(a => [a.name, a]))
const homepageAreas: AreaCard[] = (
  [
    ['Dubai Marina', 'Waterfront & Beachfront'],
    ['Palm Jumeirah', 'Waterfront & Beachfront'],
    ['Emaar Beachfront', 'Waterfront & Beachfront'],
    ['Creek Harbour', 'Waterfront & Beachfront'],
    ['Downtown Dubai', 'City & Business'],
    ['Business Bay', 'City & Business'],
    ['JLT', 'City & Business'],
    ['MBR City', 'City & Business'],
    ['Dubai Hills', 'Family & Lifestyle'],
    ['Damac Hills', 'Family & Lifestyle'],
    ['Damac Hills 2', 'Family & Lifestyle'],
    ['The Valley', 'Family & Lifestyle'],
  ] as [string, Theme][]
).map(([name, theme]) => {
  const a = byName.get(name)!
  return { name, theme, slug: a.slug, avgPrice: a.metrics.avgPrice, roi: a.metrics.roi, img: a.heroImage }
})

const THEMES: AreaCard['theme'][] = ['Waterfront & Beachfront', 'City & Business', 'Family & Lifestyle']

export default function AreasSection() {
  return (
    <section id="areas" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-12">
          <p className="text-gold-accessible text-sm font-medium uppercase tracking-widest mb-2">
            Dubai Locations
          </p>
          <h2 className="section-title">Explore Dubai&apos;s Best<br />Investment Areas</h2>
          <p className="section-subtitle">Market data updated regularly based on DLD transactions</p>
        </div>

        <div className="space-y-12">
          {THEMES.map(theme => (
            <div key={theme}>
              <h3 className="font-serif text-xl text-navy mb-4">{theme}</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {homepageAreas.filter(a => a.theme === theme).map(area => (
                  <Link
                    key={area.name}
                    href={`/${area.slug}`}
                    className="group relative overflow-hidden rounded-sm aspect-[4/3] cursor-pointer"
                  >
                    <Image
                      src={area.img}
                      alt={`${area.name}, Dubai — investment properties`}
                      fill
                      sizes="(max-width: 768px) 50vw, 25vw"
                      className="object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-navy/90 via-navy/30 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-4">
                      <p className="text-white font-serif text-lg leading-tight">{area.name}</p>
                      <div className="flex justify-between items-center mt-1">
                        <span className="text-white/60 text-xs">{area.avgPrice}</span>
                        <span className="text-gold text-xs font-medium">{area.roi} ROI</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
