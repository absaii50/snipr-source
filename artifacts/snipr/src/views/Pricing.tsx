"use client";
import { useState } from "react";
import { PublicNavbar } from "@/components/layout/PublicNavbar";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { Check } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";

type Plan = "starter" | "growth" | "pro" | "business" | "enterprise";

export default function Pricing() {
  const { user } = useAuth();
  const router = useRouter();
  const [loadingPlan, setLoadingPlan] = useState<Plan | null>(null);
  const [billing, setBilling] = useState<"monthly" | "annual">("monthly");

  function startCheckout(plan: Plan) {
    if (!user) {
      window.location.href = "/signup";
      return;
    }
    setLoadingPlan(plan);
    router.push(`/checkout?plan=${plan}&billing=${billing}`);
  }

  const tiers: {
    name: string;
    plan: Plan | null;
    monthlyPrice: string;
    annualPrice: string;
    annualMonthly: string;
    clicks: string;
    description: string;
    features: string[];
    cta: string;
    action: () => void;
    highlighted: boolean;
    disabled: boolean;
  }[] = [
    {
      name: "Free",
      plan: null,
      monthlyPrice: "$0",
      annualPrice: "$0",
      annualMonthly: "$0",
      clicks: "10K clicks/mo",
      description: "For getting started",
      features: [
        "10K clicks/month",
        "Basic short links",
        "Custom slugs",
        "QR code export",
        "Basic click analytics",
        "snipr.sh domain",
      ],
      cta: "Get Started Free",
      action: () => { window.location.href = user ? "/dashboard" : "/signup"; },
      highlighted: false,
      disabled: false,
    },
    {
      name: "Starter",
      plan: "starter",
      monthlyPrice: "$4",
      annualPrice: "$38",
      annualMonthly: "$3.17",
      clicks: "1M clicks/mo",
      description: "For personal projects",
      features: [
        "1M clicks/month",
        "1 custom domain",
        "Geo & device analytics",
        "Link expiry & scheduling",
        "Password-protected links",
        "Folders & tags",
      ],
      cta: loadingPlan === "starter" ? "Redirecting…" : "Get Starter",
      action: () => startCheckout("starter"),
      highlighted: false,
      disabled: loadingPlan === "starter",
    },
    {
      name: "Growth",
      plan: "growth",
      monthlyPrice: "$12",
      annualPrice: "$115",
      annualMonthly: "$9.58",
      clicks: "5M clicks/mo",
      description: "For creators & marketers",
      features: [
        "5M clicks/month",
        "3 custom domains",
        "Link cloaking",
        "Geo & device routing rules",
        "UTM builder",
        "AI-powered insights",
      ],
      cta: loadingPlan === "growth" ? "Redirecting…" : "Get Growth",
      action: () => startCheckout("growth"),
      highlighted: true,
      disabled: loadingPlan === "growth",
    },
    {
      name: "Pro",
      plan: "pro",
      monthlyPrice: "$29",
      annualPrice: "$278",
      annualMonthly: "$23.17",
      clicks: "25M clicks/mo",
      description: "For growing businesses",
      features: [
        "25M clicks/month",
        "10 custom domains",
        "Conversion & revenue tracking",
        "Pixel integrations (Meta, Google, TikTok)",
        "Link rules (city, OS, language)",
        "Priority support",
      ],
      cta: loadingPlan === "pro" ? "Redirecting…" : "Get Pro",
      action: () => startCheckout("pro"),
      highlighted: false,
      disabled: loadingPlan === "pro",
    },
    {
      name: "Business",
      plan: "business",
      monthlyPrice: "$79",
      annualPrice: "$758",
      annualMonthly: "$63.17",
      clicks: "100M clicks/mo",
      description: "For scaling teams",
      features: [
        "100M clicks/month",
        "Unlimited domains",
        "Team workspaces & roles",
        "Webhook & Zapier integrations",
        "API access",
        "Dedicated support",
      ],
      cta: loadingPlan === "business" ? "Redirecting…" : "Get Business",
      action: () => startCheckout("business"),
      highlighted: false,
      disabled: loadingPlan === "business",
    },
    {
      name: "Enterprise",
      plan: "enterprise",
      monthlyPrice: "$149",
      annualPrice: "$1,430",
      annualMonthly: "$119.17",
      clicks: "Unlimited clicks",
      description: "For large organisations",
      features: [
        "Unlimited clicks",
        "Unlimited domains & workspaces",
        "Custom AI reporting",
        "SLA & uptime guarantee",
        "Custom onboarding",
        "24/7 dedicated support",
      ],
      cta: loadingPlan === "enterprise" ? "Redirecting…" : "Get Enterprise",
      action: () => startCheckout("enterprise"),
      highlighted: false,
      disabled: loadingPlan === "enterprise",
    },
  ];

  return (
    <div className="min-h-screen bg-[#080708] flex flex-col font-sans">
      <PublicNavbar />

      <main className="flex-1 py-24 px-4">
        <div className="container mx-auto max-w-7xl">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <div className="text-[11px] text-[#5A5C60] font-semibold uppercase tracking-[0.14em] mb-4">Pricing</div>
            <h1 className="text-[40px] md:text-[52px] font-bold tracking-tight text-[#EFEFF0] leading-[1.08] mb-5">
              Simple, click-based pricing
            </h1>
            <p className="text-[16px] text-[#C3C3C1] leading-[1.7]">
              Pay only for what you use. Up to 50% cheaper than Bitly, Short.io, and Rebrandly.
            </p>
          </div>

          {/* Billing toggle */}
          <div className="flex items-center justify-center gap-4 mb-12">
            <span className={`text-[14px] font-medium ${billing === "monthly" ? "text-[#EFEFF0]" : "text-[#5A5C60]"}`}>Monthly</span>
            <button
              onClick={() => setBilling(billing === "monthly" ? "annual" : "monthly")}
              className={`relative w-11 h-6 rounded-full transition-colors overflow-hidden ${billing === "annual" ? "bg-[#728DA7]" : "bg-[#2A2A2E]"}`}
            >
              <span className={`absolute top-[3px] left-[3px] w-[18px] h-[18px] rounded-full bg-white transition-transform duration-200 ${billing === "annual" ? "translate-x-[20px]" : "translate-x-0"}`} />
            </button>
            <span className={`text-[14px] font-medium ${billing === "annual" ? "text-[#EFEFF0]" : "text-[#5A5C60]"}`}>
              Annual
              <span className="ml-2 px-1.5 py-0.5 rounded bg-green-500/15 text-green-400 text-[11px] font-semibold">Save 20%</span>
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-start max-w-6xl mx-auto">
            {tiers.map((tier) => (
              <div
                key={tier.name}
                className={`relative rounded-2xl p-7 flex flex-col transition-all duration-300
                  ${tier.highlighted
                    ? "bg-[#3C3C44] border-2 border-[#728DA7]"
                    : "bg-[#141416] border border-[#2A2A2E]"}
                `}
              >
                {tier.highlighted && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-1 bg-[#728DA7] text-white text-[11px] font-bold tracking-wide rounded-full whitespace-nowrap">
                    Most Popular
                  </div>
                )}

                <div className="mb-5">
                  <h3 className="text-[18px] font-bold text-[#EFEFF0] mb-0.5">{tier.name}</h3>
                  <p className="text-[12px] text-[#5A5C60]">{tier.description}</p>
                </div>

                <div className="mb-2 flex items-baseline gap-1">
                  <span className="text-[42px] font-extrabold tracking-tight text-[#EFEFF0] leading-none">
                    {billing === "annual" && tier.plan ? tier.annualMonthly : tier.monthlyPrice}
                  </span>
                  {tier.plan && <span className="font-normal text-[14px] text-[#5A5C60]">/mo</span>}
                </div>

                {billing === "annual" && tier.plan && (
                  <p className="text-[12px] text-[#728DA7] mb-1">
                    {tier.annualPrice} billed annually
                  </p>
                )}

                <p className="text-[12px] text-[#5A5C60] mb-6">{tier.clicks}</p>

                <ul className="space-y-3 mb-7 flex-1">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5">
                      <Check className="w-3.5 h-3.5 text-[#728DA7] shrink-0 mt-0.5" />
                      <span className="text-[13px] text-[#C3C3C1]">{feature}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={tier.action}
                  disabled={tier.disabled}
                  className={`w-full h-10 rounded-lg text-[13px] font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed
                    ${tier.highlighted
                      ? "bg-[#728DA7] hover:bg-[#5a7a94] text-white"
                      : "bg-[#2A2A2E] hover:bg-[#3C3C44] text-[#EFEFF0]"}
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
