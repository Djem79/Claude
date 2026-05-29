import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Navigation from '@/components/Navigation'
import Footer from '@/components/Footer'
import FloatingCTA from '@/components/FloatingCTA'
import LeadCaptureSection from '@/components/LeadCaptureSection'
import AreaFeaturedProperties from '@/components/AreaFeaturedProperties'
import AreaFAQ from '@/components/AreaFAQ'
import AreaPageClient from './AreaPageClient'
import { getArea, areaSlugs, propertyMatchesArea } from '@/lib/areas'
import { getProperties } from '@/lib/properties'

const BASE = 'https://worldwise.pro'
const FEATURED_LIMIT = 6

// ISR: re-read data/properties.json so newly added listings appear in the area
// grid without a full redeploy (matches /properties and the homepage).
export const revalidate = 60

export function generateStaticParams() {
  return areaSlugs.map(slug => ({ area: slug }))
}

export async function generateMetadata({
  params,
}: {
  params: { area: string }
}): Promise<Metadata> {
  const area = getArea(params.area)
  if (!area) return {}

  const title = `${area.name} Apartments & Investment Properties | Worldwise Real Estate`
  const url = `${BASE}/${area.slug}`
  const image = `${BASE}${area.heroImage}`

  return {
    title,
    description: area.metaDescription,
    alternates: { canonical: url },
    openGraph: {
      title,
      description: area.metaDescription,
      url,
      type: 'website',
      images: [{ url: image, width: 1200, height: 800, alt: area.name }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: area.metaDescription,
      images: [image],
    },
  }
}

export default function AreaPage({ params }: { params: { area: string } }) {
  const area = getArea(params.area)
  if (!area) notFound()

  const allProperties = getProperties()
  const inArea = allProperties.filter(p => propertyMatchesArea(p.area, area))
  const featured = inArea.slice(0, FEATURED_LIMIT)
  const listingCount = inArea.length

  const placeJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Place',
    name: area.name,
    description: area.metaDescription,
    image: `${BASE}${area.heroImage}`,
    address: {
      '@type': 'PostalAddress',
      addressLocality: area.name,
      addressRegion: 'Dubai',
      addressCountry: 'AE',
    },
  }

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: BASE },
      { '@type': 'ListItem', position: 2, name: area.name, item: `${BASE}/${area.slug}` },
    ],
  }

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: area.faq.map(item => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  }

  const leadSource = `area_${area.slug.replace(/-/g, '_')}`

  return (
    <>
      <Navigation transparent />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(placeJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <AreaPageClient area={area} listingCount={listingCount}>
        <section className="py-20 bg-white">
          <div className="max-w-3xl mx-auto px-6">
            <p className="text-gold-accessible text-sm font-medium uppercase tracking-widest mb-2">
              Why Invest
            </p>
            <h2 className="font-serif text-3xl md:text-4xl text-navy mb-8 leading-tight">
              Why {area.name} works for investors
            </h2>
            <div className="space-y-5 text-gray-700 leading-relaxed text-lg">
              {area.whyInvest.map((paragraph, i) => (
                <p key={i}>{paragraph}</p>
              ))}
            </div>
          </div>
        </section>

        <section className="py-16 bg-gray-50">
          <div className="max-w-5xl mx-auto px-6">
            <div className="text-center mb-10">
              <p className="text-gold-accessible text-sm font-medium uppercase tracking-widest mb-2">
                Key Stats
              </p>
              <h2 className="section-title">{area.name} at a glance</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="Average price" value={area.metrics.avgPrice} />
              <StatCard label="Rental yield" value={area.metrics.roi} accent />
              <StatCard label="Typical size" value={area.metrics.typicalSize} />
              <StatCard label="Handover" value={area.metrics.handover} small />
            </div>
          </div>
        </section>

        <AreaFeaturedProperties areaName={area.name} properties={featured} />

        <section className="py-20 bg-white">
          <div className="max-w-3xl mx-auto px-6">
            <p className="text-gold-accessible text-sm font-medium uppercase tracking-widest mb-2">
              The Neighbourhood
            </p>
            <h2 className="font-serif text-3xl md:text-4xl text-navy mb-8 leading-tight">
              What&apos;s nearby
            </h2>
            <ul className="space-y-3 text-gray-700 leading-relaxed text-lg list-none">
              {area.whatsNearby.map((item, i) => (
                <li key={i} className="flex gap-3">
                  <span className="text-gold-accessible mt-2 shrink-0">●</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <AreaFAQ areaName={area.name} items={area.faq} />

        <LeadCaptureSection source={leadSource} />
      </AreaPageClient>

      <FloatingCTA />
      <Footer />
    </>
  )
}

function StatCard({
  label,
  value,
  accent = false,
  small = false,
}: {
  label: string
  value: string
  accent?: boolean
  small?: boolean
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-sm p-5 text-center">
      <p className="text-gray-500 text-xs uppercase tracking-widest">{label}</p>
      <p
        className={`font-serif mt-2 ${accent ? 'text-gold-accessible' : 'text-navy'} ${
          small ? 'text-base leading-snug' : 'text-2xl'
        }`}
      >
        {value}
      </p>
    </div>
  )
}
