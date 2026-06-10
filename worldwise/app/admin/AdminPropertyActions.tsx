'use client'

import { useRouter } from 'next/navigation'

export default function AdminPropertyActions({ propertyId }: { propertyId: string }) {
  const router = useRouter()

  async function handleDelete() {
    if (!confirm('Delete this property? This cannot be undone.')) return
    const res = await fetch(`/api/properties/${propertyId}`, { method: 'DELETE' }).catch(() => null)
    if (!res?.ok) { alert('Delete failed'); return }
    router.refresh()
  }

  return (
    <button onClick={handleDelete} className="text-red-400 hover:text-red-600 text-xs">
      Delete
    </button>
  )
}
