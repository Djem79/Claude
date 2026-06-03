// Pure mortgage math, shared by the homepage MortgageCalculator and the per-property
// "from X/mo" affordability anchor. No React, no I/O — unit-tested.

export interface MortgageOpts {
  downPct?: number // fraction, e.g. 0.25 = 25% down
  ratePct?: number // annual interest rate %, e.g. 4.5
  years?: number   // term in years
}

// Defaults for the per-property anchor (agreed: 25% down / 4.5% / 25 yrs).
export const MORTGAGE_DEFAULTS = { downPct: 0.25, ratePct: 4.5, years: 25 } as const

// Monthly annuity payment (AED). Returns 0 when nothing is financed (e.g. 100% down).
export function estimateMonthly(priceAed: number, opts: MortgageOpts = {}): number {
  const downPct = opts.downPct ?? MORTGAGE_DEFAULTS.downPct
  const ratePct = opts.ratePct ?? MORTGAGE_DEFAULTS.ratePct
  const years = opts.years ?? MORTGAGE_DEFAULTS.years
  const loan = priceAed * (1 - downPct)
  if (loan <= 0) return 0
  const r = ratePct / 100 / 12
  const n = years * 12
  if (r === 0) return loan / n
  return (loan * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)
}
