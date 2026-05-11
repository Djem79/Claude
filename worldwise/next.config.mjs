/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: '**.tildacdn.com' },
      { protocol: 'https', hostname: '**.tildacdn.pro' },
    ],
  },
  async redirects() {
    return [
      {
        source: '/www.youtube.com/:path*',
        destination: 'https://www.youtube.com/:path*',
        permanent: true,
      },
      {
        source: '/www.instagram.com/:path*',
        destination: 'https://www.instagram.com/:path*',
        permanent: true,
      },
      {
        source: '/www.facebook.com/:path*',
        destination: 'https://www.facebook.com/:path*',
        permanent: true,
      },
      {
        source: '/www.linkedin.com/:path*',
        destination: 'https://www.linkedin.com/:path*',
        permanent: true,
      },
      {
        source: '/www.tiktok.com/:path*',
        destination: 'https://www.tiktok.com/:path*',
        permanent: true,
      },
    ]
  },
}

export default nextConfig
