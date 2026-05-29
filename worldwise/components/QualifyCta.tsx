'use client'

import { useState } from 'react'
import QualifyingModal from './QualifyingModal'

export default function QualifyCta() {
  const [open, setOpen] = useState(false)

  return (
    <section className="bg-[#F8F8F6] py-16 md:py-20">
      <div className="max-w-4xl mx-auto px-6">
        <div className="bg-navy rounded-lg border border-gold/25 shadow-xl px-8 py-12 md:py-14 text-center">
          <p className="text-gold text-xs font-medium uppercase tracking-widest mb-3">
            Free Matching Service
          </p>
          <h2 className="font-serif text-3xl md:text-4xl text-white mb-3">
            Not sure where to start?
          </h2>
          <p className="text-gray-300 mb-8 max-w-xl mx-auto">
            Answer 3 quick questions and we&apos;ll match you with the right Dubai investment.
          </p>
          <button onClick={() => setOpen(true)} className="btn-primary">
            Find My Investment →
          </button>
        </div>
      </div>

      <QualifyingModal isOpen={open} onClose={() => setOpen(false)} source="qualify" />
    </section>
  )
}
