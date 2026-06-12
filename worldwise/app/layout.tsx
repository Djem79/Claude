import type { Metadata } from 'next'
import { Cormorant_Garamond, Inter } from 'next/font/google'
import './globals.css'
import CookieBanner from '@/components/CookieBanner'
import Analytics from '@/components/Analytics'
import UtmCapture from '@/components/UtmCapture'
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
    default: 'Dubai Real Estate Investment | Worldwise — 8-10% ROI, 0% Tax',
    template: '%s | Worldwise',
  },
  description:
    'Buy off-plan and ready properties in Dubai with 8-10% annual yield. RERA-certified agency. 50+ investors from 30+ countries. Free consultation.',
  openGraph: {
    title: 'Dubai Real Estate Investment | Worldwise',
    description: 'Buy off-plan and ready properties in Dubai with 8-10% annual yield. RERA-certified agency. Free consultation.',
    url: 'https://worldwise.pro',
    siteName: 'Worldwise Real Estate',
    type: 'website',
    locale: 'en_AE',
    images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: 'Worldwise Real Estate' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Dubai Real Estate Investment | Worldwise',
    description: 'Buy off-plan and ready properties in Dubai with 8-10% annual yield.',
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
    'Dubai-based real estate investment agency specialising in off-plan and secondary market properties. RERA-certified. 8-10% annual yield. 0% income tax.',
  telephone: '+971506960435',
  email: 'info@worldwise.pro',
  address: {
    '@type': 'PostalAddress',
    streetAddress: 'Rasis Business Centre - 5, 5th Floor, Office 502 (EBC03), Al Barsha 1',
    addressLocality: 'Dubai',
    addressCountry: 'AE',
  },
  areaServed: { '@type': 'City', name: 'Dubai' },
  aggregateRating: {
    '@type': 'AggregateRating',
    ratingValue: '5',
    reviewCount: '4',
    bestRating: '5',
    worstRating: '1',
  },
  review: [
    {
      '@type': 'Review',
      author: { '@type': 'Person', name: 'James H.' },
      reviewRating: { '@type': 'Rating', ratingValue: '5', bestRating: '5' },
      reviewBody:
        'I was looking to diversify outside the UK property market. Worldwise found me an off-plan apartment in Business Bay with 8.5% projected ROI. The whole process — from first call to signing — took less than 3 weeks. Exceptional team.',
    },
    {
      '@type': 'Review',
      author: { '@type': 'Person', name: 'Priya S.' },
      reviewRating: { '@type': 'Rating', ratingValue: '5', bestRating: '5' },
      reviewBody:
        'As an NRI investor, I was worried about the legal process and trust. Worldwise guided me through every step, handled the DLD registration remotely and even helped me set up the rental management. Highly recommend.',
    },
    {
      '@type': 'Review',
      author: { '@type': 'Person', name: 'Markus W.' },
      reviewRating: { '@type': 'Rating', ratingValue: '5', bestRating: '5' },
      reviewBody:
        "What impressed me most was their market knowledge. They didn't just sell me a listing — they explained the yield potential, resale dynamics and neighbourhood growth projections. A genuinely data-driven team.",
    },
    {
      '@type': 'Review',
      author: { '@type': 'Person', name: 'Ahmed Al F.' },
      reviewRating: { '@type': 'Rating', ratingValue: '5', bestRating: '5' },
      reviewBody:
        "I've worked with several agencies in Dubai. Worldwise stands out for their follow-through. Even after the sale closed they assisted with furnishing, DEWA setup and finding tenants. Truly full-service.",
    },
  ],
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
      </body>
    </html>
  )
}
