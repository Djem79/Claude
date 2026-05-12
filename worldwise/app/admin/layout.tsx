import { getSession } from '@/lib/auth'
import AdminNav from './AdminNav'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSession()
  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav session={session} />
      {children}
    </div>
  )
}
