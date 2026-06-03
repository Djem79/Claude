'use client'

import { useState } from 'react'
import LeadModal from './LeadModal'

// Desktop-only centered sticky pill (bottom-center) — leaves the bottom-right
// corner free for FloatingCTA (fixed bottom-6 right-6 z-40). z-30 keeps it below.
export default function MortgageAnchorBar({
  monthlyLabel,
  propertySlug,
  propertyTitle,
}: {
  monthlyLabel: string
  propertySlug?: string
  propertyTitle?: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <div className="hidden md:flex fixed bottom-6 left-1/2 -translate-x-1/2 z-30 items-center gap-4 bg-navy/95 backdrop-blur border border-gold/25 shadow-xl rounded-full pl-6 pr-2 py-2 text-white">
        <p className="text-sm whitespace-nowrap">
          Own this from <span className="font-serif text-gold text-lg">{monthlyLabel}</span>/mo
          <span className="text-white/45"> · 25% down · 4.5% · 25 yrs</span>
        </p>
        <button onClick={() => setOpen(true)} className="btn-primary py-2 px-5 text-sm rounded-full">
          Get pre-approved
        </button>
      </div>
      <LeadModal
        isOpen={open}
        onClose={() => setOpen(false)}
        source="mortgage_anchor"
        propertySlug={propertySlug}
        propertyTitle={propertyTitle}
        title="Get mortgage pre-approval"
        subtitle="Our advisors work with 15+ UAE banks to find your best rate."
        ctaLabel="Request pre-approval"
      />
    </>
  )
}
