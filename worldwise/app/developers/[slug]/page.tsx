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

export async function generateMetadata(props: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const params = await props.params;
  const dev = getDeveloper(params.slug)
  if (!dev) return {}
  // metadata.title stays brandless (layout title.template appends the brand once);
  // og/twitter titles need the brand explicitly — the template does NOT apply to them.
  const title = `${dev.name} Projects in Dubai`
  const ogTitle = `${title} | Worldwise Real Estate`
  const url = `${BASE}/developers/${dev.slug}`
  const ogImage = `${BASE}/opengraph-image`
  return {
    title,
    description: dev.blurb,
    alternates: { canonical: url },
    openGraph: { title: ogTitle, description: dev.blurb, url, type: 'website', images: [{ url: ogImage, width: 1200, height: 630, alt: dev.name }] },
    twitter: { card: 'summary_large_image', title: ogTitle, description: dev.blurb, images: [ogImage] },
  }
}

export default async function DeveloperPage(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
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
  const faqJsonLd = dev.faqs?.length
    ? {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: dev.faqs.map(f => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      }
    : null

  return (
    <>
      <Navigation />
      <JsonLd data={breadcrumbJsonLd} />
      <JsonLd data={orgJsonLd} />
      {faqJsonLd && <JsonLd data={faqJsonLd} />}
      <DeveloperPageClient developer={dev} listingCount={matched.length}>
        {dev.intro && (
          <section className="py-16 bg-white">
            <div className="max-w-3xl mx-auto px-6">
              <h2 className="section-title mb-6">About {dev.name} in Dubai</h2>
              <p className="text-gray-600 leading-relaxed text-lg">{dev.intro}</p>
            </div>
          </section>
        )}
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
        {dev.faqs?.length ? (
          <section className="py-16 bg-white">
            <div className="max-w-3xl mx-auto px-6">
              <h2 className="section-title text-center mb-10">{dev.name} — frequently asked questions</h2>
              <div className="space-y-6">
                {dev.faqs.map(f => (
                  <div key={f.q} className="border-b border-gray-100 pb-5">
                    <h3 className="font-serif text-xl text-navy mb-2">{f.q}</h3>
                    <p className="text-gray-600 leading-relaxed">{f.a}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        ) : null}
        <LeadCaptureSection source={source} />
      </DeveloperPageClient>
      <FloatingCTA />
      <Footer />
    </>
  )
}
