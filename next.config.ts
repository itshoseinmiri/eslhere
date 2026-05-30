import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      { source: '/discussions', destination: '/' },
      { source: '/discussions/:id', destination: '/' },
    ];
  },
};

export default nextConfig;
