import fs from 'fs'
import path from 'path'
import { Lead } from '@/types'

const DATA_FILE = path.join(process.cwd(), 'data', 'leads.json')

export function getLeads(): Lead[] {
  const raw = fs.readFileSync(DATA_FILE, 'utf-8')
  return JSON.parse(raw) as Lead[]
}

export function saveLead(data: Omit<Lead, 'id' | 'createdAt'>): Lead {
  const leads = getLeads()
  const lead: Lead = {
    ...data,
    id: String(Date.now()),
    createdAt: new Date().toISOString(),
  }
  fs.writeFileSync(DATA_FILE, JSON.stringify([lead, ...leads], null, 2), 'utf-8')
  return lead
}
