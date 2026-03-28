import type { Metadata } from "next";
import Home from "@/views/Home";

export const metadata: Metadata = {
  title: "Snipr — AI-Powered Link Intelligence",
  description:
    "Shorten, track, and optimize your links with AI-powered insights. Smart routing, real-time analytics, custom branded short links, QR codes, and conversion tracking for marketers.",
  keywords: [
    "URL shortener",
    "link analytics",
    "branded short links",
    "AI link insights",
    "smart routing",
    "UTM tracking",
    "QR code generator",
    "link management",
    "conversion tracking",
    "link in bio",
  ],
  alternates: {
    canonical: "https://snipr.sh",
  },
  openGraph: {
    title: "Snipr — AI-Powered Link Intelligence",
    description:
      "Transform every link into a data point. Smart routing, real-time analytics, AI insights, and custom branded short links.",
    url: "https://snipr.sh",
    type: "website",
  },
};

export default function HomePage() {
  return <Home />;
}
