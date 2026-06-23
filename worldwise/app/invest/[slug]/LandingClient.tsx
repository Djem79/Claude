'use client'

import { useState } from 'react'
import LeadModal from '@/components/LeadModal'
import MobileCtaBar from '@/components/MobileCtaBar'
import AreaFeaturedProperties from '@/components/AreaFeaturedProperties'
import type { Landing } from '@/lib/landings'
import type { Property } from '@/types'

type Props = {
  landing: Landing
  properties: Property[]
}

export default function LandingClient({ landing, properties }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* Hero */}
      <section className="bg-navy pt-32 pb-20">
        <div className="max-w-3xl mx-auto px-6">
          <p className="text-gold text-sm font-medium uppercase tracking-widest mb-3">
            Dubai · Investment Guide
          </p>
          <h1 className="font-serif text-white text-4xl md:text-6xl leading-tight">
            {landing.h1}
          </h1>
          <p className="text-white/75 text-lg md:text-xl mt-6 leading-relaxed max-w-2xl">
            {landing.intro}
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <button onClick={() => setOpen(true)} className="btn-primary">
              Get Free Consultation
            </button>
            <a href="#featured" className="btn-outline-gold">
              See Properties
            </a>
          </div>
        </div>
      </section>

      {/* Content sections */}
      {landing.sections.map((section, i) => (
        <section
          key={i}
          className={`py-16 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
        >
          <div className="max-w-3xl mx-auto px-6">
            <h2 className="font-serif text-2xl md:text-3xl text-navy mb-6 leading-tight">
              {section.h2}
            </h2>

            {/* Body paragraphs — split on blank lines */}
            <div className="space-y-5 text-gray-700 leading-relaxed text-lg">
              {section.body.split('\n\n').map((para, j) => (
                <p key={j} className="max-w-[68ch]">{para}</p>
              ))}
            </div>

            {/* Optional comparison table */}
            {section.table && section.table.length > 0 && (
              <div className="mt-8 overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr>
                      {section.table[0].map((cell, k) => (
                        <th
                          key={k}
                          className="bg-navy text-white text-left px-4 py-3 font-medium tracking-wide whitespace-nowrap"
                        >
                          {cell}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {section.table.slice(1).map((row, ri) => (
                      <tr
                        key={ri}
                        className={ri % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                      >
                        {row.map((cell, ci) => (
                          <td
                            key={ci}
                            className="px-4 py-3 border-b border-gray-100 text-gray-700 whitespace-nowrap"
                          >
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      ))}

      {/* Property grid */}
      <AreaFeaturedProperties
        areaName="Dubai"
        properties={properties}
        heading={landing.gridHeading}
      />

      {/* FAQ */}
      <section className="py-20 bg-white">
        <div className="max-w-3xl mx-auto px-6">
          <div className="text-center mb-12">
            <p className="text-gold-accessible text-sm font-medium uppercase tracking-widest mb-2">
              FAQ
            </p>
            <h2 className="section-title">Frequently Asked Questions</h2>
            <p className="section-subtitle">
              The questions our clients ask most often.
            </p>
          </div>

          <div className="space-y-3">
            {landing.faq.map((item, i) => (
              <details
                key={i}
                className="group border border-gray-200 rounded-sm bg-white open:shadow-sm"
              >
                <summary className="cursor-pointer list-none px-5 py-4 flex justify-between items-center gap-4 hover:bg-gray-50 transition-colors">
                  <span className="font-serif text-navy text-lg leading-snug">{item.q}</span>
                  <span className="text-gold-accessible text-2xl leading-none group-open:rotate-45 transition-transform">
                    +
                  </span>
                </summary>
                <div className="px-5 pb-5 -mt-1">
                  <p className="text-gray-600 leading-relaxed">{item.a}</p>
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Mid-page CTA band */}
      <section className="py-14 bg-gray-50 border-t border-gray-200">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <h2 className="font-serif text-2xl md:text-3xl text-navy mb-4">
            Ready to take the next step?
          </h2>
          <p className="text-gray-600 text-lg mb-8">
            Our licensed advisors can guide you through every stage — from shortlisting
            properties to completing the DLD transfer.
          </p>
          <button
            onClick={() => setOpen(true)}
            className="btn-primary text-base px-10 py-3"
          >
            Request Free Consultation
          </button>
        </div>
      </section>

      {/* LeadModal */}
      <LeadModal
        isOpen={open}
        onClose={() => setOpen(false)}
        source={landing.leadSource}
        title="Speak to a Dubai Advisor"
        subtitle="Tell us your goals and budget — we'll match you with the right properties within 24 hours."
      />

      {/* Mobile sticky bar */}
      <MobileCtaBar
        enquireSource={landing.leadSource}
        enquireLabel="Get Free Consultation"
        waMessage={`Hi Worldwise, I'm interested in buying an apartment in Dubai and would like some advice.`}
      />
    </>
  )
}
