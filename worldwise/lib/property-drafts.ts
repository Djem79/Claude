import fs from 'fs'
import path from 'path'
import { mutateJsonFile } from '@/lib/json-store'
import { coercePropertyInput, createProperty, getProperties } from '@/lib/properties'
import { revalidatePropertyPages } from '@/lib/revalidate'
import type { Property, PropertyDraft } from '@/types'

const DRAFTS_PATH = path.join(process.cwd(), 'data', 'property-drafts.json')

// Forgiving read for DISPLAY only (admin panel shows an empty list on a corrupt
// file instead of crashing). Mutations go through mutateJsonFile, whose strict
// read throws on corruption — persisting this [] fallback would wipe the drafts.
function read(): PropertyDraft[] {
  try {
    if (!fs.existsSync(DRAFTS_PATH)) return []
    const parsed = JSON.parse(fs.readFileSync(DRAFTS_PATH, 'utf-8'))
    return Array.isArray(parsed) ? parsed : []
  } catch (e) {
    console.error('[property-drafts] read failed:', e)
    return []
  }
}

function mutateDrafts(mutate: (current: PropertyDraft[]) => PropertyDraft[]): void {
  mutateJsonFile<PropertyDraft[]>(DRAFTS_PATH, [], mutate)
}

export function listDrafts(): PropertyDraft[] { return read() }
export function getDraft(id: string): PropertyDraft | null { return read().find(d => d.draftId === id) ?? null }

export function addDraft(draft: PropertyDraft): void {
  mutateDrafts(all => [draft, ...all])
}

export function updateDraftFields(id: string, fields: Partial<Property>): PropertyDraft | null {
  let updated: PropertyDraft | null = null
  mutateDrafts(all => {
    const i = all.findIndex(d => d.draftId === id)
    if (i === -1) return all
    updated = { ...all[i], fields: { ...all[i].fields, ...fields } }
    return all.map((d, j) => (j === i ? updated! : d))
  })
  return updated
}

function removeRecord(id: string): void {
  mutateDrafts(all => all.filter(d => d.draftId !== id))
}

/** Reject: drop the draft record AND its extracted-image folder. */
export function rejectDraft(id: string): boolean {
  if (!getDraft(id)) return false
  removeRecord(id)
  fs.rmSync(path.join(process.cwd(), 'public', 'images', 'properties', id), { recursive: true, force: true })
  return true
}

/**
 * Publish: merge stored draft fields with any edited fields, validate via the
 * canonical coercePropertyInput, then create the property reusing draftId as its
 * id — so the already-extracted images under properties/<id>/ are correct as-is.
 * Drops only the draft RECORD (keeps the image folder, now owned by the property).
 */
export function publishDraft(
  id: string,
  edited: Partial<Property>
): { ok: true; property: Property } | { ok: false; error: string } {
  const draft = getDraft(id)
  if (!draft) return { ok: false, error: 'Draft not found' }
  const merged = { ...draft.fields, ...edited }
  const parsed = coercePropertyInput(merged, { partial: false })
  if (!parsed.ok) return { ok: false, error: parsed.error }
  // Guard double-publish: createProperty would silently mint a NEW id on collision,
  // orphaning the images already stored under properties/<draftId>/.
  if (getProperties().some(p => p.id === id)) return { ok: false, error: 'Draft already published' }
  parsed.value.id = id
  const property = createProperty(parsed.value as Omit<Property, 'createdAt'> & { id?: string })
  removeRecord(id)
  revalidatePropertyPages()
  return { ok: true, property }
}
