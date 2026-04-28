/** @type {import('next').NextConfig} */
const nextConfig = {
  // Image optimization (unoptimized for Cloudflare Pages)
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "*.cloudinary.com" },
    ],
  },

  // Production optimizations
  poweredByHeader: false,
  compress: true,
  reactStrictMode: true,

  // Redirects
  async redirects() {
    return [
      { source: "/shop", destination: "/store", permanent: true },
      { source: "/products", destination: "/store", permanent: true },
      { source: "/terms", destination: "/legal", permanent: true },
    ];
  },

  // Security Headers
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
      {
        source: "/api/webhook/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET, POST, OPTIONS" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;


// Injected content via Sentry wizard below

const { withSentryConfig } = require("@sentry/nextjs");

module.exports = withSentryConfig(module.exports, {
  org: "clalmobile",
  project: "javascript-nextjs",

  // Only print Sentry build-plugin logs in CI; locally we want a quiet build.
  silent: !process.env.CI,

  // Upload extended source maps for readable stack traces. Source maps
  // never reach the production bundle — they go straight to Sentry — so
  // this is safe for our Cloudflare Workers deploy via OpenNext.
  widenClientFileUpload: true,

  // Tunnel browser → Sentry traffic through a Next.js rewrite so that
  // ad-blockers and corporate proxies don't drop our client-side errors.
  // The middleware allow-lists `/monitoring` (no CSRF, no auth) — keep
  // them in sync.
  tunnelRoute: "/monitoring",

  // Tree-shake Sentry's debug logger out of the production bundle.
  // We DO NOT enable `automaticVercelMonitors` — ClalMobile runs on
  // Cloudflare Workers via OpenNext, and that flag only applies to
  // Vercel Cron Monitors.
  webpack: {
    treeshake: {
      removeDebugLogging: true,
    },
  },
});
