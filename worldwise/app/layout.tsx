import type { Metadata } from 'next'
import { Cormorant_Garamond, Inter } from 'next/font/google'
import './globals.css'
import CookieBanner from '@/components/CookieBanner'

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
  title: 'Dubai Real Estate Investment | Worldwise — 8-10% ROI, 0% Tax',
  description:
    'Buy off-plan and ready properties in Dubai with 8-10% annual yield. RERA-certified agency. 500+ investors from 30+ countries. Free consultation.',
  keywords: 'Dubai real estate, off-plan properties Dubai, invest in Dubai, Dubai apartments, ROI Dubai property',
  openGraph: {
    title: 'Dubai Real Estate Investment | Worldwise',
    description: 'Buy off-plan and ready properties in Dubai with 8-10% annual yield.',
    url: 'https://worldwise.pro',
    siteName: 'Worldwise Real Estate',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${cormorant.variable} ${inter.variable}`}>
      <body className="font-sans antialiased">
        {children}
        <CookieBanner />
      </body>
    </html>
  )
}
