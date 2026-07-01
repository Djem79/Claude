export const GOLDEN_VISA_AED = 2_000_000

export function qualifiesForGoldenVisa(priceAed: number): boolean {
  return priceAed >= GOLDEN_VISA_AED
}

// Property-level check. Rent listings quote ANNUAL RENT in `priceAed`, not a
// purchase price — the Golden Visa is a property-purchase programme, so a
// high-rent listing must never surface the badge or land on /golden-visa.
export function propertyQualifiesForGoldenVisa(p: { priceAed: number; status?: string }): boolean {
  return p.status !== 'rent' && qualifiesForGoldenVisa(p.priceAed)
}
