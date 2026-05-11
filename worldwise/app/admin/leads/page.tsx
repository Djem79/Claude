import Link from 'next/link'
import { getLeads, leadStats } from '@/lib/leads'
import { getSession } from '@/lib/auth'
import LogoutButton from '../LogoutButton'
import LeadsClient from './LeadsClient'

export const dynamic = 'force-dynamic'

export default async function LeadsPage() {
  const session = await getSession()
  const leads = getLeads()
  const stats = leadStats(leads)

  const cards = [
    { label: 'Total Leads', value: stats.total },
    { label: 'New (24h)', value: stats.new24h },
    { label: 'New (7 days)', value: stats.new7d },
    { label: 'In Progress', value: stats.byStatus['in-progress'] + stats.byStatus.contacted },
    { label: 'Won', value: stats.byStatus.won },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-navy text-white px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <span className="font-serif text-xl">WORLDWISE</span>
          <span className="text-white/40 text-sm">Admin Panel</span>
          <nav className="flex gap-5 text-sm">
            <Link href="/admin" className="text-white/60 hover:text-white">Properties</Link>
            <Link href="/admin/leads" className="text-white">Leads</Link>
            {session?.role === 'owner' && (
              <Link href="/admin/users" className="text-white/60 hover:text-white">Users</Link>
            )}
          </nav>
        </div>
        <div className="flex items-center gap-4">
          {session && <span className="text-white/50 text-sm">{session.name}</span>}
          <Link href="/" target="_blank" className="text-white/60 hover:text-white text-sm">View Site ↗</Link>
          <LogoutButton />
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-8 py-10 space-y-8">
        <div>
          <h1 className="font-serif text-3xl text-navy mb-1">Leads CRM</h1>
          <p className="text-gray-500 text-sm">Track and manage all enquiries from the website.</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {cards.map(c => (
            <div key={c.label} className="bg-white rounded-sm p-5 shadow-sm border border-gray-100">
              <p className="text-gray-400 text-xs font-medium uppercase tracking-wide">{c.label}</p>
              <p className="font-serif text-3xl text-navy mt-1">{c.value}</p>
            </div>
          ))}
        </div>

        <LeadsClient initialLeads={leads} isOwner={session?.role === 'owner'} />
      </div>
    </div>
  )
}
