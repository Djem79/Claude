import { MetadataRoute } from 'next'
import { getProperties } from '@/lib/properties'

const BASE = 'https://worldwise.pro'

export default function sitemap(): MetadataRoute.Sitemap {
  const properties = getProperties()

  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE, lastModified: new Date(), changeFrequency: 'weekly', priority: 1.0 },
    { url: `${BASE}/properties`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${BASE}/privacy`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.2 },
  ]

  const propertyPages: MetadataRoute.Sitemap = properties.map(p => ({
    url: `${BASE}/properties/${p.slug}`,
    lastModified: new Date(p.createdAt),
    changeFrequency: 'weekly',
    priority: p.featured ? 0.9 : 0.7,
  }))

  return [...staticPages, ...propertyPages]
}
