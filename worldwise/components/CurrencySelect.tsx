'use client'

import { useEffect, useState } from 'react'
import type { Currency } from '@/lib/fx'
import { getStoredCurrency, setStoredCurrency, EVENT } from '@/lib/currency-client'

const OPTIONS: Currency[] = ['AED', 'USD', 'EUR', 'GBP']

export default function CurrencySelect({ className }: { className?: string }) {
  // Default-render AED to match SSR, then sync from storage on mount.
  const [currency, setCurrency] = useState<Currency>('AED')

  useEffect(() => {
    setCurrency(getStoredCurrency())
    const sync = () => setCurrency(getStoredCurrency())
    window.addEventListener(EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const c = e.target.value as Currency
    setCurrency(c)
    setStoredCurrency(c)
  }

  return (
    <select
      value={currency}
      onChange={onChange}
      aria-label="Display currency"
      className={
        className ??
        'border border-gray-200 bg-white px-4 py-2.5 rounded-sm text-navy text-sm focus:outline-none focus:border-gold'
      }
    >
      {OPTIONS.map(c => (
        <option key={c} value={c}>{c}</option>
      ))}
    </select>
  )
}
