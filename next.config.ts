import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
      {
        protocol: 'http',
        hostname: '**',
      },
    ],
  },
  typescript: {
    ignoreBuildErrors: false, // Changed to false to catch real errors
  },
  eslint: {
    ignoreDuringBuilds: false, // Changed to false to catch real errors
  },
};

export default nextConfig;

