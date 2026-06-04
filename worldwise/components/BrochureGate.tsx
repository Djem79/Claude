'use client'

import { useState, useRef } from 'react'
import { track } from '@/lib/analytics'

export default function BrochureGate({
  propertyId,
  propertySlug,
  propertyTitle,
}: {
  propertyId: string
  propertySlug: string
  propertyTitle: string
}) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const hpRef = useRef<HTMLInputElement>(null)

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
        body: JSON.stringify({
          name,
          phone,
          source: 'brochure_request',
          propertySlug,
          propertyTitle,
          _hp: hpRef.current?.value ?? '',
        }),
      })
      if (!res.ok) throw new Error('Failed')
      setSuccess(true)
      track('lead_form_submit', { source: 'brochure_request', property: propertyTitle })
    } catch {
      setError('Something went wrong. Please try again or message us on WhatsApp.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="border border-gray-200 rounded-sm p-5 bg-white">
      <p className="font-serif text-lg text-navy">Project brochure</p>
      <p className="text-gray-500 text-sm mt-1 mb-4">
        Full floor plans, payment plan and finishes — PDF.
      </p>

      {success ? (
        <a
          href={`/api/properties/${propertyId}/brochure`}
          target="_blank"
          rel="noopener"
          download
          className="btn-primary w-full block text-center"
        >
          Download PDF
        </a>
      ) : open ? (
        <form onSubmit={handleSubmit} className="space-y-3">
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
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button type="submit" disabled={loading} className="btn-primary w-full disabled:opacity-60">
            {loading ? 'Sending...' : 'Get brochure'}
          </button>
          <p className="text-xs text-gray-400 text-center">Your download unlocks instantly.</p>
        </form>
      ) : (
        <button onClick={() => setOpen(true)} className="btn-primary w-full">
          Download brochure (PDF)
        </button>
      )}
    </div>
  )
}
