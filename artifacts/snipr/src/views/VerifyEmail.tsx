"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, XCircle, Loader2, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function VerifyEmail() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#080708] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#728DA7] animate-spin" />
      </div>
    }>
      <VerifyEmailInner />
    </Suspense>
  );
}

function VerifyEmailInner() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("No verification token found. Please check your email link.");
      return;
    }

    fetch(`/api/auth/verify-email?token=${token}`, { credentials: "include" })
      .then(async (r) => {
        const data = await r.json();
        if (data.ok) {
          setStatus("success");
          setMessage(data.message || "Your email has been verified!");
        } else {
          setStatus("error");
          setMessage(data.error || "Verification failed. The link may have expired.");
        }
      })
      .catch(() => {
        setStatus("error");
        setMessage("Something went wrong. Please try again.");
      });
  }, [token]);

  return (
    <div className="min-h-screen bg-[#080708] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-block text-2xl font-extrabold tracking-tight text-[#EFEFF0]">
            snipr
          </Link>
        </div>

        <div className="bg-[#141416] rounded-2xl border border-[#2A2A2E] p-8 text-center">
          {status === "loading" && (
            <>
              <Loader2 className="w-12 h-12 text-[#728DA7] animate-spin mx-auto mb-4" />
              <h2 className="text-xl font-bold text-[#EFEFF0] mb-2">Verifying your email...</h2>
              <p className="text-[#8888A0] text-sm">Please wait a moment.</p>
            </>
          )}

          {status === "success" && (
            <>
              <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-green-500" />
              </div>
              <h2 className="text-xl font-bold text-[#EFEFF0] mb-2">Email Verified!</h2>
              <p className="text-[#8888A0] text-sm mb-6">{message}</p>
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#728DA7] text-white font-semibold text-sm hover:bg-[#5F7A94] transition-all"
              >
                Go to Dashboard <ArrowRight className="w-4 h-4" />
              </Link>
            </>
          )}

          {status === "error" && (
            <>
              <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                <XCircle className="w-8 h-8 text-red-500" />
              </div>
              <h2 className="text-xl font-bold text-[#EFEFF0] mb-2">Verification Failed</h2>
              <p className="text-[#8888A0] text-sm mb-6">{message}</p>
              <div className="flex gap-3 justify-center">
                <Link
                  href="/login"
                  className="px-5 py-2.5 rounded-xl border border-[#2A2A2E] text-[#EFEFF0] text-sm font-medium hover:bg-[#1A1A1E] transition-all"
                >
                  Back to Login
                </Link>
                <Link
                  href="/dashboard"
                  className="px-5 py-2.5 rounded-xl bg-[#728DA7] text-white text-sm font-semibold hover:bg-[#5F7A94] transition-all"
                >
                  Dashboard
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
