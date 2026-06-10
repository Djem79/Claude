'use client'

import { useState } from 'react'
import { useLeadSubmit } from '@/lib/useLeadSubmit'
import Honeypot from '@/components/Honeypot'
import AdvisorCard from '@/components/AdvisorCard'

const INSIDE = [
  'Real rental yields by district — what to actually expect in 2026',
  'The buying process for non-residents, step by step',
  'Full cost breakdown: DLD fees, agent commission and hidden extras',
  'How property buyers qualify for the 10-year Golden Visa',
  'A getting-started checklist to make your first investment',
]

export default function GuideClient() {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const { hpRef, loading, success, error, submit } = useLeadSubmit({
    source: 'lead_magnet_guide',
    failError: 'Something went wrong. Please try again or message us on WhatsApp.',
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await submit({ name, phone })
  }

  return (
    <section className="bg-navy pt-32 pb-20">
      <div className="max-w-6xl mx-auto px-6 grid lg:grid-cols-2 gap-12 items-center">
        {/* Value prop */}
        <div>
          <p className="text-gold text-sm font-medium uppercase tracking-widest mb-3">
            Free Download · 2026 Edition
          </p>
          <h1 className="font-serif text-4xl md:text-5xl text-white leading-tight mb-5">
            Download the free 2026 Dubai Investment Guide
          </h1>
          <p className="text-white/60 text-lg mb-8">
            Everything an international investor needs to buy Dubai property with confidence —
            written by RERA-certified advisors. Enter your details and download instantly.
          </p>
          <ul className="space-y-3">
            {INSIDE.map(item => (
              <li key={item} className="flex items-start gap-3 text-white/80">
                <span className="text-gold mt-0.5 shrink-0">✓</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <AdvisorCard className="mt-10" />
        </div>

        {/* Gated form card */}
        <div className="bg-white rounded-sm shadow-2xl p-8">
          {success ? (
            <div className="text-center py-2">
              <div className="text-4xl mb-4">✓</div>
              <h2 className="font-serif text-2xl text-navy mb-2">Your guide is ready</h2>
              <p className="text-gray-500 text-sm mb-6">
                Thank you, {name.trim().split(' ')[0]}. Tap below to open your free guide.
              </p>
              <a
                href="/dubai-investment-guide.pdf"
                target="_blank"
                rel="noopener"
                download
                className="btn-primary w-full block text-center"
              >
                Download the Guide (PDF)
              </a>
              <a
                href="https://t.me/WorldwisePro"
                target="_blank"
                rel="noopener noreferrer"
                className="block mt-4 w-full text-center rounded-sm py-3 px-4 text-sm font-medium bg-[#229ED9]/10 border border-[#229ED9]/30 text-[#229ED9] hover:bg-[#229ED9]/20 transition-colors"
              >
                Bonus: subscribe to our Telegram channel →
              </a>
              <p className="text-xs text-gray-400 mt-1">New off-plan and weekly market analytics</p>
            </div>
          ) : (
            <>
              <h2 className="font-serif text-2xl text-navy mb-1">Get your free copy</h2>
              <p className="text-gray-500 text-sm mb-6">
                Enter your name and phone — your download unlocks instantly.
              </p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <Honeypot hpRef={hpRef} />
                <input
                  className="input-field"
                  placeholder="Full Name *"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                />
                <input
                  className="input-field"
                  placeholder="WhatsApp / Phone *"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  required
                />

                {error && <p className="text-red-500 text-sm">{error}</p>}

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary w-full disabled:opacity-60"
                >
                  {loading ? 'Sending...' : 'Get the Free Guide'}
                </button>

                <p className="text-xs text-gray-400 text-center">
                  No spam. We&apos;ll only use this to send your guide and follow up.
                </p>
              </form>
            </>
          )}
        </div>
      </div>
    </section>
  )
}
