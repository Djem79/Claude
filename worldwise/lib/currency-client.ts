import type { Currency } from './fx'

export const EVENT = 'ww_currency'
const KEY = 'ww_currency'
const VALID: Currency[] = ['AED', 'USD', 'EUR', 'GBP']

export function getStoredCurrency(): Currency {
  if (typeof window === 'undefined') return 'AED'
  try {
    const v = window.localStorage.getItem(KEY)
    return VALID.includes(v as Currency) ? (v as Currency) : 'AED'
  } catch {
    // localStorage can throw in Safari Private Mode / when storage is disabled.
    return 'AED'
  }
}

export function setStoredCurrency(c: Currency): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(KEY, c)
  } catch {
    // ignore storage failures — still broadcast so the in-memory UI updates
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: c }))
}
