import type { Metadata } from "next";
import Contact from "@/views/Contact";

export const metadata: Metadata = {
  title: "Contact Us - Get in Touch with the Snipr Team",
  description: "Get in touch with the Snipr team. We're here to help with any questions about our URL shortener and link analytics platform.",
  alternates: { canonical: "https://snipr.sh/contact" },
  openGraph: {
    title: "Contact Us | Snipr",
    description: "Get in touch with the Snipr team. We're here to help with questions about URL shortening, analytics, and custom domains.",
    url: "https://snipr.sh/contact",
    type: "website",
    images: [{ url: "/opengraph.jpg", width: 1200, height: 630, alt: "Contact Snipr" }],
  },
};

export default function ContactPage() {
  return <Contact />;
}
