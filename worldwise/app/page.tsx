import { getFeaturedProperties } from '@/lib/properties'
import Navigation from '@/components/Navigation'
import Hero from '@/components/Hero'
import TrustBar from '@/components/TrustBar'
import FeaturedProperties from '@/components/FeaturedProperties'
import MortgageCalculator from '@/components/MortgageCalculator'
import AreasSection from '@/components/AreasSection'
import WhyWorldwise from '@/components/WhyWorldwise'
import HowItWorks from '@/components/HowItWorks'
import Testimonials from '@/components/Testimonials'
import BlogPreview from '@/components/BlogPreview'
import LeadCaptureSection from '@/components/LeadCaptureSection'
import Footer from '@/components/Footer'
import FloatingCTA from '@/components/FloatingCTA'

export const revalidate = 60

export default function Home() {
  const featured = getFeaturedProperties()

  return (
    <>
      <Navigation transparent />
      <main>
        <Hero />
        <TrustBar />
        <FeaturedProperties properties={featured} />
        <MortgageCalculator />
        <AreasSection />
        <WhyWorldwise />
        <HowItWorks />
        <Testimonials />
        <BlogPreview />
        <LeadCaptureSection />
      </main>
      <Footer />
      <FloatingCTA />
    </>
  )
}
