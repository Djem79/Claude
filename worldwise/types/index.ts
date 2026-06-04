export interface Property {
  id: string
  slug: string
  title: string
  developer: string
  area: string
  type: 'apartment' | 'villa' | 'townhouse' | 'penthouse'
  status: 'off-plan' | 'secondary' | 'rent'
  priceAed: number
  pricePerSqft?: number
  roi?: number
  grossYield?: number   // annual gross rental yield %, e.g. 7.5
  completionDate?: string
  paymentPlan?: string
  bedrooms: string
  description: string
  shortDescription: string
  amenities: string[]
  images: string[]
  featured: boolean
  badge?: string
  rented?: boolean
  qrImage?: string
  permitNumber?: string
  projectNumber?: string
  brochure?: string   // filename under public/files/brochures/<id>.pdf; presence => show the gate
  floorPlans?: string[]   // floor-plan image URLs under /images/properties/<id>/; shown gated, separate from `images`
  createdAt: string
}

export interface PropertyDraft {
  draftId: string            // numeric string; reused as the property id on publish
  fields: Partial<Property>  // AI-extracted, cleaned property fields
  imageCandidates: string[]  // /images/properties/<draftId>/<n>.png paths from the PDF
  sourcePdf: string          // original uploaded filename (for display)
  extractedAt: string        // ISO timestamp
  status: 'pending'
}

export type LeadStatus = 'new' | 'contacted' | 'in-progress' | 'won' | 'lost'

export interface ActivityEntry {
  at: string
  by: string
  byName: string
  action: string
}

export interface SentEntry {
  via: 'whatsapp' | 'email'
  sentAt: string
  sentBy: string
  sentByName: string
}

export interface FileAttachment {
  id: string
  name: string
  size: number
  url: string
  uploadedAt: string
  uploadedBy: string
  sentLog: SentEntry[]
}

export interface Lead {
  id: string
  name: string
  phone: string
  email?: string
  budget?: string
  propertyType?: string
  area?: string
  message?: string
  source: string
  propertySlug?: string
  propertyTitle?: string
  status?: LeadStatus
  notes?: string
  contactedAt?: string
  updatedAt?: string
  createdAt: string
  activityLog?: ActivityEntry[]
  attachments?: FileAttachment[]
}

export type AdminRole = 'owner' | 'manager'

export type AdminSection = 'properties' | 'leads' | 'dashboard'

export interface AdminUser {
  id: string
  name: string
  username: string
  passwordHash: string
  role: AdminRole
  active: boolean
  /** Sections a manager may access. Absent on legacy users → treated as all sections. Ignored for owner. */
  sections?: AdminSection[]
  createdAt: string
  lastLoginAt?: string
}
