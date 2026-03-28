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
} from "@workspace/api-client-react";
import {
  LinkIcon, Activity, Sparkles, Loader2, ArrowRight,
  Plus, BarChart3, Zap, TrendingUp, MousePointerClick,
  ExternalLink, Users, RefreshCw, ArrowUpRight, ArrowDownRight, Sun,
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
      day: format(parseISO(pt.time), "MMM d"),
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

  return (
    <ProtectedLayout>
      <div className="px-7 py-7 max-w-[1200px] mx-auto w-full space-y-6">

        {/* ── Page header ───────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.2em] uppercase text-[#728DA7] mb-1" suppressHydrationWarning>
              {mounted ? getGreeting() : "Welcome"}, {firstName || "there"}
            </p>
            <h1 className="text-[22px] font-bold tracking-tight text-[#0A0A0A] leading-snug">
              Dashboard
            </h1>
            <p className="text-[13px] text-[#9090A0] mt-0.5" suppressHydrationWarning>
              {mounted ? format(new Date(), "EEEE, MMMM d") : ""} · Here's how your links are performing.
            </p>
          </div>
          <Link href="/links">
            <button className="inline-flex items-center gap-2 bg-[#0A0A0A] hover:bg-[#1A1A2E] active:scale-[0.97] text-white text-[13px] font-semibold px-4 py-2.5 rounded-xl transition-all shadow-sm shrink-0">
              <Plus className="w-3.5 h-3.5" />
              New Link
            </button>
          </Link>
        </div>

        {/* ── Quick Stats strip ─────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          <KpiCard
            label="Today's Clicks"
            value={todayClicks}
            icon={<Sun className="w-4 h-4" />}
            accent="#E07B30"
            bgAccent="#FEF3E8"
            sublabel="Since midnight"
          />
          <KpiCard
            label="7-Day Clicks"
            value={stats?.totalClicks ?? null}
            icon={<MousePointerClick className="w-4 h-4" />}
            accent="#2563EB"
            bgAccent="#EFF6FF"
            delta={clickDelta}
          />
          <KpiCard
            label="Total Links"
            value={isLoading ? null : totalLinks}
            icon={<LinkIcon className="w-4 h-4" />}
            accent="#728DA7"
            bgAccent="#EEF3F7"
            sublabel={isLoading ? null : `${activeLinks} active`}
          />
          <KpiCard
            label="Active Links"
            value={isLoading ? null : activeLinks}
            icon={<Activity className="w-4 h-4" />}
            accent="#2E9A72"
            bgAccent="#E8F7F1"
            sublabel={isLoading || totalLinks === 0 ? null : `${Math.round((activeLinks / totalLinks) * 100)}% of total`}
          />
        </div>

        {/* ── Click trend chart ──────────────────────────────────────── */}
        {timeseries.length > 0 && (
          <div className="bg-white border border-[#EBEBF0] rounded-2xl overflow-hidden shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
            <div className="px-5 pt-5 pb-3 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-[14px] text-[#0A0A0A] flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-[#728DA7]" />
                  Clicks — Last 7 Days
                </h3>
                {clickDelta !== null && (
                  <p className={`mt-0.5 text-[12px] font-semibold flex items-center gap-1 ${clickDelta >= 0 ? "text-[#2E9A72]" : "text-[#E05050]"}`}>
                    {clickDelta >= 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                    {Math.abs(clickDelta)}% vs last week
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#728DA7]" />
                <span className="text-[11px] text-[#9090A0] font-medium">Clicks</span>
              </div>
            </div>
            <div className="px-1 pb-3 h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timeseries} margin={{ top: 4, right: 12, bottom: 0, left: -24 }}>
                  <defs>
                    <linearGradient id="dashClicksGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#728DA7" stopOpacity={0.16} />
                      <stop offset="95%" stopColor="#728DA7" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#F0F0F6" />
                  <XAxis
                    dataKey="day"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#B0B0BA", fontSize: 11 }}
                    dy={8}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#B0B0BA", fontSize: 11 }}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{ borderRadius: "12px", border: "1px solid #EBEBF0", boxShadow: "0 4px 16px rgba(0,0,0,0.08)", background: "#FFFFFF" }}
                    labelStyle={{ color: "#0A0A0A", fontWeight: 600, fontSize: 12, marginBottom: 4 }}
                    itemStyle={{ color: "#728DA7", fontSize: 12 }}
                    cursor={{ stroke: "#E4E4EC", strokeWidth: 1, strokeDasharray: "4 4" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="clicks"
                    name="Clicks"
                    stroke="#728DA7"
                    strokeWidth={2}
                    fill="url(#dashClicksGrad)"
                    dot={false}
                    activeDot={{ r: 5, fill: "#728DA7", strokeWidth: 0 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* ── Quick Actions ──────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { icon: <Plus className="w-4 h-4" />, label: "Create Link", desc: "Shorten a new URL instantly", href: "/links", accent: "#0A0A0A", bg: "#F0F0F5" },
            { icon: <BarChart3 className="w-4 h-4" />, label: "Analytics", desc: "See traffic & engagement", href: "/analytics", accent: "#2E9A72", bg: "#E8F7F1" },
            { icon: <Sparkles className="w-4 h-4" />, label: "AI Insights", desc: "Smart performance analysis", href: "/ai", accent: "#7C5CC4", bg: "#F3EEFF" },
          ].map((action) => (
            <Link key={action.href} href={action.href}>
              <div className="group flex items-center gap-3 bg-white hover:bg-[#FAFAFD] border border-[#EBEBF0] hover:border-[#D8D8E8] hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)] rounded-2xl p-4 cursor-pointer transition-all">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: action.bg, color: action.accent }}
                >
                  {action.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-[#0A0A0A]">{action.label}</p>
                  <p className="text-[11px] text-[#9090A0]">{action.desc}</p>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-[#CCCCDA] group-hover:text-[#728DA7] group-hover:translate-x-0.5 shrink-0 transition-all" />
              </div>
            </Link>
          ))}
        </div>

        {/* ── Main grid ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* Top Links */}
          <div className="bg-white rounded-2xl border border-[#EBEBF0] overflow-hidden flex flex-col shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
            <div className="px-5 py-4 flex items-center justify-between border-b border-[#F2F2F6]">
              <h3 className="font-semibold text-[13.5px] text-[#0A0A0A] flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-[#EEF3F7] flex items-center justify-center">
                  <LinkIcon className="w-3.5 h-3.5 text-[#728DA7]" />
                </div>
                Top Links
              </h3>
              <Link href="/links" className="text-[12px] text-[#728DA7] hover:text-[#4A7A94] font-semibold flex items-center gap-1 group transition-colors">
                View all
                <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>

            <div className="flex-1 divide-y divide-[#F5F5F8]">
              {isLoading ? (
                <div className="h-48 flex items-center justify-center">
                  <Loader2 className="w-5 h-5 animate-spin text-[#728DA7]/30" />
                </div>
              ) : !links || links.length === 0 ? (
                <div className="h-48 flex flex-col items-center justify-center gap-3 text-center px-6">
                  <div className="w-12 h-12 rounded-2xl bg-[#F2F2F6] flex items-center justify-center">
                    <LinkIcon className="w-5 h-5 text-[#CCCCDA]" />
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold text-[#0A0A0A]">No links yet</p>
                    <p className="text-[12px] text-[#9090A0] mt-0.5">Create your first short link to get started.</p>
                  </div>
                  <Link href="/links">
                    <button className="mt-1 text-[12px] font-semibold text-[#728DA7] hover:text-[#4A7A94] transition-colors">
                      Create a link →
                    </button>
                  </Link>
                </div>
              ) : (
                topLinks.map((link, i) => {
                  const clicks = clickCounts[link.id] ?? 0;
                  const maxClicks = Math.max(...topLinks.map((l) => clickCounts[l.id] ?? 0), 1);
                  return (
                    <div key={link.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-[#FAFAFA] transition-colors group">
                      <span className="text-[11px] font-bold text-[#DDDDE8] w-4 shrink-0 tabular-nums">
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-[13px] font-semibold text-[#2D6A8A] truncate">/{link.slug}</p>
                          {link.title && (
                            <span className="text-[10px] text-[#B0B0BA] font-medium truncate hidden sm:block">{link.title}</span>
                          )}
                        </div>
                        <div className="h-1.5 bg-[#F2F2F6] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#728DA7] rounded-full transition-all duration-700"
                            style={{ width: `${Math.max((clicks / maxClicks) * 100, 3)}%` }}
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="text-right">
                          <span className="text-[13px] font-bold text-[#0A0A0A] tabular-nums">{clicks.toLocaleString()}</span>
                          <p className="text-[10px] text-[#B0B0BA]">clicks</p>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${link.enabled ? "bg-[#E8F7F1] text-[#2E9A72]" : "bg-[#F2F2F6] text-[#9090A0]"}`}>
                          {link.enabled ? "Live" : "Off"}
                        </span>
                        <a
                          href={`${origin}/r/${link.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="opacity-0 group-hover:opacity-100 text-[#CCCCDA] hover:text-[#728DA7] transition-all"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* AI Insights */}
          <div className="bg-white rounded-2xl border border-[#EBEBF0] overflow-hidden flex flex-col shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
            <div className="px-5 py-4 flex items-center justify-between border-b border-[#F2F2F6]">
              <h3 className="font-semibold text-[13.5px] text-[#0A0A0A] flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-[#F0EBF9] flex items-center justify-center">
                  <Sparkles className="w-3.5 h-3.5 text-[#7C5CC4]" />
                </div>
                AI Insights
              </h3>
              <button
                onClick={handleGenerateSummary}
                disabled={summaryMutation.isPending}
                className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#728DA7] hover:text-[#4A7A94] disabled:opacity-40 transition-colors group"
              >
                {summaryMutation.isPending
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <RefreshCw className="w-3.5 h-3.5 group-hover:rotate-180 transition-transform duration-500" />}
                Generate
              </button>
            </div>

            <div className="p-5 flex-1 flex flex-col">
              {summaryMutation.isPending ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-3 py-8">
                  <div className="relative">
                    <div className="w-10 h-10 rounded-2xl bg-[#F0EBF9] flex items-center justify-center">
                      <Sparkles className="w-5 h-5 text-[#7C5CC4]" />
                    </div>
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-[#7C5CC4] rounded-full animate-ping opacity-75" />
                  </div>
                  <div className="text-center">
                    <p className="text-[13px] font-semibold text-[#0A0A0A]">Analysing your data…</p>
                    <p className="text-[12px] text-[#9090A0] mt-0.5">This takes a few seconds.</p>
                  </div>
                </div>
              ) : latestSummary ? (
                <>
                  <div className="flex-1 text-[13px] text-[#3A3A3E] leading-[1.7] whitespace-pre-wrap overflow-auto max-h-64 custom-scrollbar">
                    {latestSummary.content}
                  </div>
                  <Link href="/ai" className="mt-4 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-[#728DA7] hover:text-[#4A7A94] transition-colors group">
                    View full AI Insights
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </Link>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center gap-4 py-8">
                  <div className="w-14 h-14 rounded-2xl bg-[#F5F0FE] flex items-center justify-center">
                    <Sparkles className="w-6 h-6 text-[#7C5CC4]/50" />
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold text-[#0A0A0A] mb-1">No insights yet</p>
                    <p className="text-[12px] text-[#9090A0] max-w-[220px] mx-auto leading-relaxed">
                      Generate a weekly summary to uncover performance trends.
                    </p>
                  </div>
                  <button
                    onClick={handleGenerateSummary}
                    disabled={summaryMutation.isPending}
                    className="inline-flex items-center gap-2 text-[12.5px] font-semibold bg-[#7C5CC4] hover:bg-[#6B4BB3] text-white px-4 py-2 rounded-xl transition-colors disabled:opacity-40 active:scale-[0.97]"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    Generate now
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

function KpiCard({
  label, value, icon, accent, bgAccent, delta, sublabel,
}: {
  label: string;
  value: number | null;
  icon: React.ReactNode;
  accent: string;
  bgAccent: string;
  delta?: number | null;
  sublabel?: string | null;
}) {
  return (
    <div className="bg-white border border-[#EBEBF0] rounded-2xl p-5 cursor-default hover:shadow-[0_2px_10px_rgba(0,0,0,0.07)] transition-shadow shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <div className="flex items-start justify-between mb-4">
        <p className="text-[11px] font-semibold text-[#A0A0AE] tracking-wide">{label}</p>
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: bgAccent, color: accent }}
        >
          {icon}
        </div>
      </div>
      <div className="text-[28px] font-bold text-[#0A0A0A] leading-none tracking-tight tabular-nums">
        {value === null ? (
          <div className="flex gap-1.5 pt-1">
            <span className="w-14 h-6 rounded-lg bg-[#F2F2F6] animate-pulse inline-block" />
          </div>
        ) : (
          value.toLocaleString()
        )}
      </div>
      <div className="mt-2 flex items-center gap-2 h-5">
        {delta !== null && delta !== undefined ? (
          <span className={`text-[11px] font-semibold flex items-center gap-0.5 ${delta >= 0 ? "text-[#2E9A72]" : "text-[#E05050]"}`}>
            {delta >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {Math.abs(delta)}%
            <span className="text-[#B0B0BA] font-normal ml-0.5">vs last week</span>
          </span>
        ) : sublabel ? (
          <span className="text-[11px] font-medium" style={{ color: accent }}>{sublabel}</span>
        ) : (
          <span className="text-[11px] text-[#B0B0BA]">last 7 days</span>
        )}
      </div>
    </div>
  );
}
