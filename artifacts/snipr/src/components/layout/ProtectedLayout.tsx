"use client";
import { ReactNode, useEffect, useState } from "react";
import { ProtectedSidebar } from "./ProtectedSidebar";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { getGetMeQueryKey } from "@workspace/api-client-react";
import { Loader2, Mail, ArrowRight, RefreshCw } from "lucide-react";

function VerifyEmailGate() {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
    }, 10_000);
    return () => clearInterval(interval);
  }, [queryClient]);

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
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "#0B0F1A" }}>
      <div className="w-full max-w-md text-center">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6" style={{ background: "linear-gradient(135deg, #818CF8, #6366F1)", boxShadow: "0 8px 24px rgba(99,102,241,0.25)" }}>
          <Mail className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-2xl font-extrabold text-[#F1F5F9] mb-2 font-[family-name:var(--font-space-grotesk)]">Check your inbox</h1>
        <p className="text-[#64748B] mb-8 leading-relaxed">
          We sent a verification link to your email. Please click it to activate your account.
        </p>
        <div className="rounded-[20px] p-6 mb-6" style={{ background: "rgba(17,24,39,0.65)", backdropFilter: "blur(16px)", border: "1px solid rgba(255,255,255,0.06)", boxShadow: "0 1px 2px rgba(0,0,0,0.2)" }}>
          <p className="text-sm text-[#94A3B8] mb-4">Didn&apos;t receive the email? Check your spam folder or</p>
          <button
            onClick={resend}
            disabled={sending || sent}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[12px] text-white text-sm font-semibold active:scale-[0.98] disabled:opacity-50 transition-all"
            style={{ background: "linear-gradient(135deg, #818CF8, #6366F1)", boxShadow: "0 4px 14px rgba(99,102,241,0.25)" }}
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : sent ? <Mail className="w-4 h-4" /> : <RefreshCw className="w-4 h-4" />}
            {sending ? "Sending..." : sent ? "Email sent!" : "Resend verification email"}
          </button>
        </div>
        <a href="/login" className="text-sm text-[#818CF8] hover:underline font-medium">
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
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#0B0F1A" }}>
        <Loader2 className="w-6 h-6 animate-spin text-[#818CF8]" />
      </div>
    );
  }

  if (error || !user) return null;

  if (!user?.emailVerified) {
    return <VerifyEmailGate />;
  }

  return (
    <div className="flex h-screen overflow-hidden text-[#E2E8F0]" style={{ background: "#0B0F1A" }}>
      <ProtectedSidebar />
      <main className="flex-1 overflow-y-auto" style={{ background: "#0B0F1A" }}>
        {children}
      </main>
    </div>
  );
}
