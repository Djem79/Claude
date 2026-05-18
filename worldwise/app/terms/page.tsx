import Navigation from '@/components/Navigation'
import Footer from '@/components/Footer'

export const metadata = {
  title: 'Terms of Use | Worldwise Real Estate',
  description: 'Terms and conditions governing your use of the Worldwise Real Estate website and services.',
  alternates: { canonical: 'https://worldwise.pro/terms' },
}

export default function TermsPage() {
  return (
    <>
      <Navigation />
      <main className="bg-white pt-32 pb-20">
        <div className="max-w-3xl mx-auto px-6">
          <h1 className="font-serif text-4xl text-navy mb-3">Terms of Use</h1>
          <p className="text-gray-500 text-sm mb-10">Last updated: 12 May 2026</p>

          <section>
            <h2 className="font-serif text-2xl text-navy mt-8 mb-3">1. Acceptance</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              By accessing or using worldwise.pro (&ldquo;the Site&rdquo;), you agree to be bound by these Terms of
              Use. If you do not agree, please do not use the Site. These terms apply to all visitors,
              registered users, and enquiry submitters.
            </p>

            <h2 className="font-serif text-2xl text-navy mt-8 mb-3">2. About Worldwise</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              Worldwise Real Estate L.L.C. is a licensed real estate brokerage registered in Dubai, UAE,
              and regulated by the Real Estate Regulatory Authority (RERA). Our office is at Rasis
              Business Center, Al Barsha, 5th floor EBC03, Dubai, UAE. Contact:{' '}
              <a href="mailto:info@worldwise.pro" className="text-gold hover:underline">info@worldwise.pro</a>.
            </p>

            <h2 className="font-serif text-2xl text-navy mt-8 mb-3">3. Property listings and information</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              All property listings, prices, availability, yield estimates and market data on the Site
              are provided for informational purposes only and are subject to change without notice.
              Prices are indicative and do not constitute a binding offer. We make reasonable efforts
              to keep information accurate but cannot guarantee completeness or currency of all data.
            </p>
            <p className="text-gray-700 leading-relaxed mb-4">
              Rental yield estimates and ROI figures are based on historical market data and are not
              a guarantee of future returns. Property investment involves risk and past performance
              does not predict future results.
            </p>

            <h2 className="font-serif text-2xl text-navy mt-8 mb-3">4. Not financial advice</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              Nothing on the Site constitutes financial, investment, tax or legal advice. The mortgage
              calculator, yield estimates and market commentary are provided as general guidance only.
              Before making any investment decision, you should consult a qualified financial adviser
              and conduct your own due diligence.
            </p>

            <h2 className="font-serif text-2xl text-navy mt-8 mb-3">5. Enquiry forms and communications</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              When you submit an enquiry form, you consent to being contacted by Worldwise Real Estate
              via phone, WhatsApp, or email regarding your enquiry. We do not sell your contact details.
              See our{' '}
              <a href="/privacy" className="text-gold hover:underline">Privacy & Cookie Policy</a> for
              full details on data handling.
            </p>

            <h2 className="font-serif text-2xl text-navy mt-8 mb-3">6. Intellectual property</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              All content on the Site — including text, images, logos, property photography, and
              written guides — is the property of Worldwise Real Estate L.L.C. or is used with
              permission. You may not copy, reproduce, redistribute or use any content without prior
              written consent.
            </p>

            <h2 className="font-serif text-2xl text-navy mt-8 mb-3">7. Third-party links</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              The Site may contain links to developer websites, property portals and external resources.
              We are not responsible for the content or practices of those sites and do not endorse them.
            </p>

            <h2 className="font-serif text-2xl text-navy mt-8 mb-3">8. Limitation of liability</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              To the maximum extent permitted by applicable law, Worldwise Real Estate shall not be
              liable for any direct, indirect, incidental, or consequential loss arising from your use
              of the Site, reliance on information provided, or inability to access the Site. The Site
              is provided &ldquo;as is&rdquo; without warranties of any kind.
            </p>

            <h2 className="font-serif text-2xl text-navy mt-8 mb-3">9. Governing law</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              These Terms are governed by the laws of the Emirate of Dubai and the federal laws of the
              United Arab Emirates. Any disputes shall be subject to the exclusive jurisdiction of the
              courts of Dubai, UAE.
            </p>

            <h2 className="font-serif text-2xl text-navy mt-8 mb-3">10. Changes</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              We may update these Terms at any time. The current version with the &ldquo;Last updated&rdquo; date
              will always be available at this URL. Continued use of the Site after changes constitutes
              acceptance of the revised Terms.
            </p>
          </section>
        </div>
      </main>
      <Footer />
    </>
  )
}
