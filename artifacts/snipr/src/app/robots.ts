import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/pricing", "/contact", "/privacy", "/terms", "/cookies", "/security", "/login", "/signup"],
        disallow: [
          "/dashboard",
          "/links",
          "/analytics",
          "/domains",
          "/pixels",
          "/organize",
          "/conversions",
          "/revenue",
          "/ai",
          "/team",
          "/integrations",
          "/billing",
          "/live",
          "/admin",
          "/settings",
          "/checkout",
          "/verify-email",
          "/reset-password",
          "/forgot-password",
          "/join",
          "/api/",
          "/_next/",
        ],
      },
      {
        userAgent: "GPTBot",
        disallow: ["/"],
      },
      {
        userAgent: "ChatGPT-User",
        disallow: ["/"],
      },
      {
        userAgent: "CCBot",
        disallow: ["/"],
      },
      {
        userAgent: "anthropic-ai",
        disallow: ["/"],
      },
    ],
    sitemap: "https://snipr.sh/sitemap.xml",
    host: "https://snipr.sh",
  };
}
