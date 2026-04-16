import type { NextConfig } from "next";

const securityHeaders = [
  // Prevent clickjacking
  { key: "X-Frame-Options", value: "DENY" },
  // Prevent MIME sniffing
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Control referrer info
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Permissions policy (restrict browser features)
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
  // XSS protection (legacy browsers)
  { key: "X-XSS-Protection", value: "1; mode=block" },
  // HSTS — force HTTPS for 1 year + subdomains
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" },
  // DNS prefetch control
  { key: "X-DNS-Prefetch-Control", value: "on" },
];

const nextConfig: NextConfig = {
  allowedDevOrigins: ["*.replit.dev", "*.picard.replit.dev", "*.riker.replit.dev", "*.repl.co"],
  poweredByHeader: false,
  compress: true,
  images: {
    formats: ["image/webp", "image/avif"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
    minimumCacheTTL: 86400,
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
  },
  experimental: {
    optimizePackageImports: ["lucide-react", "recharts", "framer-motion", "@radix-ui/react-icons", "date-fns"],
  },
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: "/api/:path*",
          destination: "http://localhost:8080/api/:path*",
        },
      ],
    };
  },
  async headers() {
    const isDev = process.env.NODE_ENV !== "production";
    return [
      // Security headers on ALL routes
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
      // HTML pages — short CDN cache so deploys take effect immediately
      {
        source: "/((?!_next/static|_next/image|favicon.ico).*)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, s-maxage=60, stale-while-revalidate=300" },
          { key: "CDN-Cache-Control", value: "max-age=60" },
        ],
      },
      // Fonts — cache forever (hashed)
      {
        source: "/:path*.(woff2|woff|ttf|otf|eot)",
        headers: [
          { key: "Cache-Control", value: isDev ? "no-store" : "public, max-age=31536000, immutable" },
        ],
      },
      // Static assets — cache forever (hashed by Next.js)
      {
        source: "/_next/static/:path*",
        headers: [
          { key: "Cache-Control", value: isDev ? "no-store" : "public, max-age=31536000, immutable" },
        ],
      },
      // Images — 7 day cache with long stale-while-revalidate
      {
        source: "/:path*.(jpg|jpeg|png|gif|svg|ico|webp|avif)",
        headers: [
          { key: "Cache-Control", value: isDev ? "no-store" : "public, max-age=604800, stale-while-revalidate=2592000" },
        ],
      },
    ];
  },
};

export default nextConfig;
