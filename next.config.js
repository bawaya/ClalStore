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
