// Pure size/extension gate for extracted brochure images. Kept dependency-free in
// its own file so it (and pdf-images' callers) stay unit-testable in isolation.

// Coarse pre-filter only: below this an extracted image is almost certainly a
// logo/icon/divider. Kept LOW because real unit FLOOR PLANS are simple line art that
// compresses tiny (observed 19–45 KB in DAMAC brochures) — a higher cut silently
// dropped them before classification. The Gemini classifier (image-classify.ts) is
// the real quality gate; this only keeps the candidate set sane.
export const MIN_PHOTO_BYTES = 12 * 1024

export function isLikelyPhoto(bytes: number, filename: string): boolean {
  if (!/\.(jpe?g|png)$/i.test(filename)) return false
  return bytes >= MIN_PHOTO_BYTES
}
