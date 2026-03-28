import type { Metadata } from "next";
import Cookies from "@/views/Cookies";

export const metadata: Metadata = {
  title: "Cookie Policy",
  description: "Snipr's cookie policy. Learn about how we use cookies and similar technologies.",
  alternates: { canonical: "https://snipr.sh/cookies" },
};

export default function CookiesPage() {
  return <Cookies />;
}
