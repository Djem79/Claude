import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import Navigation from '@/components/Navigation'
import Footer from '@/components/Footer'
import FloatingCTA from '@/components/FloatingCTA'
import LeadCaptureSection from '@/components/LeadCaptureSection'
import JsonLd from '@/components/JsonLd'
import { AUTHOR, personJsonLd } from '@/lib/author'

const BASE = 'https://worldwise.pro'

const TITLE = 'About Dzhambulat Tkhazaplizhev'
const OG_TITLE = `${TITLE} | Worldwise Real Estate`
const DESCRIPTION =
  'Dzhambulat Tkhazaplizhev is the founder and Managing Director of Worldwise Real Estate, a RERA-certified Dubai brokerage serving international investors. A software engineer by background, he runs the agency on verified market data.'

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: `${BASE}/about` },
  openGraph: {
    title: OG_TITLE,
    description: DESCRIPTION,
    url: `${BASE}/about`,
    type: 'profile',
    images: [{ url: AUTHOR.image, width: 900, height: 1200, alt: AUTHOR.name }],
  },
  twitter: { card: 'summary_large_image', title: OG_TITLE, description: DESCRIPTION, images: [AUTHOR.image] },
}

// The citable assets double as the author's public track record — the same
// three pages llms.txt flags for AI engines. Keep this list in sync with them.
const DATA_WORK = [
  {
    href: '/blog/dubai-rental-yields-report',
    title: 'Dubai Rental Yields Report',
    note: 'Gross yields for 12 districts, re-verified monthly against DLD transaction data.',
  },
  {
    href: '/blog/dubai-property-market-q2-2026',
    title: 'Dubai Property Market: Q2 2026 in Numbers',
    note: 'The quarterly market snapshot built on registered-transaction figures.',
  },
  {
    href: '/blog/dld-fees-dubai-international-investors-guide',
    title: "DLD Fees: The International Investor's Guide",
    note: 'Every fee in a Dubai purchase, itemised and kept current.',
  },
]

export default function AboutPage() {
  const personLd = { '@context': 'https://schema.org', ...personJsonLd() }
  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: BASE },
      { '@type': 'ListItem', position: 2, name: 'About', item: `${BASE}/about` },
    ],
  }

  return (
    <>
      <JsonLd data={personLd} />
      <JsonLd data={breadcrumbLd} />
      <Navigation />
      <main>
        <section className="bg-navy py-20 pt-32">
          <div className="max-w-4xl mx-auto px-6 md:flex md:items-center md:gap-12">
            <div className="mb-8 md:mb-0 md:shrink-0">
              <Image
                src="/images/author/dzhambulat-tkhazaplizhev.jpg"
                alt={AUTHOR.name}
                width={280}
                height={373}
                priority
                className="rounded-sm object-cover"
              />
            </div>
            <div>
              <p className="text-gold/80 text-xs uppercase tracking-widest font-medium mb-3">
                {AUTHOR.jobTitle}
              </p>
              <h1 className="font-serif text-3xl md:text-4xl lg:text-5xl text-white leading-tight mb-4">
                {AUTHOR.name}
              </h1>
              <p className="text-white/70 leading-relaxed">
                Founder of Worldwise Real Estate, a RERA-licensed brokerage (ORN 39125) in Al Barsha,
                Dubai. Based in the city since 2022, working with international buyers in
                English and Russian.
              </p>
            </div>
          </div>
        </section>

        <section className="py-16 bg-white">
          <div className="max-w-4xl mx-auto px-6 space-y-6 text-gray-700 leading-relaxed">
            <p>
              Dzhambulat came to real estate from software engineering — years of building
              applications and data pipelines before Dubai&rsquo;s property market pulled him in.
              What made the market compelling was how measurable it is: every transaction
              passes through the government&rsquo;s Dubai Land Department registry, so prices and
              yields can be verified instead of taken from brochures.
            </p>
            <p>
              He built the brokerage the way an engineer would — around data. The team
              tracks gross rental yields across twelve Dubai districts and re-verifies them
              every month against registered transactions, favouring transaction records
              over listing-portal asking prices whenever the two disagree. The same
              verified figures drive the advice the agency gives to buyers and the market
              reports it publishes.
            </p>
            <p>
              Worldwise Real Estate works primarily with international investors — buyers
              comparing Dubai with other markets, purchasing remotely, and navigating
              off-plan contracts, developer track records and residency rules for the
              first time.
            </p>

            <h2 className="font-serif text-2xl text-navy pt-6">Published data work</h2>
            <ul className="space-y-4">
              {DATA_WORK.map(item => (
                <li key={item.href}>
                  <Link href={item.href} className="text-gold-accessible font-medium hover:underline">
                    {item.title}
                  </Link>
                  <p className="text-sm text-gray-500">{item.note}</p>
                </li>
              ))}
            </ul>

            <h2 className="font-serif text-2xl text-navy pt-6">Editorial standards</h2>
            <p>
              Every article on this site is reviewed before publication. Market figures
              come from Dubai Land Department records and named industry sources, carry a
              &ldquo;data last verified&rdquo; date, and are corrected in place when the
              market moves. Requests for comment, source data or fact-checking:{' '}
              <a href="mailto:info@worldwise.pro" className="text-gold-accessible hover:underline">
                info@worldwise.pro
              </a>
              .
            </p>
          </div>
        </section>

        <LeadCaptureSection />
      </main>
      <Footer />
      <FloatingCTA />
    </>
  )
}
