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
              "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://www.google-analytics.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: blob: https://images.unsplash.com https://*.tildacdn.com https://*.tildacdn.pro",
              "connect-src 'self' https://www.google-analytics.com https://analytics.google.com https://region1.google-analytics.com",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
        ],
      },
    ]
  },
  images: {
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
}

export default nextConfig
