"use client";
import { useState, useEffect } from "react";
import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import {
  CreditCard, ExternalLink, CheckCircle2, Clock, XCircle,
  Zap, Star, Crown, ArrowUpRight, RefreshCw
} from "lucide-react";
import { useRouter, usePathname } from "next/navigation";

interface Subscription {
  plan: "free" | "pro" | "business";
  status: string | null;
  subscriptionId: string | null;
  renewsAt: string | null;
  expiresAt: string | null;
}

const PLAN_META = {
  free: {
    label: "Free",
    price: "$0/mo",
    icon: Zap,
    color: "#8888A0",
    bg: "#F4F4F6",
    features: ["Up to 10 links", "Basic analytics", "snipr.sh domain"],
  },
  pro: {
    label: "Pro",
    price: "$19/mo",
    icon: Star,
    color: "#728DA7",
    bg: "#EEF3F7",
    features: ["Unlimited links", "Advanced analytics", "Custom domains", "AI insights", "Priority support"],
  },
  business: {
    label: "Business",
    price: "$49/mo",
    icon: Crown,
    color: "#7C5CC4",
    bg: "#F0EBF9",
    features: ["Everything in Pro", "Team workspaces", "Conversion tracking", "API access", "Dedicated support"],
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
    <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold px-2.5 py-1 rounded-full border"
      style={{ color: entry.color, borderColor: `${entry.color}33`, background: `${entry.color}11` }}>
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
  const location = usePathname();

  const upgraded = new URLSearchParams(location.split("?")[1] ?? "").get("upgraded") === "1";

  useEffect(() => {
    fetch("/api/billing/subscription", { credentials: "include" })
      .then((r) => r.json())
      .then(setSub)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleUpgrade(plan: "pro" | "business") {
    setUpgrading(plan);
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
        alert(data.error ?? "Failed to start checkout.");
      }
    } catch {
      alert("Network error. Please try again.");
    } finally {
      setUpgrading(null);
    }
  }

  async function handlePortal() {
    setPortalLoading(true);
    try {
      const res = await fetch("/api/billing/portal", { credentials: "include" });
      const data = await res.json();
      if (data.url) {
        window.open(data.url, "_blank");
      } else {
        alert(data.error ?? "Could not open billing portal.");
      }
    } catch {
      alert("Network error. Please try again.");
    } finally {
      setPortalLoading(false);
    }
  }

  const currentPlan = sub?.plan ?? "free";
  const meta = PLAN_META[currentPlan];
  const PlanIcon = meta.icon;

  return (
    <ProtectedLayout>
      <div className="p-6 md:p-8 max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-[22px] font-bold text-[#0A0A0A] mb-1">Billing & Subscription</h1>
          <p className="text-[14px] text-[#8888A0]">Manage your plan and payment details.</p>
        </div>

        {upgraded && (
          <div className="mb-6 flex items-center gap-3 bg-[#F0FDF4] border border-[#86EFAC] rounded-xl px-4 py-3">
            <CheckCircle2 className="w-5 h-5 text-[#22C55E] shrink-0" />
            <div>
              <div className="text-[14px] font-semibold text-[#15803D]">Payment successful!</div>
              <div className="text-[12px] text-[#16A34A]">Your plan has been upgraded. It may take a moment to reflect.</div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center gap-3 py-12 text-[#8888A0]">
            <RefreshCw className="w-5 h-5 animate-spin" />
            <span className="text-[14px]">Loading subscription…</span>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Current plan card */}
            <div className="bg-white rounded-2xl border border-[#E4E4EC] p-6">
              <div className="flex items-start justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: meta.bg }}>
                    <PlanIcon className="w-5 h-5" style={{ color: meta.color }} />
                  </div>
                  <div>
                    <div className="text-[16px] font-bold text-[#0A0A0A]">{meta.label} Plan</div>
                    <div className="text-[13px] text-[#8888A0]">{meta.price}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={sub?.status ?? (currentPlan === "free" ? null : "active")} />
                </div>
              </div>

              <ul className="space-y-2 mb-5">
                {meta.features.map((f) => (
                  <li key={f} className="flex items-center gap-2.5 text-[13px] text-[#3A3A3E]">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" style={{ color: meta.color }} />
                    {f}
                  </li>
                ))}
              </ul>

              {sub?.renewsAt && (
                <div className="text-[12px] text-[#8888A0] mb-4">
                  Renews on{" "}
                  <span className="font-medium text-[#555]">
                    {new Date(sub.renewsAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                  </span>
                </div>
              )}
              {sub?.expiresAt && sub.status === "cancelled" && (
                <div className="text-[12px] text-[#8888A0] mb-4">
                  Access until{" "}
                  <span className="font-medium text-[#D97706]">
                    {new Date(sub.expiresAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                  </span>
                </div>
              )}

              {sub?.subscriptionId && (
                <button
                  onClick={handlePortal}
                  disabled={portalLoading}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold border border-[#E4E4EC] text-[#555] hover:bg-[#F4F4F6] disabled:opacity-50 transition-all"
                >
                  {portalLoading ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <ExternalLink className="w-3.5 h-3.5" />
                  )}
                  Manage subscription
                </button>
              )}
            </div>

            {/* Upgrade options */}
            {currentPlan !== "business" && (
              <div className="bg-white rounded-2xl border border-[#E4E4EC] p-6">
                <h2 className="text-[15px] font-bold text-[#0A0A0A] mb-4">Upgrade your plan</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {(["pro", "business"] as const)
                    .filter((p) => p !== currentPlan)
                    .map((planKey) => {
                      const m = PLAN_META[planKey];
                      const Icon = m.icon;
                      return (
                        <div
                          key={planKey}
                          className="border border-[#E4E4EC] rounded-xl p-5 hover:border-[#728DA7] hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)] transition-all"
                        >
                          <div className="flex items-center gap-2.5 mb-3">
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: m.bg }}>
                              <Icon className="w-4.5 h-4.5" style={{ color: m.color }} />
                            </div>
                            <div>
                              <div className="text-[14px] font-bold text-[#0A0A0A]">{m.label}</div>
                              <div className="text-[12px] text-[#8888A0]">{m.price}</div>
                            </div>
                          </div>
                          <ul className="space-y-1.5 mb-4">
                            {m.features.slice(0, 3).map((f) => (
                              <li key={f} className="flex items-center gap-2 text-[12px] text-[#555]">
                                <div className="w-1 h-1 rounded-full shrink-0" style={{ background: m.color }} />
                                {f}
                              </li>
                            ))}
                          </ul>
                          <button
                            onClick={() => handleUpgrade(planKey)}
                            disabled={upgrading === planKey}
                            className="w-full flex items-center justify-center gap-1.5 h-9 rounded-lg text-[13px] font-semibold text-white transition-all disabled:opacity-60"
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

            {/* Powered by Lemon Squeezy */}
            <div className="flex items-center gap-2 text-[12px] text-[#AAAAB4]">
              <CreditCard className="w-3.5 h-3.5" />
              Payments powered by{" "}
              <a
                href="https://lemonsqueezy.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#FFC439] font-semibold hover:underline"
              >
                Lemon Squeezy
              </a>
            </div>
          </div>
        )}
      </div>
    </ProtectedLayout>
  );
}
