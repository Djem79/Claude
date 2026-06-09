import Navigation from '@/components/Navigation'
import Footer from '@/components/Footer'
import FloatingCTA from '@/components/FloatingCTA'

export const metadata = {
  title: 'Privacy & Cookie Policy',
  description: 'How Worldwise Real Estate collects, uses, and protects your personal data and cookies.',
  alternates: { canonical: 'https://worldwise.pro/privacy' },
}

export default function PrivacyPage() {
  return (
    <>
      <Navigation />
      <main className="bg-white pt-32 pb-20">
        <div className="max-w-3xl mx-auto px-6">
          <h1 className="font-serif text-4xl text-navy mb-3">Privacy & Cookie Policy</h1>
          <p className="text-gray-500 text-sm mb-10">Last updated: 9 May 2026</p>

          <section className="prose-section">
            <h2 className="font-serif text-2xl text-navy mt-8 mb-3">1. Who we are</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              Worldwise Real Estate L.L.C. (&ldquo;Worldwise&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;) is a Dubai-based real estate
              brokerage. Our office is at Rasis Business Center, Al Barsha, 5th floor, EBC03, Dubai, UAE.
              For data privacy questions contact <a href="mailto:info@worldwise.pro" className="text-gold-accessible underline">info@worldwise.pro</a>.
            </p>

            <h2 className="font-serif text-2xl text-navy mt-8 mb-3">2. What data we collect</h2>
            <ul className="list-disc pl-6 text-gray-700 leading-relaxed space-y-1.5 mb-4">
              <li>Information you submit through enquiry forms (name, phone, email, budget, message).</li>
              <li>Technical data — IP address, browser type, pages visited, referring source.</li>
              <li>Cookie identifiers (see section 5).</li>
            </ul>

            <h2 className="font-serif text-2xl text-navy mt-8 mb-3">3. How we use your data</h2>
            <ul className="list-disc pl-6 text-gray-700 leading-relaxed space-y-1.5 mb-4">
              <li>To respond to your property enquiries and provide consultation.</li>
              <li>To send relevant property suggestions (only if you have requested them).</li>
              <li>To improve the website and analyze user behaviour in aggregate.</li>
              <li>To comply with UAE legal and regulatory obligations (RERA, AML/KYC).</li>
            </ul>

            <h2 className="font-serif text-2xl text-navy mt-8 mb-3">4. Sharing</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              We do not sell your data. We share it only with property developers when you express
              interest in a specific project, and with service providers (email delivery, analytics)
              under confidentiality agreements.
            </p>

            <h2 className="font-serif text-2xl text-navy mt-8 mb-3">5. Cookies</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              We use cookies and similar technologies for the following purposes:
            </p>
            <ul className="list-disc pl-6 text-gray-700 leading-relaxed space-y-1.5 mb-4">
              <li><strong>Essential cookies</strong> — required for the site and admin panel to function (session, security). These cannot be disabled.</li>
              <li><strong>Analytics cookies</strong> — help us understand which pages and properties are most viewed. Anonymised.</li>
              <li><strong>Marketing cookies</strong> — used to measure ad campaign performance.</li>
            </ul>
            <p className="text-gray-700 leading-relaxed mb-4">
              You can accept or decline non-essential cookies via the banner shown on your first visit.
              You can change your choice at any time by clearing your browser&apos;s site data.
            </p>

            <h2 className="font-serif text-2xl text-navy mt-8 mb-3">6. Your rights</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              You may request access, correction or deletion of your personal data at any time by
              emailing <a href="mailto:info@worldwise.pro" className="text-gold-accessible underline">info@worldwise.pro</a>.
              We respond within 30 days.
            </p>

            <h2 className="font-serif text-2xl text-navy mt-8 mb-3">7. Retention</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              Enquiry data is kept for up to 24 months from your last interaction with us, then deleted
              or anonymised, unless retention is required by UAE law.
            </p>

            <h2 className="font-serif text-2xl text-navy mt-8 mb-3">8. Updates to this policy</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              We may update this policy. The current version is always available at this URL with the
              &ldquo;Last updated&rdquo; date at the top.
            </p>
          </section>
        </div>
      </main>
      <Footer />
      <FloatingCTA />
    </>
  )
}
