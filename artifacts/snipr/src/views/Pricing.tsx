"use client";
import { useState } from "react";
import { PublicNavbar } from "@/components/layout/PublicNavbar";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { Check } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";

export default function Pricing() {
  const { user } = useAuth();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  async function startCheckout(plan: "pro" | "business") {
    if (!user) {
      window.location.href = "/signup";
      return;
    }
    setLoadingPlan(plan);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error ?? "Could not start checkout.");
        setLoadingPlan(null);
      }
    } catch {
      alert("Network error. Please try again.");
      setLoadingPlan(null);
    }
  }

  const tiers = [
    {
      name: "Free",
      price: "$0",
      period: null,
      description: "For getting started",
      features: [
        "Basic short links",
        "Limited analytics",
        "1 workspace",
        "QR code support"
      ],
      cta: "Get Started",
      action: () => { window.location.href = user ? "/dashboard" : "/signup"; },
      highlighted: false,
      disabled: false,
    },
    {
      name: "Pro",
      price: "$19",
      period: "/mo",
      description: "For marketers and creators",
      features: [
        "Branded links",
        "Advanced analytics",
        "Custom slugs",
        "Smart routing",
        "AI insights",
        "Priority support"
      ],
      cta: loadingPlan === "pro" ? "Redirecting…" : "Upgrade to Pro",
      action: () => startCheckout("pro"),
      highlighted: true,
      disabled: loadingPlan === "pro",
    },
    {
      name: "Business",
      price: "$49",
      period: "/mo",
      description: "For growing teams",
      features: [
        "Everything in Pro",
        "Custom domains",
        "Team management",
        "Conversion tracking",
        "API access",
        "Dedicated support"
      ],
      cta: loadingPlan === "business" ? "Redirecting…" : "Upgrade to Business",
      action: () => startCheckout("business"),
      highlighted: false,
      disabled: loadingPlan === "business",
    }
  ];

  return (
    <div className="min-h-screen bg-[#080708] flex flex-col font-sans">
      <PublicNavbar />

      <main className="flex-1 py-24 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <div className="text-[11px] text-[#5A5C60] font-semibold uppercase tracking-[0.14em] mb-4">Pricing</div>
            <h1 className="text-[40px] md:text-[52px] font-bold tracking-tight text-[#EFEFF0] leading-[1.08] mb-5">
              Simple pricing for growing teams
            </h1>
            <p className="text-[16px] text-[#C3C3C1] leading-[1.7]">
              Start free, upgrade when you need more control, analytics, and insight.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-center max-w-5xl mx-auto">
            {tiers.map((tier) => (
              <div
                key={tier.name}
                className={`relative rounded-2xl p-8 flex flex-col h-full transition-all duration-300
                  ${tier.highlighted
                    ? 'bg-[#3C3C44] border-2 border-[#728DA7] md:-mt-4 md:mb-0'
                    : 'bg-[#3C3C44] border border-[#4A4A52]'}
                `}
              >
                {tier.highlighted && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-1 bg-[#728DA7] text-white text-[11px] font-bold tracking-wide rounded-full">
                    Most Popular
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="text-[20px] font-bold text-[#EFEFF0] mb-1">{tier.name}</h3>
                  <p className="text-[13px] text-[#5A5C60]">{tier.description}</p>
                </div>

                <div className="mb-8 flex items-baseline">
                  <span className="text-[48px] font-extrabold tracking-tight text-[#EFEFF0] leading-none">{tier.price}</span>
                  {tier.period && <span className="ml-2 font-normal text-[15px] text-[#5A5C60]">{tier.period}</span>}
                </div>

                <ul className="space-y-3.5 mb-8 flex-1">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3">
                      <Check className="w-4 h-4 text-[#728DA7] shrink-0 mt-0.5" />
                      <span className="text-[14px] text-[#C3C3C1]">{feature}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={tier.action}
                  disabled={tier.disabled}
                  className={`w-full h-11 rounded-lg text-[14px] font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed
                    ${tier.highlighted
                      ? 'bg-[#728DA7] hover:bg-[#5a7a94] text-white'
                      : 'bg-[#4A4A52] hover:bg-[#5A5C60] text-[#EFEFF0]'}
                  `}
                >
                  {tier.cta}
                </button>
              </div>
            ))}
          </div>

          <div className="mt-12 text-center text-[13px] text-[#5A5C60]">
            All plans include SSL, link redirects, and basic analytics. No contracts. Cancel anytime.
            <br />
            <span className="text-[#8888A0] mt-1 block">
              Payments secured by{" "}
              <a href="https://stripe.com" target="_blank" rel="noopener noreferrer" className="text-[#635BFF] hover:underline">
                Stripe
              </a>
            </span>
          </div>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
