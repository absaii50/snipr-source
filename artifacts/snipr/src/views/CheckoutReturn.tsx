"use client";
import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { CheckCircle2, XCircle, RefreshCw, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function CheckoutReturn() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const sessionId = searchParams.get("session_id");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionId) {
      router.replace("/pricing");
      return;
    }

    fetch(`/api/billing/session-status?session_id=${sessionId}`, {
      credentials: "include",
    })
      .then((r) => r.json())
      .then((data) => {
        setStatus(data.status ?? "unknown");
      })
      .catch(() => {
        setStatus("error");
      })
      .finally(() => setLoading(false));
  }, [sessionId, router]);

  if (!sessionId) return null;

  return (
    <div className="min-h-screen bg-[#09090B] font-sans flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        {loading ? (
          <div className="bg-[#18181B] rounded-xl border border-[#27272A] p-10 text-center">
            <RefreshCw className="w-8 h-8 text-[#71717A] mx-auto mb-4 animate-spin" />
            <h2 className="text-[18px] font-bold text-[#FAFAFA] mb-2">
              Processing payment...
            </h2>
            <p className="text-[14px] text-[#A1A1AA]">
              Please wait while we confirm your subscription.
            </p>
          </div>
        ) : status === "complete" ? (
          <div className="bg-[#18181B] rounded-xl border border-[#10B981]/30 p-10 text-center">
            <div className="w-16 h-16 rounded-full bg-[#10B981]/10 flex items-center justify-center mx-auto mb-5">
              <CheckCircle2 className="w-8 h-8 text-[#10B981]" />
            </div>
            <h2 className="text-[22px] font-bold text-[#FAFAFA] mb-2">
              Payment successful!
            </h2>
            <p className="text-[14px] text-[#A1A1AA] mb-6">
              Your plan has been upgraded. Welcome to the new features!
            </p>
            <div className="flex flex-col gap-3">
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center gap-2 w-full h-11 rounded-xl text-[14px] font-semibold text-white transition-colors"
                style={{ background: 'linear-gradient(135deg, #8B5CF6, #7C3AED)' }}
              >
                Go to Dashboard
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/billing"
                className="inline-flex items-center justify-center gap-2 w-full h-10 rounded-xl text-[13px] font-semibold border border-[#27272A] text-[#A1A1AA] hover:bg-[#27272A] transition-colors"
              >
                View subscription details
              </Link>
            </div>
          </div>
        ) : (
          <div className="bg-[#18181B] rounded-xl border border-red-500/30 p-10 text-center">
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-5">
              <XCircle className="w-8 h-8 text-[#EF4444]" />
            </div>
            <h2 className="text-[22px] font-bold text-[#FAFAFA] mb-2">
              {status === "open" ? "Checkout incomplete" : "Something went wrong"}
            </h2>
            <p className="text-[14px] text-[#A1A1AA] mb-6">
              {status === "open"
                ? "Your checkout session is still open. Please try again."
                : "We couldn't confirm your payment. Please try again or contact support."}
            </p>
            <Link
              href="/pricing"
              className="inline-flex items-center justify-center gap-2 w-full h-11 rounded-xl text-[14px] font-semibold text-white transition-colors"
              style={{ background: 'linear-gradient(135deg, #8B5CF6, #7C3AED)' }}
            >
              Back to pricing
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
