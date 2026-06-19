'use client'

import { useState } from 'react'
import { Property } from '@/types'
import { validateForPf } from '@/lib/pf-listing-map' // pure module — safe in a client component

// Back-office (admin) UI — glyphs/emoji are allowed here (not public-facing).

type PfStatus = NonNullable<Property['pfListingStatus']>

const STATUS_LABEL: Record<PfStatus, string> = {
  draft: 'Draft',
  pending: 'Publishing…',
  live: 'Live on Property Finder',
  unpublished: 'Unpublished',
  action_required: 'Action needed',
  failed: 'Failed',
}

export default function PfListingPanel({ property }: { property: Property }) {
  const [status, setStatus] = useState<PfStatus | undefined>(property.pfListingStatus)
  const [credits, setCredits] = useState<number | null>(null)
  const [loading, setLoading] = useState<'' | 'draft' | 'publish' | 'unpublish'>('')
  const [error, setError] = useState('')
  const [missing, setMissing] = useState<string[]>([])

  const validation = validateForPf(property)

  async function call(action: 'draft' | 'publish' | 'unpublish') {
    setLoading(action)
    setError('')
    setMissing([])
    try {
      const res = await fetch(`/api/admin/pf-listing/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId: property.id }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (Array.isArray(data.missing)) setMissing(data.missing)
        setError(data.error || `Request failed (${res.status})`)
        return
      }
      if (action === 'draft') {
        setStatus('draft')
        setCredits(typeof data.priceCredits === 'number' ? data.priceCredits : null)
      } else if (action === 'publish') {
        setStatus('pending')
      } else {
        setStatus('unpublished')
      }
    } catch {
      setError('Network error.')
    } finally {
      setLoading('')
    }
  }

  const canDraft = validation.ok && (!status || status === 'failed' || status === 'unpublished')

  return (
    <div className="border-t border-gray-100 pt-6">
      <h3 className="font-serif text-lg text-navy mb-1">PROPERTY FINDER</h3>
      <p className="text-xs text-gray-400 mb-4">
        Publish this listing to Property Finder. Drafting is free; publishing spends portal credits.
      </p>

      <div className="flex items-center gap-2 mb-4 text-sm">
        <span className="text-gray-500">Status:</span>
        <span className="font-medium text-navy">
          {status ? STATUS_LABEL[status] : 'Not on Property Finder'}
          {status === 'draft' && credits != null ? ` — ${credits} credits to publish` : ''}
        </span>
      </div>

      {!validation.ok && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-sm px-3 py-2 mb-3">
          Fill these required fields and save before publishing: <strong>{validation.missing.join(', ')}</strong>
        </p>
      )}

      {status === 'action_required' && (
        <p className="text-xs text-red-700 bg-red-50 border border-red-100 rounded-sm px-3 py-2 mb-3">
          Property Finder flagged a compliance issue. Resolve it in PF Expert or the listing will be auto-unpublished.
        </p>
      )}

      {error && (
        <p className="text-xs text-red-600 mb-3">
          {error}
          {missing.length > 0 && <> — missing: <strong>{missing.join(', ')}</strong></>}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => call('draft')}
          disabled={!canDraft || loading !== ''}
          className="btn-outline-gold-light text-sm disabled:opacity-50"
          title={validation.ok ? '' : 'Complete the required fields first'}
        >
          {loading === 'draft' ? 'Creating…' : 'Create draft'}
        </button>

        {status === 'draft' && (
          <button
            type="button"
            onClick={() => {
              if (confirm(`Publish to Property Finder${credits != null ? ` for ${credits} credits` : ''}? This spends portal credits.`)) call('publish')
            }}
            disabled={loading !== ''}
            className="btn-primary text-sm disabled:opacity-50"
          >
            {loading === 'publish' ? 'Publishing…' : `Publish${credits != null ? ` (${credits} credits)` : ''}`}
          </button>
        )}

        {(status === 'live' || status === 'pending' || status === 'action_required') && (
          <button
            type="button"
            onClick={() => call('unpublish')}
            disabled={loading !== ''}
            className="btn-outline-gold-light text-sm disabled:opacity-50"
          >
            {loading === 'unpublish' ? 'Unpublishing…' : 'Unpublish'}
          </button>
        )}
      </div>

      {status === 'pending' && (
        <p className="text-xs text-gray-400 mt-2">
          Sent to Property Finder. Status flips to “Live” when PF confirms (via webhook). Reload the page to refresh.
        </p>
      )}
    </div>
  )
}
