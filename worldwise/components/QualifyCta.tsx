'use client'

import { useState } from 'react'
import QualifyingModal from './QualifyingModal'

export default function QualifyCta() {
  const [open, setOpen] = useState(false)

  return (
    <section className="bg-navy py-16 md:py-20">
      <div className="max-w-3xl mx-auto px-6 text-center">
        <h2 className="font-serif text-3xl md:text-4xl text-white mb-3">
          Not sure where to start?
        </h2>
        <p className="text-gray-300 mb-8">
          Answer 3 quick questions and we&apos;ll match you with the right Dubai investment.
        </p>
        <button onClick={() => setOpen(true)} className="btn-primary">
          Find My Investment →
        </button>
      </div>

      <QualifyingModal isOpen={open} onClose={() => setOpen(false)} source="qualify" />
    </section>
  )
}
