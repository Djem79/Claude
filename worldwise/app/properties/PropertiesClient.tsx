'use client'

import { useState, useMemo } from 'react'
import { Property } from '@/types'
import PropertyCard from '@/components/PropertyCard'
import CurrencySelect from '@/components/CurrencySelect'

const STATUSES = [
  { value: 'all', label: 'All Types' },
  { value: 'off-plan', label: 'Off-Plan' },
  { value: 'secondary', label: 'Secondary' },
  { value: 'rent', label: 'For Rent' },
]
const TYPES = [
  { value: 'all', label: 'All Properties' },
  { value: 'apartment', label: 'Apartment' },
  { value: 'villa', label: 'Villa' },
  { value: 'townhouse', label: 'Townhouse' },
  { value: 'penthouse', label: 'Penthouse' },
]

const MAX_PRICE = 100_000_000

export default function PropertiesClient({ properties }: { properties: Property[] }) {
  const areas = useMemo(
    () => ['All Areas', ...Array.from(new Set(properties.map(p => p.area).filter(Boolean))).sort()],
    [properties]
  )
  const [area, setArea] = useState('All Areas')
  const [status, setStatus] = useState('all')
  const [type, setType] = useState('all')
  const [maxPrice, setMaxPrice] = useState(MAX_PRICE)

  const filtered = useMemo(
    () =>
      properties.filter(
        p =>
          (area === 'All Areas' || p.area === area) &&
          (status === 'all' || p.status === status) &&
          (type === 'all' || p.type === type) &&
          p.priceAed <= maxPrice
      ),
    [properties, area, status, type, maxPrice]
  )

  function FilterSelect({
    value, onChange, options,
  }: {
    value: string
    onChange: (v: string) => void
    options: { value: string; label: string }[]
  }) {
    return (
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-40 max-w-full border border-gray-200 bg-white px-4 py-2.5 rounded-sm text-navy text-sm focus:outline-none focus:border-gold truncate"
      >
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    )
  }

  return (
    <>
      {/* Filters */}
      <div className="bg-white rounded-sm p-5 mb-8 shadow-sm flex flex-wrap gap-4 items-end">
        <div>
          <label className="text-xs text-gray-500 font-medium block mb-1">Area</label>
          <FilterSelect
            value={area}
            onChange={setArea}
            options={areas.map(a => ({ value: a, label: a }))}
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 font-medium block mb-1">Status</label>
          <FilterSelect value={status} onChange={setStatus} options={STATUSES} />
        </div>
        <div>
          <label className="text-xs text-gray-500 font-medium block mb-1">Type</label>
          <FilterSelect value={type} onChange={setType} options={TYPES} />
        </div>
        <div>
          <label className="text-xs text-gray-500 font-medium block mb-1">Currency</label>
          <CurrencySelect />
        </div>
        <div className="flex-1 min-w-48">
          <label className="text-xs text-gray-500 font-medium block mb-1">
            Max Price: AED {(maxPrice / 1_000_000).toFixed(1)}M
          </label>
          <input
            type="range"
            min={500_000}
            max={MAX_PRICE}
            step={500_000}
            value={maxPrice}
            onChange={e => setMaxPrice(Number(e.target.value))}
            className="w-full accent-gold"
          />
        </div>
        <button
          onClick={() => { setArea('All Areas'); setStatus('all'); setType('all'); setMaxPrice(MAX_PRICE) }}
          className="text-sm text-gray-400 hover:text-navy transition-colors"
        >
          Reset
        </button>
      </div>

      {/* Results */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-xl mb-2">No properties match your filters.</p>
          <button onClick={() => { setArea('All Areas'); setStatus('all'); setType('all'); setMaxPrice(25_000_000) }} className="text-gold-accessible underline">
            Reset filters
          </button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map(p => <PropertyCard key={p.id} property={p} />)}
        </div>
      )}
    </>
  )
}
