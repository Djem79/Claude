'use client'

import { useState } from 'react'
import { useLeadSubmit } from '@/lib/useLeadSubmit'
import Honeypot from '@/components/Honeypot'

export default function FloorPlanGate({
  floorPlans,
  propertySlug,
  propertyTitle,
}: {
  floorPlans: string[]
  propertySlug: string
  propertyTitle: string
}) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [open, setOpen] = useState(false)
  const { hpRef, loading, success, error, submit } = useLeadSubmit({
    source: 'floor_plan',
    trackParams: { property: propertyTitle },
    failError: 'Something went wrong. Please try again or message us on WhatsApp.',
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await submit({ name, phone, propertySlug, propertyTitle })
  }

  return (
    <div className="border border-gray-200 rounded-sm p-5 bg-white">
      <p className="font-serif text-lg text-navy">Floor plans &amp; site plans</p>
      <p className="text-gray-500 text-sm mt-1 mb-4">
        {floorPlans.length} layout{floorPlans.length > 1 ? 's' : ''} available — enter your details to view.
      </p>

      <div className="grid grid-cols-3 gap-2 mb-4">
        {floorPlans.map((src, i) => (
          success ? (
            <a key={i} href={src} target="_blank" rel="noopener" className="block aspect-square overflow-hidden rounded-sm border border-gray-100">
              <img src={src} alt={`Floor plan ${i + 1}`} className="w-full h-full object-cover" />
            </a>
          ) : (
            <div key={i} className="aspect-square overflow-hidden rounded-sm border border-gray-100 bg-gray-50">
              <img
                src={src}
                alt=""
                aria-hidden="true"
                draggable={false}
                className="w-full h-full object-cover select-none"
                style={{ filter: 'blur(8px)', pointerEvents: 'none', transform: 'scale(1.1)' }}
              />
            </div>
          )
        ))}
      </div>

      {success ? (
        <p className="text-sm text-green-700">Layouts unlocked — tap any plan to open full size.</p>
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
            {loading ? 'Sending...' : 'View floor plans'}
          </button>
          <p className="text-xs text-gray-400 text-center">Your layouts unlock instantly.</p>
        </form>
      ) : (
        <button onClick={() => setOpen(true)} className="btn-primary w-full">
          Request layout (free)
        </button>
      )}
    </div>
  )
}
