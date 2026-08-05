import type { Metadata } from 'next'
import { Cormorant_Garamond, Inter } from 'next/font/google'
import './globals.css'
import CookieBanner from '@/components/CookieBanner'
import Analytics from '@/components/Analytics'
import UtmCapture from '@/components/UtmCapture'
import ExitIntentTrigger from '@/components/ExitIntentTrigger'
import JsonLd from '@/components/JsonLd'

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-cormorant',
  display: 'swap',
})

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL('https://worldwise.pro'),
  title: {
    default: 'Dubai Real Estate Investment | Worldwise — Up to 8% Yield, 0% Tax',
    template: '%s | Worldwise',
  },
  description:
    'RERA-licensed Dubai brokerage (ORN 39125) for international investors. Gross rental yields up to 8% by district, reviewed monthly against DLD transaction data, plus 5-7% price growth in 2026.',
  openGraph: {
    title: 'Dubai Real Estate Investment | Worldwise',
    description: 'RERA-licensed Dubai brokerage (ORN 39125). Gross rental yields up to 8% by district, reviewed monthly against DLD data. Off-plan and ready property.',
    url: 'https://worldwise.pro',
    siteName: 'Worldwise Real Estate',
    type: 'website',
    locale: 'en_AE',
    images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: 'Worldwise Real Estate' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Dubai Real Estate Investment | Worldwise',
    description: 'RERA-licensed Dubai brokerage (ORN 39125). District rental yields up to 8%, reviewed monthly against DLD data.',
    images: ['/opengraph-image'],
  },
  alternates: {
    canonical: 'https://worldwise.pro',
    types: { 'application/rss+xml': 'https://worldwise.pro/blog/rss.xml' },
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  verification: {
    google: 'sqxgQTdYtSZhi4wHwzX8V1La6RErfM7-KHAKDbGCPOE',
  },
}

const orgJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'RealEstateAgent',
  '@id': 'https://worldwise.pro/#agency',
  name: 'Worldwise Real Estate',
  url: 'https://worldwise.pro',
  logo: 'https://worldwise.pro/images/logo.png',
  description:
    'RERA-licensed Dubai brokerage (ORN 39125) advising international investors on off-plan and secondary-market property. We publish a district-by-district gross rental yield index covering 12 Dubai districts, reviewed monthly against Dubai Land Department transaction data, and a quarterly Dubai market report, both free to cite with attribution. The UAE levies no income tax on rental income and no capital gains tax.',
  telephone: '+971506960435',
  email: 'info@worldwise.pro',
  address: {
    '@type': 'PostalAddress',
    streetAddress: 'Rasis Business Centre - 5, 5th Floor, Office 502 (EBC03), Al Barsha 1',
    addressLocality: 'Dubai',
    addressCountry: 'AE',
  },
  areaServed: { '@type': 'City', name: 'Dubai' },
  // No aggregateRating / review here on purpose. The reviews shown on the site
  // are real, but we collected them ourselves — Google treats self-serving
  // review markup on a LocalBusiness as ineligible, so it never produced stars
  // and only added risk. The verifiable rating (5.0 from 8) lives in our Google
  // Business Profile, linked from sameAs below and from the homepage.
  sameAs: [
    'https://www.google.com/maps/place/WORLDWISE+REAL+ESTATE+LLC/@25.1071856,55.1984163,17z/data=!3m1!4b1!4m6!3m5!1s0x3e5f69003d5d7793:0xcb632527c181460e!8m2!3d25.1071856!4d55.1984163!16s%2Fg%2F11vzbltfqp',
    'https://www.instagram.com/worldwiseofficial',
    'https://www.linkedin.com/company/worldwise-real-estate-llc/',
    'https://www.youtube.com/@worldwiserealestate',
    'https://www.facebook.com/people/Worldwise-Real-Estate/61572461707148/',
    'https://www.tiktok.com/@worldwiseestate',
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${cormorant.variable} ${inter.variable}`}>
      <body className="font-sans antialiased">
        <JsonLd data={orgJsonLd} />
        {children}
        <CookieBanner />
        <Analytics />
        <UtmCapture />
        <ExitIntentTrigger />
      </body>
    </html>
  )
}
