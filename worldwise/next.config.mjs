/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: '**.tildacdn.com' },
      { protocol: 'https', hostname: '**.tildacdn.pro' },
    ],
  },
}

export default nextConfig
