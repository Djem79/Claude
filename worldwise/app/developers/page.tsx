import type { Metadata } from 'next'
import Link from 'next/link'
import Navigation from '@/components/Navigation'
import Footer from '@/components/Footer'
import FloatingCTA from '@/components/FloatingCTA'
import JsonLd from '@/components/JsonLd'
import { developers, propertyMatchesDeveloper } from '@/lib/developers'
import { getProperties } from '@/lib/properties'

const BASE = 'https://worldwise.pro'
export const revalidate = 60

export const metadata: Metadata = {
  title: 'Dubai Property Developers',
  description: "Browse Dubai's leading developers — Emaar, DAMAC, Sobha, Ellington, Danube and more. See available projects and request developer pricing.",
  alternates: { canonical: `${BASE}/developers` },
}

export default function DevelopersIndex() {
  const props = getProperties()
  const cards = developers
    .map(d => ({ d, count: props.filter(p => propertyMatchesDeveloper(p.developer, d)).length }))
    .sort((a, b) => b.count - a.count)

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: BASE },
      { '@type': 'ListItem', position: 2, name: 'Developers', item: `${BASE}/developers` },
    ],
  }

  return (
    <>
      <Navigation />
      <JsonLd data={breadcrumbJsonLd} />
      <main className="pt-24 min-h-screen bg-[#F8F8F6]">
        <div className="max-w-7xl mx-auto px-6 pb-20">
          <div className="py-10 text-center">
            <p className="text-gold-accessible text-sm font-medium uppercase tracking-widest mb-2">Developers</p>
            <h1 className="font-serif text-4xl md:text-5xl text-navy">Dubai&apos;s Leading Developers</h1>
            <p className="text-gray-500 mt-2 max-w-2xl mx-auto">
              We work directly with Dubai&apos;s top developers for priority access to new launches and developer pricing.
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {cards.map(({ d, count }) => (
              <Link
                key={d.slug}
                href={`/developers/${d.slug}`}
                className="bg-white rounded-sm border border-gray-200 p-6 flex flex-col items-center text-center gap-3 hover:border-gold hover:shadow-md transition-all"
              >
                <div className="h-12 flex items-center justify-center">
                  {d.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={d.logo} alt={d.name} className="max-h-12 w-auto object-contain" />
                  ) : (
                    <span className="font-serif text-2xl text-navy">
                      {d.name.split(' ').map(w => w[0]).slice(0, 2).join('')}
                    </span>
                  )}
                </div>
                <span className="font-serif text-lg text-navy leading-tight">{d.name}</span>
                <span className="text-xs text-gray-500">{count} {count === 1 ? 'property' : 'properties'}</span>
              </Link>
            ))}
          </div>
        </div>
      </main>
      <FloatingCTA />
      <Footer />
    </>
  )
}
