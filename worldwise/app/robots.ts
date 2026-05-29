import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Block real private paths only. Next.js prefetch (?_rsc=) and analytics
        // (?gtm_latency=) param URLs are NOT blocked: they return the page HTML
        // with a self-canonical to the clean URL, so Google consolidates them via
        // rel=canonical. Blocking them in robots instead leaves them stuck as
        // "Blocked by robots.txt" in Search Console (Google can't read the
        // canonical), which is worse than letting them resolve normally.
        disallow: [
        '/admin',
        '/admin/',
        '/api/',
        '/api',
        '/files/leads/',
      ],
      },
    ],
    sitemap: 'https://worldwise.pro/sitemap.xml',
  }
}
