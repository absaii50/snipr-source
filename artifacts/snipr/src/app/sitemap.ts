import { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://snipr.sh";

  return [
    {
      url: baseUrl,
      lastModified: new Date("2026-04-05"),
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${baseUrl}/pricing`,
      lastModified: new Date("2026-04-01"),
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/signup`,
      lastModified: new Date("2026-03-15"),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/contact`,
      lastModified: new Date("2026-03-01"),
      changeFrequency: "yearly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/security`,
      lastModified: new Date("2026-03-01"),
      changeFrequency: "yearly",
      priority: 0.6,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified: new Date("2026-03-01"),
      changeFrequency: "yearly",
      priority: 0.5,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: new Date("2026-03-01"),
      changeFrequency: "yearly",
      priority: 0.5,
    },
    {
      url: `${baseUrl}/cookies`,
      lastModified: new Date("2026-03-01"),
      changeFrequency: "yearly",
      priority: 0.4,
    },
  ];
}
