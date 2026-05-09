'use client'

import { useRouter } from 'next/navigation'

export default function AdminPropertyActions({ propertyId }: { propertyId: string }) {
  const router = useRouter()

  async function handleDelete() {
    if (!confirm('Delete this property? This cannot be undone.')) return
    await fetch(`/api/properties/${propertyId}`, { method: 'DELETE' })
    router.refresh()
  }

  return (
    <button onClick={handleDelete} className="text-red-400 hover:text-red-600 text-xs">
      Delete
    </button>
  )
}
