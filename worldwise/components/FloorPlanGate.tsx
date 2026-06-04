'use client'

import { useState, useRef } from 'react'
import { track } from '@/lib/analytics'

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
          source: 'floor_plan',
          propertySlug,
          propertyTitle,
          _hp: hpRef.current?.value ?? '',
        }),
      })
      if (!res.ok) throw new Error('Failed')
      setSuccess(true)
      track('lead_form_submit', { source: 'floor_plan', property: propertyTitle })
    } catch {
      setError('Something went wrong. Please try again or message us on WhatsApp.')
    } finally {
      setLoading(false)
    }
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
