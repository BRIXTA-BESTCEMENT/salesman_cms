import type { NextConfig } from "next";
import withBundleAnalyzer from '@next/bundle-analyzer'; 

const nextConfig: NextConfig = {
  output:"standalone",
  cacheComponents: true,

  // ... other configurations
};

module.exports = withBundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
})(nextConfig);
