"use client";
import { useState, useCallback, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import {
  EmbeddedCheckoutProvider,
  EmbeddedCheckout,
} from "@stripe/react-stripe-js";
import { ArrowLeft, Shield, Lock } from "lucide-react";
import Link from "next/link";

const VALID_PLANS = ["starter", "growth", "pro", "business", "enterprise"] as const;
type PlanName = typeof VALID_PLANS[number];

const PLAN_INFO: Record<PlanName, { name: string; monthlyPrice: string; annualPrice: string; color: string }> = {
  starter:    { name: "Starter",    monthlyPrice: "$4/mo",   annualPrice: "$38/yr",    color: "#728DA7" },
  growth:     { name: "Growth",     monthlyPrice: "$12/mo",  annualPrice: "$115/yr",   color: "#4A9B7F" },
  pro:        { name: "Pro",        monthlyPrice: "$29/mo",  annualPrice: "$278/yr",   color: "#7C5CC4" },
  business:   { name: "Business",   monthlyPrice: "$79/mo",  annualPrice: "$758/yr",   color: "#C45C5C" },
  enterprise: { name: "Enterprise", monthlyPrice: "$149/mo", annualPrice: "$1,430/yr", color: "#C4945C" },
};

export default function Checkout() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const plan = searchParams.get("plan") as PlanName | null;
  const billing = searchParams.get("billing") as "monthly" | "annual" | null;
  const [error, setError] = useState<string | null>(null);
  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace(`/login?redirect=/checkout?plan=${plan ?? "starter"}&billing=${billing ?? "monthly"}`);
    }
  }, [authLoading, user, plan, billing, router]);

  useEffect(() => {
    if (!plan || !VALID_PLANS.includes(plan)) {
      router.replace("/pricing");
      return;
    }
    if (!user) return; // wait for auth
    // Fetch publishable key; show error immediately if misconfigured
    fetch("/api/billing/publishable-key")
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok || !data.publishableKey) {
          setError(data.error || "Billing is not configured. Please contact support.");
          return;
        }
        setStripePromise(loadStripe(data.publishableKey));
      })
      .catch(() => {
        setError("Could not connect to billing service. Please try again.");
      });
  }, [plan, billing, router, user]);

  const fetchClientSecret = useCallback(async () => {
    const res = await fetch("/api/billing/create-checkout-session", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan, billing: billing ?? "monthly" }),
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
  }, [plan, billing]);

  if (authLoading || (!authLoading && !user)) {
    return null; // redirect in progress
  }

  if (!plan || !VALID_PLANS.includes(plan)) {
    return null;
  }

  const info = PLAN_INFO[plan];
  const displayPrice = billing === "annual" ? info.annualPrice : info.monthlyPrice;

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
            You&apos;re subscribing to the {info.name} plan at {displayPrice}. Cancel anytime.
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
        ) : !stripePromise ? (
          <div className="bg-white rounded-2xl border border-[#E4E4EC] overflow-hidden shadow-sm min-h-[400px] flex items-center justify-center">
            <div className="text-[14px] text-[#8888A0]">Loading payment form…</div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-[#E4E4EC] overflow-hidden shadow-sm">
            <EmbeddedCheckoutProvider
              stripe={stripePromise}
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
