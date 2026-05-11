import type { Metadata } from 'next'
import { Cormorant_Garamond, Inter } from 'next/font/google'
import './globals.css'
import CookieBanner from '@/components/CookieBanner'
import Analytics from '@/components/Analytics'

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
    template: '%s | Worldwise Real Estate Dubai',
  },
  description:
    'Buy off-plan and ready properties in Dubai with 8-10% annual yield. RERA-certified agency. 500+ investors from 30+ countries. Free consultation.',
  openGraph: {
    title: 'Dubai Real Estate Investment | Worldwise',
    description: 'Buy off-plan and ready properties in Dubai with 8-10% annual yield. RERA-certified agency. Free consultation.',
    url: 'https://worldwise.pro',
    siteName: 'Worldwise Real Estate',
    type: 'website',
    locale: 'en_AE',
    images: [
      {
        url: '/images/areas/dubai-marina.jpg',
        width: 1600,
        height: 1067,
        alt: 'Dubai Marina — Worldwise Real Estate',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Dubai Real Estate Investment | Worldwise',
    description: 'Buy off-plan and ready properties in Dubai with 8-10% annual yield.',
    images: ['/images/areas/dubai-marina.jpg'],
  },
  alternates: {
    canonical: 'https://worldwise.pro',
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
    streetAddress: 'Rasis Business Center, Al Barsha, 5th floor, EBC03',
    addressLocality: 'Dubai',
    addressCountry: 'AE',
  },
  areaServed: { '@type': 'City', name: 'Dubai' },
  sameAs: [
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
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
        />
        {children}
        <CookieBanner />
        <Analytics />
      </body>
    </html>
  )
}
