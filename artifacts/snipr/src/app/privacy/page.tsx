import type { Metadata } from "next";
import Privacy from "@/views/Privacy";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Snipr's privacy policy. Learn how we collect, use, and protect your personal data.",
  alternates: { canonical: "https://snipr.sh/privacy" },
};

export default function PrivacyPage() {
  return <Privacy />;
}
