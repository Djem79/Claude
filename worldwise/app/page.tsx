import { getFeaturedProperties, getProperties } from '@/lib/properties'
import Navigation from '@/components/Navigation'
import Hero from '@/components/Hero'
import IntentRouter from '@/components/IntentRouter'
import TrustBar from '@/components/TrustBar'
import FeaturedProperties from '@/components/FeaturedProperties'
import MortgageCalculator from '@/components/MortgageCalculator'
import AreasSection from '@/components/AreasSection'
import PopularSearches from '@/components/PopularSearches'
import WhyWorldwise from '@/components/WhyWorldwise'
import HowItWorks from '@/components/HowItWorks'
import Testimonials from '@/components/Testimonials'
import TeamSection from '@/components/TeamSection'
import BlogPreview from '@/components/BlogPreview'
import LeadCaptureSection from '@/components/LeadCaptureSection'
import Footer from '@/components/Footer'
import FloatingCTA from '@/components/FloatingCTA'
import QualifyCta from '@/components/QualifyCta'
import Reveal from '@/components/Reveal'

export const revalidate = 60

export default function Home() {
  const featured = getFeaturedProperties()
  const allProperties = getProperties()

  return (
    <>
      <Navigation transparent />
      <main>
        <Hero />
        <IntentRouter />
        <TrustBar />
        <Reveal>
          <FeaturedProperties properties={featured} />
        </Reveal>
        <Reveal>
          <QualifyCta />
        </Reveal>
        <Reveal>
          <MortgageCalculator />
        </Reveal>
        <Reveal>
          <AreasSection />
        </Reveal>
        <Reveal>
          <PopularSearches properties={allProperties} />
        </Reveal>
        <Reveal>
          <WhyWorldwise />
        </Reveal>
        <Reveal>
          <HowItWorks />
        </Reveal>
        <Reveal>
          <Testimonials />
        </Reveal>
        <Reveal>
          <TeamSection />
        </Reveal>
        <Reveal>
          <BlogPreview />
        </Reveal>
        <Reveal>
          <LeadCaptureSection />
        </Reveal>
      </main>
      <Footer />
      <FloatingCTA />
    </>
  )
}
