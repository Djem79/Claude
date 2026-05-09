import { getProperties } from '@/lib/properties'
import Navigation from '@/components/Navigation'
import Footer from '@/components/Footer'
import FloatingCTA from '@/components/FloatingCTA'
import PropertiesClient from './PropertiesClient'

export const revalidate = 60

export const metadata = {
  title: 'Dubai Properties for Investment | Worldwise Real Estate',
  description:
    'Browse off-plan and secondary market properties in Dubai. Filter by area, price and type. Expert guidance for international investors.',
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
