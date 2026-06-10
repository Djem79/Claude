// Shared compact AED price formatter — "AED 2.45M" / "AED 850K".
// Used by PriceTag, the property detail page and the admin table.
// (MortgageCalculator keeps its own variant: it rounds K differently and
// has a sub-1000 branch.)
export function formatAedCompact(aed: number): string {
  if (aed >= 1_000_000) return `AED ${(aed / 1_000_000).toFixed(2)}M`
  return `AED ${(aed / 1000).toFixed(0)}K`
}
