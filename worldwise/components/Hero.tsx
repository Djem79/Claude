import Link from 'next/link'
import Image from 'next/image'

export default function Hero() {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden">
      {/* Background image — local, priority-loaded for LCP */}
      <Image
        src="/images/hero-dubai.jpg"
        alt="Dubai skyline"
        fill
        priority
        className="object-cover object-center"
        sizes="100vw"
      />
      {/* Overlay */}
      <div className="absolute inset-0 bg-navy/65" />

      <div className="relative z-10 max-w-7xl mx-auto px-6 pt-24 pb-16 w-full">
        <div className="max-w-2xl">
          {/* Tag */}
          <div className="inline-flex items-center gap-2 bg-gold/20 border border-gold/40 px-4 py-1.5 rounded-sm mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-gold" />
            <span className="text-gold text-sm font-medium tracking-wider uppercase">
              RERA Certified · Dubai
            </span>
          </div>

          <h1 className="font-serif text-5xl md:text-6xl lg:text-7xl text-white leading-tight">
            UAE Real Estate
            <br />
            <span className="text-gold">8–10% Yield.</span>
            <br />
            0% Tax.
          </h1>

          <p className="text-white/75 text-lg md:text-xl mt-6 leading-relaxed">
            We help investors from 30+ countries buy, grow capital and build
            passive income through UAE real estate. Expert guidance, end-to-end support.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 mt-10">
            <Link href="#contact" className="btn-primary text-base">
              Get Free Consultation
            </Link>
            <Link href="/properties" className="btn-outline text-base">
              Browse Properties
            </Link>
          </div>

          {/* Trust stats */}
          <div className="flex flex-wrap gap-8 mt-14 pt-8 border-t border-white/20">
            {[
              { value: '50+', label: 'Investors Served' },
              { value: '$30M+', label: 'In Transactions' },
              { value: '5.0 ★', label: 'Google Rating' },
              { value: 'Up to 8%', label: 'Rental Yield' },
            ].map(stat => (
              <div key={stat.label}>
                <div className="font-serif text-2xl text-gold">{stat.value}</div>
                <div className="text-white/60 text-sm mt-0.5">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Scroll hint */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-white/40">
        <span className="text-xs tracking-widest uppercase">Scroll</span>
        <div className="w-px h-8 bg-white/30 animate-pulse" />
      </div>
    </section>
  )
}
