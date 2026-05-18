import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
        '/admin',
        '/admin/',
        '/api/',
        '/api',
        '/files/leads/',
        '/*?_rsc=',
        '/*?gtm_latency=',
      ],
      },
    ],
    sitemap: 'https://worldwise.pro/sitemap.xml',
  }
}
