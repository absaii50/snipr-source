import type { Metadata } from "next";
import Login from "@/views/Login";

export const metadata: Metadata = {
  title: "Log in",
  description: "Log in to your Snipr account to manage your links and analytics.",
  robots: { index: false, follow: true },
};

export default function LoginPage() {
  return <Login />;
}
