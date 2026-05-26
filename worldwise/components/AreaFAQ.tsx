import { AreaFaqItem } from '@/lib/areas'

type Props = {
  areaName: string
  items: AreaFaqItem[]
}

export default function AreaFAQ({ areaName, items }: Props) {
  return (
    <section className="py-20 bg-white">
      <div className="max-w-3xl mx-auto px-6">
        <div className="text-center mb-12">
          <p className="text-gold text-sm font-medium uppercase tracking-widest mb-2">
            FAQ
          </p>
          <h2 className="section-title">Investing in {areaName}</h2>
          <p className="section-subtitle">
            The questions investors most often ask our team.
          </p>
        </div>

        <div className="space-y-3">
          {items.map((item, i) => (
            <details
              key={i}
              className="group border border-gray-200 rounded-sm bg-white open:shadow-sm"
            >
              <summary className="cursor-pointer list-none px-5 py-4 flex justify-between items-center gap-4 hover:bg-gray-50 transition-colors">
                <span className="font-serif text-navy text-lg leading-snug">{item.q}</span>
                <span className="text-gold text-2xl leading-none group-open:rotate-45 transition-transform">
                  +
                </span>
              </summary>
              <div className="px-5 pb-5 -mt-1">
                <p className="text-gray-600 leading-relaxed">{item.a}</p>
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}
