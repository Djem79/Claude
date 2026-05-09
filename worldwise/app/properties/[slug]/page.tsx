import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { getPropertyBySlug, getProperties } from '@/lib/properties'
import Navigation from '@/components/Navigation'
import Footer from '@/components/Footer'
import PropertyEnquiryForm from './PropertyEnquiryForm'
import PropertyGallery from './PropertyGallery'

export const revalidate = 60

export async function generateStaticParams() {
  return getProperties().map(p => ({ slug: p.slug }))
}

function formatPrice(aed: number) {
  if (aed >= 1_000_000) return `AED ${(aed / 1_000_000).toFixed(2)}M`
  return `AED ${(aed / 1000).toFixed(0)}K`
}

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const p = getPropertyBySlug(params.slug)
  if (!p) return {}
  const url = `https://worldwise.pro/properties/${p.slug}`
  const img = p.images[0] ?? '/images/areas/dubai-marina.jpg'
  const title = `${p.title} by ${p.developer} — ${formatPrice(p.priceAed)}`
  const description = `${p.shortDescription} Located in ${p.area}, Dubai.${p.roi ? ` Est. ROI ${p.roi}%.` : ''}${p.completionDate ? ` Handover ${p.completionDate}.` : ''} RERA-certified listing.`
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      type: 'website',
      images: [{ url: img, width: 1200, height: 800, alt: p.title }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [img],
    },
  }
}

export default function PropertyPage({ params }: { params: { slug: string } }) {
  const property = getPropertyBySlug(params.slug)
  if (!property) notFound()

  const similar = getProperties()
    .filter(p => p.id !== property.id && (p.area === property.area || p.developer === property.developer))
    .slice(0, 3)

  const base = 'https://worldwise.pro'
  const url = `${base}/properties/${property.slug}`

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: base },
      { '@type': 'ListItem', position: 2, name: 'Properties', item: `${base}/properties` },
      { '@type': 'ListItem', position: 3, name: property.title, item: url },
    ],
  }

  const listingLd = {
    '@context': 'https://schema.org',
    '@type': 'RealEstateListing',
    '@id': `${url}#listing`,
    name: property.title,
    description: property.description,
    url,
    image: property.images.slice(0, 5).map(img =>
      img.startsWith('http') ? img : `${base}${img}`
    ),
    datePosted: property.createdAt,
    offers: {
      '@type': 'Offer',
      price: property.priceAed,
      priceCurrency: 'AED',
      availability: 'https://schema.org/InStock',
      seller: {
        '@type': 'RealEstateAgent',
        '@id': `${base}/#agency`,
        name: 'Worldwise Real Estate',
      },
    },
    address: {
      '@type': 'PostalAddress',
      addressLocality: property.area,
      addressRegion: 'Dubai',
      addressCountry: 'AE',
    },
    numberOfRooms: property.bedrooms,
    ...(property.roi ? { annualPercentageRate: property.roi } : {}),
    ...(property.amenities.length > 0
      ? {
          amenityFeature: property.amenities.map(a => ({
            '@type': 'LocationFeatureSpecification',
            name: a,
            value: true,
          })),
        }
      : {}),
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(listingLd) }} />
      <Navigation />
      <main className="pt-16">
        {/* Gallery */}
        <PropertyGallery images={property.images} title={property.title} />

        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="grid lg:grid-cols-3 gap-12">
            {/* Left: details */}
            <div className="lg:col-span-2 space-y-10">
              {/* Header */}
              <div>
                <div className="flex flex-wrap gap-2 mb-3">
                  <span className="badge bg-navy text-gold">{property.status}</span>
                  {property.badge && <span className="badge bg-gold/10 text-gold">{property.badge}</span>}
                </div>
                <h1 className="font-serif text-4xl md:text-5xl text-navy">{property.title}</h1>
                <p className="text-gray-500 text-lg mt-2">
                  {property.developer} · {property.area}, Dubai
                </p>
              </div>

              {/* Key stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Starting Price', value: formatPrice(property.priceAed) },
                  { label: 'Bedrooms', value: property.bedrooms },
                  ...(property.roi ? [{ label: 'Est. ROI', value: `${property.roi}%` }] : []),
                  ...(property.completionDate ? [{ label: 'Handover', value: property.completionDate }] : []),
                  ...(property.paymentPlan ? [{ label: 'Payment Plan', value: property.paymentPlan }] : []),
                ].map(s => (
                  <div key={s.label} className="bg-[#F8F8F6] rounded-sm p-4">
                    <p className="text-xs text-gray-400 font-medium mb-1">{s.label}</p>
                    <p className="font-serif text-lg text-navy">{s.value}</p>
                  </div>
                ))}
              </div>

              {/* Description */}
              <div>
                <h2 className="font-serif text-2xl text-navy mb-4">About This Property</h2>
                <p className="text-gray-600 leading-relaxed">{property.description}</p>
              </div>

              {/* Amenities */}
              {property.amenities.length > 0 && (
                <div>
                  <h2 className="font-serif text-2xl text-navy mb-5">Amenities</h2>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {property.amenities.map(a => (
                      <div key={a} className="flex items-center gap-2 text-sm text-gray-600">
                        <span className="w-1.5 h-1.5 rounded-full bg-gold flex-shrink-0" />
                        {a}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* DLD Permit / QR Code */}
              {property.qrImage && (
                <div className="border-t border-gray-100 pt-8">
                  <h2 className="font-serif text-2xl text-navy mb-2">Official Permit</h2>
                  <p className="text-gray-500 text-sm mb-5">
                    Verified listing registered with the Dubai Land Department. Scan the QR code to confirm authenticity.
                  </p>
                  <div className="flex flex-col sm:flex-row items-start gap-6 bg-[#F8F8F6] rounded-sm p-6">
                    <img
                      src={property.qrImage}
                      alt="DLD Permit QR Code"
                      className="w-40 h-40 bg-white p-2 rounded-sm"
                    />
                    <div className="space-y-2 text-sm">
                      {property.projectNumber && (
                        <div>
                          <p className="text-xs text-gray-400 uppercase tracking-wider">Project Number</p>
                          <p className="font-serif text-lg text-navy">{property.projectNumber}</p>
                        </div>
                      )}
                      {property.permitNumber && (
                        <div>
                          <p className="text-xs text-gray-400 uppercase tracking-wider">Permit Number</p>
                          <p className="font-serif text-lg text-navy">{property.permitNumber}</p>
                        </div>
                      )}
                      <p className="text-xs text-gray-400 pt-2">
                        Issued by Dubai Land Department (DLD) · Real Estate Regulatory Agency (RERA)
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Right: enquiry form */}
            <div className="lg:col-span-1">
              <div className="sticky top-24">
                <PropertyEnquiryForm
                  propertySlug={property.slug}
                  propertyTitle={property.title}
                />
              </div>
            </div>
          </div>

          {/* Similar properties */}
          {similar.length > 0 && (
            <div className="mt-16 pt-12 border-t border-gray-100">
              <h2 className="font-serif text-3xl text-navy mb-8">Similar Properties</h2>
              <div className="grid md:grid-cols-3 gap-6">
                {similar.map(p => (
                  <Link key={p.id} href={`/properties/${p.slug}`} className="group bg-white rounded-sm overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                    <div className="relative h-44 overflow-hidden">
                      <Image
                        src={p.images[0]}
                        alt={p.title}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-500"
                        sizes="(max-width: 768px) 100vw, 33vw"
                      />
                    </div>
                    <div className="p-4">
                      <p className="text-xs text-gray-400 mb-1">{p.developer} · {p.area}</p>
                      <p className="font-serif text-lg text-navy">{p.title}</p>
                      <p className="text-gold text-sm font-medium mt-1">From AED {(p.priceAed / 1_000_000).toFixed(2)}M</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="bg-navy py-12 text-center">
          <p className="font-serif text-2xl text-white mb-4">
            Interested in {property.title}?
          </p>
          <p className="text-white/60 mb-8">Contact us and we&apos;ll send you a full investment breakdown.</p>
          <div className="flex flex-wrap justify-center gap-4">
            <a
              href={`https://wa.me/971506960435?text=Hi%2C%20I%27m%20interested%20in%20${encodeURIComponent(property.title)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary"
            >
              💬 WhatsApp Now
            </a>
            <a href="tel:+971506960435" className="btn-outline">
              📞 Call Us
            </a>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
