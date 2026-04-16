"use client";
import { ReactNode, useEffect, useState } from "react";
import { ProtectedSidebar } from "./ProtectedSidebar";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { getGetMeQueryKey } from "@workspace/api-client-react";
import { Loader2, Mail, RefreshCw } from "lucide-react";

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
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "#09090B" }}>
      <div className="w-full max-w-md text-center">
        <div
          className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-6"
          style={{ background: "linear-gradient(135deg, #8B5CF6, #06B6D4)", boxShadow: "0 8px 24px rgba(139,92,246,0.2)" }}
        >
          <Mail className="w-7 h-7 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-[#FAFAFA] mb-2 font-[family-name:var(--font-space-grotesk)]">Check your inbox</h1>
        <p className="text-[#71717A] mb-8 leading-relaxed text-[14px]">
          We sent a verification link to your email. Please click it to activate your account.
        </p>
        <div className="rounded-xl p-6 mb-6 bg-[#18181B] border border-[#27272A]">
          <p className="text-sm text-[#A1A1AA] mb-4">Didn&apos;t receive the email? Check your spam folder or</p>
          <button
            onClick={resend}
            disabled={sending || sent}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-white text-sm font-semibold active:scale-[0.98] disabled:opacity-50 transition-all"
            style={{ background: "linear-gradient(135deg, #8B5CF6, #06B6D4)", boxShadow: "0 4px 14px rgba(139,92,246,0.2)" }}
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : sent ? <Mail className="w-4 h-4" /> : <RefreshCw className="w-4 h-4" />}
            {sending ? "Sending..." : sent ? "Email sent!" : "Resend verification email"}
          </button>
        </div>
        <a href="/login" className="text-sm text-[#8B5CF6] hover:text-[#A78BFA] hover:underline font-medium transition-colors">
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
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#09090B" }}>
        <Loader2 className="w-5 h-5 animate-spin text-[#8B5CF6]" />
      </div>
    );
  }

  if (error || !user) return null;

  if (!user?.emailVerified) {
    return <VerifyEmailGate />;
  }

  return (
    <div className="flex h-screen overflow-hidden text-[#E4E4E7]" style={{ background: "#09090B" }}>
      <ProtectedSidebar />
      <main className="flex-1 overflow-y-auto" style={{ background: "#09090B" }}>
        {children}
      </main>
    </div>
  );
}
