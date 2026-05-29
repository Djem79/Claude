// Server-side FX rates: units of target currency per 1 AED. AED is always 1.
// AED is USD-pegged at 3.6725 → USD ≈ 0.2723; EUR/GBP approximate.

export type Currency = 'AED' | 'USD' | 'EUR' | 'GBP'
export type Rates = Record<Currency, number>

export const FALLBACK_RATES: Rates = { AED: 1, USD: 0.2723, EUR: 0.25, GBP: 0.215 }

export const SYMBOL: Record<Currency, string> = { AED: 'AED', USD: '$', EUR: '€', GBP: '£' }

export async function getRates(): Promise<Rates> {
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/AED', {
      next: { revalidate: 86400 },
    })
    if (!res.ok) return FALLBACK_RATES
    const data = await res.json()
    const r = data?.rates
    const usd = Number(r?.USD)
    const eur = Number(r?.EUR)
    const gbp = Number(r?.GBP)
    if (!usd || !eur || !gbp) return FALLBACK_RATES
    return { AED: 1, USD: usd, EUR: eur, GBP: gbp }
  } catch {
    return FALLBACK_RATES
  }
}
