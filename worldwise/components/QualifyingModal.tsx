'use client'

import { useState, useEffect, useRef } from 'react'
import { track } from '@/lib/analytics'
import { getStoredAttribution } from '@/lib/utm'
import { waLink } from '@/lib/whatsapp'
import { areas } from '@/lib/areas'
import { useFocusTrap } from '@/lib/useFocusTrap'

interface Props {
  isOpen: boolean
  onClose: () => void
  source: string
}

const BUDGETS = [
  'Under AED 1M',
  'AED 1M – 3M',
  'AED 3M – 7M',
  'AED 7M – 15M',
  'Above AED 15M',
]

const PROPERTY_TYPES = ['Ready', 'Off-plan']

const AREA_NAMES = areas.map(a => a.name)

export default function QualifyingModal({ isOpen, onClose, source }: Props) {
  const [step, setStep] = useState(1)
  const [budget, setBudget] = useState('')
  const [propertyType, setPropertyType] = useState('')
  const [area, setArea] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const hpRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      setStep(1)
      setSuccess(false)
      setError('')
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  // Accessibility: trap focus, Escape-to-close, focus first field. Re-runs per step
  // since the focusable set changes (audit Low — modal a11y).
  useFocusTrap(panelRef, isOpen, onClose, [step, success])

  if (!isOpen) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !phone.trim()) {
      setError('Please fill in your name and phone number.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, source, budget, propertyType, area, ...getStoredAttribution(), _hp: hpRef.current?.value ?? '' }),
      })
      if (!res.ok) throw new Error('Failed')
      setSuccess(true)
      track('lead_form_submit', { source })
    } catch {
      setError('Something went wrong. Please try WhatsApp instead.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="absolute inset-0 bg-navy/80 backdrop-blur-sm" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Find your Dubai investment"
        className="relative bg-white rounded-sm shadow-2xl w-full max-w-md p-8"
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 text-gray-400 hover:text-navy text-xl leading-none"
        >
          ✕
        </button>

        {success ? (
          <div className="text-center py-6">
            <div className="text-4xl mb-4">✓</div>
            <h3 className="font-serif text-2xl text-navy mb-2">Thank You!</h3>
            <p className="text-gray-500">
              We&apos;ve received your request and will contact you within 2 hours.
            </p>
            <a
              href="https://t.me/WorldwisePro"
              target="_blank"
              rel="noopener noreferrer"
              className="block mt-5 w-full text-center rounded-sm py-3 px-4 text-sm font-medium bg-[#229ED9]/10 border border-[#229ED9]/30 text-[#229ED9] hover:bg-[#229ED9]/20 transition-colors"
            >
              Bonus: subscribe to our Telegram channel →
            </a>
            <p className="text-xs text-gray-400 mt-1">New off-plan and weekly market analytics</p>
            <button onClick={onClose} className="btn-primary mt-4 w-full">
              Close
            </button>
          </div>
        ) : (
          <>
            <p className="text-xs font-medium uppercase tracking-wide text-gold-accessible mb-1">
              Step {step} of 3
            </p>
            <div className="flex gap-1.5 mb-6">
              {[1, 2, 3].map(n => (
                <div
                  key={n}
                  className={`h-1 flex-1 rounded-full ${n <= step ? 'bg-gold' : 'bg-gray-200'}`}
                />
              ))}
            </div>

            {/* Honeypot — present on every step's form via the contact form below;
                kept mounted here so it always submits. */}
            <input ref={hpRef} type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position: 'absolute', width: '1px', height: '1px', margin: '-1px', padding: 0, overflow: 'hidden', clip: 'rect(0,0,0,0)', border: 0 }} />

            {step === 1 && (
              <>
                <h3 className="font-serif text-2xl text-navy mb-1">What&apos;s your budget?</h3>
                <p className="text-gray-500 text-sm mb-6">Helps us match the right opportunities. Optional.</p>
                <div className="space-y-2">
                  {BUDGETS.map(b => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => { setBudget(b); setStep(2) }}
                      className={`w-full text-left rounded-sm border px-4 py-3 text-sm transition-colors ${
                        budget === b
                          ? 'border-gold bg-gold/10 text-navy font-medium'
                          : 'border-gray-200 text-navy hover:border-gold'
                      }`}
                    >
                      {b}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="btn-primary w-full mt-6"
                >
                  Next →
                </button>
              </>
            )}

            {step === 2 && (
              <>
                <h3 className="font-serif text-2xl text-navy mb-1">What are you looking for?</h3>
                <p className="text-gray-500 text-sm mb-6">Pick a type and area. Optional.</p>
                <div className="grid grid-cols-2 gap-2 mb-4">
                  {PROPERTY_TYPES.map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setPropertyType(propertyType === t ? '' : t)}
                      className={`rounded-sm border px-4 py-3 text-sm transition-colors ${
                        propertyType === t
                          ? 'border-gold bg-gold/10 text-navy font-medium'
                          : 'border-gray-200 text-navy hover:border-gold'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                <select
                  className="input-field"
                  value={area}
                  onChange={e => setArea(e.target.value)}
                >
                  <option value="">No preference (area)</option>
                  {AREA_NAMES.map(a => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
                <div className="flex gap-3 mt-6">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="btn-outline flex-1"
                  >
                    ← Back
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className="btn-primary flex-1"
                  >
                    Next →
                  </button>
                </div>
              </>
            )}

            {step === 3 && (
              <>
                <h3 className="font-serif text-2xl text-navy mb-1">Where should we send your matches?</h3>
                <p className="text-gray-500 text-sm mb-6">Our experts will contact you within 2 hours.</p>
                <form onSubmit={handleSubmit} className="space-y-4">
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

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      className="btn-outline flex-1"
                    >
                      ← Back
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="btn-primary flex-1 disabled:opacity-60"
                    >
                      {loading ? 'Sending...' : 'Get My Matches'}
                    </button>
                  </div>

                  <p className="text-xs text-gray-400 text-center">
                    No spam. No obligation. We reply within 2 hours.
                  </p>

                  <a
                    href={waLink("Hi Worldwise, I'd like help finding a Dubai investment.")}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => track('whatsapp_click', { source })}
                    className="flex items-center justify-center gap-2 w-full rounded-sm py-3 text-sm font-medium border border-[#25D366] text-[#177d3c] hover:bg-[#25D366]/10 transition-colors"
                  >
                    Or message us on WhatsApp
                  </a>
                </form>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
