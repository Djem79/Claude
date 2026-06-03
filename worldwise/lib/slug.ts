// Filesystem- and URL-safe slug helpers for blog article images. Pure, testable.
export function sanitizeSlug(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '')
}

export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9-]{1,80}$/.test(slug)
}

/**
 * Ensure `base` is unique among `taken`. If it collides, append -2, -3, … until
 * free. Used on property create/publish so two listings can't share a slug (which
 * would leave the second unreachable by URL, since lookups resolve the first).
 */
export function uniqueSlug(base: string, taken: string[]): string {
  if (!taken.includes(base)) return base
  let n = 2
  while (taken.includes(`${base}-${n}`)) n++
  return `${base}-${n}`
}
