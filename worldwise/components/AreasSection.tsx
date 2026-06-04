import Link from 'next/link'
import { areas as areaData } from '@/lib/areas'

type AreaCard = {
  name: string
  avgPrice: string
  roi: string
  img: string
  slug: string
  theme: 'Waterfront & Beachfront' | 'City & Business' | 'Family & Lifestyle'
}

const slugByName = new Map(areaData.map(a => [a.name, a.slug]))

const homepageAreas: AreaCard[] = [
  { name: 'Dubai Marina',     avgPrice: 'AED 1,850/sqft', roi: '7–8%', img: '/images/areas/dubai-marina.jpg',     slug: slugByName.get('Dubai Marina')!,     theme: 'Waterfront & Beachfront' },
  { name: 'Palm Jumeirah',    avgPrice: 'AED 2,800/sqft', roi: '6–8%', img: '/images/areas/palm-jumeirah.jpg',    slug: slugByName.get('Palm Jumeirah')!,    theme: 'Waterfront & Beachfront' },
  { name: 'Emaar Beachfront', avgPrice: 'AED 2,500/sqft', roi: '7–8%', img: '/images/areas/emaar-beachfront.jpg', slug: slugByName.get('Emaar Beachfront')!, theme: 'Waterfront & Beachfront' },
  { name: 'Creek Harbour',    avgPrice: 'AED 1,700/sqft', roi: '7–8%', img: '/images/areas/creek-harbour.jpg',    slug: slugByName.get('Creek Harbour')!,    theme: 'Waterfront & Beachfront' },
  { name: 'Downtown Dubai',   avgPrice: 'AED 2,200/sqft', roi: '6–7%', img: '/images/areas/downtown-dubai.jpg',   slug: slugByName.get('Downtown Dubai')!,   theme: 'City & Business' },
  { name: 'Business Bay',     avgPrice: 'AED 1,600/sqft', roi: '7–9%', img: '/images/areas/business-bay.jpg',     slug: slugByName.get('Business Bay')!,     theme: 'City & Business' },
  { name: 'JLT',              avgPrice: 'AED 1,200/sqft', roi: '7–9%', img: '/images/areas/jlt.jpg',              slug: slugByName.get('JLT')!,              theme: 'City & Business' },
  { name: 'Dubai Hills',      avgPrice: 'AED 1,400/sqft', roi: '6–7%', img: '/images/areas/dubai-hills.jpg',      slug: slugByName.get('Dubai Hills')!,      theme: 'Family & Lifestyle' },
]

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
                    <div
                      className="absolute inset-0 bg-cover bg-center group-hover:scale-105 transition-transform duration-500"
                      style={{ backgroundImage: `url('${area.img}')` }}
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
