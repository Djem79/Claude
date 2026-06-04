// Pure size/extension gate for extracted brochure images. Kept dependency-free in
// its own file so it (and pdf-images' callers) stay unit-testable in isolation.

// Below this, an extracted image is almost certainly a logo/icon/divider, not a
// render worth showing. Tuned for developer brochures (real renders are >100KB).
// KEEP THIS HIGH. Lowering it to catch small floor plans (line art, ~20KB) backfires:
// it explodes the candidate set (one DAMAC brochure went 35 -> 232 candidates), and the
// CLASSIFY_MAX=120 truncation then keeps the front-section junk (people/section covers)
// in document order while DROPPING the real exterior/interior renders and the late
// floor-plan pages. Floor plans must be handled by a separate targeted pass or manual
// upload — NOT by widening this gate. (regression 2026-06-04, reverted same day.)
export const MIN_PHOTO_BYTES = 50 * 1024

export function isLikelyPhoto(bytes: number, filename: string): boolean {
  if (!/\.(jpe?g|png)$/i.test(filename)) return false
  return bytes >= MIN_PHOTO_BYTES
}
