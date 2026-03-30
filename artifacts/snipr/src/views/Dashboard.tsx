"use client";
import { useMemo, useState, useEffect } from "react";
import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import {
  useGetLinks, useGetAiInsights, useGenerateWeeklySummary,
  getGetAiInsightsQueryKey, useGetWorkspaceAnalytics,
  useGetWorkspaceTimeseries, useGetDomains,
} from "@workspace/api-client-react";
import {
  LinkIcon, Sparkles, Loader2, ArrowRight, Plus,
  BarChart3, Zap, MousePointerClick, ExternalLink, RefreshCw,
  ArrowUpRight, ArrowDownRight, Globe, Copy, CheckCircle2,
  Rocket, Monitor, Smartphone, Activity, Chrome, Wifi,
  Users, TrendingUp, Calendar, Eye,
} from "lucide-react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";
import { format, parseISO, subDays } from "date-fns";
import dynamic from "next/dynamic";
const DashboardAreaChart = dynamic(
  () => import("@/components/charts/DashboardAreaChart"),
  { ssr: false }
);

/* ─── period helpers ───────────────────────────────────────── */
type Period = "7d" | "30d" | "3m" | "all";

function getPeriodConfig(p: Period) {
  const today = new Date();
  const iso = (d: Date) => d.toISOString().split("T")[0];
  if (p === "7d")  return { from: iso(subDays(today, 6)),  to: iso(today), interval: "day"   as const, days: 7   };
  if (p === "30d") return { from: iso(subDays(today, 29)), to: iso(today), interval: "day"   as const, days: 30  };
  if (p === "3m")  return { from: iso(subDays(today, 89)), to: iso(today), interval: "week"  as const, days: 90  };
  return           { from: iso(subDays(today, 364)),        to: iso(today), interval: "month" as const, days: 365 };
}

function fmtNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 10_000)    return (n / 1_000).toFixed(0) + "K";
  if (n >= 1_000)     return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return n.toLocaleString();
}

function fmtDay(time: string, interval: string, p: Period): string {
  try {
    const d = parseISO(time);
    if (interval === "month") return format(d, "MMM ''yy");
    if (p === "7d")           return format(d, "EEE");
    if (p === "3m")           return format(d, "MMM d");
    return format(d, "MMM d");
  } catch { return time; }
}

function getFlagEmoji(code: string): string {
  if (!code || code.length !== 2) return "🌍";
  return String.fromCodePoint(...[...code.toUpperCase()].map(c => 0x1f1e6 + c.charCodeAt(0) - 65));
}

function cleanReferrer(r: string): string {
  if (!r || r === "(none)" || r === "(direct)") return "Direct";
  try { return new URL(r.startsWith("http") ? r : `https://${r}`).hostname.replace(/^www\./, ""); }
  catch { return r.slice(0, 32); }
}

const COUNTRY: Record<string, string> = {
  US:"United States", GB:"United Kingdom", DE:"Germany", FR:"France",
  NL:"Netherlands", IT:"Italy", VN:"Vietnam", CA:"Canada", AU:"Australia",
  JP:"Japan", CN:"China", KR:"South Korea", BR:"Brazil", MX:"Mexico",
  IN:"India", ES:"Spain", PL:"Poland", SE:"Sweden", NO:"Norway",
  DK:"Denmark", FI:"Finland", CH:"Switzerland", AT:"Austria", BE:"Belgium",
  PT:"Portugal", CZ:"Czech Republic", TR:"Turkey", RU:"Russia", UA:"Ukraine",
  PK:"Pakistan", BD:"Bangladesh", NG:"Nigeria", ZA:"South Africa", EG:"Egypt",
  AR:"Argentina", CL:"Chile", CO:"Colombia", ID:"Indonesia", TH:"Thailand",
  MY:"Malaysia", SG:"Singapore", PH:"Philippines", HK:"Hong Kong", TW:"Taiwan",
  NZ:"New Zealand", IE:"Ireland", IL:"Israel", AE:"UAE", SA:"Saudi Arabia",
  GR:"Greece", RO:"Romania", HU:"Hungary", SK:"Slovakia", HR:"Croatia",
};

async function fetchTodayClicks({ signal }: { signal: AbortSignal }): Promise<number> {
  try {
    const r = await fetch("/api/stats/today", { credentials: "include", signal });
    if (!r.ok) return 0;
    return (await r.json()).clicks ?? 0;
  } catch { return 0; }
}
async function fetchLinkClicks({ signal }: { signal: AbortSignal }): Promise<Record<string, number>> {
  try {
    const r = await fetch("/api/links/clicks", { credentials: "include", signal });
    if (!r.ok) return {};
    return r.json();
  } catch { return {}; }
}

/* ─── main dashboard ───────────────────────────────────────── */
export default function Dashboard() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [origin, setOrigin] = useState("");
  const [period, setPeriod] = useState<Period>("30d");
  const [breakdownTab, setBreakdownTab] = useState<"browser" | "device" | "os">("browser");

  useEffect(() => { setMounted(true); setOrigin(window.location.origin); }, []);

  const ST5 = 5 * 60 * 1000;
  const { data: links, isLoading } = useGetLinks(undefined, { query: { staleTime: ST5 } });
  const { data: allDomains } = useGetDomains({ query: { staleTime: ST5 } });
  const domainMap = useMemo(() => {
    const m: Record<string, string> = {};
    allDomains?.forEach((d: any) => { if (d.id) m[d.id] = d.domain; });
    return m;
  }, [allDomains]);

  const { data: aiInsights } = useGetAiInsights({ limit: 10 }, { query: { staleTime: ST5 } });
  const summaryMutation = useGenerateWeeklySummary();

  const { from, to, interval, days } = getPeriodConfig(period);
  const prevFrom = subDays(new Date(from), days).toISOString().split("T")[0];
  const prevTo   = subDays(new Date(from), 1).toISOString().split("T")[0];

  const allStatsFrom = useMemo(() => subDays(new Date(), 364).toISOString().split("T")[0], []);
  const { data: allStats }  = useGetWorkspaceAnalytics(
    { from: allStatsFrom, to: new Date().toISOString().split("T")[0] },
    { query: { staleTime: 10 * 60 * 1000 } }
  );
  const { data: stats }     = useGetWorkspaceAnalytics({ from, to }, { query: { staleTime: ST5 } });
  const { data: prevStats } = useGetWorkspaceAnalytics({ from: prevFrom, to: prevTo }, { query: { staleTime: ST5 } });
  const { data: todayClicks = 0 } = useQuery({ queryKey: ["stats-today"], queryFn: fetchTodayClicks, staleTime: 30_000 });
  const { data: clickCounts = {} } = useQuery({ queryKey: ["links-clicks"], queryFn: fetchLinkClicks, staleTime: 60_000 });

  const tsResult = useGetWorkspaceTimeseries({ from, to, interval }, { query: { staleTime: ST5 } });
  const timeseries = useMemo(() => {
    if (!tsResult.data) return [];
    return tsResult.data.map(pt => ({ ...pt, day: fmtDay(pt.time, interval, period) }));
  }, [tsResult.data, interval, period]);

  const totalLinks  = links?.length ?? 0;
  const activeLinks = links?.filter((l) => l.enabled).length ?? 0;
  const firstName   = user?.name?.split(" ")[0] ?? "there";
  const latestAI    = aiInsights?.find((i) => i.type === "weekly_summary");

  const clicksNow  = stats?.totalClicks ?? 0;
  const clicksPrev = prevStats?.totalClicks ?? 0;
  const delta      = clicksPrev > 0 ? Math.round(((clicksNow - clicksPrev) / clicksPrev) * 100) : null;
  const allTime    = allStats?.totalClicks ?? 0;
  const uniqueNow  = stats?.uniqueClicks ?? 0;

  const topLinks = useMemo(() =>
    !links ? [] : [...links].sort((a, b) => (clickCounts[b.id] ?? 0) - (clickCounts[a.id] ?? 0)).slice(0, 6),
    [links, clickCounts]
  );
  const topCountries = useMemo(() => (stats?.topCountries ?? []).slice(0, 7), [stats]);
  const topRefs      = useMemo(() => (stats?.topReferrers ?? []).slice(0, 6), [stats]);
  const breakdownData = useMemo(() => {
    if (breakdownTab === "browser") return (stats?.topBrowsers  ?? []).slice(0, 6);
    if (breakdownTab === "device")  return (stats?.topDevices   ?? []).slice(0, 6);
    return                                 ((stats as any)?.topOs ?? []).slice(0, 6);
  }, [stats, breakdownTab]);
  const maxBreakdown = Math.max(...breakdownData.map((d: any) => d.count), 1);

  const showOnboarding = !isLoading && totalLinks === 0;

  const greeting = mounted
    ? (new Date().getHours() < 12 ? "Good morning" : new Date().getHours() < 17 ? "Good afternoon" : "Good evening")
    : "Welcome";

  return (
    <ProtectedLayout>
      <div className="min-h-full px-5 lg:px-8 py-6 space-y-5 max-w-[1200px] mx-auto w-full">

        {/* ══ HEADER ══════════════════════════════════════════════════ */}
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-[12px] font-semibold text-[#94A3B8] tracking-wide uppercase flex items-center gap-1.5" suppressHydrationWarning>
              <Calendar className="w-3.5 h-3.5" />
              {mounted ? format(new Date(), "EEEE, MMMM d, yyyy") : ""}
            </p>
            <h1 className="text-[24px] font-extrabold text-[#0F172A] tracking-tight leading-tight" suppressHydrationWarning>
              {greeting}, <span className="text-[#4F46E5]">{firstName}</span>
            </h1>
            <p className="text-[13px] text-[#64748B]">
              Here's what's happening with your links today.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {/* Today's live count */}
            <div className="hidden sm:flex items-center gap-2 bg-white border border-[#E2E8F0] rounded-xl px-3.5 py-2 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#14B8A6] opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#14B8A6]" />
              </span>
              <span className="text-[12px] font-bold text-[#0F172A] tabular-nums">{fmtNum(todayClicks)}</span>
              <span className="text-[11px] text-[#94A3B8] font-medium">today</span>
            </div>
            <Link href="/links">
              <button className="inline-flex items-center gap-2 bg-[#4F46E5] hover:bg-[#4338CA] active:scale-[0.97] text-white text-[13px] font-semibold px-4 py-2.5 rounded-xl transition-all shadow-[0_2px_8px_rgba(79,70,229,0.35)] shrink-0">
                <Plus className="w-4 h-4" />
                New Link
              </button>
            </Link>
          </div>
        </div>

        {/* ══ ONBOARDING ═══════════════════════════════════════════════ */}
        {showOnboarding && (
          <div className="relative overflow-hidden rounded-2xl border border-[#C7D2FE] bg-gradient-to-br from-[#EEF2FF] via-[#E0E7FF] to-[#EDE9FE] p-6">
            <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: "radial-gradient(circle at 1px 1px,#4F46E5 1px,transparent 0)", backgroundSize: "24px 24px" }} />
            <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-5">
              <div className="w-12 h-12 rounded-2xl bg-[#4F46E5] flex items-center justify-center shrink-0 shadow-[0_4px_12px_rgba(79,70,229,0.3)]">
                <Rocket className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <p className="font-bold text-[16px] text-[#1E1B4B]">Create your first short link</p>
                <p className="text-[13px] text-[#4338CA]/70 mt-0.5 max-w-md">Start tracking clicks, analyzing traffic sources, and understanding your audience in real time.</p>
              </div>
              <Link href="/links">
                <button className="bg-[#4F46E5] hover:bg-[#4338CA] text-white text-[13px] font-bold px-5 py-2.5 rounded-xl transition-colors shadow-[0_2px_8px_rgba(79,70,229,0.3)] shrink-0">
                  Create first link →
                </button>
              </Link>
            </div>
          </div>
        )}

        {/* ══ KPI STRIP ════════════════════════════════════════════════ */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">

          {/* All-Time Clicks — brand card */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#4F46E5] to-[#6366F1] p-5 text-white shadow-[0_4px_20px_rgba(79,70,229,0.28)]">
            <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-white/5 -translate-y-8 translate-x-8" />
            <div className="absolute bottom-0 left-0 w-20 h-20 rounded-full bg-white/5 translate-y-6 -translate-x-4" />
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-indigo-200">All-Time Clicks</span>
                <div className="w-7 h-7 rounded-lg bg-white/15 flex items-center justify-center">
                  <MousePointerClick className="w-3.5 h-3.5" />
                </div>
              </div>
              {allStats == null
                ? <div className="h-9 w-24 bg-white/20 rounded-lg animate-pulse" />
                : <p className="text-[36px] font-extrabold leading-none tabular-nums tracking-tight">{fmtNum(allTime)}</p>
              }
              <p className="text-[11px] text-indigo-200/80 mt-2.5 flex items-center gap-1">
                <Eye className="w-3 h-3" />
                {allStats?.uniqueClicks != null ? `${fmtNum(allStats.uniqueClicks)} unique visitors` : "\u00a0"}
              </p>
            </div>
          </div>

          <KpiCard
            label="Period Clicks"
            sublabel={period === "7d" ? "Last 7 days" : period === "30d" ? "Last 30 days" : period === "3m" ? "Last 3 months" : "All time"}
            value={stats?.totalClicks ?? null}
            delta={delta}
            icon={<TrendingUp className="w-4 h-4" />}
            accent="#4F46E5"
            accentBg="#EEF2FF"
            iconColor="#4F46E5"
          />
          <KpiCard
            label="Unique Visitors"
            sublabel={period === "7d" ? "Last 7 days" : period === "30d" ? "Last 30 days" : period === "3m" ? "Last 3 months" : "All time"}
            value={uniqueNow}
            icon={<Users className="w-4 h-4" />}
            accent="#0EA5E9"
            accentBg="#F0F9FF"
            iconColor="#0EA5E9"
          />
          <KpiCard
            label="Active Links"
            sublabel={isLoading ? undefined : `${totalLinks} total links`}
            value={isLoading ? null : activeLinks}
            icon={<LinkIcon className="w-4 h-4" />}
            accent="#14B8A6"
            accentBg="#F0FDFA"
            iconColor="#14B8A6"
          />
        </div>

        {/* ══ AREA CHART ═══════════════════════════════════════════════ */}
        <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-[0_1px_3px_rgba(0,0,0,0.05),_0_4px_16px_rgba(0,0,0,0.04)] overflow-hidden">
          <div className="px-6 pt-5 pb-4 flex flex-wrap items-center justify-between gap-4 border-b border-[#F1F5F9]">
            <div className="flex items-center gap-5">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#94A3B8] mb-1">Click Activity</p>
                <div className="flex items-baseline gap-3">
                  <span className="text-[32px] font-extrabold text-[#0F172A] tabular-nums tracking-tight leading-none">
                    {fmtNum(clicksNow)}
                  </span>
                  <span className="text-[13px] text-[#94A3B8] font-medium">clicks</span>
                  {delta !== null && (
                    <span className={`inline-flex items-center gap-0.5 text-[11px] font-bold px-2 py-1 rounded-lg ${delta >= 0 ? "bg-[#F0FDF4] text-[#16A34A]" : "bg-[#FEF2F2] text-[#DC2626]"}`}>
                      {delta >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                      {Math.abs(delta)}%
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1 bg-[#F1F5F9] rounded-xl p-1 shrink-0">
              {(["7d","30d","3m","all"] as Period[]).map(p => (
                <button key={p} onClick={() => setPeriod(p)}
                  className={`text-[11px] font-bold px-3.5 py-1.5 rounded-lg transition-all ${period === p ? "bg-white text-[#0F172A] shadow-sm" : "text-[#94A3B8] hover:text-[#475569]"}`}>
                  {p === "7d" ? "7D" : p === "30d" ? "30D" : p === "3m" ? "3M" : "All"}
                </button>
              ))}
            </div>
          </div>

          <div className="h-[220px] px-2 pb-4 pt-2">
            {tsResult.isLoading ? (
              <div className="h-full flex items-center justify-center">
                <Loader2 className="w-5 h-5 animate-spin text-[#CBD5E1]" />
              </div>
            ) : timeseries.length > 0 ? (
              <DashboardAreaChart data={timeseries} period={period} />
            ) : (
              <div className="h-full flex flex-col items-center justify-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-[#F1F5F9] flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 text-[#CBD5E1]" />
                </div>
                <p className="text-[12px] text-[#94A3B8] font-medium">No click data for this period</p>
              </div>
            )}
          </div>
        </div>

        {/* ══ 3-COLUMN BREAKDOWN ═══════════════════════════════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Top Links */}
          <SectionCard title="Top Links" action={<Link href="/links" className="text-[11px] text-[#94A3B8] hover:text-[#4F46E5] font-semibold flex items-center gap-1 transition-colors">View all <ArrowRight className="w-3 h-3" /></Link>}>
            {isLoading ? (
              <SkeletonRows n={5} />
            ) : topLinks.length === 0 ? (
              <EmptyState icon={<LinkIcon className="w-5 h-5" />} label="No links yet" hint="Create a link to see top performers here" />
            ) : (
              <div className="space-y-0.5 mt-1">
                {topLinks.map((link, i) => {
                  const clicks   = clickCounts[link.id] ?? 0;
                  const maxC     = Math.max(...topLinks.map(l => clickCounts[l.id] ?? 0), 1);
                  const pct      = Math.max((clicks / maxC) * 100, 3);
                  const domain   = link.domainId ? domainMap[link.domainId] : null;
                  const shortUrl = domain ? `https://${domain}/${link.slug}` : `${origin}/r/${link.slug}`;
                  return (
                    <LinkRowItem key={link.id} rank={i + 1} slug={link.slug} domain={domain} shortUrl={shortUrl}
                      enabled={link.enabled} clicks={clicks} pct={pct} />
                  );
                })}
              </div>
            )}
          </SectionCard>

          {/* Traffic Sources */}
          <SectionCard title="Traffic Sources">
            {topRefs.length === 0 ? (
              <EmptyState icon={<Wifi className="w-5 h-5" />} label="No referrer data yet" hint="Traffic sources appear after your first clicks" />
            ) : (
              <div className="space-y-3 mt-2">
                {topRefs.map((r: any, i: number) => {
                  const label = cleanReferrer(r.label);
                  const total = Math.max(...topRefs.map((x: any) => x.count), 1);
                  const pct   = Math.round((r.count / total) * 100);
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-center shrink-0">
                        <Globe className="w-3.5 h-3.5 text-[#94A3B8]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[12px] font-semibold text-[#0F172A] truncate max-w-[130px]">{label}</span>
                          <span className="text-[11px] text-[#475569] tabular-nums font-semibold ml-2 shrink-0">{r.count.toLocaleString()}</span>
                        </div>
                        <div className="h-1.5 bg-[#F1F5F9] rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-gradient-to-r from-[#4F46E5] to-[#6366F1]" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>

          {/* Audience Breakdown */}
          <SectionCard
            title="Audience Breakdown"
            action={
              <div className="flex gap-0.5 bg-[#F1F5F9] rounded-lg p-0.5">
                {(["browser","device","os"] as const).map(t => (
                  <button key={t} onClick={() => setBreakdownTab(t)}
                    className={`text-[10px] font-bold px-2.5 py-1 rounded-md transition-all capitalize ${breakdownTab === t ? "bg-white text-[#0F172A] shadow-sm" : "text-[#94A3B8]"}`}>
                    {t === "os" ? "OS" : t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>
            }
          >
            {breakdownData.length === 0 ? (
              <EmptyState icon={<Monitor className="w-5 h-5" />} label="No data yet" hint="Device breakdown appears after your first clicks" />
            ) : (
              <div className="space-y-3 mt-2">
                {breakdownData.map((d: any, i: number) => {
                  const pct = Math.round((d.count / maxBreakdown) * 100);
                  const ico = breakdownTab === "device"
                    ? (d.label?.toLowerCase().includes("mobile") || d.label?.toLowerCase().includes("phone")
                        ? <Smartphone className="w-3.5 h-3.5 text-[#94A3B8]" />
                        : <Monitor className="w-3.5 h-3.5 text-[#94A3B8]" />)
                    : <Chrome className="w-3.5 h-3.5 text-[#94A3B8]" />;
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-center shrink-0">
                        {ico}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[12px] font-semibold text-[#0F172A] truncate max-w-[110px]">{d.label || "Unknown"}</span>
                          <span className="text-[11px] text-[#475569] tabular-nums font-semibold shrink-0">{pct}%</span>
                        </div>
                        <div className="h-1.5 bg-[#F1F5F9] rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-gradient-to-r from-[#0EA5E9] to-[#38BDF8]" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>
        </div>

        {/* ══ COUNTRIES + AI ═══════════════════════════════════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

          {/* Geographic Distribution — 3 cols */}
          <div className="lg:col-span-3">
            <SectionCard title="Geographic Distribution">
              {topCountries.length === 0 ? (
                <EmptyState icon={<Globe className="w-5 h-5" />} label="No geographic data yet" hint="Country breakdown will appear after your first clicks" />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1 mt-2">
                  {topCountries.map((c: any) => {
                    const pct = Math.round((c.count / Math.max(...topCountries.map((x: any) => x.count), 1)) * 100);
                    return (
                      <div key={c.label} className="flex items-center gap-3 py-1.5">
                        <span className="text-[20px] leading-none shrink-0">{getFlagEmoji(c.label)}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[12px] font-semibold text-[#0F172A] truncate">{COUNTRY[c.label] ?? c.label}</span>
                            <span className="text-[11px] tabular-nums text-[#475569] font-semibold shrink-0 ml-2">{fmtNum(c.count)}</span>
                          </div>
                          <div className="h-1.5 bg-[#F1F5F9] rounded-full overflow-hidden">
                            <div className="h-full rounded-full bg-gradient-to-r from-[#14B8A6] to-[#2DD4BF]" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </SectionCard>
          </div>

          {/* AI Insights — 2 cols */}
          <div className="lg:col-span-2">
            <SectionCard
              title="AI Insights"
              titleIcon={<Sparkles className="w-3.5 h-3.5 text-[#7C3AED]" />}
              action={
                <button onClick={async () => {
                  try { await summaryMutation.mutateAsync(); queryClient.invalidateQueries({ queryKey: getGetAiInsightsQueryKey() }); }
                  catch {}
                }} disabled={summaryMutation.isPending}
                  className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide bg-[#F5F3FF] text-[#7C3AED] hover:bg-[#EDE9FE] px-2.5 py-1.5 rounded-lg transition-colors border border-[#DDD6FE] disabled:opacity-40">
                  {summaryMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                  {summaryMutation.isPending ? "Analyzing…" : "Generate"}
                </button>
              }
              minH="260px"
            >
              {summaryMutation.isPending ? (
                <div className="flex flex-col items-center justify-center flex-1 gap-3 py-10">
                  <div className="relative w-12 h-12 rounded-2xl bg-[#F5F3FF] border border-[#EDE9FE] flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-[#7C3AED]" />
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-[#7C3AED] rounded-full animate-ping opacity-75" />
                  </div>
                  <p className="text-[12px] text-[#94A3B8] font-medium">Analyzing your link performance…</p>
                </div>
              ) : latestAI ? (
                <div className="mt-2 flex flex-col gap-4 flex-1">
                  <div className="p-3.5 bg-[#FAFAF8] rounded-xl border border-[#E2E8F0]">
                    <p className="text-[12.5px] text-[#475569] leading-[1.75] line-clamp-6">{latestAI.content}</p>
                  </div>
                  <Link href="/ai" className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#7C3AED] hover:text-[#6D28D9] transition-colors">
                    View full insights <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center flex-1 text-center gap-4 py-8">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#F5F3FF] to-[#EEF2FF] border border-[#E9D5FF] flex items-center justify-center">
                    <Sparkles className="w-6 h-6 text-[#7C3AED]" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-[13px] font-bold text-[#1E293B]">No insights yet</p>
                    <p className="text-[11px] text-[#94A3B8] max-w-[170px] mx-auto leading-relaxed">Generate an AI-powered weekly summary of your link performance</p>
                  </div>
                  <button onClick={async () => {
                    try { await summaryMutation.mutateAsync(); queryClient.invalidateQueries({ queryKey: getGetAiInsightsQueryKey() }); }
                    catch {}
                  }} className="inline-flex items-center gap-2 text-[12px] font-bold bg-[#7C3AED] hover:bg-[#6D28D9] text-white px-4 py-2.5 rounded-xl transition-colors shadow-[0_2px_8px_rgba(124,58,237,0.3)]">
                    <Zap className="w-3.5 h-3.5" /> Generate now
                  </button>
                </div>
              )}
            </SectionCard>
          </div>
        </div>

        {/* ══ QUICK ACTIONS ═══════════════════════════════════════════ */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { icon: Plus,      label: "New Link",    desc: "Shorten a URL",      href: "/links",     accent: "#4F46E5", bg: "bg-[#4F46E5]",    dark: true },
            { icon: BarChart3, label: "Analytics",   desc: "Deep dive into data", href: "/analytics", accent: "#0EA5E9", bg: "bg-[#F0F9FF]",    iconColor: "text-[#0EA5E9]" },
            { icon: Globe,     label: "Domains",     desc: "Manage domains",      href: "/domains",   accent: "#14B8A6", bg: "bg-[#F0FDFA]",    iconColor: "text-[#14B8A6]" },
            { icon: Sparkles,  label: "AI Insights", desc: "Weekly summary",      href: "/ai",        accent: "#7C3AED", bg: "bg-[#F5F3FF]",    iconColor: "text-[#7C3AED]" },
          ].map(a => (
            <Link key={a.href} href={a.href}>
              <div className={`group flex items-center gap-3 rounded-xl p-4 cursor-pointer transition-all border ${a.dark ? "bg-[#4F46E5] border-[#4338CA] hover:bg-[#4338CA] shadow-[0_2px_8px_rgba(79,70,229,0.25)]" : "bg-white border-[#E2E8F0] hover:border-[#C7D2FE] hover:shadow-[0_2px_8px_rgba(79,70,229,0.08)]"}`}>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${a.dark ? "bg-white/15" : a.bg} ${a.dark ? "text-white" : (a as any).iconColor}`}>
                  <a.icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-[12px] font-bold ${a.dark ? "text-white" : "text-[#0F172A]"}`}>{a.label}</p>
                  <p className={`text-[10px] truncate mt-0.5 ${a.dark ? "text-indigo-200" : "text-[#94A3B8]"}`}>{a.desc}</p>
                </div>
                <ArrowRight className={`w-3.5 h-3.5 shrink-0 group-hover:translate-x-0.5 transition-transform ${a.dark ? "text-indigo-200" : "text-[#CBD5E1]"}`} />
              </div>
            </Link>
          ))}
        </div>

      </div>
    </ProtectedLayout>
  );
}

/* ─── sub-components ───────────────────────────────────────── */
function SectionCard({ title, titleIcon, action, children, minH }: {
  title: string; titleIcon?: React.ReactNode; action?: React.ReactNode;
  children: React.ReactNode; minH?: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-[0_1px_3px_rgba(0,0,0,0.05),_0_4px_16px_rgba(0,0,0,0.04)] overflow-hidden h-full flex flex-col" style={minH ? { minHeight: minH } : undefined}>
      <div className="px-5 pt-4 pb-3 flex items-center justify-between shrink-0 border-b border-[#F1F5F9]">
        <p className="text-[11px] font-bold uppercase tracking-[0.09em] text-[#94A3B8] flex items-center gap-1.5">
          {titleIcon}{title}
        </p>
        {action}
      </div>
      <div className="px-5 pb-5 flex-1 flex flex-col">{children}</div>
    </div>
  );
}

function KpiCard({ label, sublabel, value, delta, icon, accent, accentBg, iconColor }: {
  label: string; sublabel?: string; value: number | null;
  delta?: number | null; icon: React.ReactNode;
  accent: string; accentBg: string; iconColor: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-[0_1px_3px_rgba(0,0,0,0.05),_0_4px_16px_rgba(0,0,0,0.04)] p-5 relative overflow-hidden">
      {/* Subtle accent top bar */}
      <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl" style={{ background: `linear-gradient(90deg, ${accent}, ${accent}88)` }} />
      <div className="flex items-start justify-between mb-4">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#94A3B8]">{label}</span>
          {sublabel && (
            <p className="text-[10px] text-[#CBD5E1] mt-0.5 font-medium">{sublabel}</p>
          )}
        </div>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: accentBg, color: iconColor }}>
          {icon}
        </div>
      </div>
      {value === null
        ? <div className="h-9 w-20 bg-[#F1F5F9] rounded-lg animate-pulse" />
        : <p className="text-[30px] font-extrabold text-[#0F172A] leading-none tabular-nums tracking-tight">{fmtNum(value)}</p>
      }
      <div className="mt-2 h-5 flex items-center">
        {delta !== null && delta !== undefined ? (
          <span className={`inline-flex items-center gap-0.5 text-[11px] font-bold px-2 py-0.5 rounded-lg ${delta >= 0 ? "bg-[#F0FDF4] text-[#16A34A]" : "bg-[#FEF2F2] text-[#DC2626]"}`}>
            {delta >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {Math.abs(delta)}% <span className="font-normal text-[#94A3B8] ml-0.5">vs prior</span>
          </span>
        ) : null}
      </div>
    </div>
  );
}

function SkeletonRows({ n }: { n: number }) {
  return (
    <div className="space-y-3 mt-3">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="flex items-center gap-2.5 animate-pulse">
          <div className="w-4 h-4 bg-[#F1F5F9] rounded" />
          <div className="flex-1 h-3 bg-[#F1F5F9] rounded" />
          <div className="w-8 h-3 bg-[#F1F5F9] rounded" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ icon, label, hint }: { icon: React.ReactNode; label: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2.5 py-10 text-center flex-1">
      <div className="w-11 h-11 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-center text-[#CBD5E1]">
        {icon}
      </div>
      <div>
        <p className="text-[12px] font-semibold text-[#475569]">{label}</p>
        {hint && <p className="text-[11px] text-[#94A3B8] mt-0.5 max-w-[160px] mx-auto leading-relaxed">{hint}</p>}
      </div>
    </div>
  );
}

function LinkRowItem({ rank, slug, domain, shortUrl, enabled, clicks, pct }: {
  rank: number; slug: string; domain: string | null; shortUrl: string;
  enabled: boolean; clicks: number; pct: number;
}) {
  const [copied, setCopied] = useState(false);
  function copy() { navigator.clipboard.writeText(shortUrl); setCopied(true); setTimeout(() => setCopied(false), 1500); }
  return (
    <div className="group flex items-center gap-2.5 py-2.5 rounded-xl hover:bg-[#F8FAFC] px-2 -mx-2 transition-colors cursor-default">
      <span className="text-[10px] font-bold text-[#CBD5E1] w-4 shrink-0 tabular-nums text-right">{rank}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-2">
          <p className="text-[12px] font-semibold text-[#1E293B] truncate">
            <span className="text-[#94A3B8]">{domain ? domain + "/" : ""}</span>{slug}
          </p>
          <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full shrink-0 tracking-wide ${enabled ? "bg-[#F0FDF4] text-[#16A34A]" : "bg-[#F8FAFC] text-[#94A3B8]"}`}>
            {enabled ? "LIVE" : "OFF"}
          </span>
        </div>
        <div className="h-1.5 bg-[#F1F5F9] rounded-full overflow-hidden">
          <div className="h-full rounded-full bg-gradient-to-r from-[#4F46E5] to-[#818CF8]" style={{ width: `${pct}%`, transition: "width 0.6s ease" }} />
        </div>
      </div>
      <span className="text-[13px] font-bold text-[#0F172A] tabular-nums shrink-0 min-w-[32px] text-right">{fmtNum(clicks)}</span>
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button onClick={copy} className="p-1.5 rounded-lg hover:bg-[#EEF2FF] transition-colors">
          {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-[#16A34A]" /> : <Copy className="w-3.5 h-3.5 text-[#CBD5E1]" />}
        </button>
        <a href={shortUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="p-1.5 rounded-lg hover:bg-[#EEF2FF] transition-colors">
          <ExternalLink className="w-3.5 h-3.5 text-[#CBD5E1]" />
        </a>
      </div>
    </div>
  );
}
