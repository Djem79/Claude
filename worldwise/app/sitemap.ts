import { MetadataRoute } from 'next'
import { getProperties } from '@/lib/properties'
import { getAllArticles } from '@/lib/articles'
import { areaSlugs } from '@/lib/areas'

export const revalidate = 3600

const BASE = 'https://worldwise.pro'

export default function sitemap(): MetadataRoute.Sitemap {
  const properties = getProperties()

  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE, lastModified: new Date(), changeFrequency: 'weekly', priority: 1.0 },
    { url: `${BASE}/properties`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${BASE}/blog`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE}/mortgage-calculator`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE}/golden-visa`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE}/guide`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE}/privacy`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.2 },
    { url: `${BASE}/terms`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.2 },
  ]

  const propertyPages: MetadataRoute.Sitemap = properties.map(p => ({
    url: `${BASE}/properties/${p.slug}`,
    lastModified: new Date(p.createdAt),
    changeFrequency: 'weekly',
    priority: p.featured ? 0.9 : 0.7,
  }))

  const blogPages: MetadataRoute.Sitemap = getAllArticles().map(a => ({
    url: `${BASE}/blog/${a.slug}`,
    lastModified: 'publishedAt' in a ? new Date(a.publishedAt) : new Date(),
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }))

  const areaPages: MetadataRoute.Sitemap = areaSlugs.map(slug => ({
    url: `${BASE}/${slug}`,
    lastModified: new Date(),
    changeFrequency: 'monthly' as const,
    priority: 0.8,
  }))

  return [...staticPages, ...areaPages, ...propertyPages, ...blogPages]
}
