import Link from 'next/link'
import { getSession } from '@/lib/auth'
import { getUsers } from '@/lib/users'
import { redirect } from 'next/navigation'
import LogoutButton from '../LogoutButton'
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
    <div className="min-h-screen bg-gray-50">
      <header className="bg-navy text-white px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <span className="font-serif text-xl">WORLDWISE</span>
          <span className="text-white/40 text-sm">Admin Panel</span>
          <nav className="flex gap-5 text-sm">
            <Link href="/admin" className="text-white/60 hover:text-white">Properties</Link>
            <Link href="/admin/leads" className="text-white/60 hover:text-white">Leads</Link>
            <Link href="/admin/users" className="text-white">Users</Link>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-white/50 text-sm">{session.name}</span>
          <Link href="/" target="_blank" className="text-white/60 hover:text-white text-sm">View Site ↗</Link>
          <LogoutButton />
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-8 py-10">
        <UsersClient initialUsers={users} currentUsername={session.username} />
      </div>
    </div>
  )
}
