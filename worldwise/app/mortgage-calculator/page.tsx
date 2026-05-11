import Navigation from '@/components/Navigation'
import Footer from '@/components/Footer'
import FloatingCTA from '@/components/FloatingCTA'
import MortgageCalculator from '@/components/MortgageCalculator'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'UAE Mortgage Calculator 2026 | Dubai Property Financing',
  description:
    'Free UAE mortgage calculator for residents and non-residents. Instantly calculate monthly payments, loan amount and total interest for Dubai property. Get a personalised mortgage quote from 15+ banks.',
  alternates: { canonical: 'https://worldwise.pro/mortgage-calculator' },
  openGraph: {
    title: 'UAE Mortgage Calculator — Dubai Property Financing | Worldwise',
    description:
      'Calculate your monthly mortgage payment for Dubai property. Residents and non-residents. Instant results — no registration required.',
    url: 'https://worldwise.pro/mortgage-calculator',
  },
  keywords: [
    'UAE mortgage calculator',
    'Dubai mortgage calculator',
    'Dubai property mortgage',
    'mortgage calculator non-resident UAE',
    'buy property Dubai mortgage',
    'UAE home loan calculator',
  ],
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'UAE Mortgage Calculator',
  url: 'https://worldwise.pro/mortgage-calculator',
  description:
    'Free mortgage calculator for UAE property buyers — residents and non-residents. Calculates monthly payment, total interest and DLD fees.',
  applicationCategory: 'FinanceApplication',
  operatingSystem: 'All',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  provider: {
    '@type': 'RealEstateAgent',
    name: 'Worldwise Real Estate',
    url: 'https://worldwise.pro',
  },
}

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'Can non-residents get a mortgage in the UAE?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes. UAE banks offer mortgages to non-residents on freehold properties in designated zones. Non-residents can borrow up to 75–80% of the property value (LTV), depending on the property price and bank policy. A minimum down payment of 20–25% is required.',
      },
    },
    {
      '@type': 'Question',
      name: 'What is the minimum down payment for a mortgage in Dubai?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'The UAE Central Bank sets a minimum down payment of 20% for UAE residents on properties up to AED 5M, and 30% above AED 5M. Non-residents typically need 20–25% down payment. Additional costs include a 4% DLD registration fee and bank arrangement fees.',
      },
    },
    {
      '@type': 'Question',
      name: 'What interest rates do UAE banks offer foreigners?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Mortgage rates for non-residents in the UAE typically range from 3.5% to 5.5% per annum in 2026, depending on the bank, loan term, and your financial profile. Rates can be fixed (usually for the first 1–5 years) or variable (linked to EIBOR). Working with a mortgage broker helps you compare rates across 15+ banks.',
      },
    },
    {
      '@type': 'Question',
      name: 'What is the maximum mortgage term in the UAE?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'The maximum loan term in the UAE is 25 years. The loan must be fully repaid before the borrower reaches the age of 65 (for employed applicants) or 70 (for self-employed). Non-residents are typically offered terms of up to 25 years, subject to bank approval.',
      },
    },
    {
      '@type': 'Question',
      name: 'What additional costs should I budget for when buying in Dubai?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Beyond the property price, budget for: DLD registration fee (4%), real estate agent commission (2%), DLD admin fee (~AED 4,580), mortgage registration fee (0.25% of loan amount), bank arrangement fee (0.5–1%), and property valuation fee (AED 2,500–3,500).',
      },
    },
  ],
}

const FAQ_ITEMS = [
  {
    q: 'Can non-residents get a mortgage in the UAE?',
    a: 'Yes. UAE banks offer mortgages to non-residents on freehold properties in designated zones (Dubai Marina, Downtown, Palm Jumeirah, Business Bay and many more). Non-residents can borrow up to 75–80% of the property value, with a minimum down payment of 20–25% depending on the bank.',
  },
  {
    q: 'What is the minimum down payment for a mortgage in Dubai?',
    a: 'The UAE Central Bank requires a minimum 20% down payment for residents on properties up to AED 5M. Non-residents also typically need 20–25%. You must also budget for the DLD registration fee (4% of purchase price) on top of your down payment.',
  },
  {
    q: 'What interest rates do UAE banks offer foreigners?',
    a: 'In 2026, mortgage rates for non-residents range from approximately 3.5% to 5.5% per annum, depending on the bank, term, and your financial profile. Rates can be fixed (for 1–5 years) or variable (linked to EIBOR). A mortgage broker can compare rates across 15+ banks simultaneously.',
  },
  {
    q: 'What is the maximum mortgage term in the UAE?',
    a: 'The maximum loan term is 25 years. The mortgage must be fully repaid before you turn 65 (employed) or 70 (self-employed). Most non-residents are offered up to 25 years, subject to approval.',
  },
  {
    q: 'What additional costs should I budget for when buying in Dubai?',
    a: 'Beyond the purchase price: DLD registration fee (4%), agent commission (~2%), DLD admin fee (~AED 4,580), mortgage registration (0.25% of loan), bank arrangement fee (0.5–1%), and property valuation (AED 2,500–3,500). Total transaction costs typically add 6–8% on top of the price.',
  },
]

export default function MortgageCalculatorPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <Navigation />
      <main>
        {/* Hero */}
        <section className="bg-navy pt-32 pb-4">
          <div className="max-w-4xl mx-auto px-6 text-center">
            <p className="text-gold text-sm font-medium uppercase tracking-widest mb-3">
              Free Tool · No Registration
            </p>
            <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl text-white leading-tight mb-4">
              UAE Mortgage Calculator
            </h1>
            <p className="text-white/60 text-lg max-w-2xl mx-auto">
              Calculate your monthly payment, loan amount and total cost for any Dubai property — for residents and non-residents.
            </p>
          </div>
        </section>

        {/* Calculator */}
        <MortgageCalculator />

        {/* How UAE mortgages work */}
        <section className="py-16 bg-white">
          <div className="max-w-4xl mx-auto px-6">
            <h2 className="font-serif text-3xl text-navy mb-8 text-center">
              How UAE Mortgages Work for International Buyers
            </h2>
            <div className="grid md:grid-cols-2 gap-8">
              {[
                {
                  title: 'Who can get a mortgage?',
                  text: 'Any foreign national can apply for a mortgage in the UAE to buy freehold property. Banks assess your income, employment type, existing liabilities and credit history. Both employed and self-employed applicants qualify — though self-employed buyers may need 2 years of audited accounts.',
                },
                {
                  title: 'LTV limits set by the Central Bank',
                  text: 'The UAE Central Bank caps LTV at 80% for residents and non-residents on properties up to AED 5M. Above AED 5M the cap drops to 70% for residents, 65% for non-residents. This means minimum down payment of 20–35% depending on price and residency.',
                },
                {
                  title: 'Fixed vs. variable rates',
                  text: 'Most UAE banks offer a fixed rate for the first 1–5 years (typically 3.5–5%), then switch to a variable rate linked to EIBOR (Emirates Interbank Offered Rate). Fixing for longer gives predictability; variable rates can go lower if EIBOR falls.',
                },
                {
                  title: 'Pre-approval before you search',
                  text: 'Getting a mortgage pre-approval letter before you sign an MOU is strongly recommended. It confirms your budget, speeds up the transaction (cash-equivalent for the seller), and prevents losing your 10% deposit if the bank later declines.',
                },
              ].map(item => (
                <div key={item.title} className="border-l-2 border-gold pl-5">
                  <h3 className="font-semibold text-navy mb-2">{item.title}</h3>
                  <p className="text-gray-600 text-sm leading-relaxed">{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Cost breakdown */}
        <section className="py-16 bg-[#F8F8F6]">
          <div className="max-w-4xl mx-auto px-6">
            <h2 className="font-serif text-3xl text-navy mb-2 text-center">
              Full Cost of Buying with a Mortgage in Dubai
            </h2>
            <p className="text-gray-500 text-center mb-8 text-sm">
              Based on a AED 2,000,000 property with 20% down payment
            </p>
            <div className="bg-white rounded-sm overflow-hidden shadow-sm">
              <table className="w-full text-sm">
                <thead className="bg-navy text-white">
                  <tr>
                    <th className="px-5 py-3 text-left font-medium">Cost item</th>
                    <th className="px-5 py-3 text-right font-medium">Amount</th>
                    <th className="px-5 py-3 text-right font-medium">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {[
                    ['Down Payment (20%)', 'AED 400,000', 'Minimum for residents & non-residents'],
                    ['DLD Registration Fee', 'AED 80,000', '4% of purchase price'],
                    ['Agent Commission', '~AED 40,000', '2% + VAT (buyer side)'],
                    ['Mortgage Registration', 'AED 4,000', '0.25% of loan + AED 290'],
                    ['Bank Arrangement Fee', '~AED 16,000', '1% of loan amount'],
                    ['Property Valuation', 'AED 2,500–3,500', 'Required by the bank'],
                    ['DLD Admin + Title Deed', '~AED 5,000', 'Fixed government fees'],
                  ].map(([item, amount, note]) => (
                    <tr key={item} className="hover:bg-gray-50">
                      <td className="px-5 py-3 text-navy font-medium">{item}</td>
                      <td className="px-5 py-3 text-right text-gold font-semibold">{amount}</td>
                      <td className="px-5 py-3 text-right text-gray-400">{note}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                  <tr>
                    <td className="px-5 py-3 font-semibold text-navy">Total upfront cost</td>
                    <td className="px-5 py-3 text-right font-bold text-navy">~AED 548,000</td>
                    <td className="px-5 py-3 text-right text-gray-400">~27% of property price</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="py-16 bg-white">
          <div className="max-w-3xl mx-auto px-6">
            <h2 className="font-serif text-3xl text-navy mb-10 text-center">
              Frequently Asked Questions
            </h2>
            <div className="space-y-6">
              {FAQ_ITEMS.map(item => (
                <div key={item.q} className="border-b border-gray-100 pb-6">
                  <h3 className="font-semibold text-navy mb-2">{item.q}</h3>
                  <p className="text-gray-600 text-sm leading-relaxed">{item.a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-16 bg-navy">
          <div className="max-w-3xl mx-auto px-6 text-center">
            <h2 className="font-serif text-3xl text-white mb-4">
              Ready to Get Pre-Approved?
            </h2>
            <p className="text-white/60 mb-8">
              Our advisors compare rates across 15+ UAE banks and handle the full mortgage application — at no cost to you.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a href="#mortgage-calculator" className="btn-primary">
                Use the Calculator Again
              </a>
              <a href="/#contact" className="btn-outline">
                Talk to a Mortgage Advisor
              </a>
            </div>
          </div>
        </section>
      </main>
      <Footer />
      <FloatingCTA />
    </>
  )
}
