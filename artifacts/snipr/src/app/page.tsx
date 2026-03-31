import type { Metadata } from "next";
import Home from "@/views/Home";

export const metadata: Metadata = {
  title: "Snipr - Best Custom Domain URL Shortener + QR Code Generator",
  description:
    "Snipr is the best custom domain URL shortener and QR code generator. Shorten links with your own branded domain, track clicks with real-time analytics, create QR codes, and grow faster with AI-powered insights.",
  keywords: [
    "URL shortener",
    "custom domain URL shortener",
    "branded URL shortener",
    "QR code generator",
    "free QR code generator",
    "link shortener",
    "short link generator",
    "custom short links",
    "link analytics",
    "link management",
    "branded links",
    "AI link insights",
    "UTM tracking",
    "smart link routing",
    "geo targeting links",
    "link click tracking",
    "custom domain redirects",
    "best URL shortener",
    "bitly alternative",
    "rebrandly alternative",
  ],
  alternates: {
    canonical: "https://snipr.sh",
  },
  openGraph: {
    title: "Snipr - Best Custom Domain URL Shortener + QR Code Generator",
    description:
      "Shorten links with your own custom domain, generate QR codes, and track every click with real-time analytics. The best branded URL shortener for businesses.",
    url: "https://snipr.sh",
    type: "website",
    images: [
      {
        url: "/opengraph.jpg",
        width: 1200,
        height: 630,
        alt: "Snipr - Custom Domain URL Shortener & QR Code Generator",
      },
    ],
  },
};

export default function HomePage() {
  return <Home />;
}
