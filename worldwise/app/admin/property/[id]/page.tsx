import { getPropertyById } from '@/lib/properties'
import { notFound, redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { canAccess, landingPath } from '@/lib/permissions'
import PropertyForm from '../PropertyForm'

export const dynamic = 'force-dynamic'

export default async function EditPropertyPage({ params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) redirect('/admin/login')
  if (!canAccess(session, 'properties')) redirect(landingPath(session) ?? '/admin')

  const property = getPropertyById(params.id)
  if (!property) notFound()

  return (
    <div className="max-w-3xl mx-auto px-8 py-10">
      <PropertyForm property={property} />
    </div>
  )
}
