import type { NextConfig } from "next";
import withBundleAnalyzer from '@next/bundle-analyzer'; 

const nextConfig: NextConfig = {
  output:"standalone",
  cacheComponents: true,
  experimental: {
    preloadEntriesOnStart: false,
  },
  async rewrites() {
    return [
      {
        // Catches any client fetch requests pointing to /api/v1/internal-backend/
        source: '/api/v1/internal-backend/:path*',
        // Rewrites them server-to-server over localhost directly to your Express container port (55000)
        destination: 'http://127.0.0.1:55000/api/:path*',
      },
    ];
  },
  // ... other configurations
};

module.exports = withBundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
})(nextConfig);
