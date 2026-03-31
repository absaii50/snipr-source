import type { Metadata } from "next";
import { Suspense } from "react";
import ResetPassword from "@/views/ResetPassword";

export const metadata: Metadata = {
  title: "Reset Password",
  description: "Set a new password for your Snipr account.",
  robots: { index: false, follow: true },
};

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPassword />
    </Suspense>
  );
}
