import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["*.replit.dev", "*.picard.replit.dev", "*.riker.replit.dev", "*.repl.co"],
  poweredByHeader: false,
  compress: true,
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
  experimental: {
    optimizePackageImports: ["lucide-react", "recharts", "framer-motion"],
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
      {
        source: "/:path*.(woff2|woff|ttf|otf|eot)",
        headers: [
          { key: "Cache-Control", value: isDev ? "no-store" : "public, max-age=31536000, immutable" },
        ],
      },
      {
        source: "/_next/static/:path*",
        headers: [
          { key: "Cache-Control", value: isDev ? "no-store" : "public, max-age=31536000, immutable" },
        ],
      },
      {
        source: "/:path*.(jpg|jpeg|png|gif|svg|ico|webp)",
        headers: [
          { key: "Cache-Control", value: isDev ? "no-store" : "public, max-age=86400, stale-while-revalidate=604800" },
        ],
      },
    ];
  },
};

export default nextConfig;
