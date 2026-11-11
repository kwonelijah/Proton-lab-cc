/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },
  // Identity hook, added 2026-11-11. Its presence is part of Next's webpack
  // cache key (`webpack: !!config.webpack`), so adding it forced Vercel to
  // rebuild from a cold cache after a deploy shipped mismatched next/font
  // class hashes (server HTML vs client CSS) and every page fell back to the
  // system font. Harmless to keep; removing it later just busts the cache again.
  webpack: (config) => config,
}

module.exports = nextConfig
