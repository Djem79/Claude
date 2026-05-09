'use client'

import { useMemo, useState } from 'react'
import { Lead, LeadStatus, ActivityEntry } from '@/types'

const STATUS_META: Record<LeadStatus, { label: string; color: string }> = {
  new: { label: 'New', color: 'bg-blue-50 text-blue-700' },
  contacted: { label: 'Contacted', color: 'bg-amber-50 text-amber-700' },
  'in-progress': { label: 'In Progress', color: 'bg-purple-50 text-purple-700' },
  won: { label: 'Won', color: 'bg-green-50 text-green-700' },
  lost: { label: 'Lost', color: 'bg-red-100 text-red-700' },
}

const STATUS_ORDER: LeadStatus[] = ['new', 'contacted', 'in-progress', 'won', 'lost']

function fmt(iso?: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function digitsOnly(s: string) {
  return s.replace(/\D/g, '')
}

export default function LeadsClient({ initialLeads }: { initialLeads: Lead[] }) {
  const [leads, setLeads] = useState<Lead[]>(initialLeads)
  const [statusFilter, setStatusFilter] = useState<LeadStatus | 'all'>('all')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)

  const sources = useMemo(() => Array.from(new Set(leads.map(l => l.source).filter(Boolean))).sort(), [leads])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return leads.filter(l => {
      if (statusFilter !== 'all' && (l.status ?? 'new') !== statusFilter) return false
      if (sourceFilter !== 'all' && l.source !== sourceFilter) return false
      if (!q) return true
      return (
        l.name.toLowerCase().includes(q) ||
        l.phone.toLowerCase().includes(q) ||
        (l.email ?? '').toLowerCase().includes(q) ||
        (l.propertyTitle ?? '').toLowerCase().includes(q)
      )
    })
  }, [leads, statusFilter, sourceFilter, query])

  async function patchLead(id: string, patch: Partial<Pick<Lead, 'status' | 'notes' | 'contactedAt'>>) {
    setSavingId(id)
    const res = await fetch(`/api/leads/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    if (res.ok) {
      const updated: Lead = await res.json()
      setLeads(prev => prev.map(l => (l.id === id ? updated : l)))
    }
    setSavingId(null)
  }

  async function removeLead(id: string) {
    if (!confirm('Delete this lead permanently? This cannot be undone.')) return
    const res = await fetch(`/api/leads/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setLeads(prev => prev.filter(l => l.id !== id))
      if (openId === id) setOpenId(null)
    }
  }

  function exportCsv() {
    const cols = ['createdAt', 'name', 'phone', 'email', 'budget', 'source', 'propertyTitle', 'status', 'notes']
    const escape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const rows = [cols.join(',')]
    for (const l of filtered) {
      rows.push(cols.map(c => escape((l as any)[c])).join(','))
    }
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      {/* Filters & search */}
      <div className="bg-white rounded-sm shadow-sm border border-gray-100 p-4 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-60">
          <label className="text-xs text-gray-500 font-medium block mb-1">Search</label>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Name, phone, email, property..."
            className="w-full border border-gray-200 px-3 py-2 rounded-sm text-sm focus:outline-none focus:border-gold"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 font-medium block mb-1">Status</label>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as LeadStatus | 'all')}
            className="border border-gray-200 px-3 py-2 rounded-sm text-sm focus:outline-none focus:border-gold"
          >
            <option value="all">All Statuses</option>
            {STATUS_ORDER.map(s => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 font-medium block mb-1">Source</label>
          <select
            value={sourceFilter}
            onChange={e => setSourceFilter(e.target.value)}
            className="border border-gray-200 px-3 py-2 rounded-sm text-sm focus:outline-none focus:border-gold"
          >
            <option value="all">All Sources</option>
            {sources.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <button onClick={exportCsv} className="text-sm text-navy border border-gray-200 px-4 py-2 rounded-sm hover:border-gold">
          Export CSV
        </button>
        <p className="text-xs text-gray-400 self-center">{filtered.length} of {leads.length}</p>
      </div>

      {/* Table */}
      <div className="bg-white rounded-sm shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Date', 'Status', 'Name', 'Phone', 'Source', 'Property', 'Actions'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400">No leads match filters.</td></tr>
              )}
              {filtered.map(l => {
                const status = (l.status ?? 'new') as LeadStatus
                const isOpen = openId === l.id
                return (
                  <>
                    <tr
                      key={l.id}
                      className={`cursor-pointer hover:bg-gray-50 transition-colors ${isOpen ? 'bg-gray-50' : ''}`}
                      onClick={() => setOpenId(isOpen ? null : l.id)}
                    >
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{fmt(l.createdAt)}</td>
                      <td className="px-4 py-3">
                        <span className={`badge text-xs ${STATUS_META[status].color}`}>{STATUS_META[status].label}</span>
                      </td>
                      <td className="px-4 py-3 font-medium text-navy">{l.name}</td>
                      <td className="px-4 py-3 text-gray-700">{l.phone}</td>
                      <td className="px-4 py-3"><span className="badge bg-gray-100 text-gray-600 text-xs">{l.source}</span></td>
                      <td className="px-4 py-3 text-gray-500 max-w-xs truncate">{l.propertyTitle ?? '—'}</td>
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <div className="flex gap-3">
                          <a href={`https://wa.me/${digitsOnly(l.phone)}`} target="_blank" rel="noopener noreferrer" className="text-xs text-green-600 hover:underline">WhatsApp</a>
                          <a href={`tel:${l.phone}`} className="text-xs text-gold hover:underline">Call</a>
                          {l.email && <a href={`mailto:${l.email}`} className="text-xs text-blue-600 hover:underline">Email</a>}
                        </div>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr key={l.id + '-detail'} className="bg-gray-50/50">
                        <td colSpan={7} className="px-4 py-5">
                          <div className="grid md:grid-cols-3 gap-6">
                            <div className="md:col-span-1 space-y-2 text-sm">
                              <div><span className="text-gray-400 text-xs">Email:</span> {l.email ?? '—'}</div>
                              <div><span className="text-gray-400 text-xs">Budget:</span> {l.budget ?? '—'}</div>
                              <div><span className="text-gray-400 text-xs">Contacted at:</span> {fmt(l.contactedAt)}</div>
                              <div><span className="text-gray-400 text-xs">Updated at:</span> {fmt(l.updatedAt)}</div>
                              {l.message && (
                                <div className="pt-2">
                                  <p className="text-gray-400 text-xs mb-1">Message from client:</p>
                                  <p className="text-gray-700 italic bg-white border border-gray-100 rounded-sm p-2">{l.message}</p>
                                </div>
                              )}
                            </div>
                            <div className="md:col-span-2 space-y-3">
                              <div>
                                <label className="text-xs text-gray-500 font-medium block mb-1">Status</label>
                                <div className="flex gap-2 flex-wrap">
                                  {STATUS_ORDER.map(s => (
                                    <button
                                      key={s}
                                      onClick={() => patchLead(l.id, { status: s })}
                                      disabled={savingId === l.id}
                                      className={`text-xs px-3 py-1.5 rounded-sm border ${
                                        status === s && s === 'lost'
                                          ? 'border-red-500 bg-red-100 text-red-700 font-medium'
                                          : status === s
                                          ? 'border-gold bg-gold/10 text-navy font-medium'
                                          : 'border-gray-200 text-gray-500 hover:border-gold'
                                      }`}
                                    >
                                      {STATUS_META[s].label}
                                    </button>
                                  ))}
                                </div>
                              </div>
                              <div>
                                <label className="text-xs text-gray-500 font-medium block mb-1">Internal notes</label>
                                <textarea
                                  defaultValue={l.notes ?? ''}
                                  rows={3}
                                  onBlur={e => {
                                    const next = e.target.value
                                    if (next !== (l.notes ?? '')) patchLead(l.id, { notes: next })
                                  }}
                                  placeholder="Call notes, follow-up dates, agent assignment..."
                                  className="w-full border border-gray-200 px-3 py-2 rounded-sm text-sm focus:outline-none focus:border-gold resize-none"
                                />
                                <p className="text-xs text-gray-400 mt-1">Saved on blur (click outside).</p>
                              </div>
                              {l.activityLog && l.activityLog.length > 0 && (
                                <div className="pt-2">
                                  <p className="text-xs text-gray-400 font-medium mb-2">Activity Log</p>
                                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                                    {[...l.activityLog].reverse().map((entry: ActivityEntry, i: number) => (
                                      <div key={i} className="flex gap-2 text-xs text-gray-500">
                                        <span className="text-gray-300 shrink-0">{fmt(entry.at)}</span>
                                        <span className="font-medium text-navy shrink-0">{entry.byName}</span>
                                        <span>{entry.action}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              <div className="pt-2">
                                <button
                                  onClick={() => removeLead(l.id)}
                                  className="text-xs text-red-500 hover:text-red-700"
                                >
                                  Delete lead
                                </button>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
