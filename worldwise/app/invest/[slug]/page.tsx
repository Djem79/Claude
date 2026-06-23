import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Navigation from '@/components/Navigation'
import Footer from '@/components/Footer'
import FloatingCTA from '@/components/FloatingCTA'
import LeadCaptureSection from '@/components/LeadCaptureSection'
import JsonLd from '@/components/JsonLd'
import { getLanding, landingSlugs, propertiesForLanding } from '@/lib/landings'
import { getProperties } from '@/lib/properties'
import LandingClient from './LandingClient'

const BASE = 'https://worldwise.pro'

export const revalidate = 3600

export function generateStaticParams() {
  return landingSlugs.map(slug => ({ slug }))
}

export async function generateMetadata(
  props: { params: Promise<{ slug: string }> },
): Promise<Metadata> {
  const params = await props.params
  const landing = getLanding(params.slug)
  if (!landing) return {}

  const url = `${BASE}/invest/${landing.slug}`
  const ogTitle = `${landing.metaTitle} | Worldwise Real Estate`

  return {
    title: landing.metaTitle,
    description: landing.metaDescription,
    alternates: { canonical: url },
    openGraph: {
      title: ogTitle,
      description: landing.metaDescription,
      url,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: ogTitle,
      description: landing.metaDescription,
    },
  }
}

export default async function LandingPage(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params
  const landing = getLanding(params.slug)
  if (!landing) notFound()

  const allProperties = getProperties()
  const featured = propertiesForLanding(landing, allProperties)

  const webPageJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: landing.h1,
    description: landing.metaDescription,
    url: `${BASE}/invest/${landing.slug}`,
  }

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: landing.faq.map(item => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  }

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: BASE },
      { '@type': 'ListItem', position: 2, name: 'Invest', item: `${BASE}/invest` },
      {
        '@type': 'ListItem',
        position: 3,
        name: landing.h1,
        item: `${BASE}/invest/${landing.slug}`,
      },
    ],
  }

  return (
    <>
      <Navigation />
      <JsonLd data={webPageJsonLd} />
      <JsonLd data={faqJsonLd} />
      <JsonLd data={breadcrumbJsonLd} />

      <LandingClient landing={landing} properties={featured} />

      <LeadCaptureSection source={landing.leadSource} />
      <FloatingCTA />
      <Footer />
    </>
  )
}
