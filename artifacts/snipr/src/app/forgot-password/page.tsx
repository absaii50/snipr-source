import type { Metadata } from "next";
import ForgotPassword from "@/views/ForgotPassword";

export const metadata: Metadata = {
  title: "Forgot Password",
  description: "Reset your Snipr account password.",
  robots: { index: false, follow: true },
};

export default function ForgotPasswordPage() {
  return <ForgotPassword />;
}
