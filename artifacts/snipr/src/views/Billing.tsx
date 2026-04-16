"use client";
import { useState, useEffect } from "react";
import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import {
  CreditCard, ExternalLink, CheckCircle2, Clock, XCircle,
  Zap, Star, Crown, ArrowUpRight, RefreshCw, Sparkles,
  Shield, ChevronRight, BadgeCheck
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

interface Subscription {
  plan: "free" | "starter" | "growth" | "pro" | "business" | "enterprise";
  status: string | null;
  subscriptionId: string | null;
  renewsAt: string | null;
  expiresAt: string | null;
}

const PLAN_ORDER = ["free", "starter", "growth", "pro", "business", "enterprise"] as const;

const PLAN_META = {
  free: {
    label: "Free",
    monthlyPrice: "$0",
    annualPrice: "$0",
    icon: Zap,
    color: "#7A7A84",
    gradient: "from-[#7A7A84] to-[#6666888]",
    bg: "rgba(122,122,132,0.12)",
    features: ["10K clicks/month", "Basic short links", "Custom slugs", "snipr.sh domain"],
    clicks: "10K",
  },
  starter: {
    label: "Starter",
    monthlyPrice: "$4",
    annualPrice: "$38",
    icon: Zap,
    color: "#34D399",
    gradient: "from-[#34D399] to-[#2D7A61]",
    bg: "rgba(52,211,153,0.12)",
    features: ["1M clicks/month", "1 custom domain", "Geo & device analytics", "Link expiry & scheduling", "Password-protected links"],
    clicks: "1M",
  },
  growth: {
    label: "Growth",
    monthlyPrice: "$12",
    annualPrice: "$115",
    icon: Star,
    color: "#818CF8",
    gradient: "from-[#818CF8] to-[#4A6E8E]",
    bg: "rgba(129,140,248,0.12)",
    features: ["5M clicks/month", "3 custom domains", "Link cloaking", "Geo & device routing rules", "UTM builder", "AI-powered insights"],
    clicks: "5M",
  },
  pro: {
    label: "Pro",
    monthlyPrice: "$29",
    annualPrice: "$278",
    icon: Star,
    color: "#A78BFA",
    gradient: "from-[#A78BFA] to-[#5E3EA6]",
    bg: "rgba(167,139,250,0.12)",
    features: ["25M clicks/month", "10 custom domains", "Conversion & revenue tracking", "Pixel integrations", "Link rules", "Priority support"],
    clicks: "25M",
  },
  business: {
    label: "Business",
    monthlyPrice: "$79",
    annualPrice: "$758",
    icon: Crown,
    color: "#F87171",
    gradient: "from-[#F87171] to-[#A33A3A]",
    bg: "rgba(248,113,113,0.12)",
    features: ["100M clicks/month", "Unlimited domains", "Team workspaces & roles", "Webhook & Zapier integrations", "API access", "Dedicated support"],
    clicks: "100M",
  },
  enterprise: {
    label: "Enterprise",
    monthlyPrice: "$149",
    annualPrice: "$1,430",
    icon: Crown,
    color: "#FB923C",
    gradient: "from-[#FB923C] to-[#A37038]",
    bg: "rgba(251,146,60,0.12)",
    features: ["Unlimited clicks", "Unlimited domains & workspaces", "Custom AI reporting", "SLA & uptime guarantee", "Custom onboarding", "24/7 dedicated support"],
    clicks: "∞",
  },
};

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return null;
  const map: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
    active:    { label: "Active",    color: "#34D399", icon: CheckCircle2 },
    cancelled: { label: "Cancelled", color: "#FB923C", icon: Clock },
    expired:   { label: "Expired",   color: "#F87171", icon: XCircle },
    paused:    { label: "Paused",    color: "#FB923C", icon: Clock },
  };
  const entry = map[status] ?? { label: status, color: "#7A7A84", icon: Clock };
  const Icon = entry.icon;
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border"
      style={{ color: entry.color, borderColor: `${entry.color}44`, background: `${entry.color}15` }}
    >
      <Icon className="w-3 h-3" />
      {entry.label}
    </span>
  );
}

export default function Billing() {
  const [sub, setSub] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [billing, setBilling] = useState<"monthly" | "annual">("monthly");
  const router = useRouter();
  const searchParams = useSearchParams();
  const upgraded = searchParams.get("upgraded") === "1";

  useEffect(() => {
    let attempts = 0;
    const maxAttempts = upgraded ? 6 : 1;
    const delay = 2000;

    async function fetchSub() {
      try {
        const r = await fetch("/api/billing/subscription", { credentials: "include" });
        const data = await r.json();
        setSub(data);

        // If we just upgraded but plan is still free, poll again (webhook may be processing)
        if (upgraded && data.plan === "free" && attempts < maxAttempts) {
          attempts++;
          setTimeout(fetchSub, delay);
          return;
        }
      } catch {
        // ignore
      }
      setLoading(false);
    }

    fetchSub();
  }, [upgraded]);

  function handleUpgrade(plan: string) {
    setUpgrading(plan);
    router.push(`/checkout?plan=${plan}&billing=${billing}`);
  }

  async function handlePortal() {
    setPortalLoading(true);
    try {
      const res = await fetch("/api/billing/portal", { credentials: "include" });
      const data = await res.json();
      if (data.url) window.open(data.url, "_blank");
      else alert(data.error ?? "Could not open billing portal.");
    } catch {
      alert("Network error. Please try again.");
    } finally {
      setPortalLoading(false);
    }
  }

  const currentPlan = (sub?.plan ?? "free") as keyof typeof PLAN_META;
  const meta = PLAN_META[currentPlan] ?? PLAN_META.free;
  const PlanIcon = meta.icon;
  const currentIdx = PLAN_ORDER.indexOf(currentPlan);
  const upgradePlans = PLAN_ORDER.slice(currentIdx + 1).filter((p) => p !== "free") as (keyof typeof PLAN_META)[];

  return (
    <ProtectedLayout>
      <div className="max-w-4xl mx-auto px-4 py-10 space-y-6">

        {/* Header */}
        <div className="flex items-center gap-4">
          <div
            className="w-12 h-12 rounded-[14px] flex items-center justify-center shrink-0"
            style={{ background: "linear-gradient(135deg, #818CF8, #A78BFA)" }}
          >
            <CreditCard className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-[28px] font-[family-name:var(--font-space-grotesk)] font-extrabold tracking-[-0.02em] text-[#F1F5F9]">Billing & Subscription</h1>
            <p className="text-[13px] text-[#94A3B8] mt-0.5">Manage your plan, payments, and usage.</p>
          </div>
        </div>

        {/* Success / confirming banner */}
        {upgraded && sub?.plan === "free" && !loading && (
          <div
            className="flex items-center gap-3 px-5 py-4"
            style={{ background: "rgba(251,191,36,0.1)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", border: "1px solid rgba(252,211,77,0.2)", borderRadius: "20px" }}
          >
            <RefreshCw className="w-5 h-5 text-[#FB923C] shrink-0 animate-spin" />
            <div>
              <div className="text-[14px] font-semibold text-[#FB923C]">Confirming your payment...</div>
              <div className="text-[12px] text-[#D97706]">This usually takes a few seconds. The page will update automatically.</div>
            </div>
          </div>
        )}
        {upgraded && sub && sub.plan !== "free" && (
          <div
            className="flex items-center gap-3 px-5 py-4"
            style={{ background: "rgba(52,211,153,0.1)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", border: "1px solid rgba(52,211,153,0.2)", borderRadius: "20px" }}
          >
            <BadgeCheck className="w-5 h-5 text-[#34D399] shrink-0" />
            <div>
              <div className="text-[14px] font-semibold text-[#34D399]">Payment successful!</div>
              <div className="text-[12px] text-[#34D399]/70">You are now on the {sub.plan.charAt(0).toUpperCase() + sub.plan.slice(1)} plan.</div>
            </div>
          </div>
        )}

        {loading ? (
          <div
            className="p-12 flex items-center justify-center gap-3 text-[#7A7A84]"
            style={{ background: "rgba(17,24,39,0.65)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", border: "1px solid rgba(255,255,255,0.06)", boxShadow: "0 1px 2px rgba(0,0,0,0.3), 0 8px 32px rgba(0,0,0,0.3)", borderRadius: "20px" }}
          >
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span className="text-[14px]">Loading subscription...</span>
          </div>
        ) : (
          <>
            {/* Current Plan Card */}
            <div
              className="relative overflow-hidden"
              style={{ background: "linear-gradient(135deg, #0F172A, #1E293B)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)", borderRadius: "20px", boxShadow: "0 4px 24px rgba(0,0,0,0.4)" }}
            >
              {/* Gradient accent */}
              <div
                className="absolute inset-0 opacity-20"
                style={{ background: `radial-gradient(ellipse at top right, ${meta.color} 0%, transparent 60%)` }}
              />
              <div className="relative p-6 md:p-8">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div
                      className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
                      style={{ background: `${meta.color}25`, border: `1px solid ${meta.color}40`, backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}
                    >
                      <PlanIcon className="w-6 h-6" style={{ color: meta.color }} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[20px] font-bold text-white">{meta.label} Plan</span>
                        <StatusBadge status={sub?.status ?? (currentPlan === "free" ? null : "active")} />
                      </div>
                      <div className="text-[13px] text-[#7A7A84]">
                        {currentPlan === "free"
                          ? "You're on the free plan"
                          : `${billing === "annual" ? meta.annualPrice + "/yr" : meta.monthlyPrice + "/mo"} · billed ${billing}`}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {sub?.subscriptionId && (
                      <button
                        onClick={handlePortal}
                        disabled={portalLoading}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-[14px] text-[13px] font-semibold text-white transition-all disabled:opacity-50"
                        style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)" }}
                      >
                        {portalLoading ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <ExternalLink className="w-3.5 h-3.5" />
                        )}
                        Manage
                      </button>
                    )}
                    {currentPlan !== "enterprise" && (
                      <Link
                        href="/pricing"
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold text-white transition-all"
                        style={{ background: meta.color }}
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        Upgrade
                      </Link>
                    )}
                  </div>
                </div>

                {/* Features */}
                <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2">
                  {meta.features.map((f) => (
                    <div key={f} className="flex items-center gap-2 text-[12px] text-[#D1D5DB]">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" style={{ color: meta.color }} />
                      {f}
                    </div>
                  ))}
                </div>

                {/* Renewal info */}
                {sub?.renewsAt && (
                  <div className="mt-5 pt-5 flex items-center gap-2 text-[12px] text-[#7A7A84]" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                    <Clock className="w-3.5 h-3.5" />
                    Renews on{" "}
                    <span className="text-white font-medium">
                      {new Date(sub.renewsAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                    </span>
                  </div>
                )}
                {sub?.expiresAt && sub.status === "cancelled" && (
                  <div className="mt-5 pt-5 flex items-center gap-2 text-[12px] text-[#FB923C]" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                    <Clock className="w-3.5 h-3.5" />
                    Access until{" "}
                    <span className="font-medium">
                      {new Date(sub.expiresAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Upgrade Section */}
            {upgradePlans.length > 0 && (
              <div
                className="overflow-hidden"
                style={{
                  background: "rgba(17,24,39,0.65)",
                  backdropFilter: "blur(16px)",
                  WebkitBackdropFilter: "blur(16px)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.3), 0 8px 32px rgba(0,0,0,0.3)",
                  borderRadius: "20px",
                }}
              >
                <div className="px-6 pt-6 pb-4 flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <h2 className="text-[16px] font-bold text-[#F1F5F9]">Upgrade your plan</h2>
                    <p className="text-[12px] text-[#94A3B8] mt-0.5">Unlock more clicks, domains, and features.</p>
                  </div>
                  {/* Billing toggle */}
                  <div className="flex items-center gap-3 rounded-[14px] px-3 py-2" style={{ background: "rgba(255,255,255,0.05)" }}>
                    <button
                      onClick={() => setBilling("monthly")}
                      className={`text-[12px] font-semibold px-3 py-1.5 rounded-lg transition-all ${
                        billing === "monthly" ? "bg-[rgba(129,140,248,0.12)] shadow-sm text-[#A5B4FC]" : "text-[#7A7A84]"
                      }`}
                    >
                      Monthly
                    </button>
                    <button
                      onClick={() => setBilling("annual")}
                      className={`text-[12px] font-semibold px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                        billing === "annual" ? "bg-[rgba(129,140,248,0.12)] shadow-sm text-[#A5B4FC]" : "text-[#7A7A84]"
                      }`}
                    >
                      Annual
                      <span className="text-[10px] font-bold text-[#34D399] bg-[rgba(52,211,153,0.12)] px-1.5 py-0.5 rounded-full">-20%</span>
                    </button>
                  </div>
                </div>

                <div className="px-6 pb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {upgradePlans.map((planKey) => {
                    const m = PLAN_META[planKey];
                    const Icon = m.icon;
                    const price = billing === "annual" ? m.annualPrice : m.monthlyPrice;
                    const perUnit = billing === "annual" ? "/yr" : "/mo";
                    return (
                      <div
                        key={planKey}
                        className="group relative p-5 hover:shadow-[0_8px_32px_rgba(0,0,0,0.4)] hover:-translate-y-1 transition-all cursor-pointer"
                        onClick={() => handleUpgrade(planKey)}
                        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "18px" }}
                      >
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2.5">
                            <div
                              className="w-9 h-9 rounded-xl flex items-center justify-center"
                              style={{ background: m.bg }}
                            >
                              <Icon className="w-4 h-4" style={{ color: m.color }} />
                            </div>
                            <div>
                              <div className="text-[14px] font-bold text-[#F1F5F9]">{m.label}</div>
                              <div className="text-[11px] text-[#7A7A84]">{m.clicks} clicks/mo</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-[18px] font-extrabold text-[#F1F5F9]">{price}</div>
                            <div className="text-[10px] text-[#7A7A84]">{perUnit}</div>
                          </div>
                        </div>

                        <ul className="space-y-1.5 mb-4">
                          {m.features.slice(0, 3).map((f) => (
                            <li key={f} className="flex items-center gap-2 text-[12px] text-[#94A3B8]">
                              <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: m.color }} />
                              {f}
                            </li>
                          ))}
                        </ul>

                        <button
                          disabled={upgrading === planKey}
                          className="w-full flex items-center justify-center gap-1.5 h-9 rounded-[14px] text-[13px] font-semibold text-white transition-all disabled:opacity-60"
                          style={{ background: m.color, boxShadow: `0 2px 8px ${m.color}40` }}
                        >
                          {upgrading === planKey ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <>
                              Upgrade to {m.label}
                              <ArrowUpRight className="w-3.5 h-3.5" />
                            </>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Quick links */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <a
                href="https://stripe.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between px-5 py-4 hover:shadow-[0_8px_32px_rgba(0,0,0,0.4)] transition-all group"
                style={{ background: "rgba(17,24,39,0.65)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", border: "1px solid rgba(255,255,255,0.06)", boxShadow: "0 1px 2px rgba(0,0,0,0.3), 0 8px 32px rgba(0,0,0,0.3)", borderRadius: "20px" }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-[12px] flex items-center justify-center"
                    style={{ background: "linear-gradient(135deg, rgba(99,91,255,0.15), rgba(99,91,255,0.2))" }}
                  >
                    <CreditCard className="w-4 h-4 text-[#818CF8]" />
                  </div>
                  <div>
                    <div className="text-[13px] font-semibold text-[#F1F5F9]">Payment methods</div>
                    <div className="text-[11px] text-[#94A3B8]">Manage cards via Stripe portal</div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-[#475569] group-hover:text-[#7A7A84] transition-colors" />
              </a>

              <div
                className="flex items-center justify-between px-5 py-4"
                style={{ background: "rgba(17,24,39,0.65)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", border: "1px solid rgba(255,255,255,0.06)", boxShadow: "0 1px 2px rgba(0,0,0,0.3), 0 8px 32px rgba(0,0,0,0.3)", borderRadius: "20px" }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-[12px] flex items-center justify-center"
                    style={{ background: "linear-gradient(135deg, rgba(52,211,153,0.12), rgba(52,211,153,0.18))" }}
                  >
                    <Shield className="w-4 h-4 text-[#34D399]" />
                  </div>
                  <div>
                    <div className="text-[13px] font-semibold text-[#F1F5F9]">Secure payments</div>
                    <div className="text-[11px] text-[#94A3B8]">256-bit encryption · PCI-compliant</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer note */}
            <p className="text-center text-[12px] text-[#94A3B8]">
              Payments powered by{" "}
              <a href="https://stripe.com" target="_blank" rel="noopener noreferrer" className="text-[#818CF8] font-semibold hover:underline">
                Stripe
              </a>
              {" · "}No contracts · Cancel anytime
            </p>
          </>
        )}
      </div>
    </ProtectedLayout>
  );
}
