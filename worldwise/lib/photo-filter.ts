// Pure size/extension gate for extracted brochure images. Kept dependency-free in
// its own file so it (and pdf-images' callers) stay unit-testable in isolation.

// Below this, an extracted image is almost certainly a logo/icon/divider, not a
// render worth showing. Tuned for developer brochures (real renders are >100KB).
export const MIN_PHOTO_BYTES = 50 * 1024

export function isLikelyPhoto(bytes: number, filename: string): boolean {
  if (!/\.(jpe?g|png)$/i.test(filename)) return false
  return bytes >= MIN_PHOTO_BYTES
}
