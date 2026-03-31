import type { Metadata } from "next";
import Pricing from "@/views/Pricing";

export const metadata: Metadata = {
  title: "Pricing - Affordable URL Shortener & QR Code Plans",
  description:
    "Simple, transparent pricing for everyone. Start free with custom domain URL shortening, QR code generation, and link analytics. Upgrade for AI insights, smart routing, and advanced features. Up to 50% cheaper than Bitly.",
  keywords: [
    "URL shortener pricing",
    "custom domain URL shortener price",
    "QR code generator pricing",
    "link shortener plans",
    "bitly alternative pricing",
    "cheap URL shortener",
    "free URL shortener",
  ],
  alternates: {
    canonical: "https://snipr.sh/pricing",
  },
  openGraph: {
    title: "Pricing - Affordable URL Shortener & QR Code Plans | Snipr",
    description:
      "Plans starting at $4/mo. Custom domains, QR codes, real-time analytics, AI insights. Up to 50% cheaper than Bitly and Short.io. Start free — no credit card required.",
    url: "https://snipr.sh/pricing",
    type: "website",
    images: [
      {
        url: "/opengraph.jpg",
        width: 1200,
        height: 630,
        alt: "Snipr Pricing - Custom Domain URL Shortener Plans",
      },
    ],
  },
};

export default function PricingPage() {
  return <Pricing />;
}
