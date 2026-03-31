import type { Metadata } from "next";
import ResetPassword from "@/views/ResetPassword";

export const metadata: Metadata = {
  title: "Reset Password",
  description: "Set a new password for your Snipr account.",
  robots: { index: false, follow: true },
};

export default function ResetPasswordPage() {
  return <ResetPassword />;
}
