import Image from 'next/image'

// "Your advisor" trust block — a named, RERA-licensed face in the funnel.
// Used on the /guide lead-magnet gate and at the foot of blog articles.
// White card; reads cleanly on both navy and light surfaces.
export default function AdvisorCard({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center gap-5 rounded-sm border border-gray-200 bg-white p-5 shadow-sm ${className}`}>
      <div className="relative w-24 h-28 flex-shrink-0 overflow-hidden rounded-sm bg-navy/10">
        <Image
          src="/images/team/max-advisor.jpg"
          alt="Max Rean — Worldwise Real Estate advisor"
          width={120}
          height={140}
          className="w-full h-full object-cover object-top"
        />
      </div>
      <div className="min-w-0 text-left">
        <p className="text-gold-accessible text-[11px] font-medium uppercase tracking-widest mb-1">Your advisor</p>
        <h3 className="font-serif text-navy text-lg leading-snug">Max Rean</h3>
        <p className="text-gray-500 text-sm mb-2">Business Director &amp; Property Advisor</p>
        <p className="text-gray-500 text-xs leading-relaxed">
          RERA-licensed · Dubai off-plan &amp; ready specialist · replies within 2 hours.
        </p>
      </div>
    </div>
  )
}
