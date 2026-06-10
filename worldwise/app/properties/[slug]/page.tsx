import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { getPropertyBySlug, getProperties } from '@/lib/properties'
import Navigation from '@/components/Navigation'
import Footer from '@/components/Footer'
import PropertyEnquiryForm from './PropertyEnquiryForm'
import PropertyGallery from './PropertyGallery'
import CurrencySelect from '@/components/CurrencySelect'
import SocialProofStrip from '@/components/SocialProofStrip'
import MobileCtaBar from '@/components/MobileCtaBar'
import FloatingCTA from '@/components/FloatingCTA'
import MortgageAnchorBar from '@/components/MortgageAnchorBar'
import BrochureGate from '@/components/BrochureGate'
import FloorPlanGate from '@/components/FloorPlanGate'
import { waPropertyMessage, PHONE_TEL } from '@/lib/whatsapp'
import WhatsAppCta from './WhatsAppCta'
import { qualifiesForGoldenVisa } from '@/lib/golden-visa'
import PriceTag from '@/components/PriceTag'
import { estimateMonthly } from '@/lib/mortgage'
import JsonLd from '@/components/JsonLd'
import PropertyLocation from '@/components/PropertyLocation'
import { areas, propertyMatchesArea } from '@/lib/areas'
import { resolvePropertyCoords } from '@/lib/property-coords'
import { formatAedCompact } from '@/lib/format'

export const revalidate = 60

export async function generateStaticParams() {
  return getProperties().map(p => ({ slug: p.slug }))
}

export async function generateMetadata(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const p = getPropertyBySlug(params.slug)
  if (!p) return {}
  const url = `https://worldwise.pro/properties/${p.slug}`
  const img = p.images[0] ?? '/images/areas/dubai-marina.jpg'
  const title = `${p.title} by ${p.developer} — ${formatAedCompact(p.priceAed)}`
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

export default async function PropertyPage(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const property = getPropertyBySlug(params.slug)
  if (!property) notFound()

  // "Similar" = same area/developer first, then ranked by closest price so the
  // suggestions sit in the same budget. Backfill with the nearest-priced of the
  // remaining listings if there aren't 3 contextual matches.
  const others = getProperties().filter(p => p.id !== property.id)
  const byPriceCloseness = (a: typeof others[number], b: typeof others[number]) =>
    Math.abs(a.priceAed - property.priceAed) - Math.abs(b.priceAed - property.priceAed)
  const contextual = others
    .filter(p => p.area === property.area || p.developer === property.developer)
    .sort(byPriceCloseness)
  const fallback = others
    .filter(p => p.area !== property.area && p.developer !== property.developer)
    .sort(byPriceCloseness)
  const similar = [...contextual, ...fallback].slice(0, 3)

  const matchedArea = areas.find(a => propertyMatchesArea(property.area, a))
  const resolvedCoords = resolvePropertyCoords(property, matchedArea?.coords)

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

  // bedrooms is free text ("7 Bed", "1–3 Bed", "Studio"); schema.org numberOfRooms
  // expects a number — emit the first integer found, or omit the field.
  const bedroomsNum = property.bedrooms?.match(/\d+/)?.[0]

  const listingLd = {
    '@context': 'https://schema.org',
    '@type': 'RealEstateListing',
    '@id': `${url}#listing`,
    name: property.title,
    description: property.description,
    url,
    // Omit the field entirely when there are no images, rather than emitting image: []
    ...(property.images.length
      ? { image: property.images.slice(0, 5).map(img => (img.startsWith('http') ? img : `${base}${img}`)) }
      : {}),
    datePosted: property.createdAt,
    offers: {
      '@type': 'Offer',
      price: property.priceAed,
      priceCurrency: 'AED',
      seller: {
        '@type': 'RealEstateAgent',
        '@id': `${base}/#agency`,
        name: 'Worldwise Real Estate',
      },
    },
    ...(property.permitNumber
      ? {
          identifier: {
            '@type': 'PropertyValue',
            name: 'DLD Permit Number',
            value: property.permitNumber,
          },
        }
      : {}),
    address: {
      '@type': 'PostalAddress',
      addressLocality: property.area,
      addressRegion: 'Dubai',
      addressCountry: 'AE',
    },
    ...(resolvedCoords
      ? {
          geo: {
            '@type': 'GeoCoordinates',
            latitude: resolvedCoords.lat,
            longitude: resolvedCoords.lng,
          },
        }
      : {}),
    ...(bedroomsNum ? { numberOfRooms: Number(bedroomsNum) } : {}),
    // No aggregateRating here: Google's review-snippet validator rejects a rating
    // on RealEstateListing (an unsupported host type → "invalid object type for
    // <parent_node>"), and a borrowed agency-wide rating on every listing also
    // violates review guidelines. The agency rating lives on RealEstateAgent only.
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
      <JsonLd data={breadcrumbLd} />
      <JsonLd data={listingLd} />
      <Navigation />
      <main className="pt-16">
        {/* Gallery */}
        <PropertyGallery images={property.images} title={property.title} />

        <div className="max-w-7xl mx-auto px-6 py-12">
          {/* grid-cols-1 (minmax(0,1fr) track) + min-w-0 stop the column's min-content
              from blowing the layout wider than the viewport on narrow phones (360px) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
            {/* Left: details */}
            <div className="lg:col-span-2 space-y-10 min-w-0">
              {/* Header */}
              <div>
                <div className="flex flex-wrap gap-2 mb-3">
                  <span className="badge bg-navy text-gold">{property.status}</span>
                  {property.rented && <span className="badge bg-gray-800/80 text-white">Rented</span>}
                  {property.badge && <span className="badge bg-gold/10 text-gold-accessible">{property.badge}</span>}
                  {qualifiesForGoldenVisa(property.priceAed) && <span className="badge bg-gold text-navy">Golden Visa</span>}
                </div>
                <div className="flex items-start justify-between gap-4">
                  {/* min-w-0 lets the long title wrap/shrink inside the flex row instead of
                      forcing horizontal overflow on narrow phones (360px) — was a 48px leak */}
                  <h1 className="font-serif text-4xl md:text-5xl text-navy min-w-0 break-words">{property.title}</h1>
                  <CurrencySelect className="border border-gray-200 bg-white px-3 py-1.5 rounded-sm text-navy text-sm focus:outline-none focus:border-gold shrink-0" />
                </div>
                <p className="text-gray-500 text-lg mt-2">
                  {property.developer} · {property.area}, Dubai
                </p>
              </div>

              {/* Key stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Starting Price', value: <PriceTag aed={property.priceAed} /> },
                  { label: 'Bedrooms', value: property.bedrooms },
                  ...(property.pricePerSqft ? [{ label: 'Price / sq.ft', value: `AED ${property.pricePerSqft.toLocaleString('en-US')}` }] : []),
                  ...(property.roi ? [{ label: 'Est. ROI', value: `${property.roi}%` }] : []),
                  ...(property.grossYield ? [{ label: 'Gross Yield', value: `${property.grossYield}%` }] : []),
                  ...(property.completionDate ? [{ label: 'Handover', value: property.completionDate }] : []),
                  ...(property.paymentPlan ? [{ label: 'Payment Plan', value: property.paymentPlan }] : []),
                ].map(s => (
                  <div key={s.label} className="bg-[#F8F8F6] rounded-sm p-4">
                    <p className="text-xs text-gray-400 font-medium mb-1">{s.label}</p>
                    <p className="font-serif text-lg text-navy">{s.value}</p>
                  </div>
                ))}
              </div>

              {property.status !== 'rent' && (
                <p className="-mt-6 text-sm text-gray-500">
                  ≈ <span className="text-navy font-medium">AED {Math.round(estimateMonthly(property.priceAed)).toLocaleString('en-US')}/mo</span> with a mortgage
                  <span className="text-gray-400"> · 25% down · 4.5% · 25 yrs</span>
                  {' '}<Link href="/mortgage-calculator" className="text-gold-accessible hover:underline">Estimate yours →</Link>
                </p>
              )}

              {/* Description */}
              <div>
                <h2 className="font-serif text-2xl text-navy mb-4">About This Property</h2>
                {/* Preserve the author's paragraph breaks: raw \n in a single <p> would
                    collapse to spaces, so split on newlines and render each as its own <p>. */}
                <div className="space-y-4 text-gray-600 leading-relaxed">
                  {property.description.split(/\n+/).map(p => p.trim()).filter(Boolean).map((para, i) => (
                    <p key={i}>{para}</p>
                  ))}
                </div>
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

              {/* Location */}
              <PropertyLocation
                title={property.title}
                area={property.area}
                coords={resolvedCoords}
                areaSlug={matchedArea?.slug}
              />

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
                        Issued by Dubai Land Department (DLD) · Real Estate Regulatory Agency (RERA) ·{' '}
                        <a href="https://dubailand.gov.ae/en/" target="_blank" rel="noopener noreferrer" className="text-gold-accessible hover:underline">Verify on dubailand.gov.ae →</a>
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
                {property.brochure && (
                  <div className="mt-6">
                    <BrochureGate
                      propertyId={property.id}
                      propertySlug={property.slug}
                      propertyTitle={property.title}
                    />
                  </div>
                )}
                {property.floorPlans && property.floorPlans.length > 0 && (
                  <div className="mt-6">
                    <FloorPlanGate
                      floorPlans={property.floorPlans}
                      propertySlug={property.slug}
                      propertyTitle={property.title}
                    />
                  </div>
                )}
                <div className="mt-6">
                  <SocialProofStrip />
                </div>
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
                    <div className="relative aspect-[4/3] overflow-hidden">
                      <Image
                        src={p.images[0] ?? '/images/areas/dubai-marina.jpg'}
                        alt={p.title}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-500"
                        sizes="(max-width: 768px) 100vw, 33vw"
                      />
                    </div>
                    <div className="p-4">
                      <p className="text-xs text-gray-400 mb-1">{p.developer} · {p.area}</p>
                      <p className="font-serif text-lg text-navy">{p.title}</p>
                      <p className="text-gold-accessible text-sm font-medium mt-1">From AED {(p.priceAed / 1_000_000).toFixed(2)}M</p>
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
            <WhatsAppCta title={property.title} />
            <a href={PHONE_TEL} className="btn-outline">
              Call Us
            </a>
          </div>
        </div>
      </main>
      <Footer />
      {property.status !== 'rent' && (
        <MortgageAnchorBar
          monthlyLabel={`AED ${Math.round(estimateMonthly(property.priceAed)).toLocaleString('en-US')}`}
          propertySlug={property.slug}
          propertyTitle={property.title}
        />
      )}
      <MobileCtaBar
        enquireSource="property_enquiry"
        enquireLabel="Enquire Now"
        waMessage={waPropertyMessage(property.title)}
        propertySlug={property.slug}
        propertyTitle={property.title}
        monthlyNote={property.status !== 'rent' ? `Own from AED ${Math.round(estimateMonthly(property.priceAed)).toLocaleString('en-US')}/mo (mortgage)` : undefined}
      />
      {/* Desktop persistent CTA (hidden md:flex); coexists with the md:hidden MobileCtaBar above */}
      <FloatingCTA />
    </>
  );
}
