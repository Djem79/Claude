import { getPropertyById } from '@/lib/properties'
import { notFound } from 'next/navigation'
import PropertyForm from '../PropertyForm'

export const dynamic = 'force-dynamic'

export default function EditPropertyPage({ params }: { params: { id: string } }) {
  const property = getPropertyById(params.id)
  if (!property) notFound()

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-navy text-white px-8 py-4 flex items-center gap-4">
        <a href="/admin" className="text-white/60 hover:text-white text-sm">← Back</a>
        <span className="font-serif text-xl">Edit: {property.title}</span>
      </header>
      <div className="max-w-3xl mx-auto px-8 py-10">
        <PropertyForm property={property} />
      </div>
    </div>
  )
}
