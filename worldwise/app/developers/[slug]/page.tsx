import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Navigation from '@/components/Navigation'
import Footer from '@/components/Footer'
import FloatingCTA from '@/components/FloatingCTA'
import LeadCaptureSection from '@/components/LeadCaptureSection'
import PropertyCard from '@/components/PropertyCard'
import JsonLd from '@/components/JsonLd'
import DeveloperPageClient from './DeveloperPageClient'
import { getDeveloper, developerSlugs, propertyMatchesDeveloper } from '@/lib/developers'
import { getProperties } from '@/lib/properties'

const BASE = 'https://worldwise.pro'
export const revalidate = 60

export function generateStaticParams() {
  return developerSlugs.map(slug => ({ slug }))
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const dev = getDeveloper(params.slug)
  if (!dev) return {}
  const title = `${dev.name} Projects in Dubai | Worldwise Real Estate`
  const url = `${BASE}/developers/${dev.slug}`
  return {
    title,
    description: dev.blurb,
    alternates: { canonical: url },
    openGraph: { title, description: dev.blurb, url, type: 'website' },
  }
}

export default function DeveloperPage({ params }: { params: { slug: string } }) {
  const dev = getDeveloper(params.slug)
  if (!dev) notFound()
  const matched = getProperties().filter(p => propertyMatchesDeveloper(p.developer, dev))
  const source = `developer_${dev.slug.replace(/-/g, '_')}`

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: BASE },
      { '@type': 'ListItem', position: 2, name: 'Developers', item: `${BASE}/developers` },
      { '@type': 'ListItem', position: 3, name: dev.name, item: `${BASE}/developers/${dev.slug}` },
    ],
  }
  const orgJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: dev.name,
    description: dev.blurb,
    url: `${BASE}/developers/${dev.slug}`,
    ...(dev.logo ? { logo: `${BASE}${dev.logo}` } : {}),
  }

  return (
    <>
      <Navigation />
      <JsonLd data={breadcrumbJsonLd} />
      <JsonLd data={orgJsonLd} />
      <DeveloperPageClient developer={dev} listingCount={matched.length}>
        <section className="py-16 bg-[#F8F8F6]">
          <div className="max-w-7xl mx-auto px-6">
            <h2 className="section-title text-center mb-10">Available {dev.name} properties</h2>
            {matched.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {matched.map(p => <PropertyCard key={p.id} property={p} />)}
              </div>
            ) : (
              <p className="text-center text-gray-500">
                New {dev.name} launches are added regularly — contact us for current availability.
              </p>
            )}
          </div>
        </section>
        <LeadCaptureSection source={source} />
      </DeveloperPageClient>
      <FloatingCTA />
      <Footer />
    </>
  )
}
