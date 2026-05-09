import Link from 'next/link'

const areas = [
  { name: 'Dubai Marina', avgPrice: 'AED 1,850/sqft', roi: '7–8%', img: '/images/areas/dubai-marina.jpg' },
  { name: 'Downtown Dubai', avgPrice: 'AED 2,200/sqft', roi: '6–7%', img: '/images/areas/downtown-dubai.jpg' },
  { name: 'Palm Jumeirah', avgPrice: 'AED 2,800/sqft', roi: '6–8%', img: '/images/areas/palm-jumeirah.jpg' },
  { name: 'Business Bay', avgPrice: 'AED 1,600/sqft', roi: '7–9%', img: '/images/areas/business-bay.jpg' },
  { name: 'Dubai Hills', avgPrice: 'AED 1,400/sqft', roi: '6–7%', img: '/images/areas/dubai-hills.jpg' },
  { name: 'JLT', avgPrice: 'AED 1,200/sqft', roi: '7–9%', img: '/images/areas/jlt.jpg' },
  { name: 'Creek Harbour', avgPrice: 'AED 1,700/sqft', roi: '7–8%', img: '/images/areas/creek-harbour.jpg' },
  { name: 'Emaar Beachfront', avgPrice: 'AED 2,500/sqft', roi: '7–8%', img: '/images/areas/emaar-beachfront.jpg' },
]

export default function AreasSection() {
  return (
    <section id="areas" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-12">
          <p className="text-gold text-sm font-medium uppercase tracking-widest mb-2">
            Dubai Locations
          </p>
          <h2 className="section-title">Explore Dubai&apos;s Best<br />Investment Areas</h2>
          <p className="section-subtitle">Market data updated regularly based on DLD transactions</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {areas.map(area => (
            <Link
              key={area.name}
              href={`/properties?area=${encodeURIComponent(area.name)}`}
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
    </section>
  )
}
