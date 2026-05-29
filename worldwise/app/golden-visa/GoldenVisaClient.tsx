'use client'

import { useState, ReactNode } from 'react'
import Image from 'next/image'
import LeadModal from '@/components/LeadModal'
import MobileCtaBar from '@/components/MobileCtaBar'
import { GOLDEN_VISA_AED } from '@/lib/golden-visa'

const SOURCE = 'golden_visa'
const WA_MESSAGE =
  'Hi Worldwise, am I eligible for the UAE Golden Visa through property investment?'

export default function GoldenVisaClient({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <section
        className="relative h-[72vh] min-h-[540px] w-full flex items-end overflow-hidden"
        aria-label="Dubai Golden Visa through property investment"
      >
        <Image
          src="/images/hero-dubai.jpg"
          alt="Dubai skyline"
          fill
          priority
          className="object-cover"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-navy via-navy/60 to-navy/20" />

        <div className="relative max-w-7xl mx-auto px-6 pb-16 md:pb-24 w-full">
          <p className="text-gold text-sm font-medium uppercase tracking-widest mb-3">
            Dubai · UAE Residency
          </p>
          <h1 className="font-serif text-white text-4xl md:text-6xl leading-tight max-w-3xl">
            Own Dubai property from AED 2M — get a 10-year UAE Golden Visa.
          </h1>
          <p className="text-white/80 text-lg md:text-xl mt-4 max-w-2xl leading-relaxed">
            A renewable 10-year residency for international investors and their
            families — secured through a single qualifying property purchase, with
            no local sponsor required.
          </p>

          <div className="mt-10 flex flex-wrap gap-3">
            <button onClick={() => setOpen(true)} className="btn-primary">
              Check Your Eligibility
            </button>
            <a href="#eligible-listings" className="btn-outline-gold">
              See Qualifying Properties
            </a>
          </div>
        </div>
      </section>

      {children}

      <LeadModal
        isOpen={open}
        onClose={() => setOpen(false)}
        source={SOURCE}
        title="Check your Golden Visa eligibility"
        subtitle={`Tell us your budget — we'll confirm whether you qualify for the 10-year UAE Golden Visa (from AED ${(GOLDEN_VISA_AED / 1_000_000).toFixed(0)}M).`}
      />
      <MobileCtaBar
        enquireSource={SOURCE}
        enquireLabel="Check Eligibility"
        waMessage={WA_MESSAGE}
      />
    </>
  )
}
