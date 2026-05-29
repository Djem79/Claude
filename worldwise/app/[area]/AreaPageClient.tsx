'use client'

import { useState, ReactNode } from 'react'
import AreaHero from '@/components/AreaHero'
import LeadModal from '@/components/LeadModal'
import MobileCtaBar from '@/components/MobileCtaBar'
import type { Area } from '@/lib/areas'

type Props = {
  area: Area
  listingCount: number
  children: ReactNode
}

export default function AreaPageClient({ area, listingCount, children }: Props) {
  const [open, setOpen] = useState(false)
  const leadSource = `area_${area.slug.replace(/-/g, '_')}`

  return (
    <>
      <AreaHero area={area} listingCount={listingCount} onCtaClick={() => setOpen(true)} />
      {children}
      <LeadModal
        isOpen={open}
        onClose={() => setOpen(false)}
        source={leadSource}
        title={`Investing in ${area.name}?`}
        subtitle="Tell us what you're looking for — we'll send curated options within 24 hours."
      />
      <MobileCtaBar
        enquireSource={`area_${area.slug.replace(/-/g, '_')}`}
        enquireLabel={`Invest in ${area.name}`}
        waMessage={`Hi Worldwise, I'm interested in investing in ${area.name}, Dubai.`}
      />
    </>
  )
}
