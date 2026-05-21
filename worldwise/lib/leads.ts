import fs from 'fs'
import path from 'path'
import { Lead, LeadStatus, ActivityEntry } from '@/types'
import { normalizePhone } from '@/lib/lead-parse'
import { writeFileAtomic } from '@/lib/atomic-write'

const DATA_FILE = path.join(process.cwd(), 'data', 'leads.json')

export function getLeads(): Lead[] {
  if (!fs.existsSync(DATA_FILE)) return []
  const raw = fs.readFileSync(DATA_FILE, 'utf-8')
  return JSON.parse(raw) as Lead[]
}

export function getLeadById(id: string): Lead | null {
  return getLeads().find(l => l.id === id) ?? null
}

export function findLeadByPhone(phone: string): Lead | null {
  const norm = normalizePhone(phone)
  if (!norm) return null
  return getLeads().find(l => normalizePhone(l.phone) === norm) ?? null
}

function saveLeads(leads: Lead[]): void {
  writeFileAtomic(DATA_FILE, JSON.stringify(leads, null, 2))
}

export function saveLead(data: Omit<Lead, 'id' | 'createdAt' | 'status'>): Lead {
  const leads = getLeads()
  const lead: Lead = {
    ...data,
    id: String(Date.now()),
    status: 'new',
    createdAt: new Date().toISOString(),
  }
  saveLeads([lead, ...leads])
  return lead
}

export function updateLead(
  id: string,
  data: Partial<Pick<Lead, 'status' | 'notes' | 'contactedAt' | 'attachments' | 'source'>>,
  actor?: { uid: string; username: string; name: string }
): Lead | null {
  const leads = getLeads()
  const idx = leads.findIndex(l => l.id === id)
  if (idx === -1) return null
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
  leads[idx] = updated
  saveLeads(leads)
  return updated
}

export function deleteLead(id: string): boolean {
  const leads = getLeads()
  const filtered = leads.filter(l => l.id !== id)
  if (filtered.length === leads.length) return false
  saveLeads(filtered)
  return true
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
