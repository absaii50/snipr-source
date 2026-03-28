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
      "Free forever plan. Pro at $19/mo. Business at $49/mo. No hidden fees.",
    url: "https://snipr.sh/pricing",
  },
};

export default function PricingPage() {
  return <Pricing />;
}
