'use client'

import { useState, useEffect, useRef } from 'react'
import { track } from '@/lib/analytics'
import { waLink, waPropertyMessage } from '@/lib/whatsapp'
import { useFocusTrap } from '@/lib/useFocusTrap'

interface Props {
  isOpen: boolean
  onClose: () => void
  source: string
  title?: string
  subtitle?: string
  propertySlug?: string
  propertyTitle?: string
  ctaLabel?: string
}

const BUDGETS = [
  'Under AED 1M',
  'AED 1M – 3M',
  'AED 3M – 7M',
  'AED 7M – 15M',
  'Above AED 15M',
]

export default function LeadModal({
  isOpen,
  onClose,
  source,
  title = 'Request Free Consultation',
  subtitle = 'Our experts will contact you within 2 hours.',
  propertySlug,
  propertyTitle,
  ctaLabel = 'Request Consultation',
}: Props) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [budget, setBudget] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const hpRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  // Accessibility: trap focus, Escape-to-close, focus first field (audit Low — modal a11y).
  useFocusTrap(panelRef, isOpen, onClose, [success])

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
        body: JSON.stringify({ name, phone, email, budget, source, propertySlug, propertyTitle, _hp: hpRef.current?.value ?? '' }),
      })
      if (!res.ok) throw new Error('Failed')
      setSuccess(true)
      track('lead_form_submit', { source, ...(propertyTitle ? { property: propertyTitle } : {}) })
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
        aria-label={title}
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
              Bonus: subscribe to Telegram «Смотрим Дубай» →
            </a>
            <p className="text-xs text-gray-400 mt-1">New off-plan and weekly market analytics</p>
            <button onClick={onClose} className="btn-primary mt-4 w-full">
              Close
            </button>
          </div>
        ) : (
          <>
            <h3 className="font-serif text-2xl text-navy mb-1">{title}</h3>
            <p className="text-gray-500 text-sm mb-6">{subtitle}</p>

            {propertyTitle && (
              <div className="bg-gray-50 rounded-sm px-4 py-3 text-sm text-navy font-medium mb-5">
                Re: {propertyTitle}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <input ref={hpRef} type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position: 'absolute', width: '1px', height: '1px', margin: '-1px', padding: 0, overflow: 'hidden', clip: 'rect(0,0,0,0)', border: 0 }} />
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
              <input
                className="input-field"
                placeholder="Email (optional)"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
              <select
                className="input-field"
                value={budget}
                onChange={e => setBudget(e.target.value)}
              >
                <option value="">Investment Budget (optional)</option>
                {BUDGETS.map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>

              {error && <p className="text-red-500 text-sm">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full disabled:opacity-60"
              >
                {loading ? 'Sending...' : ctaLabel}
              </button>

              <p className="text-xs text-gray-400 text-center">
                No spam. No obligation. We reply within 2 hours.
              </p>

              <a
                href={waLink(propertyTitle ? waPropertyMessage(propertyTitle) : "Hi Worldwise, I'd like a consultation about Dubai property.")}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => track('whatsapp_click', { source, ...(propertyTitle ? { property: propertyTitle } : {}) })}
                className="flex items-center justify-center gap-2 w-full rounded-sm py-3 text-sm font-medium border border-[#25D366] text-[#177d3c] hover:bg-[#25D366]/10 transition-colors"
              >
                Or message us on WhatsApp
              </a>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
