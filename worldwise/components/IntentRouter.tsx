'use client'

import Link from 'next/link'
import { useState } from 'react'
import QualifyingModal from './QualifyingModal'

export default function IntentRouter() {
  const [open, setOpen] = useState(false)
  const card = 'flex flex-col items-center text-center gap-2 bg-white rounded-sm border border-gray-200 px-4 py-6 hover:border-gold hover:shadow-md transition-all'
  return (
    <section className="bg-[#F8F8F6] py-10 md:py-12">
      <div className="max-w-6xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-5">
        <Link href="/properties" className={card}>
          <span className="text-3xl">🏙</span>
          <span className="font-serif text-lg text-navy">Browse Properties</span>
          <span className="text-xs text-gray-500">Explore our Dubai portfolio</span>
        </Link>
        <button type="button" onClick={() => setOpen(true)} className={card}>
          <span className="text-3xl">🎯</span>
          <span className="font-serif text-lg text-navy">Find My Property</span>
          <span className="text-xs text-gray-500">Matched to your budget</span>
        </button>
        <Link href="/mortgage-calculator" className={card}>
          <span className="text-3xl">📊</span>
          <span className="font-serif text-lg text-navy">Mortgage Calculator</span>
          <span className="text-xs text-gray-500">Estimate monthly payments</span>
        </Link>
        <Link href="/golden-visa" className={card}>
          <span className="text-3xl">🛂</span>
          <span className="font-serif text-lg text-navy">Golden Visa</span>
          <span className="text-xs text-gray-500">10-year UAE residency</span>
        </Link>
      </div>
      <QualifyingModal isOpen={open} onClose={() => setOpen(false)} source="qualify" />
    </section>
  )
}
