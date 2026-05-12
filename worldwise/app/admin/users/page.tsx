import { getSession } from '@/lib/auth'
import { getUsers } from '@/lib/users'
import { redirect } from 'next/navigation'
import UsersClient from './UsersClient'
import { AdminUser } from '@/types'

export const dynamic = 'force-dynamic'

type SafeUser = Omit<AdminUser, 'passwordHash'>

function safeUser(u: AdminUser): SafeUser {
  const { passwordHash, ...rest } = u
  return rest
}

export default async function UsersPage() {
  const session = await getSession()
  if (!session || session.role !== 'owner') redirect('/admin')

  const users = getUsers().map(safeUser)

  return (
    <div className="max-w-5xl mx-auto px-8 py-10">
      <UsersClient initialUsers={users} currentUsername={session.username} />
    </div>
  )
}
