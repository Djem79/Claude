'use client'

import { useState, useEffect, useRef } from 'react'

interface Props {
  isOpen: boolean
  onClose: () => void
  source: string
  title?: string
  subtitle?: string
  propertySlug?: string
  propertyTitle?: string
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
}: Props) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [budget, setBudget] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const hpRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

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
      <div className="relative bg-white rounded-sm shadow-2xl w-full max-w-md p-8">
        <button
          onClick={onClose}
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
            <button onClick={onClose} className="btn-primary mt-6 w-full">
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
              <input ref={hpRef} type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position: 'absolute', left: '-9999px', opacity: 0 }} />
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
                {loading ? 'Sending...' : 'Request Consultation'}
              </button>

              <p className="text-xs text-gray-400 text-center">
                🔒 No spam. No obligation. We reply within 2 hours.
              </p>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
