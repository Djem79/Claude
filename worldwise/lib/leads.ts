import path from 'path'
import { Lead, LeadStatus, ActivityEntry, FileAttachment } from '@/types'
import { normalizePhone } from '@/lib/lead-parse'
import { readJsonFile, mutateJsonFile } from '@/lib/json-store'

const DATA_FILE = path.join(process.cwd(), 'data', 'leads.json')

export function getLeads(): Lead[] {
  return readJsonFile<Lead[]>(DATA_FILE, [])
}

export function getLeadById(id: string): Lead | null {
  return getLeads().find(l => l.id === id) ?? null
}

export function findLeadByPhone(phone: string): Lead | null {
  const norm = normalizePhone(phone)
  if (!norm) return null
  return getLeads().find(l => normalizePhone(l.phone) === norm) ?? null
}

// All mutations run inside mutateJsonFile's synchronous critical section —
// fresh read + sync transform + atomic write; an await cannot fit in between.
function mutateLeads(mutate: (current: Lead[]) => Lead[]): void {
  mutateJsonFile<Lead[]>(DATA_FILE, [], mutate)
}

export function saveLead(data: Omit<Lead, 'id' | 'createdAt' | 'status'>): Lead {
  let saved: Lead | null = null
  mutateLeads(leads => {
    // Date.now() can collide when two leads land in the same millisecond —
    // bump until unique so the second submit can't shadow the first.
    let id = Date.now()
    while (leads.some(l => l.id === String(id))) id++
    saved = {
      ...data,
      id: String(id),
      status: 'new',
      createdAt: new Date().toISOString(),
    }
    return [saved, ...leads]
  })
  return saved!
}

/**
 * Idempotent insert for Property Finder webhook leads. PF delivers at-least-once,
 * so the dedup-by-pfLeadId check and the insert happen in ONE mutateLeads section.
 * Returns the existing lead (deduped:true) on a repeat delivery, else the new one.
 */
export function savePfLead(
  data: Omit<Lead, 'id' | 'createdAt' | 'status'> & { pfLeadId: string },
): { lead: Lead; deduped: boolean } {
  let result: { lead: Lead; deduped: boolean } | null = null
  mutateLeads((leads) => {
    const existing = leads.find((l) => l.pfLeadId === data.pfLeadId)
    if (existing) {
      result = { lead: existing, deduped: true }
      return leads
    }
    let id = Date.now()
    while (leads.some((l) => l.id === String(id))) id++
    const lead: Lead = { ...data, id: String(id), status: 'new', createdAt: new Date().toISOString() }
    result = { lead, deduped: false }
    return [lead, ...leads]
  })
  return result!
}

export function updateLead(
  id: string,
  data: Partial<Pick<Lead, 'status' | 'notes' | 'contactedAt' | 'attachments' | 'source' | 'propertyTitle' | 'propertySlug'>>,
  actor?: { uid: string; username: string; name: string }
): Lead | null {
  let result: Lead | null = null
  mutateLeads(leads => {
    const idx = leads.findIndex(l => l.id === id)
    if (idx === -1) return leads
    const prev = leads[idx]
    const updated: Lead = {
      ...prev,
      ...data,
      updatedAt: new Date().toISOString(),
    }
    if (data.status === 'contacted' && !prev.contactedAt) {
      updated.contactedAt = new Date().toISOString()
    }
    if (actor) {
    const parts: string[] = []
    if (data.status && data.status !== prev.status) {
      parts.push(`Status: ${prev.status ?? 'new'} → ${data.status}`)
    }
    if ('notes' in data && data.notes !== prev.notes) {
      parts.push('Notes updated')
    }
    if (data.source && data.source !== prev.source) {
      parts.push(`Source: ${data.source}`)
    }
    if ('propertyTitle' in data && data.propertyTitle !== prev.propertyTitle) {
      parts.push(`Interested in: ${data.propertyTitle ?? '(cleared)'}`)
    }
    if ('attachments' in data) {
      const prevCount = prev.attachments?.length ?? 0
      const nextCount = data.attachments?.length ?? 0
      if (nextCount > prevCount) parts.push('File attached')
      else if (nextCount < prevCount) parts.push('File removed')
      else parts.push('File updated')
    }
    const entry: ActivityEntry = {
      at: new Date().toISOString(),
      by: actor.username,
      byName: actor.name,
      action: parts.join(', ') || 'Updated',
    }
    updated.activityLog = [...(prev.activityLog ?? []), entry]
    }
    result = updated
    return leads.map((l, i) => (i === idx ? updated : l))
  })
  return result
}

/**
 * Atomically read-modify-write a lead's attachments. The `mutate` callback
 * receives the CURRENT (freshly-read) attachments and returns the new array.
 *
 * Callers (file upload/delete/send/log handlers) read the lead before awaiting
 * formData/disk I/O; building the new array from that pre-await snapshot loses
 * concurrent changes (two uploads → one attachment dropped). Routing the array
 * computation through here re-reads fresh state inside updateLead's synchronous
 * mutateJsonFile section, so it cannot interleave with another request.
 */
export function mutateLeadAttachments(
  id: string,
  mutate: (current: FileAttachment[]) => FileAttachment[],
  actor?: { uid: string; username: string; name: string }
): Lead | null {
  const lead = getLeadById(id)
  if (!lead) return null
  return updateLead(id, { attachments: mutate(lead.attachments ?? []) }, actor)
}

export function deleteLead(id: string): boolean {
  let removed = false
  mutateLeads(leads => {
    const filtered = leads.filter(l => l.id !== id)
    removed = filtered.length !== leads.length
    return filtered
  })
  return removed
}

export function leadStats(leads: Lead[]) {
  const now = Date.now()
  const day = 86400_000
  const total = leads.length
  const new7d = leads.filter(l => now - new Date(l.createdAt).getTime() < 7 * day).length
  const new24h = leads.filter(l => now - new Date(l.createdAt).getTime() < day).length
  const byStatus: Record<LeadStatus, number> = { new: 0, contacted: 0, 'in-progress': 0, won: 0, lost: 0 }
  for (const l of leads) byStatus[l.status ?? 'new']++
  return { total, new7d, new24h, byStatus }
}
