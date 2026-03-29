"use client";
import { ReactNode, useEffect, useState } from "react";
import { ProtectedSidebar } from "./ProtectedSidebar";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import { Loader2, Mail, ArrowRight, RefreshCw } from "lucide-react";

function VerifyEmailGate() {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function resend() {
    setSending(true);
    try {
      await fetch("/api/auth/resend-verification", { method: "POST", credentials: "include" });
      setSent(true);
      setTimeout(() => setSent(false), 5000);
    } catch {}
    finally { setSending(false); }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8F9FB] px-4">
      <div className="w-full max-w-md text-center">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#728DA7] to-[#5A7A94] flex items-center justify-center mx-auto mb-6 shadow-lg shadow-[#728DA7]/20">
          <Mail className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-[#0A0A0A] mb-2">Check your inbox</h1>
        <p className="text-[#6B7280] mb-8 leading-relaxed">
          We sent a verification link to your email. Please click it to activate your account and access the dashboard.
        </p>
        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-6 shadow-sm mb-6">
          <p className="text-sm text-[#6B7280] mb-4">Didn't receive the email? Check your spam folder or</p>
          <button
            onClick={resend}
            disabled={sending || sent}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0A0A0A] text-white text-sm font-semibold hover:bg-[#1A1A1A] active:scale-[0.98] disabled:opacity-50 transition-all"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : sent ? <Mail className="w-4 h-4" /> : <RefreshCw className="w-4 h-4" />}
            {sending ? "Sending..." : sent ? "Email sent!" : "Resend verification email"}
          </button>
        </div>
        <a href="/login" className="text-sm text-[#728DA7] hover:underline">
          Sign in with a different account
        </a>
      </div>
    </div>
  );
}

export function ProtectedLayout({ children }: { children: ReactNode }) {
  const { user, isLoading, error } = useAuth();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && !isLoading && (error || !user)) {
      router.push("/login");
    }
  }, [mounted, isLoading, error, user, router]);

  if (!mounted) return null;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#EBECF3]">
        <Loader2 className="w-6 h-6 animate-spin text-[#4F46E5]" />
      </div>
    );
  }

  if (error || !user) return null;

  // Email verification gate
  if (!(user as any)?.user?.emailVerified) {
    return <VerifyEmailGate />;
  }

  return (
    <div className="flex min-h-screen bg-[#EBECF3] text-[#111827]">
      <ProtectedSidebar />
      <main className="flex-1 flex flex-col min-h-screen overflow-y-auto bg-[#EBECF3]">
        {children}
      </main>
    </div>
  );
}
