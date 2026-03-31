"use client";
import { useEffect, useState } from "react";
import { CreditCard, Users, Zap, Crown, Star } from "lucide-react";
import { apiFetch } from "../utils";

interface Stats {
  totalUsers: number;
  suspendedUsers: number;
}

export default function PlansTab() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    apiFetch("/admin/stats").then(setStats).catch(() => {});
  }, []);

  const plans = [
    {
      name: "Free",
      icon: Users,
      accent: "#8888A0",
      bg: "#F4F4F6",
      description: "Entry level plan with basic features",
      features: ["Up to 10 links", "Basic analytics", "Default snipr.sh domain"],
      userEstimate: stats ? Math.ceil(stats.totalUsers * 0.7) : "—",
    },
    {
      name: "Pro",
      icon: Star,
      accent: "#728DA7",
      bg: "#EEF3F7",
      description: "For power users and growing teams",
      features: ["Unlimited links", "Advanced analytics", "Custom domains", "API access"],
      userEstimate: stats ? Math.ceil(stats.totalUsers * 0.25) : "—",
    },
    {
      name: "Business",
      icon: Crown,
      accent: "#7C5CC4",
      bg: "#F0EBF9",
      description: "For organizations and large teams",
      features: ["Everything in Pro", "Team workspaces", "AI insights", "Priority support"],
      userEstimate: stats ? Math.ceil(stats.totalUsers * 0.04) : "—",
    },
    {
      name: "Enterprise",
      icon: Zap,
      accent: "#D4875A",
      bg: "#FAF0E9",
      description: "Custom contracts and dedicated support",
      features: ["Custom SLA", "Dedicated infrastructure", "SSO", "Custom integrations"],
      userEstimate: stats ? Math.ceil(stats.totalUsers * 0.01) : "—",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Notice */}
      <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-2xl px-5 py-4 flex items-start gap-3">
        <CreditCard className="w-5 h-5 text-[#D97706] shrink-0 mt-0.5" />
        <div>
          <div className="text-sm font-semibold text-[#92400E]">Payments powered by Stripe</div>
          <div className="text-xs text-[#B45309] mt-0.5">
            Subscriptions are managed via Stripe. Plan counts below are estimated; real-time subscriber
            data syncs automatically via webhooks when users upgrade or cancel.
          </div>
        </div>
      </div>

      {/* Plan cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {plans.map((plan) => {
          const Icon = plan.icon;
          return (
            <div key={plan.name} className="bg-white rounded-2xl border border-[#E4E4EC] p-5 hover:shadow-md transition-all hover:-translate-y-0.5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: plan.bg }}>
                  <Icon className="w-5 h-5" style={{ color: plan.accent }} />
                </div>
                <div>
                  <div className="font-bold text-[#0A0A0A]">{plan.name}</div>
                  <div className="text-xs text-[#8888A0]">~{plan.userEstimate} users</div>
                </div>
              </div>
              <p className="text-xs text-[#8888A0] mb-4 leading-relaxed">{plan.description}</p>
              <ul className="space-y-1.5">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-xs text-[#3A3A3E]">
                    <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: plan.accent }} />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      {/* Distribution bar */}
      {stats && (
        <div className="bg-white rounded-2xl border border-[#E4E4EC] p-5">
          <h3 className="text-sm font-semibold text-[#0A0A0A] mb-4">Estimated Plan Distribution</h3>
          <div className="flex h-6 rounded-full overflow-hidden gap-0.5">
            <div className="bg-[#C8C8D8]" style={{ width: "70%" }} title="Free: 70%" />
            <div className="bg-[#728DA7]" style={{ width: "25%" }} title="Pro: 25%" />
            <div className="bg-[#7C5CC4]" style={{ width: "4%" }} title="Business: 4%" />
            <div className="bg-[#D4875A]" style={{ width: "1%" }} title="Enterprise: 1%" />
          </div>
          <div className="flex items-center gap-4 mt-3 flex-wrap">
            {[
              { label: "Free", color: "#C8C8D8", pct: "70%" },
              { label: "Pro", color: "#728DA7", pct: "25%" },
              { label: "Business", color: "#7C5CC4", pct: "4%" },
              { label: "Enterprise", color: "#D4875A", pct: "1%" },
            ].map(({ label, color, pct }) => (
              <div key={label} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: color }} />
                <span className="text-xs text-[#3A3A3E]">{label}</span>
                <span className="text-xs text-[#8888A0]">{pct}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Placeholder upgrade/downgrade section */}
      <div className="bg-white rounded-2xl border border-[#E4E4EC] p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-[#0A0A0A]">Plan Management</h3>
          <span className="text-xs bg-[#F4F4F6] text-[#8888A0] px-2.5 py-1 rounded-full">Coming soon</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {["Search user to change plan", "Assign plan override", "View subscription history"].map((item) => (
            <div key={item} className="border border-dashed border-[#E4E4EC] rounded-xl p-4 text-center">
              <div className="text-xs text-[#8888A0]">{item}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
