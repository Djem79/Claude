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
    images: [
      {
        url: '/images/areas/downtown-dubai.jpg',
        width: 1600,
        height: 2468,
        alt: 'Downtown Dubai Properties — Worldwise Real Estate',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    images: ['/images/areas/downtown-dubai.jpg'],
  },
}

export default function PropertiesPage() {
  const properties = getProperties()
  return (
    <>
      <Navigation />
      <main className="pt-24 min-h-screen bg-[#F8F8F6]">
        <div className="max-w-7xl mx-auto px-6 pb-20">
          <div className="py-10">
            <p className="text-gold text-sm font-medium uppercase tracking-widest mb-2">
              All Listings
            </p>
            <h1 className="font-serif text-4xl md:text-5xl text-navy">
              Dubai Investment Properties
            </h1>
            <p className="text-gray-500 mt-2">
              {properties.length} properties available
            </p>
          </div>
          <PropertiesClient properties={properties} />
        </div>
      </main>
      <Footer />
      <FloatingCTA />
    </>
  )
}
