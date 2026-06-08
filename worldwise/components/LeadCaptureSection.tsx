'use client'

import { useState, useRef } from 'react'
import { track } from '@/lib/analytics'
import { getStoredAttribution } from '@/lib/utm'
import SocialProofStrip from './SocialProofStrip'

const BUDGETS = [
  'Under AED 1M',
  'AED 1M – 3M',
  'AED 3M – 7M',
  'AED 7M – 15M',
  'Above AED 15M',
]

interface LeadCaptureSectionProps {
  source?: string
}

export default function LeadCaptureSection({ source = 'lead_capture_section' }: LeadCaptureSectionProps) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [budget, setBudget] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const hpRef = useRef<HTMLInputElement>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !phone.trim()) {
      setError('Please enter your name and phone number.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, budget, source, ...getStoredAttribution(), _hp: hpRef.current?.value ?? '' }),
      })
      if (!res.ok) throw new Error()
      setSuccess(true)
      track('lead_form_submit', { source })
    } catch {
      setError('Something went wrong. Please contact us via WhatsApp.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section id="contact" className="py-20 bg-navy">
      <div className="max-w-2xl mx-auto px-6 text-center">
        <div className="mb-10">
          <SocialProofStrip dark />
        </div>
        <p className="text-gold text-sm font-medium uppercase tracking-widest mb-3">
          Get Started Today
        </p>
        <h2 className="font-serif text-4xl md:text-5xl text-white mb-3">
          Ready to Invest in Dubai?
        </h2>
        <p className="text-white/60 text-lg mb-10">
          Get a free consultation. We&apos;ll match you with the best properties for your goals and budget.
        </p>

        {success ? (
          <div className="bg-white/10 border border-gold/30 rounded-sm px-8 py-10">
            <div className="text-4xl mb-3">✓</div>
            <h3 className="font-serif text-2xl text-gold mb-2">Thank You, {name}!</h3>
            <p className="text-white/70">
              We&apos;ll be in touch within 2 hours via WhatsApp or email.
            </p>
            <a
              href="https://t.me/WorldwisePro"
              target="_blank"
              rel="noopener noreferrer"
              className="block mt-6 w-full text-center rounded-sm py-3 px-4 text-sm font-medium bg-[#229ED9]/15 border border-[#229ED9]/40 text-[#229ED9] hover:bg-[#229ED9]/25 transition-colors"
            >
              Bonus: our Telegram channel →
            </a>
            <p className="text-white/40 text-xs mt-2">Off-plan before public sales, market analytics, weekly case studies</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-white/5 border border-white/10 rounded-sm p-8 space-y-4 text-left">
            {/* Honeypot — hidden from users, visible to bots */}
            <input ref={hpRef} type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position: 'absolute', width: '1px', height: '1px', margin: '-1px', padding: 0, overflow: 'hidden', clip: 'rect(0,0,0,0)', border: 0 }} />
            <div className="grid md:grid-cols-2 gap-4">
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
            </div>
            <select
              className="input-field"
              value={budget}
              onChange={e => setBudget(e.target.value)}
            >
              <option value="">Your Investment Budget</option>
              {BUDGETS.map(b => <option key={b} value={b}>{b}</option>)}
            </select>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full text-center text-base disabled:opacity-60"
            >
              {loading ? 'Sending...' : 'Request Free Consultation'}
            </button>

            <p className="text-white/30 text-xs text-center">
              Your data is safe. No spam. No obligation. We reply within 2 hours.
            </p>
          </form>
        )}

        <div className="flex flex-wrap justify-center gap-8 mt-12 pt-10 border-t border-white/10 text-white/60 text-sm">
          <a
            href={`https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP ?? '971506960435'}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-white transition-colors"
          >
            WhatsApp
          </a>
          <a href="tel:+971506960435" className="hover:text-white transition-colors">
            +971 50 696 0435
          </a>
          <a href="mailto:info@worldwise.pro" className="hover:text-white transition-colors">
            info@worldwise.pro
          </a>
        </div>
      </div>
    </section>
  )
}
