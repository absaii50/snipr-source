import type { Metadata } from "next";
import Pricing from "@/views/Pricing";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Simple, transparent pricing for everyone. Start free, upgrade when you need custom domains, AI insights, smart routing, and advanced analytics.",
  alternates: {
    canonical: "https://snipr.sh/pricing",
  },
  openGraph: {
    title: "Pricing | Snipr",
    description:
      "Click-based pricing from $4/mo. Starter, Growth, Pro, Business, Enterprise. Up to 50% cheaper than Bitly and Short.io. No hidden fees.",
    url: "https://snipr.sh/pricing",
  },
};

export default function PricingPage() {
  return <Pricing />;
}
