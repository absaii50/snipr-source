import type { Metadata } from "next";
import Cookies from "@/views/Cookies";

export const metadata: Metadata = {
  title: "Cookie Policy",
  description: "Snipr's cookie policy. Learn about how we use cookies and similar technologies on our URL shortener platform.",
  alternates: { canonical: "https://snipr.sh/cookies" },
  openGraph: {
    title: "Cookie Policy | Snipr",
    description: "Learn how Snipr uses cookies and similar technologies.",
    url: "https://snipr.sh/cookies",
    type: "website",
    images: [{ url: "/opengraph.jpg", width: 1200, height: 630, alt: "Snipr Cookie Policy" }],
  },
};

export default function CookiesPage() {
  return <Cookies />;
}
