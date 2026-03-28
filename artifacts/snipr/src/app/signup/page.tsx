import type { Metadata } from "next";
import Signup from "@/views/Signup";

export const metadata: Metadata = {
  title: "Sign up — Get started free",
  description:
    "Create your free Snipr account and start shortening links with AI-powered insights, analytics, and smart routing.",
  alternates: {
    canonical: "https://snipr.sh/signup",
  },
  openGraph: {
    title: "Sign up — Get started free | Snipr",
    description: "Create your free account today. No credit card required.",
    url: "https://snipr.sh/signup",
  },
};

export default function SignupPage() {
  return <Signup />;
}
