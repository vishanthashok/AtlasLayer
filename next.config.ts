import type { NextConfig } from "next";

const SECURITY_HEADERS = [
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  {
    // Allow Mapbox GL, Google Maps, NASA, SoilGrids, Supabase, Anthropic CDNs.
    // 'unsafe-eval' required by Mapbox GL JS (WebGL shader compilation).
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://maps.googleapis.com https://maps.gstatic.com https://api.mapbox.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://api.mapbox.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' blob: data: https://*.mapbox.com https://*.googleapis.com https://*.gstatic.com https://*.openstreetmap.org https://power.larc.nasa.gov",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.mapbox.com https://events.mapbox.com https://api.anthropic.com https://api.open-meteo.com https://power.larc.nasa.gov https://rest.soilgrids.org https://maps.googleapis.com https://travel.state.gov https://api.reddit.com",
      "worker-src blob:",
      "frame-src 'none'",
      "object-src 'none'",
      "base-uri 'self'",
    ].join('; '),
  },
];

const nextConfig: NextConfig = {
  serverExternalPackages: ['puppeteer-core', '@sparticuz/chromium', 'puppeteer'],

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: SECURITY_HEADERS,
      },
    ];
  },

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
