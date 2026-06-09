import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { canAccess, landingPath } from '@/lib/permissions'
import FilesClient from './FilesClient'

export const dynamic = 'force-dynamic'

export default async function FilesPage() {
  const session = await getSession()
  if (!session) redirect('/admin/login')
  if (!canAccess(session, 'files')) redirect(landingPath(session) ?? '/admin')
  return <FilesClient />
}
