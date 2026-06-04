'use client'

import { useState, ReactNode } from 'react'
import LeadModal from '@/components/LeadModal'
import MobileCtaBar from '@/components/MobileCtaBar'
import type { Developer } from '@/lib/developers'

export default function DeveloperPageClient({
  developer,
  listingCount,
  children,
}: {
  developer: Developer
  listingCount: number
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const source = `developer_${developer.slug.replace(/-/g, '_')}`
  return (
    <>
      <section className="pt-32 pb-14 bg-navy text-white">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <p className="text-gold text-sm font-medium uppercase tracking-widest mb-3">Developer</p>
          <h1 className="font-serif text-4xl md:text-5xl mb-4">{developer.name}</h1>
          <p className="text-gray-300 max-w-2xl mx-auto leading-relaxed">{developer.blurb}</p>
          <p className="text-gray-400 text-sm mt-4">
            {listingCount} {listingCount === 1 ? 'property' : 'properties'} available
          </p>
          <button onClick={() => setOpen(true)} className="btn-primary mt-6">
            Request {developer.name} availability
          </button>
        </div>
      </section>
      {children}
      <LeadModal
        isOpen={open}
        onClose={() => setOpen(false)}
        source={source}
        title={`Interested in ${developer.name}?`}
        subtitle="Tell us what you're looking for — we'll send curated options within 24 hours."
      />
      <MobileCtaBar
        enquireSource={source}
        enquireLabel={`Enquire about ${developer.name}`}
        waMessage={`Hi Worldwise, I'm interested in ${developer.name} projects in Dubai.`}
      />
    </>
  )
}
