'use client'

import { useState } from 'react'
import { useLeadSubmit } from '@/lib/useLeadSubmit'
import Honeypot from '@/components/Honeypot'

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
  const { hpRef, loading, success, error, submit } = useLeadSubmit({
    source: 'brochure_request',
    trackParams: { property: propertyTitle },
    failError: 'Something went wrong. Please try again or message us on WhatsApp.',
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await submit({ name, phone, propertySlug, propertyTitle })
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
