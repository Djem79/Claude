import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/admin/', '/api/', '/api', '/files/leads/'],
      },
    ],
    sitemap: 'https://worldwise.pro/sitemap.xml',
  }
}
