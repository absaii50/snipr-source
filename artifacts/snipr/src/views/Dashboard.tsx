"use client";
import { useMemo, useState, useEffect } from "react";
import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import {
  useGetLinks,
  useGetAiInsights,
  useGenerateWeeklySummary,
  getGetAiInsightsQueryKey,
  useGetWorkspaceAnalytics,
  useGetWorkspaceTimeseries,
  useGetDomains,
} from "@workspace/api-client-react";
import {
  LinkIcon, Activity, Sparkles, Loader2, ArrowRight,
  Plus, BarChart3, Zap, TrendingUp, MousePointerClick,
  ExternalLink, RefreshCw, ArrowUpRight, ArrowDownRight,
  Globe, Copy, CheckCircle2, Rocket,
} from "lucide-react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";
import { format, parseISO } from "date-fns";
import {
  AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid,
} from "recharts";

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function getDateRange(days: number) {
  const to = new Date().toISOString().split("T")[0];
  const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  return { from, to };
}

async function fetchLinkClicks({ signal }: { signal: AbortSignal }): Promise<Record<string, number>> {
  try {
    const res = await fetch("/api/links/clicks", { credentials: "include", signal });
    if (!res.ok) return {};
    return res.json();
  } catch (e) {
    if ((e as Error)?.name === "AbortError") return {};
    throw e;
  }
}

async function fetchTodayClicks({ signal }: { signal: AbortSignal }): Promise<number> {
  try {
    const res = await fetch("/api/stats/today", { credentials: "include", signal });
    if (!res.ok) return 0;
    const data = await res.json();
    return data.clicks ?? 0;
  } catch { return 0; }
}

export default function Dashboard() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [origin, setOrigin] = useState("");
  useEffect(() => { setMounted(true); setOrigin(window.location.origin); }, []);
  const { data: links, isLoading } = useGetLinks();
  const { data: allDomains } = useGetDomains();
  const domainMap = useMemo(() => {
    const map: Record<string, string> = {};
    allDomains?.forEach((d: any) => { if (d.id) map[d.id] = d.domain; });
    return map;
  }, [allDomains]);
  const { data: insights } = useGetAiInsights({ limit: 10 });
  const summaryMutation = useGenerateWeeklySummary();

  const { from, to } = getDateRange(7);
  const prevFrom = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const prevTo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const { data: stats } = useGetWorkspaceAnalytics({ from, to });
  const { data: prevStats } = useGetWorkspaceAnalytics({ from: prevFrom, to: prevTo });
  const { data: clickCounts = {} } = useQuery({
    queryKey: ["links-clicks"],
    queryFn: fetchLinkClicks,
    staleTime: 60_000,
  });
  const { data: todayClicks = 0 } = useQuery({
    queryKey: ["stats-today"],
    queryFn: fetchTodayClicks,
    staleTime: 30_000,
  });

  const timeseriesResult = useGetWorkspaceTimeseries({ from, to });
  const timeseries = useMemo(() => {
    if (!timeseriesResult.data) return [];
    return timeseriesResult.data.map((pt) => ({
      ...pt,
      day: format(parseISO(pt.time), "EEE"),
    }));
  }, [timeseriesResult.data]);

  const totalLinks = links?.length ?? 0;
  const activeLinks = links?.filter((l) => l.enabled).length ?? 0;
  const latestSummary = insights?.find((i) => i.type === "weekly_summary");
  const firstName = user?.name?.split(" ")[0] ?? "";

  const clicksThisWeek = stats?.totalClicks ?? 0;
  const clicksLastWeek = prevStats?.totalClicks ?? 0;
  const clickDelta = clicksLastWeek > 0
    ? Math.round(((clicksThisWeek - clicksLastWeek) / clicksLastWeek) * 100)
    : null;

  const topLinks = useMemo(() => {
    if (!links) return [];
    return [...links]
      .sort((a, b) => (clickCounts[b.id] ?? 0) - (clickCounts[a.id] ?? 0))
      .slice(0, 5);
  }, [links, clickCounts]);

  const handleGenerateSummary = async () => {
    try {
      await summaryMutation.mutateAsync();
      queryClient.invalidateQueries({ queryKey: getGetAiInsightsQueryKey() });
    } catch (e) {
      console.error(e);
    }
  };

  const showOnboarding = !isLoading && totalLinks === 0;

  return (
    <ProtectedLayout>
      <div className="px-6 lg:px-8 py-6 max-w-[1140px] mx-auto w-full space-y-5">

        {/* ── Header ───────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-[24px] font-bold tracking-tight text-[#0A0A0A] leading-tight" suppressHydrationWarning>
              {mounted ? getGreeting() : "Welcome"}, {firstName || "there"}
            </h1>
            <p className="text-[13px] text-[#9CA3AF] mt-1" suppressHydrationWarning>
              {mounted ? format(new Date(), "EEEE, MMMM d") : ""} &middot; Here&apos;s your overview
            </p>
          </div>
          <Link href="/links">
            <button className="inline-flex items-center gap-2 bg-[#0A0A0A] hover:bg-[#1F1F1F] active:scale-[0.97] text-white text-[13px] font-semibold px-4 py-2.5 rounded-xl transition-all shadow-sm shrink-0">
              <Plus className="w-3.5 h-3.5" />
              New Link
            </button>
          </Link>
        </div>

        {/* ── KPI Cards ────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard label="Today" value={todayClicks} icon={<MousePointerClick className="w-4 h-4" />} gradient="from-amber-500 to-orange-500" sublabel="clicks today" />
          <KpiCard label="This Week" value={stats?.totalClicks ?? null} icon={<TrendingUp className="w-4 h-4" />} gradient="from-blue-500 to-indigo-500" delta={clickDelta} />
          <KpiCard label="Total Links" value={isLoading ? null : totalLinks} icon={<LinkIcon className="w-4 h-4" />} gradient="from-[#728DA7] to-[#5A7A94]" sublabel={isLoading ? undefined : `${activeLinks} active`} />
          <KpiCard label="Active" value={isLoading ? null : activeLinks} icon={<Activity className="w-4 h-4" />} gradient="from-emerald-500 to-green-600" sublabel={isLoading || totalLinks === 0 ? undefined : `${Math.round((activeLinks / totalLinks) * 100)}% live`} />
        </div>

        {/* ── Onboarding (if no links) ─────────────────────────── */}
        {showOnboarding && (
          <div className="bg-gradient-to-br from-[#0A0A0A] to-[#1a1a2e] rounded-2xl p-6 lg:p-8 text-white relative overflow-hidden">
            <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '20px 20px' }} />
            <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center gap-6">
              <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center shrink-0">
                <Rocket className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold mb-1">Welcome to Snipr!</h3>
                <p className="text-white/60 text-sm leading-relaxed max-w-lg">
                  Create your first short link to start tracking clicks, analyzing traffic, and optimizing your marketing.
                </p>
              </div>
              <Link href="/links">
                <button className="inline-flex items-center gap-2 bg-white text-[#0A0A0A] text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-white/90 active:scale-[0.97] transition-all shrink-0">
                  <Plus className="w-4 h-4" />
                  Create your first link
                </button>
              </Link>
            </div>
          </div>
        )}

        {/* ── Chart + Quick Actions row ────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Chart - takes 2 cols */}
          <div className="lg:col-span-2 bg-white border border-[#ECEDF0] rounded-2xl overflow-hidden">
            <div className="px-5 pt-5 pb-2 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-[14px] text-[#0A0A0A]">Click Activity</h3>
                <p className="text-[11px] text-[#9CA3AF] mt-0.5">Last 7 days performance</p>
              </div>
              {clickDelta !== null && (
                <span className={`inline-flex items-center gap-1 text-[12px] font-semibold px-2.5 py-1 rounded-lg ${clickDelta >= 0 ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-500"}`}>
                  {clickDelta >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                  {Math.abs(clickDelta)}%
                </span>
              )}
            </div>
            <div className="px-1 pb-3 h-[200px]">
              {timeseries.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={timeseries} margin={{ top: 8, right: 16, bottom: 0, left: -20 }}>
                    <defs>
                      <linearGradient id="dashGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#0A0A0A" stopOpacity={0.08} />
                        <stop offset="100%" stopColor="#0A0A0A" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#F3F4F6" />
                    <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "#9CA3AF", fontSize: 11 }} dy={8} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: "#9CA3AF", fontSize: 11 }} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ borderRadius: "12px", border: "1px solid #E5E7EB", boxShadow: "0 4px 20px rgba(0,0,0,0.08)", background: "#fff", padding: "8px 12px" }}
                      labelStyle={{ color: "#0A0A0A", fontWeight: 600, fontSize: 12, marginBottom: 2 }}
                      itemStyle={{ color: "#6B7280", fontSize: 12 }}
                      cursor={{ stroke: "#D1D5DB", strokeWidth: 1 }}
                    />
                    <Area type="monotone" dataKey="clicks" name="Clicks" stroke="#0A0A0A" strokeWidth={2} fill="url(#dashGrad)" dot={false} activeDot={{ r: 4, fill: "#0A0A0A", strokeWidth: 2, stroke: "#fff" }} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-[#D1D5DB]">
                  <div className="text-center">
                    <BarChart3 className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="text-xs text-[#9CA3AF]">Chart data will appear after your first click</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions - takes 1 col */}
          <div className="space-y-3">
            {[
              { icon: Plus, label: "Create Link", desc: "Shorten a URL", href: "/links", iconBg: "bg-[#0A0A0A]", iconColor: "text-white" },
              { icon: BarChart3, label: "Analytics", desc: "View traffic", href: "/analytics", iconBg: "bg-emerald-50", iconColor: "text-emerald-600" },
              { icon: Globe, label: "Domains", desc: "Custom domains", href: "/domains", iconBg: "bg-blue-50", iconColor: "text-blue-600" },
              { icon: Sparkles, label: "AI Insights", desc: "Smart analysis", href: "/ai", iconBg: "bg-purple-50", iconColor: "text-purple-600" },
            ].map((a) => (
              <Link key={a.href} href={a.href}>
                <div className="group flex items-center gap-3 bg-white hover:bg-[#FAFAFA] border border-[#ECEDF0] hover:border-[#D1D5DB] rounded-xl p-3.5 cursor-pointer transition-all hover:shadow-sm">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${a.iconBg} ${a.iconColor}`}>
                    <a.icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-[#0A0A0A]">{a.label}</p>
                    <p className="text-[11px] text-[#9CA3AF]">{a.desc}</p>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-[#D1D5DB] group-hover:text-[#6B7280] group-hover:translate-x-0.5 transition-all shrink-0" />
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* ── Bottom grid ──────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

          {/* Top Links - 3 cols */}
          <div className="lg:col-span-3 bg-white rounded-2xl border border-[#ECEDF0] overflow-hidden">
            <div className="px-5 py-4 flex items-center justify-between border-b border-[#F3F4F6]">
              <h3 className="font-semibold text-[14px] text-[#0A0A0A]">Top Performing Links</h3>
              <Link href="/links" className="text-[12px] text-[#6B7280] hover:text-[#0A0A0A] font-medium flex items-center gap-1 transition-colors">
                View all <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="divide-y divide-[#F9FAFB]">
              {isLoading ? (
                <div className="h-[260px] flex items-center justify-center">
                  <Loader2 className="w-5 h-5 animate-spin text-[#D1D5DB]" />
                </div>
              ) : topLinks.length === 0 ? (
                <div className="h-[260px] flex flex-col items-center justify-center text-center px-6">
                  <div className="w-12 h-12 rounded-2xl bg-[#F3F4F6] flex items-center justify-center mb-3">
                    <LinkIcon className="w-5 h-5 text-[#D1D5DB]" />
                  </div>
                  <p className="text-sm font-medium text-[#374151]">No links yet</p>
                  <p className="text-xs text-[#9CA3AF] mt-1">Create your first link to see it here</p>
                </div>
              ) : (
                topLinks.map((link, i) => {
                  const clicks = clickCounts[link.id] ?? 0;
                  const maxClicks = Math.max(...topLinks.map((l) => clickCounts[l.id] ?? 0), 1);
                  return (
                    <LinkRow key={link.id} link={link} clicks={clicks} maxClicks={maxClicks} rank={i + 1} origin={origin} domainMap={domainMap} />
                  );
                })
              )}
            </div>
          </div>

          {/* AI Insights - 2 cols */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-[#ECEDF0] overflow-hidden flex flex-col">
            <div className="px-5 py-4 flex items-center justify-between border-b border-[#F3F4F6]">
              <h3 className="font-semibold text-[14px] text-[#0A0A0A] flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-500" />
                AI Insights
              </h3>
              <button
                onClick={handleGenerateSummary}
                disabled={summaryMutation.isPending}
                className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[#6B7280] hover:text-[#0A0A0A] disabled:opacity-40 transition-colors"
              >
                {summaryMutation.isPending
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <RefreshCw className="w-3.5 h-3.5" />}
                {summaryMutation.isPending ? "Analyzing..." : "Generate"}
              </button>
            </div>
            <div className="p-5 flex-1 flex flex-col min-h-[240px]">
              {summaryMutation.isPending ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center relative">
                    <Sparkles className="w-5 h-5 text-purple-500" />
                    <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-purple-500 rounded-full animate-ping" />
                  </div>
                  <p className="text-xs text-[#9CA3AF]">Analyzing your data...</p>
                </div>
              ) : latestSummary ? (
                <>
                  <div className="flex-1 text-[13px] text-[#4B5563] leading-[1.7] overflow-auto max-h-52 custom-scrollbar">
                    {latestSummary.content}
                  </div>
                  <Link href="/ai" className="mt-4 inline-flex items-center gap-1.5 text-[12px] font-semibold text-purple-600 hover:text-purple-700 transition-colors">
                    View all insights <ArrowRight className="w-3 h-3" />
                  </Link>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-50 to-indigo-50 flex items-center justify-center">
                    <Sparkles className="w-6 h-6 text-purple-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[#374151]">No insights yet</p>
                    <p className="text-xs text-[#9CA3AF] mt-1 max-w-[200px] mx-auto">Generate a summary to see AI-powered performance analysis</p>
                  </div>
                  <button
                    onClick={handleGenerateSummary}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors active:scale-[0.97]"
                  >
                    <Zap className="w-3 h-3" /> Generate now
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </ProtectedLayout>
  );
}

/* ── KPI Card ──────────────────────────────────────────────── */
function KpiCard({ label, value, icon, gradient, delta, sublabel }: {
  label: string;
  value: number | null;
  icon: React.ReactNode;
  gradient: string;
  delta?: number | null;
  sublabel?: string;
}) {
  return (
    <div className="bg-white border border-[#ECEDF0] rounded-2xl p-4 hover:shadow-md transition-all group cursor-default">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wide">{label}</span>
        <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center text-white group-hover:scale-110 transition-transform`}>
          {icon}
        </div>
      </div>
      {value === null ? (
        <div className="h-8 w-16 rounded-lg bg-[#F3F4F6] animate-pulse" />
      ) : (
        <p className="text-[26px] font-bold text-[#0A0A0A] leading-none tracking-tight tabular-nums">{value.toLocaleString()}</p>
      )}
      <div className="mt-1.5 h-4">
        {delta !== null && delta !== undefined ? (
          <span className={`inline-flex items-center gap-0.5 text-[11px] font-semibold ${delta >= 0 ? "text-emerald-600" : "text-red-500"}`}>
            {delta >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {Math.abs(delta)}% <span className="text-[#D1D5DB] font-normal">vs last week</span>
          </span>
        ) : sublabel ? (
          <span className="text-[11px] text-[#9CA3AF]">{sublabel}</span>
        ) : null}
      </div>
    </div>
  );
}

/* ── Link Row ──────────────────────────────────────────────── */
function LinkRow({ link, clicks, maxClicks, rank, origin, domainMap }: {
  link: any;
  clicks: number;
  maxClicks: number;
  rank: number;
  origin: string;
  domainMap: Record<string, string>;
}) {
  const [copied, setCopied] = useState(false);
  const domainName = link.domainId ? domainMap[link.domainId] : null;
  const shortUrl = domainName ? `https://${domainName}/${link.slug}` : `${origin}/r/${link.slug}`;

  function copyLink() {
    navigator.clipboard.writeText(shortUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="flex items-center gap-3 px-5 py-3 hover:bg-[#FAFAFA] transition-colors group">
      <span className="text-[11px] font-bold text-[#E5E7EB] w-4 shrink-0 tabular-nums text-center">{rank}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <p className="text-[13px] font-semibold text-[#0A0A0A] truncate">{domainName ? `${domainName}/` : "/"}{link.slug}</p>
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${link.enabled ? "bg-emerald-50 text-emerald-600" : "bg-gray-100 text-gray-500"}`}>
            {link.enabled ? "LIVE" : "OFF"}
          </span>
        </div>
        <div className="h-1 bg-[#F3F4F6] rounded-full overflow-hidden">
          <div className="h-full bg-[#0A0A0A] rounded-full transition-all duration-700" style={{ width: `${Math.max((clicks / maxClicks) * 100, 4)}%` }} />
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-[13px] font-bold text-[#0A0A0A] tabular-nums">{clicks.toLocaleString()}</span>
        <button onClick={copyLink} className="opacity-0 group-hover:opacity-100 p-1 rounded-md hover:bg-[#F3F4F6] transition-all" title="Copy link">
          {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 text-[#9CA3AF]" />}
        </button>
        <a href={shortUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="opacity-0 group-hover:opacity-100 p-1 rounded-md hover:bg-[#F3F4F6] transition-all">
          <ExternalLink className="w-3.5 h-3.5 text-[#9CA3AF]" />
        </a>
      </div>
    </div>
  );
}
