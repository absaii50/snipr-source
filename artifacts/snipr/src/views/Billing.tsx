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
    color: "#8888A0",
    gradient: "from-[#8888A0] to-[#6666888]",
    bg: "#F4F4F6",
    features: ["10K clicks/month", "Basic short links", "Custom slugs", "snipr.sh domain"],
    clicks: "10K",
  },
  starter: {
    label: "Starter",
    monthlyPrice: "$4",
    annualPrice: "$38",
    icon: Zap,
    color: "#4A9B7F",
    gradient: "from-[#4A9B7F] to-[#2D7A61]",
    bg: "#EDFAF5",
    features: ["1M clicks/month", "1 custom domain", "Geo & device analytics", "Link expiry & scheduling", "Password-protected links"],
    clicks: "1M",
  },
  growth: {
    label: "Growth",
    monthlyPrice: "$12",
    annualPrice: "$115",
    icon: Star,
    color: "#728DA7",
    gradient: "from-[#728DA7] to-[#4A6E8E]",
    bg: "#EEF3F7",
    features: ["5M clicks/month", "3 custom domains", "Link cloaking", "Geo & device routing rules", "UTM builder", "AI-powered insights"],
    clicks: "5M",
  },
  pro: {
    label: "Pro",
    monthlyPrice: "$29",
    annualPrice: "$278",
    icon: Star,
    color: "#7C5CC4",
    gradient: "from-[#7C5CC4] to-[#5E3EA6]",
    bg: "#F0EBF9",
    features: ["25M clicks/month", "10 custom domains", "Conversion & revenue tracking", "Pixel integrations", "Link rules", "Priority support"],
    clicks: "25M",
  },
  business: {
    label: "Business",
    monthlyPrice: "$79",
    annualPrice: "$758",
    icon: Crown,
    color: "#C45C5C",
    gradient: "from-[#C45C5C] to-[#A33A3A]",
    bg: "#FDF0F0",
    features: ["100M clicks/month", "Unlimited domains", "Team workspaces & roles", "Webhook & Zapier integrations", "API access", "Dedicated support"],
    clicks: "100M",
  },
  enterprise: {
    label: "Enterprise",
    monthlyPrice: "$149",
    annualPrice: "$1,430",
    icon: Crown,
    color: "#C4945C",
    gradient: "from-[#C4945C] to-[#A37038]",
    bg: "#FDF5ED",
    features: ["Unlimited clicks", "Unlimited domains & workspaces", "Custom AI reporting", "SLA & uptime guarantee", "Custom onboarding", "24/7 dedicated support"],
    clicks: "∞",
  },
};

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return null;
  const map: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
    active:    { label: "Active",    color: "#22C55E", icon: CheckCircle2 },
    cancelled: { label: "Cancelled", color: "#F59E0B", icon: Clock },
    expired:   { label: "Expired",   color: "#EF4444", icon: XCircle },
    paused:    { label: "Paused",    color: "#F59E0B", icon: Clock },
  };
  const entry = map[status] ?? { label: status, color: "#8888A0", icon: Clock };
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
      <div className="min-h-screen bg-[#F7F7F9]">
        <div className="max-w-4xl mx-auto px-4 py-10 space-y-6">

          {/* Header */}
          <div>
            <h1 className="text-[22px] font-bold text-[#0A0A0A]">Billing & Subscription</h1>
            <p className="text-[13px] text-[#8888A0] mt-0.5">Manage your plan, payments, and usage.</p>
          </div>

          {/* Success / confirming banner */}
          {upgraded && sub?.plan === "free" && !loading && (
            <div className="flex items-center gap-3 bg-[#FFF8F0] border border-[#FCD34D] rounded-2xl px-5 py-4">
              <RefreshCw className="w-5 h-5 text-[#D97706] shrink-0 animate-spin" />
              <div>
                <div className="text-[14px] font-semibold text-[#92400E]">Confirming your payment…</div>
                <div className="text-[12px] text-[#B45309]">This usually takes a few seconds. The page will update automatically.</div>
              </div>
            </div>
          )}
          {upgraded && sub && sub.plan !== "free" && (
            <div className="flex items-center gap-3 bg-[#F0FDF4] border border-[#86EFAC] rounded-2xl px-5 py-4">
              <BadgeCheck className="w-5 h-5 text-[#22C55E] shrink-0" />
              <div>
                <div className="text-[14px] font-semibold text-[#15803D]">Payment successful!</div>
                <div className="text-[12px] text-[#16A34A]">You are now on the {sub.plan.charAt(0).toUpperCase() + sub.plan.slice(1)} plan.</div>
              </div>
            </div>
          )}

          {loading ? (
            <div className="bg-white rounded-2xl border border-[#E4E4EC] p-12 flex items-center justify-center gap-3 text-[#8888A0]">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span className="text-[14px]">Loading subscription…</span>
            </div>
          ) : (
            <>
              {/* Current Plan Card */}
              <div className="relative bg-[#0A0A0A] rounded-2xl overflow-hidden">
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
                        style={{ background: `${meta.color}25`, border: `1px solid ${meta.color}40` }}
                      >
                        <PlanIcon className="w-6 h-6" style={{ color: meta.color }} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[20px] font-bold text-white">{meta.label} Plan</span>
                          <StatusBadge status={sub?.status ?? (currentPlan === "free" ? null : "active")} />
                        </div>
                        <div className="text-[13px] text-[#8888A0]">
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
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold bg-white/10 hover:bg-white/15 text-white border border-white/10 transition-all disabled:opacity-50"
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
                      <div key={f} className="flex items-center gap-2 text-[12px] text-[#CCCCCC]">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" style={{ color: meta.color }} />
                        {f}
                      </div>
                    ))}
                  </div>

                  {/* Renewal info */}
                  {sub?.renewsAt && (
                    <div className="mt-5 pt-5 border-t border-white/10 flex items-center gap-2 text-[12px] text-[#8888A0]">
                      <Clock className="w-3.5 h-3.5" />
                      Renews on{" "}
                      <span className="text-white font-medium">
                        {new Date(sub.renewsAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                      </span>
                    </div>
                  )}
                  {sub?.expiresAt && sub.status === "cancelled" && (
                    <div className="mt-5 pt-5 border-t border-white/10 flex items-center gap-2 text-[12px] text-[#F59E0B]">
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
                <div className="bg-white rounded-2xl border border-[#E4E4EC] overflow-hidden">
                  <div className="px-6 pt-6 pb-4 flex items-center justify-between flex-wrap gap-3">
                    <div>
                      <h2 className="text-[16px] font-bold text-[#0A0A0A]">Upgrade your plan</h2>
                      <p className="text-[12px] text-[#8888A0] mt-0.5">Unlock more clicks, domains, and features.</p>
                    </div>
                    {/* Billing toggle */}
                    <div className="flex items-center gap-3 bg-[#F4F4F6] rounded-xl px-3 py-2">
                      <button
                        onClick={() => setBilling("monthly")}
                        className={`text-[12px] font-semibold px-3 py-1.5 rounded-lg transition-all ${
                          billing === "monthly" ? "bg-white shadow-sm text-[#0A0A0A]" : "text-[#8888A0]"
                        }`}
                      >
                        Monthly
                      </button>
                      <button
                        onClick={() => setBilling("annual")}
                        className={`text-[12px] font-semibold px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                          billing === "annual" ? "bg-white shadow-sm text-[#0A0A0A]" : "text-[#8888A0]"
                        }`}
                      >
                        Annual
                        <span className="text-[10px] font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full">−20%</span>
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
                          className="group relative border border-[#E4E4EC] rounded-2xl p-5 hover:border-transparent hover:shadow-[0_4px_20px_rgba(0,0,0,0.08)] transition-all cursor-pointer"
                          onClick={() => handleUpgrade(planKey)}
                          style={{ ["--hover-color" as string]: meta.color }}
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
                                <div className="text-[14px] font-bold text-[#0A0A0A]">{m.label}</div>
                                <div className="text-[11px] text-[#8888A0]">{m.clicks} clicks/mo</div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-[18px] font-extrabold text-[#0A0A0A]">{price}</div>
                              <div className="text-[10px] text-[#8888A0]">{perUnit}</div>
                            </div>
                          </div>

                          <ul className="space-y-1.5 mb-4">
                            {m.features.slice(0, 3).map((f) => (
                              <li key={f} className="flex items-center gap-2 text-[12px] text-[#555]">
                                <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: m.color }} />
                                {f}
                              </li>
                            ))}
                          </ul>

                          <button
                            disabled={upgrading === planKey}
                            className="w-full flex items-center justify-center gap-1.5 h-9 rounded-xl text-[13px] font-semibold text-white transition-all disabled:opacity-60"
                            style={{ background: m.color }}
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
                  className="flex items-center justify-between bg-white rounded-2xl border border-[#E4E4EC] px-5 py-4 hover:border-[#C7C7D4] transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#F0EEFF] flex items-center justify-center">
                      <CreditCard className="w-4 h-4 text-[#635BFF]" />
                    </div>
                    <div>
                      <div className="text-[13px] font-semibold text-[#0A0A0A]">Payment methods</div>
                      <div className="text-[11px] text-[#8888A0]">Manage cards via Stripe portal</div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[#C7C7D4] group-hover:text-[#8888A0] transition-colors" />
                </a>

                <div className="flex items-center justify-between bg-white rounded-2xl border border-[#E4E4EC] px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#F0FDF4] flex items-center justify-center">
                      <Shield className="w-4 h-4 text-[#22C55E]" />
                    </div>
                    <div>
                      <div className="text-[13px] font-semibold text-[#0A0A0A]">Secure payments</div>
                      <div className="text-[11px] text-[#8888A0]">256-bit encryption · PCI-compliant</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer note */}
              <p className="text-center text-[12px] text-[#AAAAB4]">
                Payments powered by{" "}
                <a href="https://stripe.com" target="_blank" rel="noopener noreferrer" className="text-[#635BFF] font-semibold hover:underline">
                  Stripe
                </a>
                {" · "}No contracts · Cancel anytime
              </p>
            </>
          )}
        </div>
      </div>
    </ProtectedLayout>
  );
}
