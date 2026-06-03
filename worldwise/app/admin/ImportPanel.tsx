'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { PropertyDraft } from '@/types'

export default function ImportPanel({ initialDrafts }: { initialDrafts: PropertyDraft[] }) {
  const router = useRouter()
  const [drafts, setDrafts] = useState<PropertyDraft[]>(initialDrafts)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function refresh() {
    const res = await fetch('/api/admin/import')
    if (res.ok) setDrafts(await res.json())
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy(true); setError('')
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/admin/import', { method: 'POST', body: fd })
    if (!res.ok) setError((await res.json().catch(() => ({}))).error || 'Import failed')
    else await refresh()
    setBusy(false)
    e.target.value = ''
  }

  async function publish(id: string) {
    setBusy(true); setError('')
    const res = await fetch(`/api/admin/import/${id}/publish`, { method: 'POST' })
    setBusy(false)
    if (res.ok) { await refresh(); router.refresh() }
    else setError((await res.json().catch(() => ({}))).error || 'Publish failed')
  }

  async function reject(id: string) {
    if (!confirm('Reject and delete this draft?')) return
    await fetch(`/api/admin/import/${id}`, { method: 'DELETE' })
    await refresh()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="font-serif text-2xl text-navy">Import from PDF</h2>
        <label className={`btn-outline text-sm px-5 py-2.5 cursor-pointer ${busy ? 'opacity-50 pointer-events-none' : ''}`}>
          {busy ? 'Working\u2026' : '+ Upload developer PDF'}
          <input type="file" accept="application/pdf" className="hidden" onChange={onFile} disabled={busy} />
        </label>
      </div>

      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

      {drafts.length === 0 ? (
        <p className="text-gray-400 text-sm mb-4">No pending imports. Upload a developer brochure PDF to extract a draft.</p>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
          {drafts.map(d => (
            <div key={d.draftId} className="bg-white rounded-sm shadow-sm border border-gray-100 p-4">
              {d.imageCandidates[0] && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={d.imageCandidates[0]} alt="" className="w-full h-32 object-cover rounded-sm mb-3" />
              )}
              <p className="font-medium text-navy truncate">{d.fields.title || '(untitled)'}</p>
              <p className="text-xs text-gray-500 truncate">{d.fields.developer || '\u2014'} \u00b7 {d.fields.area || '\u2014'}</p>
              <p className="text-xs text-gray-400 mt-1">
                {d.fields.priceAed ? `AED ${d.fields.priceAed.toLocaleString()}` : 'no price'} \u00b7 {d.imageCandidates.length} photo(s)
              </p>
              <p className="text-[11px] text-gray-300 truncate mt-1" title={d.sourcePdf}>{d.sourcePdf}</p>
              <div className="flex gap-3 mt-3 text-xs">
                <Link href={`/admin/property/new?draft=${d.draftId}`} className="text-gold-accessible hover:underline">Review &amp; edit</Link>
                <button onClick={() => publish(d.draftId)} disabled={busy} className="text-green-600 hover:underline">Publish</button>
                <button onClick={() => reject(d.draftId)} className="text-red-400 hover:text-red-600">Reject</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
