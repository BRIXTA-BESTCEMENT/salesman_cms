import type { NextConfig } from "next";
import withBundleAnalyzer from '@next/bundle-analyzer'; 

const nextConfig: NextConfig = {
  output:"standalone",
  cacheComponents: true,
  experimental: {
    preloadEntriesOnStart: false,
  },

  // ... other configurations
};

module.exports = withBundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
})(nextConfig);
