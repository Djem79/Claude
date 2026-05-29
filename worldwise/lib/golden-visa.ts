export const GOLDEN_VISA_AED = 2_000_000

export function qualifiesForGoldenVisa(priceAed: number): boolean {
  return priceAed >= GOLDEN_VISA_AED
}
