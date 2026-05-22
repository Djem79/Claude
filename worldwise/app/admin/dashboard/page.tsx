import { getLeads, leadStats } from '@/lib/leads'
import { Lead, LeadStatus } from '@/types'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { canAccess, landingPath } from '@/lib/permissions'

export const dynamic = 'force-dynamic'

const STATUS_BADGE: Record<LeadStatus, string> = {
  new: 'bg-blue-50 text-blue-700',
  contacted: 'bg-amber-50 text-amber-700',
  'in-progress': 'bg-purple-50 text-purple-700',
  won: 'bg-green-50 text-green-700',
  lost: 'bg-red-100 text-red-700',
}

const STATUS_LABEL: Record<LeadStatus, string> = {
  new: 'New',
  contacted: 'Contacted',
  'in-progress': 'In Progress',
  won: 'Won',
  lost: 'Lost',
}

const FUNNEL: { status: LeadStatus; fill: string }[] = [
  { status: 'new', fill: 'bg-navy' },
  { status: 'contacted', fill: 'bg-navy opacity-75' },
  { status: 'in-progress', fill: 'bg-navy opacity-60' },
  { status: 'won', fill: 'bg-gold' },
  { status: 'lost', fill: 'bg-gray-300' },
]

function timeAgo(iso: string): string {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime())
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function buildChartData(leads: Lead[]): { date: string; count: number }[] {
  const buckets: Record<string, number> = {}
  const now = new Date()
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    buckets[d.toISOString().slice(0, 10)] = 0
  }
  for (const l of leads) {
    const key = l.createdAt.slice(0, 10)
    if (key in buckets) buckets[key]++
  }
  return Object.entries(buckets).map(([date, count]) => ({ date, count }))
}

export default async function DashboardPage() {
  const session = await getSession()
  if (!session) redirect('/admin/login')
  if (!canAccess(session, 'dashboard')) redirect(landingPath(session) ?? '/admin')
  const leads = getLeads()
  const stats = leadStats(leads)
  const chartData = buildChartData(leads)
  const maxCount = Math.max(...chartData.map(d => d.count), 1)
  const today = new Date().toISOString().slice(0, 10)
  const convPct = stats.total > 0 ? Math.round((stats.byStatus.won / stats.total) * 100) : 0

  const recentLeads = [...leads]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5)

  const statCards = [
    { label: 'Total Leads', value: stats.total, valCls: 'text-navy', cardCls: 'bg-white border-gray-100', labelCls: 'text-gray-400' },
    { label: 'New (24h)', value: stats.new24h, valCls: 'text-navy', cardCls: 'bg-white border-gray-100', labelCls: 'text-gray-400' },
    { label: 'In Progress', value: stats.byStatus['in-progress'], valCls: 'text-navy', cardCls: 'bg-white border-gray-100', labelCls: 'text-gray-400' },
    { label: 'Won', value: stats.byStatus.won, valCls: 'text-gold', cardCls: 'bg-white border-gray-100', labelCls: 'text-gray-400' },
    { label: 'Conversion', value: `${convPct}%`, valCls: 'text-gold', cardCls: 'bg-navy border-navy', labelCls: 'text-white/60' },
  ]

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      <div>
        <h1 className="font-serif text-3xl text-navy">Dashboard</h1>
        <p className="text-gray-400 text-sm mt-1">
          {new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {statCards.map(c => (
          <div key={c.label} className={`${c.cardCls} border rounded-sm p-4`}>
            <p className={`text-xs font-semibold uppercase tracking-wide ${c.labelCls}`}>
              {c.label}
            </p>
            <p className={`font-serif text-3xl mt-1 ${c.valCls}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Chart + Funnel */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Bar chart */}
        <div className="bg-white border border-gray-100 rounded-sm p-4">
          <p className="font-serif text-navy text-sm font-semibold mb-3">
            Lead Acquisition · Last 30 days
          </p>
          <div className="flex items-end gap-0.5 h-24">
            {chartData.map(d => (
              <div
                key={d.date}
                className={`flex-1 rounded-t-sm ${d.date === today ? 'bg-gold' : 'bg-navy/15'}`}
                style={{ height: `${Math.max(4, (d.count / maxCount) * 100)}%` }}
              />
            ))}
          </div>
          <div className="flex justify-between mt-2">
            <span className="text-gray-400 text-xs">
              {chartData[0]?.date.slice(5).replace('-', ' ')}
            </span>
            <span className="text-gray-400 text-xs">Today</span>
          </div>
        </div>

        {/* Funnel */}
        <div className="bg-white border border-gray-100 rounded-sm p-4">
          <p className="font-serif text-navy text-sm font-semibold mb-3">Lead Funnel</p>
          <div className="space-y-3">
            {FUNNEL.map(row => {
              const count = stats.byStatus[row.status]
              const pct = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0
              return (
                <div key={row.status} className="flex items-center gap-3">
                  <span className="text-slate-600 text-xs w-[72px] shrink-0">
                    {STATUS_LABEL[row.status]}
                  </span>
                  <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`${row.fill} h-full rounded-full`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-gray-400 text-xs w-4 text-right">{count}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Recent leads */}
      <div className="bg-white border border-gray-100 rounded-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="font-serif text-navy text-sm font-semibold">Recent Leads</p>
          <Link href="/admin/leads" className="text-gold text-xs hover:underline">
            View all →
          </Link>
        </div>
        <table className="w-full text-sm">
          <thead className="sr-only">
            <tr>
              <th>Name</th>
              <th>Phone</th>
              <th>Status</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {recentLeads.length === 0 && (
              <tr>
                <td colSpan={4} className="py-6 text-center text-gray-400 text-sm">
                  No leads yet.
                </td>
              </tr>
            )}
            {recentLeads.map(l => {
              const status = (l.status ?? 'new') as LeadStatus
              return (
                <tr key={l.id}>
                  <td className="py-2 font-medium text-navy text-sm">{l.name}</td>
                  <td className="py-2 text-gray-500 text-xs">{l.phone}</td>
                  <td className="py-2">
                    <span className={`badge text-xs ${STATUS_BADGE[status]}`}>
                      {STATUS_LABEL[status]}
                    </span>
                  </td>
                  <td className="py-2 text-gray-400 text-xs text-right">
                    {timeAgo(l.createdAt)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
