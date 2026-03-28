import type { Metadata } from "next";
import Security from "@/views/Security";

export const metadata: Metadata = {
  title: "Security",
  description: "Snipr takes security seriously. Learn about our security practices, data encryption, and how we protect your links and data.",
  alternates: { canonical: "https://snipr.sh/security" },
};

export default function SecurityPage() {
  return <Security />;
}
