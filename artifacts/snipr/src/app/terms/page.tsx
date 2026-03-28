import type { Metadata } from "next";
import Terms from "@/views/Terms";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Snipr's terms of service. Read our terms and conditions for using our link management platform.",
  alternates: { canonical: "https://snipr.sh/terms" },
};

export default function TermsPage() {
  return <Terms />;
}
