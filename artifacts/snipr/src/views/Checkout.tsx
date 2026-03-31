"use client";
import { useState, useCallback, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { loadStripe } from "@stripe/stripe-js";
import {
  EmbeddedCheckoutProvider,
  EmbeddedCheckout,
} from "@stripe/react-stripe-js";
import { ArrowLeft, Shield, Lock } from "lucide-react";
import Link from "next/link";

let stripePromise: ReturnType<typeof loadStripe> | null = null;

function getStripePromise() {
  if (!stripePromise) {
    if (typeof window === "undefined") {
      return null as any;
    }
    stripePromise = fetch("/api/billing/publishable-key")
      .then((r) => r.json())
      .then((data) => loadStripe(data.publishableKey));
  }
  return stripePromise;
}

const PLAN_INFO: Record<string, { name: string; price: string; color: string }> = {
  pro: { name: "Pro", price: "$19/mo", color: "#728DA7" },
  business: { name: "Business", price: "$49/mo", color: "#7C5CC4" },
};

export default function Checkout() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const plan = searchParams.get("plan") as "pro" | "business" | null;
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!plan || !["pro", "business"].includes(plan)) {
      router.replace("/pricing");
    }
  }, [plan, router]);

  const fetchClientSecret = useCallback(async () => {
    const res = await fetch("/api/billing/create-checkout-session", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: "Network error" }));
      setError(data.error || "Failed to start checkout.");
      throw new Error(data.error || "Failed to create session");
    }

    const data = await res.json();
    if (!data.clientSecret) {
      setError("Failed to initialize checkout.");
      throw new Error("No client secret returned");
    }
    return data.clientSecret;
  }, [plan]);

  if (!plan || !["pro", "business"].includes(plan)) {
    return null;
  }

  const info = PLAN_INFO[plan];

  return (
    <div className="min-h-screen bg-[#F8F8FA] font-sans">
      <div className="bg-white border-b border-[#E4E4EC]">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link
            href="/pricing"
            className="inline-flex items-center gap-2 text-[13px] text-[#8888A0] hover:text-[#0A0A0A] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to pricing
          </Link>
          <div className="flex items-center gap-2 text-[12px] text-[#AAAAB4]">
            <Lock className="w-3.5 h-3.5" />
            Secure checkout
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[12px] font-semibold text-white mb-4"
            style={{ background: info.color }}
          >
            Upgrading to {info.name}
          </div>
          <h1 className="text-[28px] font-bold text-[#0A0A0A] mb-2">
            Complete your subscription
          </h1>
          <p className="text-[14px] text-[#8888A0]">
            You&apos;re subscribing to the {info.name} plan at {info.price}. Cancel anytime.
          </p>
        </div>

        {error ? (
          <div className="bg-white rounded-2xl border border-[#FECACA] p-8 text-center">
            <div className="text-[16px] font-semibold text-[#DC2626] mb-2">
              Checkout unavailable
            </div>
            <p className="text-[14px] text-[#8888A0] mb-4">{error}</p>
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-semibold bg-[#0A0A0A] text-white hover:bg-[#333] transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Return to pricing
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-[#E4E4EC] overflow-hidden shadow-sm">
            <EmbeddedCheckoutProvider
              stripe={getStripePromise()}
              options={{ fetchClientSecret }}
            >
              <EmbeddedCheckout className="min-h-[400px]" />
            </EmbeddedCheckoutProvider>
          </div>
        )}

        <div className="mt-6 flex items-center justify-center gap-4 text-[12px] text-[#AAAAB4]">
          <div className="flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5" />
            PCI-compliant
          </div>
          <span className="text-[#E4E4EC]">|</span>
          <div className="flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5" />
            256-bit encryption
          </div>
          <span className="text-[#E4E4EC]">|</span>
          <span>
            Powered by{" "}
            <a
              href="https://stripe.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#635BFF] font-semibold hover:underline"
            >
              Stripe
            </a>
          </span>
        </div>
      </div>
    </div>
  );
}
