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
    default: "Snipr - Best Custom Domain URL Shortener + QR Code Generator",
    template: "%s | Snipr",
  },
  icons: {
    icon: [
      { url: "/favicon.svg?v=2", type: "image/svg+xml" },
      { url: "/favicon.ico?v=2", sizes: "32x32", type: "image/x-icon" },
    ],
    shortcut: "/favicon.ico?v=2",
  },
  manifest: "/manifest.json",
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
  metadataBase: new URL("https://snipr.sh"),
  alternates: {
    canonical: "https://snipr.sh",
  },
  authors: [{ name: "Snipr", url: "https://snipr.sh" }],
  creator: "Snipr",
  publisher: "Snipr",
  category: "technology",
  classification: "URL Shortener, Link Management, QR Code Generator",
  openGraph: {
    type: "website",
    siteName: "Snipr",
    title: "Snipr - Best Custom Domain URL Shortener + QR Code Generator",
    description:
      "Shorten links with your own custom domain, generate QR codes, and track every click with real-time analytics. The best branded URL shortener for businesses.",
    url: "https://snipr.sh",
    locale: "en_US",
    images: [
      {
        url: "/opengraph.jpg",
        width: 1200,
        height: 630,
        alt: "Snipr - Custom Domain URL Shortener & QR Code Generator",
        type: "image/jpeg",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@snipr_sh",
    creator: "@snipr_sh",
    title: "Snipr - Best Custom Domain URL Shortener + QR Code Generator",
    description:
      "Shorten links with your own branded domain, generate QR codes, and track every click. The best URL shortener for businesses.",
    images: [{ url: "/opengraph.jpg", alt: "Snipr - URL Shortener & QR Code Generator" }],
  },
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      noimageindex: false,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    google: "",
    yandex: "",
    yahoo: "",
  },
  appleWebApp: {
    capable: true,
    title: "Snipr",
    statusBarStyle: "default",
  },
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  other: {
    "application-name": "Snipr",
    "msapplication-TileColor": "#0a0a0a",
    "theme-color": "#ffffff",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": "https://snipr.sh/#website",
      url: "https://snipr.sh",
      name: "Snipr",
      description: "Best Custom Domain URL Shortener + QR Code Generator",
      publisher: { "@id": "https://snipr.sh/#organization" },
      potentialAction: [
        {
          "@type": "SearchAction",
          target: {
            "@type": "EntryPoint",
            urlTemplate: "https://snipr.sh/links?q={search_term_string}",
          },
          "query-input": "required name=search_term_string",
        },
      ],
      inLanguage: "en-US",
    },
    {
      "@type": "Organization",
      "@id": "https://snipr.sh/#organization",
      name: "Snipr",
      url: "https://snipr.sh",
      logo: {
        "@type": "ImageObject",
        url: "https://snipr.sh/favicon.svg",
        width: 512,
        height: 512,
      },
      sameAs: ["https://twitter.com/snipr_sh"],
      contactPoint: {
        "@type": "ContactPoint",
        contactType: "customer support",
        url: "https://snipr.sh/contact",
        availableLanguage: "English",
      },
    },
    {
      "@type": "SoftwareApplication",
      "@id": "https://snipr.sh/#app",
      name: "Snipr",
      url: "https://snipr.sh",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      description:
        "Custom domain URL shortener, QR code generator, and link analytics platform with AI-powered insights.",
      offers: {
        "@type": "AggregateOffer",
        lowPrice: "0",
        highPrice: "24",
        priceCurrency: "USD",
        offerCount: 4,
        offers: [
          {
            "@type": "Offer",
            name: "Free",
            price: "0",
            priceCurrency: "USD",
            description: "Free forever with 100 links and 1 custom domain.",
          },
          {
            "@type": "Offer",
            name: "Pro",
            price: "4",
            priceCurrency: "USD",
            description: "Unlimited links, 10 custom domains, AI insights.",
          },
        ],
      },
      featureList: [
        "Custom domain URL shortening",
        "QR code generation",
        "Real-time click analytics",
        "Geo & device targeting",
        "Link password protection",
        "A/B testing",
        "AI-powered insights",
        "Branded short links",
      ],
      publisher: { "@id": "https://snipr.sh/#organization" },
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: "4.9",
        ratingCount: "120",
        bestRating: "5",
      },
    },
  ],
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
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://fonts.googleapis.com" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5" />
      </head>
      <body suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
