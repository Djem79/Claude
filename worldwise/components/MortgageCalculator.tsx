'use client'

import { useState, useMemo } from 'react'
import { estimateMonthly } from '@/lib/mortgage'
import LeadModal from './LeadModal'

function formatAed(n: number) {
  if (n >= 1_000_000) return `AED ${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `AED ${Math.round(n / 1000)}K`
  return `AED ${Math.round(n).toLocaleString()}`
}

function formatAedFull(n: number) {
  return `AED ${Math.round(n).toLocaleString('en-AE')}`
}

const TERMS = [5, 10, 15, 20, 25]
const DOWN_PAYMENTS = [20, 25, 30, 40]

export default function MortgageCalculator() {
  const [price, setPrice] = useState(2_000_000)
  const [downPct, setDownPct] = useState(20)
  const [termYears, setTermYears] = useState(25)
  const [rate, setRate] = useState(4.5)
  const [modalOpen, setModalOpen] = useState(false)

  const effectiveDown = downPct

  const calc = useMemo(() => {
    const downAmount = price * (effectiveDown / 100)
    const loan = price - downAmount
    const n = termYears * 12
    const monthly = estimateMonthly(price, { downPct: effectiveDown / 100, ratePct: rate, years: termYears })
    const totalPaid = monthly * n
    const totalInterest = totalPaid - loan
    const dldFee = price * 0.04
    return { downAmount, loan, monthly, totalPaid, totalInterest, dldFee }
  }, [price, effectiveDown, termYears, rate])

  return (
    <section id="mortgage-calculator" className="py-20 bg-navy">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-12">
          <p className="text-gold text-sm font-medium uppercase tracking-widest mb-2">
            Mortgage Calculator
          </p>
          <h2 className="font-serif text-4xl md:text-5xl text-white">
            Calculate Your Monthly Payment
          </h2>
          <p className="text-white/60 mt-3 text-lg">
            Instant estimate for UAE property financing
          </p>
        </div>

        <div className="bg-navy-light rounded-sm p-8 md:p-12 grid md:grid-cols-2 gap-12 border border-white/10">
          {/* Inputs */}
          <div className="space-y-7">
            {/* Property Price */}
            <div>
              <label className="text-white/70 text-sm font-medium block mb-3">Property Price</label>
              <input
                type="range"
                min={500_000}
                max={10_000_000}
                step={100_000}
                value={price}
                onChange={e => setPrice(Number(e.target.value))}
                className="w-full accent-gold"
              />
              <div className="flex justify-between text-white/50 text-xs mt-1">
                <span>AED 500K</span>
                <span className="text-gold font-semibold text-base">{formatAed(price)}</span>
                <span>AED 10M</span>
              </div>
            </div>

            {/* Down Payment */}
            <div>
              <label className="text-white/70 text-sm font-medium block mb-3">
                Down Payment — {effectiveDown}%{' '}
                <span className="text-white/40 font-normal">({formatAedFull(calc.downAmount)})</span>
              </label>
              <div className="flex gap-2 flex-wrap">
                {DOWN_PAYMENTS.map(p => (
                  <button
                    key={p}
                    onClick={() => setDownPct(p)}
                    className={`py-1.5 px-3 rounded-sm text-sm border transition-all ${
                      effectiveDown === p
                        ? 'bg-gold text-navy border-gold font-medium'
                        : 'text-white/70 border-white/20 hover:border-gold/50'
                    }`}
                  >
                    {p}%
                  </button>
                ))}
              </div>
            </div>

            {/* Loan Term */}
            <div>
              <label className="text-white/70 text-sm font-medium block mb-3">Loan Term</label>
              <div className="flex gap-2 flex-wrap">
                {TERMS.map(t => (
                  <button
                    key={t}
                    onClick={() => setTermYears(t)}
                    className={`py-1.5 px-3 rounded-sm text-sm border transition-all ${
                      termYears === t
                        ? 'bg-gold text-navy border-gold font-medium'
                        : 'text-white/70 border-white/20 hover:border-gold/50'
                    }`}
                  >
                    {t} yr
                  </button>
                ))}
              </div>
            </div>

            {/* Interest Rate */}
            <div>
              <label className="text-white/70 text-sm font-medium block mb-3">
                Annual Interest Rate — <span className="text-gold">{rate.toFixed(1)}%</span>
              </label>
              <input
                type="range"
                min={2.5}
                max={8}
                step={0.1}
                value={rate}
                onChange={e => setRate(Number(e.target.value))}
                className="w-full accent-gold"
              />
              <div className="flex justify-between text-white/50 text-xs mt-1">
                <span>2.5%</span>
                <span>8.0%</span>
              </div>
            </div>

            <button
              onClick={() => setModalOpen(true)}
              className="btn-primary w-full text-center"
            >
              Get a Mortgage Quote →
            </button>
          </div>

          {/* Results */}
          <div className="flex flex-col justify-center space-y-4">
            {/* Primary result */}
            <div className="rounded-sm p-6 border border-gold/40 bg-gold/5 text-center">
              <p className="text-white/60 text-sm font-medium mb-1">Monthly Payment</p>
              <p className="font-serif text-4xl md:text-5xl text-gold">{formatAedFull(calc.monthly)}</p>
              <p className="text-white/40 text-xs mt-2">per month for {termYears} years at {rate.toFixed(1)}%</p>
            </div>

            {/* Secondary results */}
            {[
              { label: 'Loan Amount', value: formatAedFull(calc.loan), sub: `${100 - effectiveDown}% LTV` },
              { label: 'Total Interest Paid', value: formatAedFull(calc.totalInterest), sub: 'Over full loan term' },
              { label: 'Total Repayment', value: formatAedFull(calc.totalPaid), sub: 'Principal + interest' },
              { label: 'DLD Registration Fee', value: formatAedFull(calc.dldFee), sub: '4% of purchase price (buyer pays)' },
            ].map(item => (
              <div key={item.label} className="rounded-sm p-4 border border-white/10 bg-white/5 flex justify-between items-center">
                <div>
                  <p className="text-white/60 text-xs font-medium">{item.label}</p>
                  <p className="text-white/30 text-xs">{item.sub}</p>
                </div>
                <p className="font-serif text-lg text-white">{item.value}</p>
              </div>
            ))}

            <p className="text-white/25 text-xs pt-1">
              * Indicative estimate only. Actual rates and eligibility depend on your bank and financial profile.
            </p>
          </div>
        </div>
      </div>

      <LeadModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        source="mortgage_calculator"
        title="Get a Personalised Mortgage Quote"
        subtitle="Our mortgage advisors work with 15+ UAE banks — we'll find the best rate for your profile."
      />
    </section>
  )
}
