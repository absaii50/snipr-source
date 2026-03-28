"use client";
import { useEffect, useState } from "react";
import {
  Users, Link2, BarChart3, Globe, TrendingUp,
  RefreshCw, ArrowUpRight, UserPlus, Zap, ShoppingCart, Crown,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { apiFetch, fmtDate, fmtNum } from "../utils";

interface Stats {
  totalUsers: number; totalWorkspaces: number; totalLinks: number;
  activeLinks: number; totalClicks: number; totalConversions: number;
  totalDomains: number; suspendedUsers: number;
  newUsersThisWeek: number; newLinksThisWeek: number; clicksThisWeek: number;
}
interface RecentUser { id: string; name: string; email: string; createdAt: string; }
interface TopLink { slug: string; destination_url: string; clicks: number; }
interface TopUser {
  id: string; name: string; email: string; plan: string;
  total_links: number; total_clicks: number; clicks_7d: number;
}
interface PlatformDay { day: string; clicks: number; }

function Kpi({ label, value, sub, icon: Icon, accent, bg }: {
  label: string; value: number | string; sub?: string;
  icon: React.ElementType; accent: string; bg: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-[#E4E4EC] p-5 hover:shadow-md transition-all hover:-translate-y-0.5">
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: bg }}>
          <Icon className="w-5 h-5" style={{ color: accent }} />
        </div>
        {sub && (
          <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full flex items-center gap-1">
            <ArrowUpRight className="w-3 h-3" />{sub}
          </span>
        )}
      </div>
      <div className="text-2xl font-bold text-[#0A0A0A] tabular-nums">
        {typeof value === "number" ? fmtNum(value) : value}
      </div>
      <div className="text-sm text-[#8888A0] mt-0.5">{label}</div>
    </div>
  );
}

function PlanBadge({ plan }: { plan: string }) {
  const cfg = plan === "business"
    ? "bg-purple-50 text-purple-700 border-purple-200"
    : plan === "pro"
    ? "bg-blue-50 text-blue-700 border-blue-200"
    : "bg-gray-100 text-gray-500 border-gray-200";
  return (
    <span className={`inline-block px-1.5 py-0.5 rounded-full text-[9px] font-bold border uppercase ${cfg}`}>
      {plan}
    </span>
  );
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#0A0A0A] text-white text-xs px-3 py-2 rounded-xl shadow-xl">
      <div className="text-[#8888A0] mb-0.5">{label}</div>
      <div className="font-bold">{fmtNum(payload[0].value)} clicks</div>
    </div>
  );
}

export default function Overview() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recent, setRecent] = useState<RecentUser[]>([]);
  const [topLinks, setTopLinks] = useState<TopLink[]>([]);
  const [topUsers, setTopUsers] = useState<TopUser[]>([]);
  const [chartData, setChartData] = useState<PlatformDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    try {
      const [s, r, t, u, p] = await Promise.all([
        apiFetch("/admin/stats"),
        apiFetch("/admin/recent-signups"),
        apiFetch("/admin/top-links"),
        apiFetch("/admin/users/top?limit=8"),
        apiFetch("/admin/analytics/platform?days=30"),
      ]);
      setStats(s); setRecent(r); setTopLinks(t); setTopUsers(u);
      setChartData((p.clicksByDay ?? []).map((d: any) => ({
        day: new Date(d.day).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        clicks: Number(d.clicks),
      })));
    } catch {
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function refresh() {
    setRefreshing(true);
    await load().catch(() => {});
    setRefreshing(false);
  }

  if (loading) return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {[...Array(8)].map((_, i) => (
        <div key={i} className="bg-white rounded-2xl border border-[#E4E4EC] h-28 animate-pulse" />
      ))}
    </div>
  );

  if (!stats) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-[#0A0A0A]">Platform Health</h2>
          <p className="text-xs text-[#8888A0]">Live across all workspaces</p>
        </div>
        <button onClick={refresh} disabled={refreshing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#E4E4EC] text-xs text-[#3A3A3E] hover:bg-[#F4F4F6] transition-all disabled:opacity-60">
          <RefreshCw className={`w-3 h-3 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label="Total Users" value={stats.totalUsers} sub={`+${stats.newUsersThisWeek} this week`}
          icon={Users} accent="#728DA7" bg="#EEF3F7" />
        <Kpi label="Total Links" value={stats.totalLinks} sub={`+${stats.newLinksThisWeek} this week`}
          icon={Link2} accent="#2E9A72" bg="#E6F7F1" />
        <Kpi label="Total Clicks" value={stats.totalClicks} sub={`${fmtNum(stats.clicksThisWeek)} this week`}
          icon={BarChart3} accent="#7C5CC4" bg="#F0EBF9" />
        <Kpi label="Conversions" value={stats.totalConversions}
          icon={ShoppingCart} accent="#D4875A" bg="#FAF0E9" />
        <Kpi label="Active Links" value={stats.activeLinks}
          icon={Zap} accent="#2E9A72" bg="#E6F7F1" />
        <Kpi label="Custom Domains" value={stats.totalDomains}
          icon={Globe} accent="#4A7A94" bg="#E8EEF4" />
        <Kpi label="Workspaces" value={stats.totalWorkspaces}
          icon={TrendingUp} accent="#7C5CC4" bg="#F0EBF9" />
        <Kpi label="Suspended" value={stats.suspendedUsers}
          icon={Users} accent="#DC2626" bg="#FEF2F2" />
      </div>

      {/* Platform traffic area chart */}
      <div className="bg-white rounded-2xl border border-[#E4E4EC] p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-[#0A0A0A]">Platform Traffic</h3>
            <p className="text-xs text-[#8888A0]">Clicks across all links — last 30 days</p>
          </div>
          <BarChart3 className="w-4 h-4 text-[#728DA7]" />
        </div>
        {chartData.length === 0 ? (
          <div className="h-32 flex items-center justify-center text-sm text-[#8888A0]">No click data yet</div>
        ) : (
          <ResponsiveContainer width="100%" height={140}>
            <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="clickGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#728DA7" stopOpacity={0.18} />
                  <stop offset="95%" stopColor="#728DA7" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F5" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#8888A0" }} tickLine={false} axisLine={false}
                interval={Math.floor(chartData.length / 6)} />
              <YAxis tick={{ fontSize: 10, fill: "#8888A0" }} tickLine={false} axisLine={false}
                tickFormatter={(v) => fmtNum(v)} />
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: "#728DA7", strokeWidth: 1, strokeDasharray: "4 4" }} />
              <Area type="monotone" dataKey="clicks" stroke="#728DA7" strokeWidth={2}
                fill="url(#clickGrad)" dot={false} activeDot={{ r: 4, fill: "#728DA7" }} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Top users + recent signups + top links */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Top users by traffic */}
        <div className="lg:col-span-1 bg-white rounded-2xl border border-[#E4E4EC] overflow-hidden">
          <div className="px-5 py-4 border-b border-[#E4E4EC] flex items-center gap-2">
            <Crown className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-semibold text-[#0A0A0A]">Top Users by Traffic</h3>
          </div>
          <div className="divide-y divide-[#F4F4F6]">
            {topUsers.length === 0 && (
              <p className="px-5 py-8 text-center text-sm text-[#8888A0]">No users yet</p>
            )}
            {topUsers.map((u, i) => {
              const maxC = Math.max(...topUsers.map((x) => Number(x.total_clicks)), 1);
              const pct = Math.round((Number(u.total_clicks) / maxC) * 100);
              return (
                <div key={u.id} className="flex items-center gap-3 px-4 py-3 hover:bg-[#F8F8FC] transition-colors">
                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0 ${
                    i === 0 ? "bg-amber-400 text-white" : i === 1 ? "bg-gray-300 text-gray-700" : i === 2 ? "bg-amber-700/40 text-amber-900" : "bg-[#F4F4F6] text-[#8888A0]"
                  }`}>
                    {i + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-xs font-semibold text-[#0A0A0A] truncate max-w-[100px]">{u.name}</span>
                      <PlanBadge plan={u.plan} />
                    </div>
                    <div className="h-1.5 bg-[#F0F0F5] rounded-full overflow-hidden">
                      <div className="h-full bg-[#728DA7] rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <div className="text-xs font-bold text-[#728DA7] shrink-0 tabular-nums">
                    {fmtNum(Number(u.total_clicks))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent signups */}
        <div className="bg-white rounded-2xl border border-[#E4E4EC] overflow-hidden">
          <div className="px-5 py-4 border-b border-[#E4E4EC] flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-[#728DA7]" />
            <h3 className="text-sm font-semibold text-[#0A0A0A]">Recent Signups</h3>
          </div>
          <div className="divide-y divide-[#F4F4F6]">
            {recent.length === 0 && (
              <p className="px-5 py-8 text-center text-sm text-[#8888A0]">No users yet</p>
            )}
            {recent.map((u) => (
              <div key={u.id} className="flex items-center gap-3 px-5 py-3 hover:bg-[#F8F8FC] transition-colors">
                <div className="w-8 h-8 rounded-full bg-[#E8EEF4] flex items-center justify-center text-[#728DA7] text-xs font-bold shrink-0">
                  {u.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-[#0A0A0A] truncate">{u.name}</div>
                  <div className="text-xs text-[#8888A0] truncate">{u.email}</div>
                </div>
                <div className="text-xs text-[#8888A0] shrink-0">{fmtDate(u.createdAt)}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Top links */}
        <div className="bg-white rounded-2xl border border-[#E4E4EC] overflow-hidden">
          <div className="px-5 py-4 border-b border-[#E4E4EC] flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[#728DA7]" />
            <h3 className="text-sm font-semibold text-[#0A0A0A]">Top Performing Links</h3>
          </div>
          <div className="divide-y divide-[#F4F4F6]">
            {topLinks.length === 0 && (
              <p className="px-5 py-8 text-center text-sm text-[#8888A0]">No links yet</p>
            )}
            {topLinks.map((l, i) => (
              <div key={l.slug} className="flex items-center gap-3 px-5 py-3 hover:bg-[#F8F8FC] transition-colors">
                <div className="w-7 h-7 rounded-lg bg-[#F4F4F6] flex items-center justify-center text-xs font-bold text-[#8888A0] shrink-0">
                  {i + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-mono font-medium text-[#0A0A0A]">snipr.sh/{l.slug}</div>
                  <div className="text-xs text-[#8888A0] truncate">{l.destination_url}</div>
                </div>
                <div className="text-xs font-semibold text-[#728DA7] shrink-0 bg-[#EEF3F7] px-2 py-0.5 rounded-full">
                  {fmtNum(Number(l.clicks))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
