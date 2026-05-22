import Link from 'next/link'
import { getProperties } from '@/lib/properties'
import { getLeads } from '@/lib/leads'
import AdminPropertyActions from './AdminPropertyActions'

export const dynamic = 'force-dynamic'

function formatPrice(aed: number) {
  return aed >= 1_000_000 ? `AED ${(aed / 1_000_000).toFixed(2)}M` : `AED ${(aed / 1000).toFixed(0)}K`
}

export default function AdminPage() {
  const properties = getProperties()
  const leads = getLeads()

  return (
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
                      <span className={`badge text-xs ${p.status === 'off-plan' ? 'bg-blue-50 text-blue-700' : p.status === 'rent' ? 'bg-purple-50 text-purple-700' : 'bg-amber-50 text-amber-700'}`}>
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

    </div>
  )
}
