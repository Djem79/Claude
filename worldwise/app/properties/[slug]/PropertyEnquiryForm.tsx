'use client'

import { useState } from 'react'
import { track } from '@/lib/analytics'
import { waLink, PHONE_TEL } from '@/lib/whatsapp'
import { BUDGET_BRACKETS } from '@/lib/lead-constants'
import { useLeadSubmit } from '@/lib/useLeadSubmit'
import Honeypot from '@/components/Honeypot'

export default function PropertyEnquiryForm({
  propertySlug,
  propertyTitle,
}: {
  propertySlug: string
  propertyTitle: string
}) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [budget, setBudget] = useState('')
  const [message, setMessage] = useState('')
  const { hpRef, loading, success, error, submit } = useLeadSubmit({
    source: 'property_enquiry',
    trackParams: { property: propertyTitle },
    emptyError: 'Name and phone are required.',
    failError: 'Something went wrong. Try WhatsApp.',
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await submit({ name, phone, email, budget, message, propertySlug, propertyTitle })
  }

  return (
    <div className="bg-white rounded-sm shadow-md p-6 border border-gray-100">
      {success ? (
        <div className="text-center py-6">
          <div className="text-3xl mb-3">✓</div>
          <h3 className="font-serif text-xl text-navy mb-2">Request Sent!</h3>
          <p className="text-gray-500 text-sm">We&apos;ll contact you within 2 hours.</p>
          <a
            href="https://t.me/WorldwisePro"
            target="_blank"
            rel="noopener noreferrer"
            className="block mt-5 w-full text-center rounded-sm py-2.5 px-4 text-sm font-medium bg-[#229ED9]/10 border border-[#229ED9]/30 text-[#229ED9] hover:bg-[#229ED9]/20 transition-colors"
          >
            Our Telegram channel →
          </a>
          <p className="text-xs text-gray-400 mt-1">New off-plan listings and market analytics every week</p>
        </div>
      ) : (
        <>
          <h3 className="font-serif text-xl text-navy mb-1">Enquire About This Property</h3>
          <p className="text-gray-400 text-sm mb-5">Free consultation · No obligation</p>

          <form onSubmit={handleSubmit} className="space-y-3">
            <Honeypot hpRef={hpRef} />
            <input className="input-field" placeholder="Full Name *" value={name} onChange={e => setName(e.target.value)} required />
            <input className="input-field" placeholder="WhatsApp / Phone *" value={phone} onChange={e => setPhone(e.target.value)} required />
            <input className="input-field" type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
            <select className="input-field" value={budget} onChange={e => setBudget(e.target.value)}>
              <option value="">Budget</option>
              {BUDGET_BRACKETS.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
            <textarea
              className="input-field resize-none"
              rows={3}
              placeholder="Message (optional)"
              value={message}
              onChange={e => setMessage(e.target.value)}
            />
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button type="submit" disabled={loading} className="btn-primary w-full disabled:opacity-60">
              {loading ? 'Sending...' : 'Send Enquiry'}
            </button>
          </form>

          <div className="mt-4 pt-4 border-t border-gray-100 flex gap-3">
            <a
              href={waLink(`Hi, I'm interested in ${propertyTitle}`)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 bg-[#25D366] text-white text-sm font-medium py-2.5 rounded-sm text-center hover:opacity-90 transition-opacity"
              onClick={() => track('whatsapp_click', { source: 'property_enquiry', property: propertyTitle })}
            >
              WhatsApp
            </a>
            <a
              href={PHONE_TEL}
              className="flex-1 border border-gray-200 text-navy text-sm font-medium py-2.5 rounded-sm text-center hover:border-gold transition-colors"
            >
              Call
            </a>
          </div>
        </>
      )}
    </div>
  )
}
