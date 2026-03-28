import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/pricing", "/contact", "/privacy", "/terms", "/cookies", "/security", "/login", "/signup"],
        disallow: ["/dashboard", "/links", "/analytics", "/domains", "/pixels", "/organize", "/conversions", "/revenue", "/ai", "/team", "/integrations", "/billing", "/live", "/admin"],
      },
    ],
    sitemap: "https://snipr.sh/sitemap.xml",
    host: "https://snipr.sh",
  };
}
