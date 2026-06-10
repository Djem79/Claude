'use client'

import { useRef, useState } from 'react'
import { Lead, FileAttachment } from '@/types'
import { fmt, digitsOnly } from './lead-ui'

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

export default function FilesSection({ lead, onUpdate }: { lead: Lead; onUpdate: (updated: Lead) => void }) {
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
    try {
      const res = await fetch(`/api/leads/${lead.id}/files`, { method: 'POST', body: form })
      if (res.ok) onUpdate(await res.json())
      else alert((await res.json().catch(() => ({}))).error ?? 'Upload failed')
    } catch {
      alert('Upload failed')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function handleDelete(fileId: string) {
    if (!confirm('Delete this file? This cannot be undone.')) return
    try {
      const res = await fetch(`/api/leads/${lead.id}/files/${fileId}`, { method: 'DELETE' })
      if (res.ok) onUpdate(await res.json())
      else alert((await res.json().catch(() => ({}))).error ?? 'Delete failed')
    } catch {
      alert('Delete failed')
    }
  }

  async function handleEmail(fileId: string) {
    setSendingId(fileId)
    try {
      const res = await fetch(`/api/leads/${lead.id}/files/${fileId}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ via: 'email' }),
      })
      if (res.ok) onUpdate(await res.json())
      else alert((await res.json().catch(() => ({}))).error ?? 'Email failed')
    } catch {
      alert('Email failed')
    } finally {
      setSendingId(null)
    }
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
