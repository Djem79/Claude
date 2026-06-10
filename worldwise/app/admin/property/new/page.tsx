import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { canAccess, landingPath } from '@/lib/permissions'
import { getDraft } from '@/lib/property-drafts'
import { Property } from '@/types'
import PropertyForm from '../PropertyForm'

export const dynamic = 'force-dynamic'

export default async function NewPropertyPage(props: { searchParams: Promise<{ draft?: string }> }) {
  const searchParams = await props.searchParams;
  const session = await getSession()
  if (!session) redirect('/admin/login')
  if (!canAccess(session, 'properties')) redirect(landingPath(session) ?? '/admin')

  const draftId = typeof searchParams.draft === 'string' ? searchParams.draft : undefined
  let prefill: Property | undefined
  let activeDraftId: string | undefined

  if (draftId) {
    const d = getDraft(draftId)
    if (d) {
      activeDraftId = draftId
      // Build a full Property shape for the form: blank defaults, draft fields on top.
      // images is resolved separately so the key appears only once in the literal.
      const resolvedImages = d.imageCandidates.length ? d.imageCandidates : (d.fields.images ?? [])
      const base: Property = {
        id: draftId, slug: '', title: '', developer: '', area: '',
        type: 'apartment', status: 'off-plan', priceAed: 0,
        bedrooms: '', description: '', shortDescription: '',
        amenities: [], images: [], featured: false, createdAt: '',
      }
      prefill = { ...base, ...d.fields, id: draftId, images: resolvedImages }
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-8 py-10">
      <PropertyForm property={prefill} draftId={activeDraftId} />
    </div>
  )
}
