import { useRef, useState, type RefObject } from 'react'
import { track } from '@/lib/analytics'
import { getStoredAttribution } from '@/lib/utm'

// Shared submit logic for every lead-capture form — spec:
// docs/superpowers/specs/2026-06-10-use-lead-submit-design.md
//
// Owns the two load-bearing invariants so individual forms cannot forget them:
//   1. the POST body always spreads getStoredAttribution() (paid-ads tracking)
//      and sends the honeypot value as `_hp`;
//   2. a successful POST always fires track('lead_form_submit', …).
// Render the honeypot with <Honeypot hpRef={hpRef} /> (components/Honeypot.tsx).

export interface LeadSubmitOptions {
  /** Lead source string — keep consistent with the registry in CLAUDE.md. */
  source: string
  /** Extra GA4 params for lead_form_submit, e.g. { property: title }. */
  trackParams?: Record<string, string>
  /** Validation message when name/phone are empty. */
  emptyError?: string
  /** Message shown when the POST fails. */
  failError?: string
}

export interface LeadSubmit {
  hpRef: RefObject<HTMLInputElement | null>
  loading: boolean
  success: boolean
  error: string
  /** Returns true on success so callers can run their own post-success work. */
  submit: (fields: { name: string; phone: string } & Record<string, unknown>) => Promise<boolean>
  /** Clear success/error — long-lived modals call this when they reopen. */
  resetStatus: () => void
}

export function useLeadSubmit(opts: LeadSubmitOptions): LeadSubmit {
  const hpRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  async function submit(fields: { name: string; phone: string } & Record<string, unknown>): Promise<boolean> {
    if (!fields.name.trim() || !fields.phone.trim()) {
      setError(opts.emptyError ?? 'Please fill in your name and phone number.')
      return false
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...fields,
          source: opts.source,
          ...getStoredAttribution(),
          _hp: hpRef.current?.value ?? '',
        }),
      })
      if (!res.ok) throw new Error('Failed')
      setSuccess(true)
      track('lead_form_submit', { source: opts.source, ...(opts.trackParams ?? {}) })
      return true
    } catch {
      setError(opts.failError ?? 'Something went wrong. Please try WhatsApp instead.')
      return false
    } finally {
      setLoading(false)
    }
  }

  function resetStatus() {
    setSuccess(false)
    setError('')
  }

  return { hpRef, loading, success, error, submit, resetStatus }
}
