// Pure helpers for per-property brochure files. No fs/next imports so this stays
// node:test-able. Bytes live server-only at public/files/brochures/<id>.pdf
// (rsync-excluded) and are served by app/api/properties/[id]/brochure/route.ts.

// Property ids are String(Date.now()) — 13 numeric digits. Mirror the media-route guard.
export function isValidBrochureId(id: string): boolean {
  return /^\d{6,20}$/.test(id)
}

// Canonical on-disk basename for a property's brochure.
export function brochureBasename(id: string): string {
  if (!isValidBrochureId(id)) throw new Error(`[brochure] invalid id: ${id}`)
  return `${id}.pdf`
}
