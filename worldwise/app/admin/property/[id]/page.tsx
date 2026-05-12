import { getPropertyById } from '@/lib/properties'
import { notFound } from 'next/navigation'
import PropertyForm from '../PropertyForm'

export const dynamic = 'force-dynamic'

export default function EditPropertyPage({ params }: { params: { id: string } }) {
  const property = getPropertyById(params.id)
  if (!property) notFound()

  return (
    <div className="max-w-3xl mx-auto px-8 py-10">
      <PropertyForm property={property} />
    </div>
  )
}
