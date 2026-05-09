import Link from 'next/link'
import { getProperties } from '@/lib/properties'
import { getLeads } from '@/lib/leads'
import AdminPropertyActions from './AdminPropertyActions'
import LogoutButton from './LogoutButton'

export const dynamic = 'force-dynamic'

function formatPrice(aed: number) {
  return aed >= 1_000_000 ? `AED ${(aed / 1_000_000).toFixed(2)}M` : `AED ${(aed / 1000).toFixed(0)}K`
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function AdminPage() {
  const properties = getProperties()
  const leads = getLeads()
  const recentLeads = leads.slice(0, 20)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-navy text-white px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <span className="font-serif text-xl">WORLDWISE</span>
          <span className="text-white/40 text-sm">Admin Panel</span>
          <nav className="flex gap-5 text-sm">
            <Link href="/admin" className="text-white">Properties</Link>
            <Link href="/admin/leads" className="text-white/60 hover:text-white">Leads</Link>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/" target="_blank" className="text-white/60 hover:text-white text-sm">
            View Site ↗
          </Link>
          <LogoutButton />
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-8 py-10 space-y-12">
        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Properties', value: properties.length },
            { label: 'Featured', value: properties.filter(p => p.featured).length },
            { label: 'Total Leads', value: leads.length },
            { label: 'New Leads (7 days)', value: leads.filter(l => Date.now() - new Date(l.createdAt).getTime() < 7 * 86400_000).length },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-sm p-5 shadow-sm border border-gray-100">
              <p className="text-gray-400 text-xs font-medium uppercase tracking-wide">{s.label}</p>
              <p className="font-serif text-3xl text-navy mt-1">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Properties table */}
        <div>
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-serif text-2xl text-navy">Properties</h2>
            <Link href="/admin/property/new" className="btn-primary text-sm px-5 py-2.5">
              + Add Property
            </Link>
          </div>

          <div className="bg-white rounded-sm shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {['Property', 'Developer', 'Area', 'Price', 'Status', 'Featured', 'Actions'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {properties.map(p => (
                    <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-navy">{p.title}</td>
                      <td className="px-4 py-3 text-gray-500">{p.developer}</td>
                      <td className="px-4 py-3 text-gray-500">{p.area}</td>
                      <td className="px-4 py-3 font-medium text-navy">{formatPrice(p.priceAed)}</td>
                      <td className="px-4 py-3">
                        <span className={`badge text-xs ${p.status === 'off-plan' ? 'bg-blue-50 text-blue-700' : p.status === 'ready' ? 'bg-green-50 text-green-700' : p.status === 'rent' ? 'bg-purple-50 text-purple-700' : 'bg-amber-50 text-amber-700'}`}>
                          {p.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium ${p.featured ? 'text-gold' : 'text-gray-300'}`}>
                          {p.featured ? '★ Yes' : '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-3">
                          <Link href={`/admin/property/${p.id}`} className="text-gold hover:underline text-xs">
                            Edit
                          </Link>
                          <Link href={`/properties/${p.slug}`} target="_blank" className="text-gray-400 hover:text-navy text-xs">
                            View
                          </Link>
                          <AdminPropertyActions propertyId={p.id} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Leads table */}
        <div>
          <h2 className="font-serif text-2xl text-navy mb-5">
            Recent Leads{' '}
            <span className="text-gray-400 text-lg font-sans font-normal">({leads.length} total)</span>
          </h2>

          <div className="bg-white rounded-sm shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {['Date', 'Name', 'Phone', 'Budget', 'Source', 'Property'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {recentLeads.map(l => (
                    <tr key={l.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-400 whitespace-nowrap">{formatDate(l.createdAt)}</td>
                      <td className="px-4 py-3 font-medium text-navy">{l.name}</td>
                      <td className="px-4 py-3">
                        <a href={`https://wa.me/${l.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="text-gold hover:underline">
                          {l.phone}
                        </a>
                      </td>
                      <td className="px-4 py-3 text-gray-500">{l.budget ?? '—'}</td>
                      <td className="px-4 py-3">
                        <span className="badge bg-gray-100 text-gray-600 text-xs">{l.source}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-500">{l.propertyTitle ?? '—'}</td>
                    </tr>
                  ))}
                  {recentLeads.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                        No leads yet. Leads appear here when visitors fill in a form.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
