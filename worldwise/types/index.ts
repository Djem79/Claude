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
  createdAt: string
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
