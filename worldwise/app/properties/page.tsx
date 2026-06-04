import { getProperties } from '@/lib/properties'
import Navigation from '@/components/Navigation'
import Footer from '@/components/Footer'
import FloatingCTA from '@/components/FloatingCTA'
import PropertiesClient from './PropertiesClient'

export const revalidate = 60

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Dubai Properties for Investment | Off-Plan & Secondary Market',
  description:
    'Browse 148+ off-plan and secondary market properties in Dubai. Filter by area, price, type and ROI. Expert guidance for international investors. Free consultation.',
  alternates: { canonical: 'https://worldwise.pro/properties' },
  openGraph: {
    title: 'Dubai Investment Properties — Off-Plan & Secondary Market',
    description: 'Browse 148+ properties in Dubai Marina, Downtown, Palm Jumeirah and more. 8-10% ROI. RERA-certified listings.',
    url: 'https://worldwise.pro/properties',
    images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: 'Dubai Investment Properties — Worldwise Real Estate' }],
  },
  twitter: {
    card: 'summary_large_image',
    images: ['/opengraph-image'],
  },
}

export default function PropertiesPage({
  searchParams,
}: {
  searchParams: { area?: string; type?: string; status?: string }
}) {
  const properties = getProperties()
  return (
    <>
      <Navigation />
      <main className="pt-24 min-h-screen bg-[#F8F8F6]">
        <div className="max-w-7xl mx-auto px-6 pb-20">
          <div className="py-10">
            <p className="text-gold-accessible text-sm font-medium uppercase tracking-widest mb-2">
              All Listings
            </p>
            <h1 className="font-serif text-4xl md:text-5xl text-navy">
              Dubai Investment Properties
            </h1>
            <p className="text-gray-500 mt-2">
              {properties.length} properties available
            </p>
          </div>
          <PropertiesClient
            properties={properties}
            initialArea={searchParams.area ?? 'All Areas'}
            initialType={searchParams.type ?? 'all'}
            initialStatus={searchParams.status ?? 'all'}
          />
        </div>
      </main>
      <Footer />
      <FloatingCTA />
    </>
  )
}
