'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function AdminPropertyActions({ propertyId }: { propertyId: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function handleDelete() {
    if (busy) return
    if (!confirm('Delete this property? This cannot be undone.')) return
    setBusy(true)
    const res = await fetch(`/api/properties/${propertyId}`, { method: 'DELETE' }).catch(() => null)
    // Keep `busy` on success — router.refresh() drops this row; a second click would 404.
    if (!res?.ok) { setBusy(false); alert('Delete failed'); return }
    router.refresh()
  }

  return (
    <button onClick={handleDelete} disabled={busy} className="text-red-400 hover:text-red-600 text-xs disabled:opacity-50">
      {busy ? 'Deleting…' : 'Delete'}
    </button>
  )
}
