'use client'

import { useMemo, useState, useRef } from 'react'
import { Lead, LeadStatus, ActivityEntry, FileAttachment } from '@/types'

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

function fmtSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function fileIcon(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase()
  if (ext === 'pdf') return '📄'
  if (['jpg', 'jpeg', 'png', 'webp'].includes(ext ?? '')) return '🖼️'
  if (['doc', 'docx'].includes(ext ?? '')) return '📝'
  return '📎'
}

const KNOWN_SOURCES = [
  'hero_cta',
  'mortgage_calculator',
  'property_enquiry',
  'lead_capture_section',
  'floating_cta',
  'blog_cta',
]

const CARD_BORDER: Record<LeadStatus, string> = {
  new: 'border-l-blue-400',
  contacted: 'border-l-amber-400',
  'in-progress': 'border-l-purple-400',
  won: 'border-l-gold',
  lost: 'border-l-gray-300',
}

const COLUMN_BADGE: Record<LeadStatus, string> = {
  new: 'bg-blue-50 text-blue-700',
  contacted: 'bg-amber-50 text-amber-800',
  'in-progress': 'bg-purple-50 text-purple-700',
  won: 'bg-amber-50 text-gold border border-gold/30',
  lost: 'bg-gray-100 text-gray-500',
}

const COLUMN_HEADER_COLOR: Record<LeadStatus, string> = {
  new: 'text-navy',
  contacted: 'text-navy',
  'in-progress': 'text-navy',
  won: 'text-gold',
  lost: 'text-gray-400',
}

function FilesSection({ lead, onUpdate }: { lead: Lead; onUpdate: (updated: Lead) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [sendingId, setSendingId] = useState<string | null>(null)
  const [openLogId, setOpenLogId] = useState<string | null>(null)
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://worldwise.pro'

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const form = new FormData()
    form.append('file', file)
    const res = await fetch(`/api/leads/${lead.id}/files`, { method: 'POST', body: form })
    if (res.ok) onUpdate(await res.json())
    else alert((await res.json()).error ?? 'Upload failed')
    setUploading(false)
    if (inputRef.current) inputRef.current.value = ''
  }

  async function handleDelete(fileId: string) {
    if (!confirm('Delete this file? This cannot be undone.')) return
    const res = await fetch(`/api/leads/${lead.id}/files/${fileId}`, { method: 'DELETE' })
    if (res.ok) onUpdate(await res.json())
    else alert((await res.json()).error ?? 'Delete failed')
  }

  async function handleEmail(fileId: string) {
    setSendingId(fileId)
    const res = await fetch(`/api/leads/${lead.id}/files/${fileId}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ via: 'email' }),
    })
    if (res.ok) onUpdate(await res.json())
    else alert((await res.json()).error ?? 'Email failed')
    setSendingId(null)
  }

  function handleWhatsApp(att: FileAttachment) {
    const phone = digitsOnly(lead.phone)
    const msg = encodeURIComponent(
      `Hello, ${lead.name}! Sending you the file: ${att.name}\n\nDownload: ${siteUrl}${att.url}`
    )
    window.open(`https://wa.me/${phone}?text=${msg}`, '_blank')
    fetch(`/api/leads/${lead.id}/files/${att.id}/log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ via: 'whatsapp' }),
    }).then(r => r.ok && r.json()).then(updated => updated && onUpdate(updated)).catch(console.error)
  }

  const attachments = lead.attachments ?? []

  return (
    <div className="pt-3 border-t border-gray-100">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-gray-400 font-medium">Files</p>
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="text-xs text-navy border border-gray-200 px-2 py-1 rounded-sm hover:border-gold disabled:opacity-50 cursor-pointer"
        >
          {uploading ? 'Uploading…' : '+ Upload file'}
        </button>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
          onChange={handleUpload}
        />
      </div>

      {attachments.length === 0 && (
        <p className="text-xs text-gray-300 italic">No files uploaded yet.</p>
      )}

      <div className="space-y-2">
        {attachments.map(att => (
          <div key={att.id} className="border border-gray-100 rounded-sm p-2 bg-white">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-base">{fileIcon(att.name)}</span>
                <div className="min-w-0">
                  <a
                    href={att.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-navy font-medium hover:underline truncate block max-w-xs"
                  >
                    {att.name}
                  </a>
                  <span className="text-xs text-gray-400">
                    {fmtSize(att.size)} · {fmt(att.uploadedAt)} · {att.uploadedBy}
                  </span>
                </div>
              </div>
              <div className="flex gap-1.5 shrink-0">
                <button
                  onClick={() => handleWhatsApp(att)}
                  className="text-xs px-2 py-1 rounded-sm border border-green-200 text-green-700 hover:border-green-400 cursor-pointer"
                >
                  WhatsApp
                </button>
                <button
                  onClick={() => handleEmail(att.id)}
                  disabled={!lead.email || sendingId === att.id}
                  title={!lead.email ? 'Lead has no email' : ''}
                  className="text-xs px-2 py-1 rounded-sm border border-blue-200 text-blue-700 hover:border-blue-400 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  {sendingId === att.id ? 'Sending…' : 'Email'}
                </button>
                <button
                  onClick={() => handleDelete(att.id)}
                  className="text-xs px-2 py-1 rounded-sm border border-gray-200 text-red-500 hover:border-red-300 cursor-pointer"
                >
                  ×
                </button>
              </div>
            </div>

            <button
              onClick={() => setOpenLogId(openLogId === att.id ? null : att.id)}
              className="text-xs text-gray-400 hover:text-gray-600 mt-1 cursor-pointer"
            >
              {openLogId === att.id ? '▴' : '▾'} Sent log ({att.sentLog.length})
            </button>

            {openLogId === att.id && (
              <div className="mt-1.5 space-y-0.5 pl-2 border-l-2 border-gray-100">
                {att.sentLog.length === 0 && (
                  <p className="text-xs text-gray-300 italic">Not sent yet.</p>
                )}
                {att.sentLog.map((entry, i) => (
                  <div key={i} className="flex gap-2 text-xs text-gray-500">
                    <span className={entry.via === 'whatsapp' ? 'text-green-600' : 'text-blue-600'}>
                      {entry.via === 'whatsapp' ? 'WhatsApp' : 'Email'}
                    </span>
                    <span className="text-gray-300">{fmt(entry.sentAt)}</span>
                    <span>{entry.sentByName ?? entry.sentBy}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function LeadsClient({ initialLeads, isOwner = false }: { initialLeads: Lead[]; isOwner?: boolean }) {
  const [leads, setLeads] = useState<Lead[]>(initialLeads)
  const [statusFilter, setStatusFilter] = useState<LeadStatus | 'all'>('all')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [view, setView] = useState<'table' | 'kanban'>('table')
  const [mobileColumn, setMobileColumn] = useState<LeadStatus>('new')

  const sources = useMemo(() => {
    const dynamic = leads.map(l => l.source).filter(Boolean) as string[]
    const extra = dynamic.filter(s => !KNOWN_SOURCES.includes(s))
    return [...KNOWN_SOURCES, ...Array.from(new Set(extra)).sort()]
  }, [leads])

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
      {/* View toggle */}
      <div className="flex justify-end">
        <div className="flex border border-gray-200 rounded overflow-hidden">
          <button
            onClick={() => setView('table')}
            className={`px-4 py-2 text-sm ${
              view === 'table' ? 'bg-navy text-white' : 'bg-white text-gray-500 hover:bg-gray-50'
            }`}
          >
            ☰ Table
          </button>
          <button
            onClick={() => setView('kanban')}
            className={`px-4 py-2 text-sm ${
              view === 'kanban' ? 'bg-navy text-white' : 'bg-white text-gray-500 hover:bg-gray-50'
            }`}
          >
            ▦ Kanban
          </button>
        </div>
      </div>

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

      {/* Table view */}
      {view === 'table' && (
        <div className="bg-white rounded-sm shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Date', 'Status', 'Name', 'Phone', 'Email', 'Source', 'Property', 'Actions'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-400">No leads match filters.</td></tr>
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
                        <td className="px-4 py-3 text-gray-500 text-xs max-w-[160px] truncate">
                          {l.email ? (
                            <a href={`mailto:${l.email}`} className="text-blue-600 hover:underline" onClick={e => e.stopPropagation()}>
                              {l.email}
                            </a>
                          ) : '—'}
                        </td>
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
                          <td colSpan={8} className="px-4 py-5">
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
                                <FilesSection
                                  lead={l}
                                  onUpdate={updated => setLeads(prev => prev.map(x => x.id === updated.id ? updated : x))}
                                />
                                {isOwner && (
                                  <div className="pt-2">
                                    <button
                                      onClick={() => removeLead(l.id)}
                                      className="text-xs text-red-500 hover:text-red-700"
                                    >
                                      Delete lead
                                    </button>
                                  </div>
                                )}
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
      )}

      {/* Kanban view */}
      {view === 'kanban' && (
        <>
          {/* Desktop: 5-column grid (hidden on mobile) */}
          <div className="hidden md:grid grid-cols-5 gap-3">
            {STATUS_ORDER.map(status => {
              const columnLeads = filtered.filter(l => (l.status ?? 'new') === status)
              return (
                <div key={status}>
                  <div className="flex items-center justify-between mb-2 px-0.5">
                    <span className={`text-xs font-bold uppercase tracking-wider ${COLUMN_HEADER_COLOR[status]}`}>
                      {STATUS_META[status].label}
                    </span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${COLUMN_BADGE[status]}`}>
                      {columnLeads.length}
                    </span>
                  </div>
                  {columnLeads.map(l => (
                    <div
                      key={l.id}
                      onClick={() => { setView('table'); setOpenId(l.id) }}
                      className={`border-l-[3px] ${CARD_BORDER[(l.status ?? 'new') as LeadStatus]} bg-white border border-gray-100 rounded-sm p-3 mb-2 cursor-pointer hover:shadow-sm transition-shadow`}
                    >
                      <p className="font-semibold text-navy text-sm leading-tight">{l.name}</p>
                      <p className="text-gray-500 text-xs mt-0.5">{l.phone}</p>
                      {l.email && <p className="text-gray-500 text-xs">{l.email}</p>}
                      <span className="bg-green-50 text-green-800 text-[10px] px-1.5 py-0.5 rounded inline-block my-1">
                        {l.source}
                      </span>
                      {(l.propertyTitle || l.budget) && (
                        <div className="border-t border-gray-100 pt-1.5 mt-1 space-y-0.5">
                          {l.propertyTitle && (
                            <p className="text-gray-400 text-[10px]">{l.propertyTitle}</p>
                          )}
                          {l.budget && (
                            <p className="text-gray-400 text-[10px]">Budget: {l.budget}</p>
                          )}
                        </div>
                      )}
                      <div className="flex gap-1.5 mt-2" onClick={e => e.stopPropagation()}>
                        <a
                          href={`https://wa.me/${digitsOnly(l.phone)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-6 h-6 bg-[#25D366] rounded flex items-center justify-center text-white text-xs"
                        >
                          W
                        </a>
                        {l.email && (
                          <a
                            href={`mailto:${l.email}`}
                            className="w-6 h-6 bg-blue-500 rounded flex items-center justify-center text-white text-xs"
                          >
                            ✉
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                  {columnLeads.length === 0 && (
                    <p className="text-gray-300 text-xs text-center py-4">—</p>
                  )}
                </div>
              )
            })}
          </div>

          {/* Mobile: pill column selector + single column */}
          <div className="md:hidden">
            <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
              {STATUS_ORDER.map(status => {
                const count = filtered.filter(l => (l.status ?? 'new') === status).length
                return (
                  <button
                    key={status}
                    onClick={() => setMobileColumn(status)}
                    className={`shrink-0 text-xs px-3 py-1.5 rounded-full font-medium ${
                      mobileColumn === status
                        ? 'bg-navy text-white'
                        : 'bg-white text-gray-500 border border-gray-200'
                    }`}
                  >
                    {STATUS_META[status].label} {count}
                  </button>
                )
              })}
            </div>
            <div>
              {filtered
                .filter(l => (l.status ?? 'new') === mobileColumn)
                .map(l => (
                  <div
                    key={l.id}
                    onClick={() => { setView('table'); setOpenId(l.id) }}
                    className={`border-l-[3px] ${CARD_BORDER[(l.status ?? 'new') as LeadStatus]} bg-white border border-gray-100 rounded-sm p-3 mb-2 cursor-pointer hover:shadow-sm transition-shadow`}
                  >
                    <p className="font-semibold text-navy text-sm">{l.name}</p>
                    <p className="text-gray-500 text-xs mt-0.5">{l.phone}</p>
                    {l.email && <p className="text-gray-500 text-xs">{l.email}</p>}
                    <span className="bg-green-50 text-green-800 text-[10px] px-1.5 py-0.5 rounded inline-block my-1">
                      {l.source}
                    </span>
                    {(l.propertyTitle || l.budget) && (
                      <div className="border-t border-gray-100 pt-1.5 mt-1 space-y-0.5">
                        {l.propertyTitle && (
                          <p className="text-gray-400 text-[10px]">{l.propertyTitle}</p>
                        )}
                        {l.budget && (
                          <p className="text-gray-400 text-[10px]">Budget: {l.budget}</p>
                        )}
                      </div>
                    )}
                    <div className="flex gap-1.5 mt-2" onClick={e => e.stopPropagation()}>
                      <a
                        href={`https://wa.me/${digitsOnly(l.phone)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-6 h-6 bg-[#25D366] rounded flex items-center justify-center text-white text-xs"
                      >
                        W
                      </a>
                      {l.email && (
                        <a
                          href={`mailto:${l.email}`}
                          className="w-6 h-6 bg-blue-500 rounded flex items-center justify-center text-white text-xs"
                        >
                          ✉
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              {filtered.filter(l => (l.status ?? 'new') === mobileColumn).length === 0 && (
                <p className="text-gray-400 text-sm text-center py-8">No leads in this column.</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
