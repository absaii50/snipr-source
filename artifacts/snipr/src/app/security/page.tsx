import type { Metadata } from "next";
import Security from "@/views/Security";

export const metadata: Metadata = {
  title: "Security - How Snipr Protects Your Data",
  description: "Snipr takes security seriously. Learn about our security practices, data encryption, and how we protect your links and analytics data.",
  alternates: { canonical: "https://snipr.sh/security" },
  openGraph: {
    title: "Security | Snipr",
    description: "Learn about Snipr's security practices, data encryption, and how we protect your data.",
    url: "https://snipr.sh/security",
    type: "website",
    images: [{ url: "/opengraph.jpg", width: 1200, height: 630, alt: "Snipr Security" }],
  },
};

export default function SecurityPage() {
  return <Security />;
}
