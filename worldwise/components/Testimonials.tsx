'use client'

import { useState } from 'react'

const testimonials = [
  {
    name: 'James H.',
    country: 'London, UK',
    deal: 'Business Bay apartment — AED 1.4M',
    text: 'I was looking to diversify outside the UK property market. Worldwise found me an off-plan apartment in Business Bay with 8.5% projected ROI. The whole process — from first call to signing — took less than 3 weeks. Exceptional team.',
    stars: 5,
  },
  {
    name: 'Priya S.',
    country: 'Mumbai, India',
    deal: 'JLT apartment — AED 2.1M',
    text: 'As an NRI investor, I was worried about the legal process and trust. Worldwise guided me through every step, handled the DLD registration remotely and even helped me set up the rental management. Highly recommend.',
    stars: 5,
  },
  {
    name: 'Markus W.',
    country: 'Frankfurt, Germany',
    deal: 'Dubai Marina penthouse — AED 5.8M',
    text: 'What impressed me most was their market knowledge. They didn\'t just sell me a listing — they explained the yield potential, resale dynamics and neighbourhood growth projections. A genuinely data-driven team.',
    stars: 5,
  },
  {
    name: 'Ahmed Al F.',
    country: 'Riyadh, KSA',
    deal: 'Creek Harbour — 2 units — AED 4.1M total',
    text: 'I\'ve worked with several agencies in Dubai. Worldwise stands out for their follow-through. Even after the sale closed they assisted with furnishing, DEWA setup and finding tenants. Truly full-service.',
    stars: 5,
  },
]

export default function Testimonials() {
  const [current, setCurrent] = useState(0)
  const t = testimonials[current]

  return (
    <section className="py-20 bg-white">
      <div className="max-w-4xl mx-auto px-6 text-center">
        <p className="text-gold-accessible text-sm font-medium uppercase tracking-widest mb-2">
          Client Stories
        </p>
        <h2 className="section-title mb-12">What Our Investors Say</h2>

        <div className="bg-[#F8F8F6] rounded-sm p-10 md:p-14 transition-all duration-300">
          <div className="flex justify-center gap-1 mb-6">
            {Array.from({ length: t.stars }).map((_, i) => (
              <span key={i} className="text-gold-accessible text-xl">★</span>
            ))}
          </div>

          <blockquote className="font-serif text-xl md:text-2xl text-navy leading-relaxed italic mb-8">
            &ldquo;{t.text}&rdquo;
          </blockquote>

          <div className="flex flex-col items-center gap-1">
            <p className="font-semibold text-navy">{t.name}</p>
            <p className="text-gray-500 text-sm">{t.country}</p>
            <p className="text-gold-accessible text-xs font-medium uppercase tracking-wide mt-1">{t.deal}</p>
          </div>
        </div>

        {/* Dots */}
        <div className="flex justify-center gap-2.5 mt-8">
          {testimonials.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`w-2 h-2 rounded-full transition-all ${
                i === current ? 'bg-gold w-6' : 'bg-gray-300'
              }`}
            />
          ))}
        </div>

        <p className="text-gray-400 text-sm mt-6">
          ★ 5.0 · Rated on Google Reviews
        </p>
      </div>
    </section>
  )
}
