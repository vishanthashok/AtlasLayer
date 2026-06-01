import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['puppeteer-core', '@sparticuz/chromium', 'puppeteer'],
  async redirects() {
    return [
      { source: "/house-ai", destination: "/parcelis", permanent: true },
      { source: "/house-ai/:path*", destination: "/parcelis/:path*", permanent: true },
      { source: "/agrimap", destination: "/fieldstone", permanent: true },
      { source: "/agrimap/:path*", destination: "/fieldstone/:path*", permanent: true },
      { source: "/api/house-ai/:path*", destination: "/api/parcelis/:path*", permanent: true },
      { source: "/api/agrimap/:path*", destination: "/api/fieldstone/:path*", permanent: true },
    ];
  },
};

export default nextConfig;
