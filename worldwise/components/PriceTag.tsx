'use client'

import { useEffect, useState } from 'react'
import type { Currency, Rates } from '@/lib/fx'
import { FALLBACK_RATES, SYMBOL } from '@/lib/fx'
import { getStoredCurrency, EVENT } from '@/lib/currency-client'

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

// AED primary — same formatting as PropertyCard's formatPrice.
function formatAed(aed: number) {
  if (aed >= 1_000_000) return `AED ${(aed / 1_000_000).toFixed(2)}M`
  return `AED ${(aed / 1000).toFixed(0)}K`
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

  const showSecondary = currency !== 'AED' && rates != null
  const converted = showSecondary ? formatConverted(aed * rates![currency], currency) : null

  return (
    <span className={className}>
      {prefix}
      {formatAed(aed)}
      {converted && (
        <span className="block text-xs text-gray-400 font-sans font-normal">≈ {converted}</span>
      )}
    </span>
  )
}
