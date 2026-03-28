import type { Metadata } from "next";
import Contact from "@/views/Contact";

export const metadata: Metadata = {
  title: "Contact us",
  description: "Get in touch with the Snipr team. We're here to help with any questions about our URL shortener and link analytics platform.",
  alternates: { canonical: "https://snipr.sh/contact" },
};

export default function ContactPage() {
  return <Contact />;
}
