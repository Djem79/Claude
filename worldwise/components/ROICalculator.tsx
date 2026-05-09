'use client'

import { useState } from 'react'
import LeadModal from './LeadModal'

const ROI_RATES: Record<string, number> = {
  apartment: 0.082,
  villa: 0.065,
  townhouse: 0.07,
  penthouse: 0.075,
}

const GROWTH_RATE = 0.06

function formatAed(n: number) {
  return `AED ${Math.round(n).toLocaleString('en-AE')}`
}

export default function ROICalculator() {
  const [budget, setBudget] = useState(2_000_000)
  const [type, setType] = useState('apartment')
  const [modalOpen, setModalOpen] = useState(false)

  const annualIncome = budget * ROI_RATES[type]
  const roi = (ROI_RATES[type] * 100).toFixed(1)
  const value5y = budget * Math.pow(1 + GROWTH_RATE, 5)
  const totalReturn5y = value5y + annualIncome * 5
  const bankReturn5y = budget * Math.pow(1.03, 5)
  const advantage = totalReturn5y - bankReturn5y

  return (
    <section className="py-20 bg-navy">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-12">
          <p className="text-gold text-sm font-medium uppercase tracking-widest mb-2">
            Investment Calculator
          </p>
          <h2 className="font-serif text-4xl md:text-5xl text-white">
            Calculate Your Return
          </h2>
          <p className="text-white/60 mt-3 text-lg">
            See how Dubai property compares to other asset classes
          </p>
        </div>

        <div className="bg-navy-light rounded-sm p-8 md:p-12 grid md:grid-cols-2 gap-12 border border-white/10">
          {/* Inputs */}
          <div className="space-y-8">
            <div>
              <label className="text-white/70 text-sm font-medium block mb-3">
                Investment Budget
              </label>
              <input
                type="range"
                min={500_000}
                max={10_000_000}
                step={100_000}
                value={budget}
                onChange={e => setBudget(Number(e.target.value))}
                className="w-full accent-gold"
              />
              <div className="flex justify-between text-white/50 text-xs mt-1">
                <span>AED 500K</span>
                <span className="text-gold font-semibold text-sm">
                  {formatAed(budget)}
                </span>
                <span>AED 10M</span>
              </div>
            </div>

            <div>
              <label className="text-white/70 text-sm font-medium block mb-3">
                Property Type
              </label>
              <div className="grid grid-cols-2 gap-3">
                {(['apartment', 'villa', 'townhouse', 'penthouse'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setType(t)}
                    className={`py-2.5 px-4 rounded-sm text-sm font-medium capitalize border transition-all ${
                      type === t
                        ? 'bg-gold text-navy border-gold'
                        : 'bg-transparent text-white/70 border-white/20 hover:border-gold/50'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => setModalOpen(true)}
              className="btn-primary w-full text-center"
            >
              Get Personalised Investment Plan →
            </button>
          </div>

          {/* Results */}
          <div className="space-y-5">
            {[
              {
                label: 'Estimated Annual Rental Income',
                value: formatAed(annualIncome),
                sub: `${roi}% gross yield`,
                highlight: true,
              },
              {
                label: 'Property Value in 5 Years',
                value: formatAed(value5y),
                sub: `+${((GROWTH_RATE * 5) * 100).toFixed(0)}% capital growth`,
              },
              {
                label: 'Total Return Over 5 Years',
                value: formatAed(totalReturn5y),
                sub: 'Rental income + capital growth',
              },
              {
                label: 'Advantage vs. Bank Deposit (3%)',
                value: `+${formatAed(advantage)}`,
                sub: 'Additional profit over 5 years',
                highlight: true,
              },
            ].map(item => (
              <div
                key={item.label}
                className={`rounded-sm p-4 border ${
                  item.highlight ? 'border-gold/30 bg-gold/5' : 'border-white/10 bg-white/5'
                }`}
              >
                <p className="text-white/60 text-xs font-medium">{item.label}</p>
                <p className={`font-serif text-2xl mt-1 ${item.highlight ? 'text-gold' : 'text-white'}`}>
                  {item.value}
                </p>
                <p className="text-white/40 text-xs mt-0.5">{item.sub}</p>
              </div>
            ))}

            <p className="text-white/30 text-xs">
              * Estimates based on current Dubai market averages. Not financial advice.
            </p>
          </div>
        </div>
      </div>

      <LeadModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        source="roi_calculator"
        title="Get Your Personalised Investment Plan"
        subtitle="Tell us your goals — we'll send a curated selection within 24 hours."
      />
    </section>
  )
}
