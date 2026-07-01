import type { Metadata } from 'next'
import Navigation from '@/components/Navigation'
import Footer from '@/components/Footer'
import FloatingCTA from '@/components/FloatingCTA'
import LeadCaptureSection from '@/components/LeadCaptureSection'
import SocialProofStrip from '@/components/SocialProofStrip'
import PropertyCard from '@/components/PropertyCard'
import GoldenVisaClient from './GoldenVisaClient'
import { getProperties } from '@/lib/properties'
import { propertyQualifiesForGoldenVisa, GOLDEN_VISA_AED } from '@/lib/golden-visa'
import JsonLd from '@/components/JsonLd'

const BASE = 'https://worldwise.pro'
const SOURCE = 'golden_visa'
const LISTING_LIMIT = 6

// ISR: re-read data/properties.json so newly added qualifying listings appear
// without a redeploy (matches /properties and the area pages).
export const revalidate = 60

// metadata.title stays brandless (layout title.template appends the brand once);
// OG/twitter need the brand explicitly — the template does NOT apply to them.
const TITLE = 'Dubai Golden Visa Through Property Investment'
const OG_TITLE = `${TITLE} | Worldwise Real Estate`
const DESCRIPTION =
  'Buy a Dubai property worth AED 2M or more and qualify for the UAE Golden Visa — a renewable 10-year residency for you and your family, with no local sponsor needed. See qualifying listings and check your eligibility.'

export async function generateMetadata(): Promise<Metadata> {
  const url = `${BASE}/golden-visa`
  const image = `${BASE}/images/hero-dubai.jpg`
  return {
    title: TITLE,
    description: DESCRIPTION,
    alternates: { canonical: url },
    openGraph: {
      title: OG_TITLE,
      description: DESCRIPTION,
      url,
      type: 'website',
      images: [{ url: image, width: 1200, height: 800, alt: 'Dubai Golden Visa' }],
    },
    twitter: {
      card: 'summary_large_image',
      title: OG_TITLE,
      description: DESCRIPTION,
      images: [image],
    },
  }
}

const STEPS = [
  {
    title: 'Buy a qualifying property',
    body: `Purchase a Dubai property worth at least AED ${(GOLDEN_VISA_AED / 1_000_000).toFixed(0)} million. Off-plan and ready homes both count, and you can combine eligible properties to reach the threshold.`,
  },
  {
    title: 'Submit your application',
    body: 'We coordinate the title deed, valuation and paperwork, then file your Golden Visa application with the Dubai authorities on your behalf.',
  },
  {
    title: 'Receive 10-year residency',
    body: 'On approval you and your eligible family members receive a renewable 10-year UAE residency visa — no employer or local sponsor required.',
  },
  {
    title: 'Renew and stay',
    body: 'The visa renews as long as you keep the qualifying investment, giving you long-term stability to live, bank and do business in the UAE.',
  },
]

const BENEFITS = [
  {
    title: 'Long-term residency',
    body: 'A renewable 10-year visa replaces the usual short-cycle renewals, giving you and your family lasting security in the UAE.',
  },
  {
    title: 'Sponsor your family',
    body: 'Bring your spouse and children — and, in many cases, parents and domestic staff — onto your visa.',
  },
  {
    title: 'No local sponsor needed',
    body: 'The investment itself is your sponsor. You stay fully in control of your residency, with no employer or partner required.',
  },
  {
    title: 'Tax-friendly base',
    body: 'The UAE levies no personal income tax and no property tax, making it an efficient base for international investors.',
  },
]

const FAQ = [
  {
    q: 'How much do I need to invest to get a Dubai Golden Visa?',
    a: `Property worth at least AED ${(GOLDEN_VISA_AED / 1_000_000).toFixed(0)} million qualifies you to apply for the 10-year UAE Golden Visa. You can reach the threshold with a single property or a combination of eligible properties.`,
  },
  {
    q: 'Can I include my family on the visa?',
    a: 'Yes. The Golden Visa lets you sponsor your spouse and children, and in many cases parents and domestic staff, under your residency.',
  },
  {
    q: 'Does an off-plan property qualify?',
    a: 'Off-plan and ready properties can both count toward the threshold, subject to the current requirements. We confirm eligibility for your specific purchase before you commit.',
  },
  {
    q: 'Do I need a local sponsor or employer?',
    a: 'No. The Golden Visa is investor-led — your qualifying property serves as the basis, so you do not need an employer or a local partner to sponsor you.',
  },
  {
    q: 'Is the visa renewable?',
    a: 'Yes. The Golden Visa is issued for 10 years and is renewable as long as you continue to hold the qualifying investment.',
  },
]

export default function GoldenVisaPage() {
  const qualifying = getProperties().filter(propertyQualifiesForGoldenVisa)
  const listings = qualifying.slice(0, LISTING_LIMIT)

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: BASE },
      { '@type': 'ListItem', position: 2, name: 'Golden Visa', item: `${BASE}/golden-visa` },
    ],
  }

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ.map(item => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  }

  return (
    <>
      <Navigation transparent />
      <JsonLd data={breadcrumbJsonLd} />
      <JsonLd data={faqJsonLd} />

      <GoldenVisaClient>
        {/* How it works */}
        <section className="py-20 bg-white">
          <div className="max-w-5xl mx-auto px-6">
            <div className="text-center mb-12">
              <p className="text-gold-accessible text-sm font-medium uppercase tracking-widest mb-2">
                How It Works
              </p>
              <h2 className="section-title">Your route to a 10-year residency</h2>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {STEPS.map((step, i) => (
                <div key={i} className="bg-gray-50 border border-gray-200 rounded-sm p-6">
                  <div className="font-serif text-gold-accessible text-3xl mb-3">
                    {String(i + 1).padStart(2, '0')}
                  </div>
                  <h3 className="font-serif text-navy text-xl mb-2">{step.title}</h3>
                  <p className="text-gray-600 leading-relaxed text-sm">{step.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Benefits */}
        <section className="py-16 bg-gray-50">
          <div className="max-w-5xl mx-auto px-6">
            <div className="text-center mb-12">
              <p className="text-gold-accessible text-sm font-medium uppercase tracking-widest mb-2">
                Why It Matters
              </p>
              <h2 className="section-title">What the Golden Visa gives you</h2>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              {BENEFITS.map((b, i) => (
                <div key={i} className="bg-white border border-gray-200 rounded-sm p-6 flex gap-4">
                  <span className="text-gold-accessible text-2xl leading-none mt-0.5 shrink-0">●</span>
                  <div>
                    <h3 className="font-serif text-navy text-xl mb-2">{b.title}</h3>
                    <p className="text-gray-600 leading-relaxed">{b.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Eligible listings */}
        <section id="eligible-listings" className="py-20 bg-white scroll-mt-20">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-12">
              <p className="text-gold-accessible text-sm font-medium uppercase tracking-widest mb-2">
                Eligible Listings
              </p>
              <h2 className="section-title">Properties that qualify for the Golden Visa</h2>
              <p className="section-subtitle">
                {`Every property below is priced at AED ${(GOLDEN_VISA_AED / 1_000_000).toFixed(0)}M or more — the threshold for a 10-year residency.`}
              </p>
            </div>

            {listings.length > 0 ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                {listings.map(property => (
                  <PropertyCard key={property.id} property={property} />
                ))}
              </div>
            ) : (
              <div className="max-w-xl mx-auto text-center bg-gray-50 border border-gray-200 rounded-sm px-8 py-12">
                <h3 className="font-serif text-navy text-2xl mb-3">
                  Contact us for qualifying options
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  We have qualifying properties available beyond what&apos;s listed
                  here. Tell us your budget and we&apos;ll send curated options that
                  meet the Golden Visa threshold within 24 hours.
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Social proof */}
        <section className="py-16 bg-gray-50">
          <div className="max-w-3xl mx-auto px-6">
            <SocialProofStrip />
          </div>
        </section>

        {/* FAQ */}
        <section className="py-20 bg-white">
          <div className="max-w-3xl mx-auto px-6">
            <div className="text-center mb-12">
              <p className="text-gold-accessible text-sm font-medium uppercase tracking-widest mb-2">
                FAQ
              </p>
              <h2 className="section-title">Golden Visa questions</h2>
              <p className="section-subtitle">
                The questions investors most often ask our team.
              </p>
            </div>
            <div className="space-y-3">
              {FAQ.map((item, i) => (
                <details
                  key={i}
                  className="group border border-gray-200 rounded-sm bg-white open:shadow-sm"
                >
                  <summary className="cursor-pointer list-none px-5 py-4 flex justify-between items-center gap-4 hover:bg-gray-50 transition-colors">
                    <span className="font-serif text-navy text-lg leading-snug">{item.q}</span>
                    <span className="text-gold-accessible text-2xl leading-none group-open:rotate-45 transition-transform">
                      +
                    </span>
                  </summary>
                  <div className="px-5 pb-5 -mt-1">
                    <p className="text-gray-600 leading-relaxed">{item.a}</p>
                  </div>
                </details>
              ))}
            </div>
          </div>
        </section>

        <LeadCaptureSection source={SOURCE} />
      </GoldenVisaClient>

      <FloatingCTA />
      <Footer />
    </>
  )
}
