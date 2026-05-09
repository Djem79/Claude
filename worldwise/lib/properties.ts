import fs from 'fs'
import path from 'path'
import { Property } from '@/types'

const DATA_FILE = path.join(process.cwd(), 'data', 'properties.json')

export function getProperties(): Property[] {
  const raw = fs.readFileSync(DATA_FILE, 'utf-8')
  return JSON.parse(raw) as Property[]
}

export function getPropertyBySlug(slug: string): Property | null {
  return getProperties().find(p => p.slug === slug) ?? null
}

export function getPropertyById(id: string): Property | null {
  return getProperties().find(p => p.id === id) ?? null
}

export function getFeaturedProperties(): Property[] {
  return getProperties().filter(p => p.featured)
}

export function saveProperties(properties: Property[]): void {
  fs.writeFileSync(DATA_FILE, JSON.stringify(properties, null, 2), 'utf-8')
}

export function createProperty(data: Omit<Property, 'createdAt'> & { id?: string }): Property {
  const properties = getProperties()
  const id = data.id && /^\d{6,20}$/.test(data.id) ? data.id : String(Date.now())
  const newProperty: Property = {
    ...data,
    id,
    createdAt: new Date().toISOString(),
  }
  saveProperties([...properties, newProperty])
  return newProperty
}

export function updateProperty(id: string, data: Partial<Omit<Property, 'id' | 'createdAt'>>): Property | null {
  const properties = getProperties()
  const index = properties.findIndex(p => p.id === id)
  if (index === -1) return null
  properties[index] = { ...properties[index], ...data }
  saveProperties(properties)
  return properties[index]
}

export function deleteProperty(id: string): boolean {
  const properties = getProperties()
  const filtered = properties.filter(p => p.id !== id)
  if (filtered.length === properties.length) return false
  saveProperties(filtered)
  return true
}
