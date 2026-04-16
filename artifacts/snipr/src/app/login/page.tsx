import type { Metadata } from "next";
import { Suspense } from "react";
import Login from "@/views/Login";

export const metadata: Metadata = {
  title: "Log In to Your Account",
  description: "Log in to your Snipr account to manage your links, view analytics, and create QR codes.",
  alternates: { canonical: "https://snipr.sh/login" },
  robots: { index: false, follow: true },
};

export default function LoginPage() {
  return <Suspense><Login /></Suspense>;
}
