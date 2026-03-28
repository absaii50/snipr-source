"use client";
import { useEffect, useState } from "react";
import {
  DollarSign, TrendingUp, Users, CheckCircle2, XCircle, Clock,
  RotateCcw, Search, ExternalLink, ChevronDown, RefreshCw,
} from "lucide-react";
import { apiFetch } from "../utils";

interface BillingStats {
  mrr: number;
  arr: number;
  totalPaid: number;
  active: number;
  cancelled: number;
  paused: number;
  byPlan: { free: number; pro: number; business: number };
}

interface Subscriber {
  id: string;
  name: string;
  email: string;
  plan: "pro" | "business";
  lsSubscriptionId: string | null;
  lsCustomerId: string | null;
  lsSubscriptionStatus: string | null;
  planRenewsAt: string | null;
  planExpiresAt: string | null;
  createdAt: string;
}

const PLAN_PRICE: Record<string, number> = { pro: 19, business: 49 };
const PLAN_COLOR: Record<string, string> = { pro: "#728DA7", business: "#7C5CC4" };
const PLAN_BG: Record<string, string>    = { pro: "#EEF3F7", business: "#F0EBF9" };

function StatCard({
  label, value, sub, icon: Icon, color,
}: {
  label: string; value: string | number; sub?: string; icon: React.ElementType; color: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-[#E4E4EC] p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-[#8888A0] uppercase tracking-wide">{label}</p>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `${color}15` }}>
          <Icon className="w-4 h-4" style={{ color }} />
        </div>
      </div>
      <p className="text-2xl font-bold text-[#0A0A0A]">{value}</p>
      {sub && <p className="text-xs text-[#8888A0] mt-1">{sub}</p>}
    </div>
  );
}

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-xs text-[#AAAAB4]">—</span>;
  const map: Record<string, { label: string; color: string; icon: React.ElementType }> = {
    active:    { label: "Active",    color: "#22C55E", icon: CheckCircle2 },
    cancelled: { label: "Cancelled", color: "#F59E0B", icon: XCircle },
    expired:   { label: "Expired",   color: "#EF4444", icon: XCircle },
    paused:    { label: "Paused",    color: "#F59E0B", icon: Clock },
  };
  const e = map[status] ?? { label: status, color: "#8888A0", icon: Clock };
  const Icon = e.icon;
  return (
    <span
      className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border"
      style={{ color: e.color, background: `${e.color}11`, borderColor: `${e.color}33` }}
    >
      <Icon className="w-2.5 h-2.5" />
      {e.label}
    </span>
  );
}

export default function BillingTab() {
  const [stats, setStats] = useState<BillingStats | null>(null);
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [loading, setLoading] = useState(true);
  const [subLoading, setSubLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [resetting, setResetting] = useState<string | null>(null);

  useEffect(() => {
    apiFetch("/admin/billing/stats")
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setSubLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (planFilter) params.set("plan", planFilter);
    if (statusFilter) params.set("status", statusFilter);
    apiFetch(`/admin/billing/subscribers?${params}`)
      .then(setSubscribers)
      .catch(() => {})
      .finally(() => setSubLoading(false));
  }, [search, planFilter, statusFilter]);

  async function resetSubscription(id: string) {
    if (!confirm("Reset this user to free plan? This removes their LS subscription data locally — their subscription in Lemon Squeezy is NOT cancelled automatically.")) return;
    setResetting(id);
    try {
      await apiFetch(`/admin/billing/subscribers/${id}/reset`, { method: "PATCH" });
      setSubscribers((prev) => prev.filter((s) => s.id !== id));
      if (stats) {
        setStats((s) => s ? { ...s, totalPaid: s.totalPaid - 1 } : s);
      }
    } catch {
      alert("Failed to reset subscription.");
    } finally {
      setResetting(null);
    }
  }

  const totalUsers = stats ? stats.byPlan.free + stats.byPlan.pro + stats.byPlan.business : 0;

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="Monthly Revenue" value={loading ? "—" : `$${stats?.mrr ?? 0}`} sub={`ARR $${stats?.arr ?? 0}`} icon={DollarSign} color="#22C55E" />
        <StatCard label="Paying Users" value={loading ? "—" : stats?.totalPaid ?? 0} sub="Across all paid plans" icon={Users} color="#728DA7" />
        <StatCard label="Active Subs" value={loading ? "—" : stats?.active ?? 0} sub="Billing successfully" icon={CheckCircle2} color="#22C55E" />
        <StatCard label="Cancelled / Paused" value={loading ? "—" : ((stats?.cancelled ?? 0) + (stats?.paused ?? 0))} sub={`${stats?.cancelled ?? 0} cancelled, ${stats?.paused ?? 0} paused`} icon={XCircle} color="#F59E0B" />
      </div>

      {/* Plan Distribution */}
      {stats && totalUsers > 0 && (
        <div className="bg-white rounded-2xl border border-[#E4E4EC] p-5">
          <h3 className="text-sm font-semibold text-[#0A0A0A] mb-4">Plan Distribution</h3>
          <div className="flex h-5 rounded-full overflow-hidden gap-0.5 mb-3">
            {stats.byPlan.free > 0 && (
              <div className="bg-[#C8C8D8] transition-all" style={{ width: `${(stats.byPlan.free / totalUsers) * 100}%` }} title={`Free: ${stats.byPlan.free}`} />
            )}
            {stats.byPlan.pro > 0 && (
              <div className="bg-[#728DA7] transition-all" style={{ width: `${(stats.byPlan.pro / totalUsers) * 100}%` }} title={`Pro: ${stats.byPlan.pro}`} />
            )}
            {stats.byPlan.business > 0 && (
              <div className="bg-[#7C5CC4] transition-all" style={{ width: `${(stats.byPlan.business / totalUsers) * 100}%` }} title={`Business: ${stats.byPlan.business}`} />
            )}
          </div>
          <div className="flex items-center gap-5 flex-wrap text-xs">
            {[
              { label: "Free", color: "#C8C8D8", count: stats.byPlan.free },
              { label: "Pro", color: "#728DA7", count: stats.byPlan.pro },
              { label: "Business", color: "#7C5CC4", count: stats.byPlan.business },
            ].map(({ label, color, count }) => (
              <div key={label} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: color }} />
                <span className="text-[#3A3A3E] font-medium">{label}</span>
                <span className="text-[#8888A0]">{count} ({totalUsers > 0 ? Math.round((count / totalUsers) * 100) : 0}%)</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Revenue Breakdown */}
      {stats && stats.totalPaid > 0 && (
        <div className="bg-white rounded-2xl border border-[#E4E4EC] p-5">
          <h3 className="text-sm font-semibold text-[#0A0A0A] mb-4">Revenue Breakdown</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(["pro", "business"] as const).map((plan) => {
              const count = stats.byPlan[plan] ?? 0;
              const revenue = count * PLAN_PRICE[plan];
              return (
                <div key={plan} className="flex items-center justify-between p-4 rounded-xl border border-[#E4E4EC]" style={{ background: PLAN_BG[plan] }}>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ background: PLAN_COLOR[plan] }} />
                    <span className="text-sm font-semibold capitalize text-[#0A0A0A]">{plan}</span>
                    <span className="text-xs text-[#8888A0]">${PLAN_PRICE[plan]}/mo × {count}</span>
                  </div>
                  <span className="text-sm font-bold" style={{ color: PLAN_COLOR[plan] }}>${revenue}/mo</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Subscriber List */}
      <div className="bg-white rounded-2xl border border-[#E4E4EC] overflow-hidden">
        <div className="px-5 py-4 border-b border-[#E4E4EC] flex flex-col sm:flex-row sm:items-center gap-3">
          <h3 className="text-sm font-semibold text-[#0A0A0A] shrink-0">
            Subscribers
            <span className="ml-2 text-xs font-normal text-[#8888A0]">{subscribers.length} shown</span>
          </h3>
          <div className="flex items-center gap-2 flex-1 min-w-0 flex-wrap">
            <div className="relative flex-1 min-w-[160px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#AAAAB4]" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name or email…"
                className="w-full h-8 pl-8 pr-3 text-xs rounded-lg border border-[#E4E4EC] bg-[#F4F4F6] focus:outline-none focus:border-[#728DA7]"
              />
            </div>
            <div className="relative">
              <select
                value={planFilter}
                onChange={(e) => setPlanFilter(e.target.value)}
                className="h-8 pl-3 pr-7 text-xs rounded-lg border border-[#E4E4EC] bg-white text-[#3A3A3E] focus:outline-none focus:border-[#728DA7] appearance-none"
              >
                <option value="">All plans</option>
                <option value="pro">Pro</option>
                <option value="business">Business</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[#AAAAB4] pointer-events-none" />
            </div>
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-8 pl-3 pr-7 text-xs rounded-lg border border-[#E4E4EC] bg-white text-[#3A3A3E] focus:outline-none focus:border-[#728DA7] appearance-none"
              >
                <option value="">All statuses</option>
                <option value="active">Active</option>
                <option value="cancelled">Cancelled</option>
                <option value="paused">Paused</option>
                <option value="expired">Expired</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[#AAAAB4] pointer-events-none" />
            </div>
          </div>
        </div>

        {subLoading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-[#8888A0]">
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span className="text-sm">Loading subscribers…</span>
          </div>
        ) : subscribers.length === 0 ? (
          <div className="py-12 text-center text-sm text-[#8888A0]">
            No paid subscribers yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="bg-[#F8F8FA] border-b border-[#E4E4EC]">
                  {["User", "Plan", "Status", "Subscription ID", "Renews / Expires", "Actions"].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold text-[#8888A0] uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0F0F6]">
                {subscribers.map((s) => (
                  <tr key={s.id} className="hover:bg-[#FAFAFA] transition-colors group">
                    <td className="px-4 py-3">
                      <div className="font-medium text-[#0A0A0A]">{s.name}</div>
                      <div className="text-[11px] text-[#8888A0]">{s.email}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold capitalize"
                        style={{ color: PLAN_COLOR[s.plan], background: PLAN_BG[s.plan] }}
                      >
                        {s.plan}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={s.lsSubscriptionStatus} />
                    </td>
                    <td className="px-4 py-3">
                      {s.lsSubscriptionId ? (
                        <div className="flex items-center gap-1">
                          <code className="text-[11px] bg-[#F4F4F6] rounded px-1.5 py-0.5 text-[#555] font-mono">
                            #{s.lsSubscriptionId}
                          </code>
                          <a
                            href={`https://app.lemonsqueezy.com/subscriptions/${s.lsSubscriptionId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#728DA7] hover:text-[#4A7A94]"
                            title="Open in Lemon Squeezy"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      ) : (
                        <span className="text-xs text-[#AAAAB4]">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {s.planRenewsAt ? (
                        <div className="text-xs text-[#3A3A3E]">
                          <span className="text-[#8888A0]">Renews </span>
                          {new Date(s.planRenewsAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </div>
                      ) : s.planExpiresAt ? (
                        <div className="text-xs text-[#D97706]">
                          <span className="text-[#8888A0]">Expires </span>
                          {new Date(s.planExpiresAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </div>
                      ) : (
                        <span className="text-xs text-[#AAAAB4]">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => resetSubscription(s.id)}
                        disabled={resetting === s.id}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-[#8888A0] hover:text-red-500 hover:bg-red-50 px-2 py-1 rounded-lg transition-all disabled:opacity-50"
                        title="Reset to free plan (local only)"
                      >
                        {resetting === s.id ? (
                          <RefreshCw className="w-3 h-3 animate-spin" />
                        ) : (
                          <RotateCcw className="w-3 h-3" />
                        )}
                        Reset
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* LS Logo */}
      <div className="flex items-center gap-2 text-[11px] text-[#AAAAB4]">
        <TrendingUp className="w-3 h-3" />
        Billing powered by{" "}
        <a href="https://app.lemonsqueezy.com" target="_blank" rel="noopener noreferrer" className="text-[#FFC439] hover:underline font-semibold">
          Lemon Squeezy
        </a>
        — view full transaction history in your LS dashboard.
      </div>
    </div>
  );
}
