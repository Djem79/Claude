'use client'

import { useEffect, useState } from 'react'
import type { Currency, Rates } from '@/lib/fx'
import { FALLBACK_RATES, SYMBOL } from '@/lib/fx'
import { getStoredCurrency, EVENT } from '@/lib/currency-client'
import { formatAedCompact } from '@/lib/format'

// Shared across every PriceTag on the page: a single /api/fx request.
let ratesPromise: Promise<Rates> | null = null
function loadRates(): Promise<Rates> {
  if (!ratesPromise) {
    ratesPromise = fetch('/api/fx')
      .then(r => (r.ok ? r.json() : FALLBACK_RATES))
      .catch(() => FALLBACK_RATES)
  }
  return ratesPromise
}

// Compact converted value, e.g. $2.45M / $520K.
function formatConverted(value: number, currency: Currency) {
  const sym = SYMBOL[currency]
  if (value >= 1_000_000) return `${sym}${(value / 1_000_000).toFixed(2)}M`
  return `${sym}${(value / 1000).toFixed(0)}K`
}

export default function PriceTag({
  aed,
  className,
  prefix,
}: {
  aed: number
  className?: string
  prefix?: string
}) {
  const [currency, setCurrency] = useState<Currency>('AED')
  const [rates, setRates] = useState<Rates | null>(null)

  useEffect(() => {
    setCurrency(getStoredCurrency())
    loadRates().then(setRates)

    const sync = () => setCurrency(getStoredCurrency())
    window.addEventListener(EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  // Reserve the secondary line as soon as the stored currency is known (before the
  // /api/fx fetch resolves) — otherwise the line pops in when rates arrive, shifting
  // everything below the price on every card (CLS for returning non-AED visitors).
  const showSecondary = currency !== 'AED'
  const converted = showSecondary && rates != null ? formatConverted(aed * rates[currency], currency) : null

  return (
    <span className={className}>
      {prefix}
      {formatAedCompact(aed)}
      {showSecondary && (
        <span className="block text-xs text-gray-400 font-sans font-normal">
          {converted ? `≈ ${converted}` : ' '}
        </span>
      )}
    </span>
  )
}
