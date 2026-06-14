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
  lat?: number   // decimal degrees; building-level coordinate when known
  lng?: number   // decimal degrees; paired with lat. Absent → fall back to area centroid
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
  pfLeadId?: string   // Property Finder lead id (dedup + provenance for portal webhook leads)
  propertySlug?: string
  propertyTitle?: string
  // Attribution — captured first-touch from URL utm_*/click-ids (lib/utm.ts)
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  utm_term?: string
  utm_content?: string
  gclid?: string
  fbclid?: string
  attributionCapturedAt?: string
  status?: LeadStatus
  notes?: string
  contactedAt?: string
  updatedAt?: string
  createdAt: string
  activityLog?: ActivityEntry[]
  attachments?: FileAttachment[]
}

export type AdminRole = 'owner' | 'manager'

export type AdminSection = 'properties' | 'leads' | 'dashboard' | 'files'

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

export interface StorageFolder {
  id: string
  name: string
  parentId: string | null   // null = root
  createdAt: string
  createdBy: string          // username
}

export interface StorageFile {
  id: string
  name: string               // sanitized original filename, with extension
  ext: string                // lowercase, no dot, e.g. "pdf"
  mime: string
  size: number               // bytes
  folderId: string | null    // null = root
  uploadedAt: string
  uploadedBy: string         // username
}

export interface FileStore {
  folders: StorageFolder[]
  files: StorageFile[]
}

export interface Crumb {
  id: string | null          // null = Root
  name: string
}

export interface FolderSearchHit extends StorageFolder { pathLabel: string }
export interface FileSearchHit extends StorageFile { pathLabel: string }
