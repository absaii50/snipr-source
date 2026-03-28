import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-inter",
  display: "swap",
  preload: true,
});

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-plus-jakarta",
  display: "swap",
  preload: true,
});

export const metadata: Metadata = {
  title: {
    default: "Snipr — AI-Powered Link Intelligence",
    template: "%s | Snipr",
  },
  description:
    "Shorten, track, and optimize your links with AI-powered insights. Smart routing, real-time analytics, custom branded short links, and conversion tracking.",
  keywords: [
    "URL shortener",
    "link analytics",
    "branded links",
    "AI insights",
    "link management",
    "UTM tracking",
    "smart routing",
    "link intelligence",
  ],
  metadataBase: new URL("https://snipr.sh"),
  alternates: {
    canonical: "https://snipr.sh",
  },
  openGraph: {
    type: "website",
    siteName: "Snipr",
    title: "Snipr — AI-Powered Link Intelligence",
    description:
      "Shorten, track, and optimize your links with AI-powered insights. Smart routing, real-time analytics, and conversion tracking.",
    url: "https://snipr.sh",
    images: [{ url: "/opengraph.jpg", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Snipr — AI-Powered Link Intelligence",
    description:
      "AI-powered URL shortener with real-time analytics, smart routing, and conversion tracking.",
    images: ["/opengraph.jpg"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${plusJakartaSans.variable}`}
    >
      <body suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
