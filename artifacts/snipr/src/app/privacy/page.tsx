import type { Metadata } from "next";
import Privacy from "@/views/Privacy";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Snipr's privacy policy. Learn how we collect, use, and protect your personal data when using our URL shortener platform.",
  alternates: { canonical: "https://snipr.sh/privacy" },
  openGraph: {
    title: "Privacy Policy | Snipr",
    description: "Learn how Snipr collects, uses, and protects your personal data.",
    url: "https://snipr.sh/privacy",
    type: "website",
    images: [{ url: "/opengraph.jpg", width: 1200, height: 630, alt: "Snipr Privacy Policy" }],
  },
};

export default function PrivacyPage() {
  return <Privacy />;
}
