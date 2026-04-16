import type { Metadata } from "next";
import { Suspense } from "react";
import Signup from "@/views/Signup";

export const metadata: Metadata = {
  title: "Sign Up Free - Custom Domain URL Shortener & QR Codes",
  description:
    "Create your free Snipr account and start shortening links with your own custom domain, generating QR codes, and tracking clicks with real-time analytics. No credit card required.",
  alternates: {
    canonical: "https://snipr.sh/signup",
  },
  openGraph: {
    title: "Sign Up Free - Custom Domain URL Shortener | Snipr",
    description: "Start shortening links with your own branded domain for free. No credit card required. QR codes, analytics, and AI insights included.",
    url: "https://snipr.sh/signup",
    type: "website",
  },
};

export default function SignupPage() {
  return <Suspense><Signup /></Suspense>;
}
