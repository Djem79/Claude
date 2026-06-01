import { revalidatePath } from 'next/cache'

/**
 * Invalidate every public page whose content is derived from the property
 * catalog, after a create/update/delete.
 *
 * Without this, those pages only refresh on their own `export const revalidate`
 * timer (e.g. the homepage's 60s ISR window). Worse, Next's stale-while-revalidate
 * serves the OLD page on the first request after that window and regenerates in the
 * background — so an admin toggling `featured` would see the public site lag one
 * edit behind ("7 selected, 6 shown"). Revalidating on mutation makes edits appear
 * immediately; the per-page `revalidate` stays as a backstop.
 */
export function revalidatePropertyPages(): void {
  revalidatePath('/') // homepage featured grid
  revalidatePath('/properties') // listing
  revalidatePath('/properties/[slug]', 'page') // all property detail pages
  revalidatePath('/[area]', 'page') // area landing featured grids
  revalidatePath('/sitemap.xml') // sitemap references property slugs
}
