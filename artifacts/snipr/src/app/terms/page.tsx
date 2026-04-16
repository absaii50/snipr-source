import type { Metadata } from "next";
import Terms from "@/views/Terms";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Snipr's terms of service. Read our terms and conditions for using our link management and URL shortener platform.",
  alternates: { canonical: "https://snipr.sh/terms" },
  openGraph: {
    title: "Terms of Service | Snipr",
    description: "Read Snipr's terms and conditions for using our link management platform.",
    url: "https://snipr.sh/terms",
    type: "website",
    images: [{ url: "/opengraph.jpg", width: 1200, height: 630, alt: "Snipr Terms of Service" }],
  },
};

export default function TermsPage() {
  return <Terms />;
}
