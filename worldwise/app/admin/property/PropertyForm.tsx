'use client'

import { useState, useRef } from 'react'
import { DUBAI_AREAS } from '@/lib/dubai-areas'
import { useRouter } from 'next/navigation'
import { Property } from '@/types'

function slugify(str: string) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

const BLANK: Partial<Property> = {
  title: '',
  slug: '',
  developer: '',
  area: '',
  type: 'apartment',
  status: 'off-plan',
  priceAed: 0,
  roi: undefined,
  grossYield: undefined,
  completionDate: '',
  paymentPlan: '',
  bedrooms: '',
  shortDescription: '',
  description: '',
  amenities: [],
  images: [],
  featured: false,
  badge: '',
}

export default function PropertyForm({ property, draftId }: { property?: Property; draftId?: string }) {
  // Draft prefill is NOT an edit: there is no saved property yet, so we publish
  // (POST) rather than PUT against a non-existent id.
  const isEdit = !!property && !draftId
  const router = useRouter()
  // Use existing id when editing; generate one upfront so uploads have a stable folder.
  const [propertyId] = useState(() => property?.id ?? String(Date.now()))
  const [form, setForm] = useState<Partial<Property>>(property ?? BLANK)
  const [amenitiesRaw, setAmenitiesRaw] = useState((property?.amenities ?? []).join('\n'))
  const [areaCustom, setAreaCustom] = useState<boolean>(() => !!property?.area && !DUBAI_AREAS.includes(property.area))
  const [images, setImages] = useState<string[]>(property?.images ?? [])
  const [qrImage, setQrImage] = useState(property?.qrImage ?? '')
  const [projectNumber, setProjectNumber] = useState(property?.projectNumber ?? '')
  const [permitNumber, setPermitNumber] = useState(property?.permitNumber ?? '')
  const [uploading, setUploading] = useState(false)
  const [uploadingQr, setUploadingQr] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [brochure, setBrochure] = useState(property?.brochure ?? '')
  const [uploadingBrochure, setUploadingBrochure] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const qrInputRef = useRef<HTMLInputElement>(null)
  const brochureInputRef = useRef<HTMLInputElement>(null)
  const [floorPlans, setFloorPlans] = useState<string[]>(property?.floorPlans ?? [])
  const [uploadingFloorPlans, setUploadingFloorPlans] = useState(false)
  const floorPlanInputRef = useRef<HTMLInputElement>(null)

  function set(key: keyof Property, value: unknown) {
    setForm(f => ({ ...f, [key]: value }))
  }

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return
    setUploading(true)
    setError('')
    const fd = new FormData()
    fd.append('propertyId', propertyId)
    fd.append('kind', 'gallery')
    Array.from(fileList).forEach(f => fd.append('files', f))
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      const data = await res.json()
      if (res.ok) {
        setImages(prev => [...prev, ...data.paths])
      } else {
        setError(data.error || 'Upload failed.')
      }
    } catch (err) {
      setError('Upload failed.')
    }
    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleQrFile(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return
    setUploadingQr(true)
    setError('')
    const fd = new FormData()
    fd.append('propertyId', propertyId)
    fd.append('kind', 'qr')
    fd.append('files', fileList[0])
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      const data = await res.json()
      if (res.ok && data.paths?.[0]) {
        setQrImage(data.paths[0])
      } else {
        setError(data.error || 'QR upload failed.')
      }
    } catch (err) {
      setError('QR upload failed.')
    }
    setUploadingQr(false)
    if (qrInputRef.current) qrInputRef.current.value = ''
  }

  async function handleBrochureFile(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return
    setUploadingBrochure(true)
    setError('')
    const fd = new FormData()
    fd.append('propertyId', propertyId)
    fd.append('kind', 'brochure')
    fd.append('files', fileList[0])
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      const data = await res.json()
      if (res.ok && data.brochure) {
        setBrochure(data.brochure)
      } else {
        setError(data.error || 'Brochure upload failed.')
      }
    } catch (err) {
      setError('Brochure upload failed.')
    }
    setUploadingBrochure(false)
    if (brochureInputRef.current) brochureInputRef.current.value = ''
  }

  async function handleFloorPlanFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return
    setUploadingFloorPlans(true)
    setError('')
    const fd = new FormData()
    fd.append('propertyId', propertyId)
    fd.append('kind', 'gallery') // floor plans are images written to the same property folder
    Array.from(fileList).forEach(f => fd.append('files', f))
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      const data = await res.json()
      if (res.ok && data.paths) {
        setFloorPlans(prev => [...prev, ...data.paths])
      } else {
        setError(data.error || 'Floor plan upload failed.')
      }
    } catch {
      setError('Floor plan upload failed.')
    }
    setUploadingFloorPlans(false)
    if (floorPlanInputRef.current) floorPlanInputRef.current.value = ''
  }

  function removeFloorPlan(idx: number) {
    setFloorPlans(prev => prev.filter((_, i) => i !== idx))
  }

  function removeImage(idx: number) {
    setImages(prev => prev.filter((_, i) => i !== idx))
  }

  function moveImage(idx: number, dir: -1 | 1) {
    setImages(prev => {
      const next = [...prev]
      const target = idx + dir
      if (target < 0 || target >= next.length) return prev
      ;[next[idx], next[target]] = [next[target], next[idx]]
      return next
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const slug = form.slug || slugify(form.title ?? '')
    const payload = {
      ...form,
      id: propertyId,
      slug,
      amenities: amenitiesRaw.split('\n').map(s => s.trim()).filter(Boolean),
      images,
      qrImage: qrImage.split('?')[0], // strip cache-bust before saving
      projectNumber,
      permitNumber,
      brochure: brochure || undefined,
      floorPlans,
    }

    const url = draftId
      ? `/api/admin/import/${draftId}/publish`
      : isEdit ? `/api/properties/${property!.id}` : '/api/properties'
    const method = draftId ? 'POST' : isEdit ? 'PUT' : 'POST'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (res.ok) {
      router.push('/admin')
      router.refresh()
    } else {
      setError('Something went wrong. Please try again.')
    }
    setLoading(false)
  }

  const fieldClass = 'w-full border border-gray-200 bg-white px-4 py-2.5 rounded-sm text-navy placeholder-gray-400 focus:outline-none focus:border-gold text-sm'

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-sm shadow-sm border border-gray-100 p-8 space-y-6">
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Property Title *</label>
          <input className={fieldClass} value={form.title} onChange={e => { set('title', e.target.value); set('slug', slugify(e.target.value)) }} required />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Slug (URL)</label>
          <input className={fieldClass} value={form.slug} onChange={e => set('slug', e.target.value)} placeholder="auto-generated from title" />
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Developer *</label>
          <input className={fieldClass} value={form.developer} onChange={e => set('developer', e.target.value)} required />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Area / District *</label>
          <select
            className={fieldClass}
            value={areaCustom ? '__other__' : (form.area || '')}
            onChange={e => {
              if (e.target.value === '__other__') { setAreaCustom(true); set('area', '') }
              else { setAreaCustom(false); set('area', e.target.value) }
            }}
            required
          >
            <option value="" disabled>Select area…</option>
            {DUBAI_AREAS.map(a => <option key={a} value={a}>{a}</option>)}
            <option value="__other__">Other…</option>
          </select>
          {areaCustom && (
            <input
              className={`${fieldClass} mt-2`}
              value={form.area || ''}
              onChange={e => set('area', e.target.value)}
              placeholder="Custom area / community"
              required
            />
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Type</label>
          <select className={fieldClass} value={form.type} onChange={e => set('type', e.target.value)}>
            {['apartment', 'villa', 'townhouse', 'penthouse'].map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Status</label>
          <select className={fieldClass} value={form.status} onChange={e => { set('status', e.target.value); if (e.target.value !== 'rent') set('rented', false) }}>
            {['off-plan', 'secondary', 'rent'].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Bedrooms</label>
          <input className={fieldClass} value={form.bedrooms} onChange={e => set('bedrooms', e.target.value)} placeholder="e.g. 1–3 Bed" />
        </div>
      </div>

      <div className="grid md:grid-cols-4 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Price (AED) *</label>
          <input type="number" className={fieldClass} value={form.priceAed} onChange={e => set('priceAed', Number(e.target.value))} required />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Est. ROI (%)</label>
          <input type="number" step="0.1" className={fieldClass} value={form.roi ?? ''} onChange={e => set('roi', e.target.value ? Number(e.target.value) : undefined)} placeholder="e.g. 7.5" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Gross Rental Yield (%)</label>
          <input type="number" step="0.1" className={fieldClass} value={form.grossYield ?? ''} onChange={e => set('grossYield', e.target.value ? Number(e.target.value) : undefined)} placeholder="e.g. 7.5" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Payment Plan</label>
          <input className={fieldClass} value={form.paymentPlan} onChange={e => set('paymentPlan', e.target.value)} placeholder="e.g. 70/30" />
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Handover / Completion Date</label>
          <input className={fieldClass} value={form.completionDate} onChange={e => set('completionDate', e.target.value)} placeholder="e.g. Q2 2026" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Badge Label</label>
          <input className={fieldClass} value={form.badge} onChange={e => set('badge', e.target.value)} placeholder="e.g. Beachfront, High ROI" />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1.5">Short Description (card preview)</label>
        <input className={fieldClass} value={form.shortDescription} onChange={e => set('shortDescription', e.target.value)} placeholder="1–2 sentences shown on property card" />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1.5">Full Description</label>
        <textarea
          className={`${fieldClass} resize-none`}
          rows={5}
          value={form.description}
          onChange={e => set('description', e.target.value)}
          placeholder="Full property description shown on the detail page..."
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1.5">
          Amenities (one per line)
        </label>
        <textarea
          className={`${fieldClass} resize-none`}
          rows={5}
          value={amenitiesRaw}
          onChange={e => setAmenitiesRaw(e.target.value)}
          placeholder={"Swimming pool\nGym\nKids play area\n..."}
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1.5">
          Photos (first image is the main one shown on the card)
        </label>

        <div
          onDragOver={e => { e.preventDefault() }}
          onDrop={e => { e.preventDefault(); handleFiles(e.dataTransfer.files) }}
          className="border-2 border-dashed border-gray-200 rounded-sm p-6 text-center hover:border-gold transition-colors cursor-pointer"
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={e => handleFiles(e.target.files)}
          />
          <p className="text-sm text-gray-500">
            {uploading ? 'Uploading...' : 'Drop photos here or click to choose files'}
          </p>
          <p className="text-xs text-gray-400 mt-1">JPG, PNG, WebP, GIF · max 8 MB each</p>
        </div>

        {images.length > 0 && (
          <div className="grid grid-cols-3 md:grid-cols-4 gap-3 mt-4">
            {images.map((src, idx) => (
              <div key={src + idx} className="relative group border border-gray-100 rounded-sm overflow-hidden bg-gray-50">
                <img src={src} alt="" className="w-full h-28 object-cover" />
                {idx === 0 && (
                  <span className="absolute top-1 left-1 bg-gold text-navy text-[10px] font-medium px-1.5 py-0.5 rounded-sm">MAIN</span>
                )}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100">
                  <button type="button" onClick={() => moveImage(idx, -1)} disabled={idx === 0} className="bg-white text-navy text-xs px-2 py-1 rounded-sm disabled:opacity-30">←</button>
                  <button type="button" onClick={() => moveImage(idx, 1)} disabled={idx === images.length - 1} className="bg-white text-navy text-xs px-2 py-1 rounded-sm disabled:opacity-30">→</button>
                  <button type="button" onClick={() => removeImage(idx)} className="bg-red-500 text-white text-xs px-2 py-1 rounded-sm">✕</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-gray-100 pt-6">
        <h3 className="font-serif text-lg text-navy mb-1">PERMISSION (DLD / RERA)</h3>
        <p className="text-xs text-gray-400 mb-4">Official Dubai Land Department permit info shown on the property page.</p>

        <div className="grid md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Project Number</label>
            <input
              className={fieldClass}
              value={projectNumber}
              onChange={e => setProjectNumber(e.target.value)}
              placeholder="e.g. 3691"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Permit Number</label>
            <input
              className={fieldClass}
              value={permitNumber}
              onChange={e => setPermitNumber(e.target.value)}
              placeholder="e.g. 1535334714"
            />
          </div>
        </div>

        <label className="block text-xs font-medium text-gray-500 mb-1.5">QR Code Image</label>
        <div className="flex items-start gap-4">
          <div
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); handleQrFile(e.dataTransfer.files) }}
            onClick={() => qrInputRef.current?.click()}
            className="border-2 border-dashed border-gray-200 rounded-sm p-5 text-center hover:border-gold transition-colors cursor-pointer flex-1"
          >
            <input
              ref={qrInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={e => handleQrFile(e.target.files)}
            />
            <p className="text-sm text-gray-500">
              {uploadingQr ? 'Uploading...' : qrImage ? 'Drop or click to replace QR' : 'Drop QR image here or click to choose'}
            </p>
            <p className="text-xs text-gray-400 mt-1">JPG / PNG / WebP · max 8 MB</p>
          </div>

          {qrImage && (
            <div className="relative group border border-gray-100 rounded-sm overflow-hidden bg-white p-1.5 shrink-0">
              <img src={qrImage} alt="QR" className="w-24 h-24 object-contain" />
              <button
                type="button"
                onClick={() => setQrImage('')}
                className="absolute top-0.5 right-0.5 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-sm opacity-0 group-hover:opacity-100"
              >
                ✕
              </button>
            </div>
          )}
        </div>

        <label className="block text-xs font-medium text-gray-500 mb-1.5 mt-5">Brochure (PDF)</label>
        <div
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); handleBrochureFile(e.dataTransfer.files) }}
          onClick={() => brochureInputRef.current?.click()}
          className="border-2 border-dashed border-gray-200 rounded-sm p-5 text-center hover:border-gold transition-colors cursor-pointer"
        >
          <input
            ref={brochureInputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={e => handleBrochureFile(e.target.files)}
          />
          <p className="text-sm text-gray-500">
            {uploadingBrochure ? 'Uploading...' : brochure ? `Replace brochure (${brochure})` : 'Drop brochure PDF here or click to choose'}
          </p>
          <p className="text-xs text-gray-400 mt-1">PDF · max 25 MB · gated behind a lead form on the property page</p>
        </div>
        {brochure && (
          <button type="button" onClick={() => setBrochure('')} className="text-xs text-red-500 mt-1">
            Remove brochure
          </button>
        )}

        <label className="block text-xs font-medium text-gray-500 mb-1.5 mt-5">Floor plans (gated on the property page)</label>
        <div
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); handleFloorPlanFiles(e.dataTransfer.files) }}
          onClick={() => floorPlanInputRef.current?.click()}
          className="border-2 border-dashed border-gray-200 rounded-sm p-5 text-center hover:border-gold transition-colors cursor-pointer"
        >
          <input
            ref={floorPlanInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="hidden"
            onChange={e => handleFloorPlanFiles(e.target.files)}
          />
          <p className="text-sm text-gray-500">
            {uploadingFloorPlans ? 'Uploading...' : 'Drop floor-plan images here or click to choose'}
          </p>
          <p className="text-xs text-gray-400 mt-1">JPG / PNG / WebP · shown blurred until a visitor submits the lead form</p>
        </div>
        {floorPlans.length > 0 && (
          <div className="grid grid-cols-4 gap-2 mt-2">
            {floorPlans.map((src, idx) => (
              <div key={idx} className="relative group border border-gray-100 rounded-sm overflow-hidden bg-white">
                <img src={src} alt={`Floor plan ${idx + 1}`} className="w-full h-20 object-cover" />
                <button
                  type="button"
                  onClick={() => removeFloorPlan(idx)}
                  className="absolute top-0.5 right-0.5 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-sm opacity-0 group-hover:opacity-100"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={form.featured}
          onChange={e => set('featured', e.target.checked)}
          className="w-4 h-4 accent-gold"
        />
        <span className="text-sm text-navy font-medium">
          Show this property in the Featured section on the homepage
        </span>
      </label>

      {form.status === 'rent' && (
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={form.rented ?? false}
            onChange={e => set('rented', e.target.checked)}
            className="w-4 h-4 accent-gold"
          />
          <span className="text-sm text-navy font-medium">
            Mark as Rented / Unavailable
          </span>
        </label>
      )}

      {error && <p className="text-red-500 text-sm">{error}</p>}

      <div className="flex gap-4 pt-4 border-t border-gray-100">
        <button type="submit" disabled={loading} className="btn-primary disabled:opacity-60">
          {loading ? 'Saving...' : isEdit ? 'Save Changes' : 'Add Property'}
        </button>
        <a href="/admin" className="btn-outline-gold">
          Cancel
        </a>
      </div>
    </form>
  )
}
