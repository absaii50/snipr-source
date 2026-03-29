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
  LinkIcon, Sparkles, Loader2, ArrowRight,
  Plus, BarChart3, Zap, TrendingUp, MousePointerClick,
  ExternalLink, RefreshCw, ArrowUpRight, ArrowDownRight,
  Globe, Copy, CheckCircle2, Rocket,
} from "lucide-react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";
import { format, parseISO, subDays } from "date-fns";
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer,
  Tooltip, CartesianGrid, Cell,
} from "recharts";

/* ── Constants ─────────────────────────────────────────────── */
const CORAL = "#E05A3A";
const CORAL_LIGHT = "#FDF1EE";

type Period = "7d" | "30d" | "all";

function getPeriodRange(p: Period) {
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  if (p === "7d") {
    return { from: subDays(today, 6).toISOString().split("T")[0], to: todayStr, interval: "day" as const };
  }
  if (p === "30d") {
    return { from: subDays(today, 29).toISOString().split("T")[0], to: todayStr, interval: "day" as const };
  }
  return { from: "2020-01-01", to: todayStr, interval: "month" as const };
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function fmtK(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return n.toLocaleString();
}

function getFlagEmoji(code: string): string {
  if (!code || code.length !== 2) return "🌍";
  const pts = [...code.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65);
  return String.fromCodePoint(...pts);
}

const COUNTRY_NAMES: Record<string, string> = {
  US: "United States", GB: "United Kingdom", DE: "Germany", FR: "France",
  NL: "Netherlands", IT: "Italy", VN: "Vietnam", CA: "Canada", AU: "Australia",
  JP: "Japan", CN: "China", KR: "South Korea", BR: "Brazil", MX: "Mexico",
  IN: "India", ES: "Spain", PL: "Poland", SE: "Sweden", NO: "Norway",
  DK: "Denmark", FI: "Finland", CH: "Switzerland", AT: "Austria", BE: "Belgium",
  PT: "Portugal", CZ: "Czech Republic", TR: "Turkey", RU: "Russia",
  UA: "Ukraine", PK: "Pakistan", BD: "Bangladesh", NG: "Nigeria", ZA: "South Africa",
  EG: "Egypt", AR: "Argentina", CL: "Chile", CO: "Colombia", ID: "Indonesia",
  TH: "Thailand", MY: "Malaysia", SG: "Singapore", PH: "Philippines",
  HK: "Hong Kong", TW: "Taiwan", NZ: "New Zealand", IE: "Ireland",
  IL: "Israel", AE: "UAE", SA: "Saudi Arabia", GR: "Greece", RO: "Romania",
  HU: "Hungary", SK: "Slovakia", HR: "Croatia", RS: "Serbia",
};

async function fetchTodayClicks({ signal }: { signal: AbortSignal }): Promise<number> {
  try {
    const res = await fetch("/api/stats/today", { credentials: "include", signal });
    if (!res.ok) return 0;
    const data = await res.json();
    return data.clicks ?? 0;
  } catch { return 0; }
}

async function fetchLinkClicks({ signal }: { signal: AbortSignal }): Promise<Record<string, number>> {
  try {
    const res = await fetch("/api/links/clicks", { credentials: "include", signal });
    if (!res.ok) return {};
    return res.json();
  } catch { return {}; }
}

/* ── Custom Tooltip ─────────────────────────────────────────── */
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#0A0A0A] text-white px-3.5 py-2.5 rounded-xl shadow-xl text-[12px]">
      <p className="font-semibold mb-0.5">{label}</p>
      <p className="text-[#9CA3AF] flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-[#E05A3A] inline-block" />
        {payload[0].value?.toLocaleString()} clicks
      </p>
    </div>
  );
}

/* ── Main Component ─────────────────────────────────────────── */
export default function Dashboard() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [period, setPeriod] = useState<Period>("7d");
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

  const { from: allFrom, to: allTo } = getPeriodRange("all");
  const { from, to, interval } = getPeriodRange(period);

  const prevFrom = subDays(new Date(from), (period === "7d" ? 7 : period === "30d" ? 30 : 365)).toISOString().split("T")[0];
  const prevTo = subDays(new Date(from), 1).toISOString().split("T")[0];

  const { data: allStats } = useGetWorkspaceAnalytics({ from: allFrom, to: allTo });
  const { data: stats } = useGetWorkspaceAnalytics({ from, to });
  const { data: prevStats } = useGetWorkspaceAnalytics({ from: prevFrom, to: prevTo });
  const { data: todayClicks = 0 } = useQuery({ queryKey: ["stats-today"], queryFn: fetchTodayClicks, staleTime: 30_000 });
  const { data: clickCounts = {} } = useQuery({ queryKey: ["links-clicks"], queryFn: fetchLinkClicks, staleTime: 60_000 });

  const timeseriesResult = useGetWorkspaceTimeseries({ from, to, interval });
  const timeseries = useMemo(() => {
    if (!timeseriesResult.data) return [];
    return timeseriesResult.data.map((pt) => {
      let day: string;
      try {
        const d = parseISO(pt.time);
        if (interval === "month") day = format(d, "MMM");
        else if (period === "7d") day = format(d, "EEE");
        else day = format(d, "MMM d");
      } catch { day = pt.time; }
      return { ...pt, day };
    });
  }, [timeseriesResult.data, interval, period]);

  const totalLinks = links?.length ?? 0;
  const activeLinks = links?.filter((l) => l.enabled).length ?? 0;
  const latestSummary = insights?.find((i) => i.type === "weekly_summary");
  const firstName = user?.name?.split(" ")[0] ?? "";

  const clicksNow = stats?.totalClicks ?? 0;
  const clicksPrev = prevStats?.totalClicks ?? 0;
  const clickDelta = clicksPrev > 0 ? Math.round(((clicksNow - clicksPrev) / clicksPrev) * 100) : null;

  const topCountries = useMemo(() => (stats?.topCountries ?? []).slice(0, 7), [stats]);
  const maxCountryCount = Math.max(...topCountries.map((c: any) => c.count), 1);

  const topLinks = useMemo(() => {
    if (!links) return [];
    return [...links].sort((a, b) => (clickCounts[b.id] ?? 0) - (clickCounts[a.id] ?? 0)).slice(0, 5);
  }, [links, clickCounts]);

  const handleGenerateSummary = async () => {
    try {
      await summaryMutation.mutateAsync();
      queryClient.invalidateQueries({ queryKey: getGetAiInsightsQueryKey() });
    } catch (e) { console.error(e); }
  };

  const showOnboarding = !isLoading && totalLinks === 0;

  return (
    <ProtectedLayout>
      <div className="px-6 lg:px-8 py-6 max-w-[1180px] mx-auto w-full space-y-5">

        {/* ── Header ──────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-[24px] font-bold tracking-tight text-[#0A0A0A] leading-tight" suppressHydrationWarning>
              {mounted ? getGreeting() : "Welcome"}, {firstName || "there"} 👋
            </h1>
            <p className="text-[13px] text-[#9CA3AF] mt-1" suppressHydrationWarning>
              {mounted ? format(new Date(), "EEEE, MMMM d") : ""} · Here's your link performance overview
            </p>
          </div>
          <Link href="/links">
            <button className="inline-flex items-center gap-2 bg-[#0A0A0A] hover:bg-[#1F1F1F] active:scale-[0.97] text-white text-[13px] font-semibold px-4 py-2.5 rounded-xl transition-all shadow-sm shrink-0">
              <Plus className="w-3.5 h-3.5" />
              New Link
            </button>
          </Link>
        </div>

        {/* ── KPI Row ─────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Hero card — dark */}
          <div className="bg-[#0A0A0A] rounded-2xl p-4 text-white relative overflow-hidden col-span-1">
            <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: "radial-gradient(circle at 80% 20%, #E05A3A 0%, transparent 60%)" }} />
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-semibold text-white/40 uppercase tracking-wide">All-Time Clicks</span>
                <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center">
                  <MousePointerClick className="w-3.5 h-3.5 text-white" />
                </div>
              </div>
              {allStats == null ? (
                <div className="h-8 w-20 rounded-lg bg-white/10 animate-pulse" />
              ) : (
                <p className="text-[28px] font-bold leading-none tracking-tight tabular-nums">
                  {fmtK(allStats.totalClicks)}
                </p>
              )}
              <p className="text-[11px] text-white/35 mt-2">
                {allStats?.uniqueClicks != null ? `${fmtK(allStats.uniqueClicks)} unique` : " "}
              </p>
            </div>
          </div>

          <KpiCard
            label="Today"
            value={todayClicks}
            icon={<Zap className="w-4 h-4" />}
            iconBg="bg-amber-50"
            iconColor="text-amber-500"
            sublabel="clicks today"
          />
          <KpiCard
            label={period === "7d" ? "Last 7 Days" : period === "30d" ? "Last 30 Days" : "All Time"}
            value={stats?.totalClicks ?? null}
            icon={<TrendingUp className="w-4 h-4" />}
            iconBg="bg-blue-50"
            iconColor="text-blue-500"
            delta={clickDelta}
          />
          <KpiCard
            label="Active Links"
            value={isLoading ? null : activeLinks}
            icon={<LinkIcon className="w-4 h-4" />}
            iconBg="bg-emerald-50"
            iconColor="text-emerald-500"
            sublabel={isLoading || totalLinks === 0 ? undefined : `of ${totalLinks} total`}
          />
        </div>

        {/* ── Onboarding banner ───────────────────────────────── */}
        {showOnboarding && (
          <div className="bg-gradient-to-br from-[#0A0A0A] to-[#1a1a2e] rounded-2xl p-6 lg:p-8 text-white relative overflow-hidden">
            <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "20px 20px" }} />
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

        {/* ── Chart + Countries ────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Bar Chart */}
          <div className="lg:col-span-2 bg-white border border-[#ECEDF0] rounded-2xl overflow-hidden">
            <div className="px-5 pt-5 pb-3 flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-baseline gap-2">
                  <p className="text-[22px] font-bold text-[#0A0A0A] leading-none tabular-nums">
                    {fmtK(clicksNow)}
                  </p>
                  <span className="text-[13px] text-[#9CA3AF] font-medium">Total Clicks</span>
                  {clickDelta !== null && (
                    <span className={`inline-flex items-center gap-0.5 text-[12px] font-semibold ${clickDelta >= 0 ? "text-emerald-500" : "text-red-400"}`}>
                      {clickDelta >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                      {Math.abs(clickDelta)}%
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-[#C4C9D4] mt-1">Click activity over time</p>
              </div>
              {/* Period tabs */}
              <div className="flex items-center gap-1 bg-[#F3F4F6] rounded-xl p-1 shrink-0">
                {(["7d", "30d", "all"] as Period[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPeriod(p)}
                    className={`text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-all ${
                      period === p
                        ? "bg-white text-[#0A0A0A] shadow-sm"
                        : "text-[#9CA3AF] hover:text-[#6B7280]"
                    }`}
                  >
                    {p === "7d" ? "7 Days" : p === "30d" ? "30 Days" : "All time"}
                  </button>
                ))}
              </div>
            </div>

            <div className="px-2 pb-4 h-[220px]">
              {timeseries.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={timeseries} barSize={period === "all" ? 16 : period === "30d" ? 8 : 22} margin={{ top: 4, right: 12, bottom: 0, left: -24 }}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#F3F4F6" />
                    <XAxis
                      dataKey="day"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#C4C9D4", fontSize: 10, fontWeight: 500 }}
                      dy={6}
                      interval={period === "30d" ? 4 : 0}
                    />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: "#C4C9D4", fontSize: 10 }} allowDecimals={false} />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: "#F9FAFB", radius: 4 }} />
                    <Bar dataKey="clicks" radius={[5, 5, 0, 0]}>
                      {timeseries.map((_, i) => (
                        <Cell key={i} fill={CORAL} fillOpacity={0.85} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <BarChart3 className="w-8 h-8 mx-auto mb-2 text-[#E5E7EB]" />
                    <p className="text-[12px] text-[#C4C9D4]">No click data for this period</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Top Countries */}
          <div className="bg-white border border-[#ECEDF0] rounded-2xl overflow-hidden flex flex-col">
            <div className="px-5 pt-5 pb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-1 h-5 rounded-full bg-[#E05A3A]" />
                <h3 className="font-bold text-[14px] text-[#0A0A0A]">Top countries</h3>
              </div>
              <Globe className="w-4 h-4 text-[#D1D5DB]" />
            </div>
            <div className="flex-1 divide-y divide-[#F9FAFB] overflow-auto px-5 pb-4">
              {topCountries.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full py-10 gap-2 text-center">
                  <Globe className="w-8 h-8 text-[#E5E7EB]" />
                  <p className="text-[12px] text-[#C4C9D4]">No geographic data yet</p>
                </div>
              ) : (
                topCountries.map((c: any) => {
                  const pct = Math.round((c.count / maxCountryCount) * 100);
                  const name = COUNTRY_NAMES[c.label] ?? c.label;
                  const flag = getFlagEmoji(c.label);
                  return (
                    <div key={c.label} className="flex items-center gap-3 py-2.5">
                      <span className="text-[20px] leading-none shrink-0">{flag}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[12px] font-medium text-[#374151] truncate">{name}</span>
                          <span className="text-[12px] font-bold text-[#0A0A0A] tabular-nums ml-2 shrink-0">{c.count.toLocaleString()}</span>
                        </div>
                        <div className="h-1 bg-[#F3F4F6] rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-[#E05A3A] transition-all duration-500" style={{ width: `${pct}%`, opacity: 0.7 }} />
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* ── Bottom row ──────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

          {/* Top Links */}
          <div className="lg:col-span-3 bg-white rounded-2xl border border-[#ECEDF0] overflow-hidden">
            <div className="px-5 py-4 flex items-center justify-between border-b border-[#F3F4F6]">
              <div className="flex items-center gap-2">
                <div className="w-1 h-5 rounded-full bg-[#0A0A0A]" />
                <h3 className="font-bold text-[14px] text-[#0A0A0A]">Top Performing Links</h3>
              </div>
              <Link href="/links" className="text-[12px] text-[#9CA3AF] hover:text-[#0A0A0A] font-medium flex items-center gap-1 transition-colors">
                View all <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            {/* Column headers */}
            <div className="grid grid-cols-[auto_1fr_auto] gap-3 px-5 py-2 border-b border-[#F9FAFB]">
              <span className="text-[10px] font-bold text-[#D1D5DB] uppercase tracking-wider w-4">#</span>
              <span className="text-[10px] font-bold text-[#D1D5DB] uppercase tracking-wider">Link</span>
              <span className="text-[10px] font-bold text-[#D1D5DB] uppercase tracking-wider">Clicks</span>
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

          {/* AI Insights */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-[#ECEDF0] overflow-hidden flex flex-col">
            <div className="px-5 py-4 flex items-center justify-between border-b border-[#F3F4F6]">
              <div className="flex items-center gap-2">
                <div className="w-1 h-5 rounded-full bg-purple-400" />
                <h3 className="font-bold text-[14px] text-[#0A0A0A] flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                  AI Insights
                </h3>
              </div>
              <button
                onClick={handleGenerateSummary}
                disabled={summaryMutation.isPending}
                className="inline-flex items-center gap-1.5 text-[11px] font-semibold bg-purple-50 hover:bg-purple-100 text-purple-600 px-3 py-1.5 rounded-lg disabled:opacity-40 transition-colors"
              >
                {summaryMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
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
                  <div className="flex-1 text-[13px] text-[#4B5563] leading-[1.7] overflow-auto max-h-52">
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

        {/* ── Quick Actions ────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { icon: Plus, label: "New Link", desc: "Shorten a URL instantly", href: "/links", bg: "bg-[#0A0A0A]", iconColor: "text-white", dark: true },
            { icon: BarChart3, label: "Analytics", desc: "Deep dive into traffic", href: "/analytics", bg: "bg-blue-50", iconColor: "text-blue-600" },
            { icon: Globe, label: "Domains", desc: "Add a custom domain", href: "/domains", bg: "bg-emerald-50", iconColor: "text-emerald-600" },
            { icon: Sparkles, label: "AI Insights", desc: "Smart weekly summaries", href: "/ai", bg: "bg-purple-50", iconColor: "text-purple-600" },
          ].map((a) => (
            <Link key={a.href} href={a.href}>
              <div className="group flex items-center gap-3 bg-white hover:bg-[#FAFAFA] border border-[#ECEDF0] hover:border-[#D1D5DB] rounded-xl p-3.5 cursor-pointer transition-all hover:shadow-sm">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${a.bg} ${a.iconColor}`}>
                  <a.icon className="w-3.5 h-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-bold text-[#0A0A0A]">{a.label}</p>
                  <p className="text-[10px] text-[#9CA3AF] truncate">{a.desc}</p>
                </div>
                <ArrowRight className="w-3 h-3 text-[#E5E7EB] group-hover:text-[#9CA3AF] group-hover:translate-x-0.5 transition-all shrink-0" />
              </div>
            </Link>
          ))}
        </div>

      </div>
    </ProtectedLayout>
  );
}

/* ── KPI Card ──────────────────────────────────────────────── */
function KpiCard({ label, value, icon, iconBg, iconColor, delta, sublabel }: {
  label: string;
  value: number | null;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  delta?: number | null;
  sublabel?: string;
}) {
  return (
    <div className="bg-white border border-[#ECEDF0] rounded-2xl p-4 hover:shadow-md transition-all group cursor-default">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wide">{label}</span>
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${iconBg} ${iconColor}`}>
          {icon}
        </div>
      </div>
      {value === null ? (
        <div className="h-8 w-16 rounded-lg bg-[#F3F4F6] animate-pulse" />
      ) : (
        <p className="text-[26px] font-bold text-[#0A0A0A] leading-none tracking-tight tabular-nums">
          {fmtK(value)}
        </p>
      )}
      <div className="mt-1.5 h-4">
        {delta !== null && delta !== undefined ? (
          <span className={`inline-flex items-center gap-0.5 text-[11px] font-semibold ${delta >= 0 ? "text-emerald-500" : "text-red-400"}`}>
            {delta >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {Math.abs(delta)}% <span className="text-[#D1D5DB] font-normal">vs prior</span>
          </span>
        ) : sublabel ? (
          <span className="text-[11px] text-[#C4C9D4]">{sublabel}</span>
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

  const pct = Math.max((clicks / maxClicks) * 100, 4);

  return (
    <div className="flex items-center gap-3 px-5 py-3.5 hover:bg-[#FAFAFA] transition-colors group">
      {/* Rank */}
      <span className="text-[11px] font-bold text-[#E5E7EB] w-4 shrink-0 text-center tabular-nums">{rank}</span>

      {/* Link info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1.5">
          <p className="text-[13px] font-semibold text-[#0A0A0A] truncate">
            {domainName ?? "/"}{link.slug}
          </p>
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${link.enabled ? "bg-emerald-50 text-emerald-600" : "bg-gray-100 text-gray-400"}`}>
            {link.enabled ? "LIVE" : "OFF"}
          </span>
        </div>
        {/* Progress bar */}
        <div className="h-1 bg-[#F3F4F6] rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: CORAL, opacity: 0.6 }} />
        </div>
      </div>

      {/* Clicks + actions */}
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="text-[14px] font-bold text-[#0A0A0A] tabular-nums min-w-[32px] text-right">{clicks.toLocaleString()}</span>
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={copyLink} className="p-1.5 rounded-lg hover:bg-[#F3F4F6] transition-colors" title="Copy link">
            {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 text-[#C4C9D4]" />}
          </button>
          <a href={shortUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="p-1.5 rounded-lg hover:bg-[#F3F4F6] transition-colors">
            <ExternalLink className="w-3.5 h-3.5 text-[#C4C9D4]" />
          </a>
        </div>
      </div>
    </div>
  );
}
