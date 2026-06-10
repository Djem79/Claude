'use client'

import { useState, useMemo } from 'react'
import { Property } from '@/types'
import PropertyCard from '@/components/PropertyCard'
import CurrencySelect from '@/components/CurrencySelect'
import { canonicalizeArea } from '@/lib/dubai-areas'

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

// Module-scope so its identity is stable across renders — a nested definition would
// remount every <select> (dropping focus) on each filter/slider state change.
function FilterSelect({
  id, label, value, onChange, options,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <select
      id={id}
      aria-label={label}
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

export default function PropertiesClient({
  properties,
  initialArea = 'All Areas',
  initialType = 'all',
  initialStatus = 'all',
}: {
  properties: Property[]
  initialArea?: string
  initialType?: string
  initialStatus?: string
}) {
  const areas = useMemo(
    () => ['All Areas', ...Array.from(new Set(properties.map(p => canonicalizeArea(p.area)).filter(Boolean))).sort()],
    [properties]
  )
  const validTypes = ['all', 'apartment', 'villa', 'townhouse', 'penthouse']
  const validStatuses = ['all', 'off-plan', 'secondary', 'rent']
  const [area, setArea] = useState(areas.includes(initialArea) ? initialArea : 'All Areas')
  const [status, setStatus] = useState(validStatuses.includes(initialStatus) ? initialStatus : 'all')
  const [type, setType] = useState(validTypes.includes(initialType) ? initialType : 'all')
  const [maxPrice, setMaxPrice] = useState(MAX_PRICE)
  const [query, setQuery] = useState('')

  const filtered = useMemo(
    () => {
      const q = query.trim().toLowerCase()
      return properties.filter(
        p =>
          (q === '' ||
            p.title.toLowerCase().includes(q) ||
            p.area.toLowerCase().includes(q) ||
            p.developer.toLowerCase().includes(q)) &&
          (area === 'All Areas' || canonicalizeArea(p.area) === area) &&
          (status === 'all' || p.status === status) &&
          (type === 'all' || p.type === type) &&
          p.priceAed <= maxPrice
      )
    },
    [properties, query, area, status, type, maxPrice]
  )

  return (
    <>
      {/* Filters */}
      <div className="bg-white rounded-sm p-5 mb-8 shadow-sm flex flex-wrap gap-4 items-end">
        <div className="w-full">
          <label htmlFor="filter-search" className="text-xs text-gray-500 font-medium block mb-1">Search</label>
          <input
            id="filter-search"
            type="search"
            aria-label="Search by name, area or developer"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search by name, area or developer…"
            className="w-full border border-gray-200 bg-white px-4 py-2.5 rounded-sm text-navy text-sm focus:outline-none focus:border-gold"
          />
        </div>
        <div>
          <label htmlFor="filter-area" className="text-xs text-gray-500 font-medium block mb-1">Area</label>
          <FilterSelect
            id="filter-area"
            label="Area"
            value={area}
            onChange={setArea}
            options={areas.map(a => ({ value: a, label: a }))}
          />
        </div>
        <div>
          <label htmlFor="filter-status" className="text-xs text-gray-500 font-medium block mb-1">Status</label>
          <FilterSelect id="filter-status" label="Status" value={status} onChange={setStatus} options={STATUSES} />
        </div>
        <div>
          <label htmlFor="filter-type" className="text-xs text-gray-500 font-medium block mb-1">Type</label>
          <FilterSelect id="filter-type" label="Type" value={type} onChange={setType} options={TYPES} />
        </div>
        <div>
          <label className="text-xs text-gray-500 font-medium block mb-1">Currency</label>
          <CurrencySelect />
        </div>
        <div className="flex-1 min-w-48">
          <label htmlFor="filter-maxprice" className="text-xs text-gray-500 font-medium block mb-1">
            Max Price: AED {(maxPrice / 1_000_000).toFixed(1)}M
          </label>
          <input
            id="filter-maxprice"
            aria-label="Maximum price in AED"
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
          onClick={() => { setQuery(''); setArea('All Areas'); setStatus('all'); setType('all'); setMaxPrice(MAX_PRICE) }}
          className="text-sm text-gray-400 hover:text-navy transition-colors"
        >
          Reset
        </button>
      </div>

      {/* Results */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-xl mb-2">No properties match your filters.</p>
          <button onClick={() => { setQuery(''); setArea('All Areas'); setStatus('all'); setType('all'); setMaxPrice(MAX_PRICE) }} className="text-gold-accessible underline">
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
