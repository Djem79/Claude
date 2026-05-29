import Link from 'next/link'
import type { Metadata } from 'next'
import Footer from '@/components/Footer'
import FloatingCTA from '@/components/FloatingCTA'
import SocialProofStrip from '@/components/SocialProofStrip'
import GuideClient from './GuideClient'

export const metadata: Metadata = {
  title: 'Free Dubai Real Estate Investment Guide 2026 | Worldwise',
  description:
    'Download the free 2026 Dubai Real Estate Investment Guide for international buyers — rental yields by district, the buying process, full costs, Golden Visa and a getting-started checklist.',
  alternates: { canonical: 'https://worldwise.pro/guide' },
  openGraph: {
    title: 'Free Dubai Real Estate Investment Guide 2026 | Worldwise',
    description:
      'The free 2026 guide for international investors buying Dubai property — yields, process, costs and the Golden Visa. Instant download.',
    url: 'https://worldwise.pro/guide',
    images: ['/images/hero-dubai.jpg'],
  },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Offer',
  name: 'Dubai Real Estate Investment Guide 2026',
  description:
    'Free downloadable guide for international investors buying property in Dubai — rental yields, buying process, costs and the Golden Visa.',
  price: '0',
  priceCurrency: 'USD',
  url: 'https://worldwise.pro/guide',
  seller: {
    '@type': 'RealEstateAgent',
    name: 'Worldwise Real Estate',
    url: 'https://worldwise.pro',
  },
}

export default function GuidePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Minimal top bar — no full navigation (ads landing) */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-navy/95 backdrop-blur-sm shadow-lg py-3">
        <div className="max-w-6xl mx-auto px-6">
          <Link href="/" className="font-serif text-2xl text-white tracking-wide">
            WORLDWISE
          </Link>
        </div>
      </header>

      <main>
        <GuideClient />

        <section className="py-16 bg-white">
          <div className="max-w-4xl mx-auto px-6">
            <SocialProofStrip />
          </div>
        </section>
      </main>

      <Footer />
      <FloatingCTA />
    </>
  )
}
