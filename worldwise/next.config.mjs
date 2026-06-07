/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              // Next.js requires unsafe-inline for its runtime scripts; JSON-LD blocks also need it
              // Cloudflare Web Analytics beacon (static.cloudflareinsights.com) is auto-injected by the CF proxy
              "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://www.google-analytics.com https://static.cloudflareinsights.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: blob: https://images.unsplash.com https://*.tildacdn.com https://*.tildacdn.pro",
              // CF Insights beacon POSTs RUM data to cloudflareinsights.com/cdn-cgi/rum
              "connect-src 'self' https://www.google-analytics.com https://analytics.google.com https://region1.google-analytics.com https://cloudflareinsights.com",
              // Lazy click-to-load Google Maps embed on /properties/[slug] (PropertyLocation).
              // Without frame-src the iframe falls back to default-src 'self' and the browser
              // blocks the cross-origin Google frame (the map renders blank).
              "frame-src https://www.google.com https://maps.google.com",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              // Hardening: block legacy plugin/embed vectors explicitly (no <object>/<embed> used)
              "object-src 'none'",
            ].join('; '),
          },
        ],
      },
    ]
  },
  images: {
    // Serve AVIF (then WebP) — smaller than the WebP-only default, improving LCP
    // on image-heavy pages (hero, galleries, area/property cards).
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: '**.tildacdn.com' },
      { protocol: 'https', hostname: '**.tildacdn.pro' },
    ],
  },
  async redirects() {
    return [
      // Old Tilda site URLs → new Next.js pages
      { source: '/tproduct/:path*', destination: '/properties', permanent: true },
      // High-traffic Tilda posts → topically-matched articles (must precede the
      // /tpost/:path* catch-all; first match wins). Slugs are Tilda-truncated.
      { source: '/tpost/ti51yhg191-new-rule-for-overseas-sellers-bank-accou', destination: '/blog/dubai-property-title-deed-transfer-guide-international-investors', permanent: true },
      { source: '/tpost/z9jizlp8u1-does-buying-property-in-the-uae-grant-a',   destination: '/blog/uae-property-residence-visa', permanent: true },
      { source: '/tpost/:path*',    destination: '/blog',       permanent: true },
      { source: '/page:path*.html', destination: '/',           permanent: true },
      { source: '/rss-feed-:path*.xml', destination: '/sitemap.xml', permanent: true },

      // Duplicate-draft property slugs that leaked into Google's index
      // (admin "duplicate" workflow produces "copy-<original>" — never a real listing)
      { source: '/properties/copy-:path*', destination: '/properties', permanent: true },

      // Bare social media URLs (missing https://)
      { source: '/www.youtube.com/:path*',  destination: 'https://www.youtube.com/:path*',  permanent: true },
      { source: '/www.instagram.com/:path*', destination: 'https://www.instagram.com/:path*', permanent: true },
      { source: '/www.facebook.com/:path*',  destination: 'https://www.facebook.com/:path*',  permanent: true },
      { source: '/www.linkedin.com/:path*',  destination: 'https://www.linkedin.com/:path*',  permanent: true },
      { source: '/www.tiktok.com/:path*',    destination: 'https://www.tiktok.com/:path*',    permanent: true },
    ]
  },
  async rewrites() {
    // afterFiles: only fires when no static public file matched. `next start` won't
    // serve public/ files created after `next build` (PDF-import images, fresh
    // uploads), so those fall through here to the runtime file server.
    return [
      { source: '/images/properties/:id/:file', destination: '/api/media/properties/:id/:file' },
      { source: '/images/qr/:file', destination: '/api/media/qr/:file' },
    ]
  },
}

export default nextConfig
