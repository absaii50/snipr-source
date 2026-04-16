"use client";
import { useEffect, useState, useCallback } from "react";
import { CreditCard, Users, Zap, Crown, Star, Rocket, Building2, Search, ChevronDown, Check, AlertCircle, DollarSign, TrendingUp, UserCheck, BarChart3 } from "lucide-react";
import { apiFetch } from "../utils";
import { useToast } from "../Toast";

interface Distribution {
  free: number;
  starter: number;
  growth: number;
  pro: number;
  business: number;
  enterprise: number;
}

interface DistributionData {
  distribution: Distribution;
  total: number;
}

interface RevenueData {
  activeSubscriptions: number;
  totalWithStripe: number;
  byStatus: Record<string, number>;
  byPlan: Record<string, number>;
}

interface SearchUser {
  id: string;
  name: string;
  email: string;
  plan: string;
}

const PLAN_TIERS = [
  {
    key: "free" as const,
    name: "Free",
    icon: Users,
    accent: "#8888A0",
    bg: "#F4F4F6",
    description: "Entry level plan with basic features",
    features: ["Up to 10 links", "Basic analytics", "Default snipr.sh domain"],
  },
  {
    key: "starter" as const,
    name: "Starter",
    icon: Rocket,
    accent: "#4A9B8E",
    bg: "#EAF5F3",
    description: "For individuals getting started",
    features: ["Up to 100 links", "7-day analytics", "1 custom domain"],
  },
  {
    key: "growth" as const,
    name: "Growth",
    icon: Star,
    accent: "#3B82F6",
    bg: "#EFF6FF",
    description: "For growing creators and marketers",
    features: ["Up to 1,000 links", "30-day analytics", "5 custom domains", "Link rules"],
  },
  {
    key: "pro" as const,
    name: "Pro",
    icon: Zap,
    accent: "#728DA7",
    bg: "#EEF3F7",
    description: "For power users and growing teams",
    features: ["Unlimited links", "Advanced analytics", "Unlimited domains", "API access"],
  },
  {
    key: "business" as const,
    name: "Business",
    icon: Crown,
    accent: "#7C5CC4",
    bg: "#F0EBF9",
    description: "For organizations and large teams",
    features: ["Everything in Pro", "Team workspaces", "AI insights", "Priority support"],
  },
  {
    key: "enterprise" as const,
    name: "Enterprise",
    icon: Building2,
    accent: "#D4875A",
    bg: "#FAF0E9",
    description: "Custom contracts and dedicated support",
    features: ["Custom SLA", "Dedicated infrastructure", "SSO", "Custom integrations"],
  },
];

const PLAN_COLORS: Record<string, string> = {
  free: "#C8C8D8",
  starter: "#4A9B8E",
  growth: "#3B82F6",
  pro: "#728DA7",
  business: "#7C5CC4",
  enterprise: "#D4875A",
};

export default function PlansTab() {
  const { toast } = useToast();
  const [dist, setDist] = useState<DistributionData | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedUser, setSelectedUser] = useState<SearchUser | null>(null);
  const [newPlan, setNewPlan] = useState("");
  const [changingPlan, setChangingPlan] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [revenue, setRevenue] = useState<RevenueData | null>(null);

  useEffect(() => {
    apiFetch("/admin/plan-distribution").then(setDist).catch(() => toast("Failed to load plan distribution", "error"));
    apiFetch("/admin/revenue").then(setRevenue).catch(() => toast("Failed to load revenue data", "error"));
  }, []);

  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query);
    setFeedback(null);
    if (query.length < 2) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }
    setSearching(true);
    try {
      const data = await apiFetch(`/admin/users/performance?search=${encodeURIComponent(query)}`);
      const users: SearchUser[] = (data.users ?? data).map((u: any) => ({
        id: u.id,
        name: u.name || u.full_name || "Unnamed",
        email: u.email,
        plan: u.plan || "free",
      }));
      setSearchResults(users);
      setShowDropdown(users.length > 0);
    } catch {
      setSearchResults([]);
      setShowDropdown(false);
    } finally {
      setSearching(false);
    }
  }, []);

  const selectUser = (user: SearchUser) => {
    setSelectedUser(user);
    setNewPlan(user.plan);
    setSearchQuery(user.email);
    setShowDropdown(false);
    setFeedback(null);
  };

  const changePlan = async () => {
    if (!selectedUser || !newPlan || newPlan === selectedUser.plan) return;
    setChangingPlan(true);
    setFeedback(null);
    try {
      await apiFetch(`/admin/users/${selectedUser.id}/plan`, {
        method: "PATCH",
        body: JSON.stringify({ plan: newPlan }),
      });
      setFeedback({ type: "success", message: `Plan changed to ${newPlan} for ${selectedUser.email}` });
      setSelectedUser({ ...selectedUser, plan: newPlan });
      // Refresh distribution
      apiFetch("/admin/plan-distribution").then(setDist).catch(() => {/* silent */});
    } catch (err: any) {
      setFeedback({ type: "error", message: err?.error || "Failed to change plan" });
    } finally {
      setChangingPlan(false);
    }
  };

  const getCount = (key: keyof Distribution) => dist?.distribution[key] ?? 0;
  const getPct = (key: keyof Distribution) => {
    if (!dist || dist.total === 0) return 0;
    return Math.round(((dist.distribution[key] ?? 0) / dist.total) * 100);
  };

  return (
    <div className="space-y-5">
      {/* Notice */}
      <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-2xl px-5 py-4 flex items-start gap-3">
        <CreditCard className="w-5 h-5 text-[#D97706] shrink-0 mt-0.5" />
        <div>
          <div className="text-sm font-semibold text-[#92400E]">Payments powered by Stripe</div>
          <div className="text-xs text-[#B45309] mt-0.5">
            Subscriptions are managed via Stripe. Plan data syncs automatically via webhooks
            when users upgrade or cancel.
          </div>
        </div>
      </div>

      {/* Plan cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {PLAN_TIERS.map((plan) => {
          const Icon = plan.icon;
          const count = getCount(plan.key);
          return (
            <div key={plan.key} className="bg-white rounded-2xl border border-[#E2E8F0] p-5 hover:shadow-md transition-all hover:-translate-y-0.5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: plan.bg }}>
                  <Icon className="w-5 h-5" style={{ color: plan.accent }} />
                </div>
                <div>
                  <div className="font-bold text-[#0A0A0A]">{plan.name}</div>
                  <div className="text-xs text-[#8888A0]">
                    {dist ? `${count} user${count !== 1 ? "s" : ""}` : "..."}
                    {dist && dist.total > 0 ? ` (${getPct(plan.key)}%)` : ""}
                  </div>
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
      {dist && dist.total > 0 && (
        <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5">
          <h3 className="text-sm font-semibold text-[#0A0A0A] mb-4">Plan Distribution</h3>
          <div className="flex h-6 rounded-full overflow-hidden gap-0.5">
            {PLAN_TIERS.map((plan) => {
              const pct = getPct(plan.key);
              if (pct === 0) return null;
              return (
                <div
                  key={plan.key}
                  className="transition-all"
                  style={{ backgroundColor: PLAN_COLORS[plan.key], width: `${Math.max(pct, 1)}%` }}
                  title={`${plan.name}: ${pct}%`}
                />
              );
            })}
          </div>
          <div className="flex items-center gap-4 mt-3 flex-wrap">
            {PLAN_TIERS.map((plan) => (
              <div key={plan.key} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: PLAN_COLORS[plan.key] }} />
                <span className="text-xs text-[#3A3A3E]">{plan.name}</span>
                <span className="text-xs text-[#8888A0]">{getPct(plan.key)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Revenue Overview */}
      <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5">
        <h3 className="text-sm font-semibold text-[#0A0A0A] mb-4 flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-[#728DA7]" />
          Revenue Overview
        </h3>
        {revenue ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-[#F0FDF4] rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <UserCheck className="w-4 h-4 text-emerald-600" />
                <span className="text-xs text-emerald-700 font-medium">Active</span>
              </div>
              <div className="text-2xl font-bold text-emerald-700">{revenue.activeSubscriptions}</div>
              <div className="text-[10px] text-emerald-600 mt-0.5">paying subscribers</div>
            </div>
            <div className="bg-[#EFF6FF] rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-blue-600" />
                <span className="text-xs text-blue-700 font-medium">Total</span>
              </div>
              <div className="text-2xl font-bold text-blue-700">{revenue.totalWithStripe}</div>
              <div className="text-[10px] text-blue-600 mt-0.5">ever subscribed</div>
            </div>
            <div className="bg-[#F5F3FF] rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="w-4 h-4 text-violet-600" />
                <span className="text-xs text-violet-700 font-medium">By Status</span>
              </div>
              <div className="space-y-1 mt-1">
                {Object.entries(revenue.byStatus).map(([status, count]) => (
                  <div key={status} className="flex items-center justify-between text-xs">
                    <span className="text-violet-600 capitalize">{status}</span>
                    <span className="font-semibold text-violet-800">{count}</span>
                  </div>
                ))}
                {Object.keys(revenue.byStatus).length === 0 && (
                  <span className="text-xs text-violet-400">No data</span>
                )}
              </div>
            </div>
            <div className="bg-[#FFFBEB] rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <CreditCard className="w-4 h-4 text-amber-600" />
                <span className="text-xs text-amber-700 font-medium">By Plan</span>
              </div>
              <div className="space-y-1 mt-1">
                {Object.entries(revenue.byPlan).map(([plan, count]) => (
                  <div key={plan} className="flex items-center justify-between text-xs">
                    <span className="text-amber-600 capitalize">{plan}</span>
                    <span className="font-semibold text-amber-800">{count}</span>
                  </div>
                ))}
                {Object.keys(revenue.byPlan).length === 0 && (
                  <span className="text-xs text-amber-400">No data</span>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center py-8 text-sm text-[#8888A0]">
            <div className="w-5 h-5 border-2 border-[#E2E8F0] border-t-[#728DA7] rounded-full animate-spin mr-3" />
            Loading revenue data...
          </div>
        )}
      </div>

      {/* Plan Management */}
      <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5">
        <h3 className="text-sm font-semibold text-[#0A0A0A] mb-4">Plan Management</h3>

        {/* User search */}
        <div className="relative mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8888A0]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
              placeholder="Search user by name or email..."
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-[#E2E8F0] text-sm text-[#0A0A0A] placeholder:text-[#8888A0] focus:outline-none focus:border-[#728DA7] transition-colors"
            />
            {searching && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-[#E2E8F0] border-t-[#728DA7] rounded-full animate-spin" />
            )}
          </div>

          {/* Dropdown */}
          {showDropdown && (
            <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white border border-[#E2E8F0] rounded-xl shadow-lg max-h-48 overflow-y-auto">
              {searchResults.map((user) => (
                <button
                  key={user.id}
                  onClick={() => selectUser(user)}
                  className="w-full text-left px-4 py-2.5 hover:bg-[#F4F4F6] transition-colors flex items-center justify-between"
                >
                  <div>
                    <div className="text-sm font-medium text-[#0A0A0A]">{user.name}</div>
                    <div className="text-xs text-[#8888A0]">{user.email}</div>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-[#F4F4F6] text-[#8888A0] capitalize">{user.plan}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Selected user + plan change */}
        {selectedUser && (
          <div className="border border-[#E2E8F0] rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-[#0A0A0A]">{selectedUser.name}</div>
                <div className="text-xs text-[#8888A0]">{selectedUser.email}</div>
              </div>
              <div className="text-xs text-[#8888A0]">
                Current plan: <span className="font-semibold text-[#0A0A0A] capitalize">{selectedUser.plan}</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <select
                  value={newPlan}
                  onChange={(e) => { setNewPlan(e.target.value); setFeedback(null); }}
                  className="w-full appearance-none px-3 py-2.5 pr-8 rounded-xl border border-[#E2E8F0] text-sm text-[#0A0A0A] bg-white focus:outline-none focus:border-[#728DA7] transition-colors capitalize"
                >
                  {PLAN_TIERS.map((p) => (
                    <option key={p.key} value={p.key}>{p.name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8888A0] pointer-events-none" />
              </div>
              <button
                onClick={changePlan}
                disabled={changingPlan || newPlan === selectedUser.plan}
                className="px-4 py-2.5 rounded-xl bg-[#0A0A0A] text-white text-sm font-medium hover:bg-[#1a1a1a] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {changingPlan ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                Change Plan
              </button>
            </div>

            {/* Feedback */}
            {feedback && (
              <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg ${
                feedback.type === "success"
                  ? "bg-[#F0FDF4] text-[#166534] border border-[#BBF7D0]"
                  : "bg-[#FEF2F2] text-[#991B1B] border border-[#FECACA]"
              }`}>
                {feedback.type === "success" ? (
                  <Check className="w-3.5 h-3.5 shrink-0" />
                ) : (
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                )}
                {feedback.message}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
