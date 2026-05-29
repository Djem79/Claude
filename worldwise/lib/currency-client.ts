import type { Currency } from './fx'

export const EVENT = 'ww_currency'
const KEY = 'ww_currency'
const VALID: Currency[] = ['AED', 'USD', 'EUR', 'GBP']

export function getStoredCurrency(): Currency {
  if (typeof window === 'undefined') return 'AED'
  const v = window.localStorage.getItem(KEY)
  return VALID.includes(v as Currency) ? (v as Currency) : 'AED'
}

export function setStoredCurrency(c: Currency): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(KEY, c)
  window.dispatchEvent(new CustomEvent(EVENT, { detail: c }))
}
