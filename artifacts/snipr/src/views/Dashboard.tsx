"use client";
import { useMemo, useState, useEffect } from "react";
import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import {
  useGetLinks, useGetAiInsights, useGenerateWeeklySummary,
  getGetAiInsightsQueryKey, useGetWorkspaceAnalytics,
  useGetWorkspaceTimeseries, useGetDomains,
} from "@workspace/api-client-react";
import type { Link, Domain, TopEntry, TimeseriesPoint, AiInsight } from "@workspace/api-client-react";
import {
  LinkIcon, Sparkles, Loader2, ArrowRight, Plus, BarChart3, Zap,
  MousePointerClick, ExternalLink, RefreshCw, ArrowUpRight, ArrowDownRight,
  Globe, Copy, CheckCircle2, Rocket, Monitor, Smartphone, Chrome, Wifi,
  Users, TrendingUp, Activity, Eye, MapPin, AlertTriangle, ToggleLeft,
  Share2, Clock, ChevronRight, PieChart,
} from "lucide-react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";
import { format, parseISO, subDays, formatDistanceToNow } from "date-fns";
import dynamic from "next/dynamic";

const DashboardAreaChart = dynamic(() => import("@/components/charts/DashboardAreaChart"), { ssr: false });
const DeviceDonutChart  = dynamic(() => import("@/components/charts/DeviceDonutChart"),   { ssr: false });

/* ─── types & helpers ──────────────────────────────────────── */
type Period = "7d" | "30d" | "3m" | "all";

function getPeriodConfig(p: Period) {
  const today = new Date();
  const iso = (d: Date) => d.toISOString().split("T")[0];
  if (p === "7d")  return { from: iso(subDays(today, 6)),  to: iso(today), interval: "day"   as const, days: 7   };
  if (p === "30d") return { from: iso(subDays(today, 29)), to: iso(today), interval: "day"   as const, days: 30  };
  if (p === "3m")  return { from: iso(subDays(today, 89)), to: iso(today), interval: "week"  as const, days: 90  };
  return           { from: iso(subDays(today, 364)),        to: iso(today), interval: "month" as const, days: 365 };
}

function fmtNum(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 10_000)    return (n / 1_000).toFixed(0) + "K";
  if (n >= 1_000)     return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return n.toLocaleString();
}

function fmtDay(time: string, interval: string, p: Period) {
  try {
    const d = parseISO(time);
    if (interval === "month") return format(d, "MMM ''yy");
    if (p === "7d")           return format(d, "EEE");
    if (p === "3m")           return format(d, "MMM d");
    return format(d, "MMM d");
  } catch { return time; }
}

function fmtAgo(date: string | Date) {
  try {
    return formatDistanceToNow(new Date(date), { addSuffix: true });
  } catch { return "recently"; }
}

function getFlagEmoji(code: string) {
  if (!code || code.length !== 2) return "🌍";
  return String.fromCodePoint(...[...code.toUpperCase()].map(c => 0x1f1e6 + c.charCodeAt(0) - 65));
}

function cleanReferrer(r: string) {
  if (!r || r === "(none)" || r === "(direct)") return "Direct";
  try { return new URL(r.startsWith("http") ? r : `https://${r}`).hostname.replace(/^www\./, ""); }
  catch { return r.slice(0, 30); }
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

const PERIOD_LABEL: Record<Period, string> = {
  "7d": "Last 7 days", "30d": "Last 30 days", "3m": "Last 3 months", "all": "Last 12 months",
};

async function fetchTodayClicks({ signal }: { signal: AbortSignal }): Promise<number> {
  try { const r = await fetch("/api/stats/today", { credentials: "include", signal }); return r.ok ? (await r.json()).clicks ?? 0 : 0; }
  catch { return 0; }
}
async function fetchLinkClicks({ signal }: { signal: AbortSignal }): Promise<Record<string, number>> {
  try { const r = await fetch("/api/links/clicks", { credentials: "include", signal }); return r.ok ? r.json() : {}; }
  catch { return {}; }
}

/* ─── main component ───────────────────────────────────────── */
export default function Dashboard() {
  const queryClient  = useQueryClient();
  const { user }     = useAuth();
  const [mounted, setMounted] = useState(false);
  const [origin, setOrigin]   = useState("");
  const [period, setPeriod]   = useState<Period>("30d");

  useEffect(() => { setMounted(true); setOrigin(window.location.origin); }, []);

  const ST5 = 5 * 60 * 1000;
  const { data: links, isLoading } = useGetLinks(undefined, { query: { staleTime: ST5 } });
  const { data: allDomains } = useGetDomains({ query: { staleTime: ST5 } });
  const domainMap = useMemo(() => {
    const m: Record<string, string> = {};
    allDomains?.forEach((d: Domain) => { if (d.id) m[d.id] = d.domain; });
    return m;
  }, [allDomains]);

  const { data: aiInsights } = useGetAiInsights({ limit: 5 }, { query: { staleTime: ST5 } });
  const summaryMutation      = useGenerateWeeklySummary();
  const latestAI             = aiInsights?.find((i: AiInsight) => i.type === "weekly_summary");

  const { from, to, interval, days } = getPeriodConfig(period);
  const prevFrom = subDays(new Date(from), days).toISOString().split("T")[0];
  const prevTo   = subDays(new Date(from), 1).toISOString().split("T")[0];

  const allStatsFrom = useMemo(() => subDays(new Date(), 364).toISOString().split("T")[0], []);
  const { data: allStats }  = useGetWorkspaceAnalytics({ from: allStatsFrom, to: new Date().toISOString().split("T")[0] }, { query: { staleTime: 10 * 60 * 1000 } });
  const { data: stats }     = useGetWorkspaceAnalytics({ from, to }, { query: { staleTime: ST5 } });
  const { data: prevStats } = useGetWorkspaceAnalytics({ from: prevFrom, to: prevTo }, { query: { staleTime: ST5 } });
  const { data: todayClicks = 0 } = useQuery({ queryKey: ["stats-today"], queryFn: fetchTodayClicks, staleTime: 30_000 });
  const { data: clickCounts = {} } = useQuery({ queryKey: ["links-clicks"], queryFn: fetchLinkClicks, staleTime: 60_000 });

  const tsResult   = useGetWorkspaceTimeseries({ from, to, interval }, { query: { staleTime: ST5 } });
  const timeseries = useMemo(() => {
    if (!tsResult.data) return [];
    return (tsResult.data as TimeseriesPoint[]).map((pt) => ({ ...pt, day: fmtDay(pt.time, interval, period) }));
  }, [tsResult.data, interval, period]);

  const totalLinks  = links?.length ?? 0;
  const activeLinks = links?.filter((l: Link) => l.enabled).length ?? 0;
  const firstName   = user?.name?.split(" ")[0] ?? "there";

  const clicksNow  = stats?.totalClicks ?? 0;
  const clicksPrev = prevStats?.totalClicks ?? 0;
  const delta      = clicksPrev > 0 ? Math.round(((clicksNow - clicksPrev) / clicksPrev) * 100) : null;
  const allTime    = allStats?.totalClicks ?? 0;
  const uniqueNow  = stats?.uniqueClicks ?? 0;

  const topLinks = useMemo(() =>
    !links ? [] : [...links].sort((a: Link, b: Link) => (clickCounts[b.id] ?? 0) - (clickCounts[a.id] ?? 0)).slice(0, 7),
    [links, clickCounts]
  );
  const topCountries = useMemo(() => (stats?.topCountries ?? []).slice(0, 8), [stats]);
  const topRefs      = useMemo(() => (stats?.topReferrers ?? []).slice(0, 7), [stats]);
  const topDevices   = useMemo(() => (stats?.topDevices   ?? []).slice(0, 5), [stats]);

  const recentLinks  = useMemo(() =>
    !links ? [] : [...links].sort((a: Link, b: Link) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5),
    [links]
  );
  const disabledLinks   = useMemo(() => (!links ? [] : links.filter((l: Link) => !l.enabled).slice(0, 4)), [links]);
  const zeroClickLinks  = useMemo(() => (!links ? [] : links.filter((l: Link) => (clickCounts[l.id] ?? 0) === 0 && l.enabled).slice(0, 4)), [links, clickCounts]);

  /* ── new insight KPI derivations ── */
  const topLinkEntry   = topLinks[0] ?? null;
  const topLinkClicks  = topLinkEntry ? (clickCounts[topLinkEntry.id] ?? 0) : 0;
  const topLinkDomain  = topLinkEntry?.domainId ? domainMap[topLinkEntry.domainId] : null;
  const topLinkDisplay = topLinkDomain ? `${topLinkDomain}/${topLinkEntry?.slug}` : (topLinkEntry?.slug ?? "—");
  const topLinkAllPct  = allTime > 0 && topLinkClicks > 0 ? Math.round((topLinkClicks / allTime) * 100) : 0;

  const topCountryEntry: TopEntry | null = topCountries[0] ?? null;
  const topCountryTotal = topCountries.reduce((s: number, c: TopEntry) => s + c.count, 0) || 1;
  const topCountryPct   = topCountryEntry ? Math.round((topCountryEntry.count / topCountryTotal) * 100) : 0;

  const topDeviceEntry: TopEntry | undefined = topDevices[0];
  const topDeviceTotal  = topDevices.reduce((s: number, d: TopEntry) => s + d.count, 0) || 1;
  const topDevicePct    = topDeviceEntry ? Math.round((topDeviceEntry.count / topDeviceTotal) * 100) : 0;

  const domainCount     = allDomains?.length ?? 0;

  const showOnboarding  = !isLoading && totalLinks === 0;

  return (
    <ProtectedLayout>
      <div className="min-h-full px-5 lg:px-8 pt-6 pb-12 space-y-4 max-w-[1280px] mx-auto w-full">

        {/* ════════════════════════════════════════════════════════
            A — HEADER
        ════════════════════════════════════════════════════════ */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-[24px] font-extrabold text-[#0F172A] tracking-tight leading-none">
              Dashboard
            </h1>
            <p className="text-[13px] text-[#64748B] mt-1" suppressHydrationWarning>
              {mounted
                ? (new Date().getHours() < 12 ? "Good morning" : new Date().getHours() < 17 ? "Good afternoon" : "Good evening")
                : "Welcome back"
              }, <span className="font-semibold text-[#475569]">{firstName}</span>
              {mounted ? ` · ${format(new Date(), "EEE, MMM d")}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="hidden sm:flex items-center gap-0.5 bg-[#F1F5F9] rounded-xl p-1 border border-[#E2E8F0]">
              {(["7d","30d","3m","all"] as Period[]).map(p => (
                <button key={p} onClick={() => setPeriod(p)}
                  className={`text-[11px] font-bold px-3 py-1.5 rounded-lg transition-all ${period === p ? "bg-white text-[#0F172A] shadow-sm" : "text-[#94A3B8] hover:text-[#475569]"}`}>
                  {p === "7d" ? "7D" : p === "30d" ? "30D" : p === "3m" ? "3M" : "1Y"}
                </button>
              ))}
            </div>
            <Link href="/links">
              <button className="inline-flex items-center gap-1.5 bg-[#4F46E5] hover:bg-[#4338CA] active:scale-[0.97] text-white text-[13px] font-semibold px-4 py-2.5 rounded-xl transition-all shadow-[0_2px_12px_rgba(79,70,229,0.3)]">
                <Plus className="w-3.5 h-3.5" /> New Link
              </button>
            </Link>
          </div>
        </div>

        {/* onboarding */}
        {showOnboarding && (
          <div className="rounded-2xl border border-[#C7D2FE] bg-gradient-to-r from-[#EEF2FF] to-[#F5F3FF] p-5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-[#4F46E5] flex items-center justify-center shrink-0 shadow-[0_4px_10px_rgba(79,70,229,0.28)]">
                <Rocket className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <p className="font-bold text-[14px] text-[#1E1B4B]">Create your first short link to unlock insights</p>
                <p className="text-[12px] text-[#4338CA]/70 mt-0.5">Track clicks, see traffic sources, and understand your audience in real time.</p>
              </div>
              <Link href="/links">
                <button className="bg-[#4F46E5] hover:bg-[#4338CA] text-white text-[12px] font-bold px-4 py-2 rounded-lg transition-colors shadow-sm shrink-0">
                  Create first link →
                </button>
              </Link>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════
            B — HERO: split card (metrics + chart)
        ════════════════════════════════════════════════════════ */}
        <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.06)] overflow-hidden">
          <div className="flex flex-col lg:flex-row">
            {/* left panel */}
            <div className="lg:w-[252px] shrink-0 bg-[#F8FAFC] border-b lg:border-b-0 lg:border-r border-[#E2E8F0] px-6 py-5 flex flex-col gap-4">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#94A3B8]">Click Activity</p>
                <p className="text-[10px] text-[#CBD5E1] mt-0.5">{PERIOD_LABEL[period]}</p>
              </div>
              <div>
                {stats == null
                  ? <div className="h-11 w-28 bg-[#E2E8F0] rounded-xl animate-pulse" />
                  : <p className="text-[42px] font-extrabold text-[#0F172A] leading-none tabular-nums tracking-tight">{fmtNum(clicksNow)}</p>
                }
                {delta !== null && (
                  <span className={`inline-flex items-center gap-0.5 text-[11px] font-bold mt-2 px-2 py-1 rounded-lg ${delta >= 0 ? "bg-[#F0FDF4] text-[#16A34A]" : "bg-[#FEF2F2] text-[#DC2626]"}`}>
                    {delta >= 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                    {Math.abs(delta)}% vs prior
                  </span>
                )}
              </div>
              <div className="space-y-2.5 border-t border-[#E2E8F0] pt-4">
                <HeroStat icon={<Eye className="w-3.5 h-3.5" />}       label="Unique visitors"  value={stats == null ? "—" : fmtNum(uniqueNow)} />
                <HeroStat icon={<Activity className="w-3.5 h-3.5" />}  label="Today's clicks"   value={fmtNum(todayClicks)} accent />
                <HeroStat icon={<MapPin className="w-3.5 h-3.5" />}    label="Countries"        value={topCountries.length > 0 ? String(topCountries.length) : "—"} />
                <HeroStat icon={<MousePointerClick className="w-3.5 h-3.5" />} label="All-time" value={allStats == null ? "—" : fmtNum(allTime)} />
              </div>
            </div>
            {/* right panel: chart */}
            <div className="flex-1 flex flex-col min-h-[240px]">
              <div className="flex sm:hidden items-center justify-between px-5 pt-3 pb-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">Trend</p>
                <div className="flex gap-0.5 bg-[#F1F5F9] rounded-lg p-0.5">
                  {(["7d","30d","3m","all"] as Period[]).map(p => (
                    <button key={p} onClick={() => setPeriod(p)}
                      className={`text-[9px] font-bold px-2 py-1 rounded-md transition-all ${period === p ? "bg-white text-[#0F172A] shadow-sm" : "text-[#94A3B8]"}`}>
                      {p === "7d" ? "7D" : p === "30d" ? "30D" : p === "3m" ? "3M" : "1Y"}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex-1 px-3 py-4">
                {tsResult.isLoading
                  ? <div className="h-full flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-[#CBD5E1]" /></div>
                  : timeseries.length > 0
                    ? <DashboardAreaChart data={timeseries} period={period} />
                    : <ChartEmpty />
                }
              </div>
            </div>
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════
            C — INSIGHT KPI BAND (new KPIs)
        ════════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Top Link */}
          <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_14px_rgba(0,0,0,0.05)] p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#94A3B8]">Top Link</p>
              <div className="w-7 h-7 rounded-lg bg-[#EEF2FF] flex items-center justify-center">
                <TrendingUp className="w-3.5 h-3.5 text-[#4F46E5]" />
              </div>
            </div>
            {isLoading
              ? <div className="h-8 w-28 bg-[#F1F5F9] rounded animate-pulse" />
              : topLinkEntry
                ? <>
                    <p className="text-[13px] font-bold text-[#0F172A] truncate leading-none mb-1.5" title={topLinkDisplay}>{topLinkDisplay}</p>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] text-[#94A3B8]">{fmtNum(topLinkClicks)} clicks</span>
                      {topLinkAllPct > 0 && <span className="text-[10px] font-bold text-[#4F46E5]">{topLinkAllPct}%</span>}
                    </div>
                    <div className="h-1 bg-[#F1F5F9] rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-[#4F46E5]" style={{ width: `${Math.min(topLinkAllPct * 2, 100)}%` }} />
                    </div>
                  </>
                : <p className="text-[12px] text-[#94A3B8] mt-1">No links yet</p>
            }
          </div>

          {/* Top Country */}
          <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_14px_rgba(0,0,0,0.05)] p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#94A3B8]">Top Country</p>
              <div className="w-7 h-7 rounded-lg bg-[#F0FDFA] flex items-center justify-center">
                <Globe className="w-3.5 h-3.5 text-[#14B8A6]" />
              </div>
            </div>
            {topCountryEntry
              ? <>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-[20px] leading-none">{getFlagEmoji(topCountryEntry.label)}</span>
                    <p className="text-[13px] font-bold text-[#0F172A] truncate leading-none">{COUNTRY[topCountryEntry.label] ?? topCountryEntry.label}</p>
                  </div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] text-[#94A3B8]">{fmtNum(topCountryEntry.count)} visits</span>
                    <span className="text-[10px] font-bold text-[#14B8A6]">{topCountryPct}%</span>
                  </div>
                  <div className="h-1 bg-[#F1F5F9] rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-[#14B8A6]" style={{ width: `${topCountryPct}%` }} />
                  </div>
                </>
              : <p className="text-[12px] text-[#94A3B8] mt-1">No data yet</p>
            }
          </div>

          {/* Best Device */}
          <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_14px_rgba(0,0,0,0.05)] p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#94A3B8]">Best Device</p>
              <div className="w-7 h-7 rounded-lg bg-[#F0F9FF] flex items-center justify-center">
                {topDeviceEntry?.label?.toLowerCase().includes("mobile") || topDeviceEntry?.label?.toLowerCase().includes("phone")
                  ? <Smartphone className="w-3.5 h-3.5 text-[#0EA5E9]" />
                  : <Monitor className="w-3.5 h-3.5 text-[#0EA5E9]" />}
              </div>
            </div>
            {topDeviceEntry
              ? <>
                  <p className="text-[13px] font-bold text-[#0F172A] truncate leading-none mb-1.5">{topDeviceEntry.label || "Unknown"}</p>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] text-[#94A3B8]">{fmtNum(topDeviceEntry.count)} sessions</span>
                    <span className="text-[10px] font-bold text-[#0EA5E9]">{topDevicePct}%</span>
                  </div>
                  <div className="h-1 bg-[#F1F5F9] rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-[#0EA5E9]" style={{ width: `${topDevicePct}%` }} />
                  </div>
                </>
              : <p className="text-[12px] text-[#94A3B8] mt-1">No data yet</p>
            }
          </div>

          {/* Domain Health */}
          <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_14px_rgba(0,0,0,0.05)] p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#94A3B8]">Domain Health</p>
              <div className="w-7 h-7 rounded-lg bg-[#FFFBEB] flex items-center justify-center">
                <Globe className="w-3.5 h-3.5 text-[#F59E0B]" />
              </div>
            </div>
            {domainCount > 0
              ? <>
                  <p className="text-[22px] font-extrabold text-[#0F172A] leading-none tabular-nums">{domainCount}</p>
                  <p className="text-[11px] text-[#94A3B8] mt-1">{domainCount === 1 ? "custom domain" : "custom domains"}</p>
                  <div className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold text-[#16A34A] bg-[#F0FDF4] px-2 py-0.5 rounded-full">
                    <CheckCircle2 className="w-3 h-3" /> Active
                  </div>
                </>
              : <>
                  <p className="text-[13px] font-semibold text-[#475569] leading-tight">No custom domain</p>
                  <p className="text-[10px] text-[#94A3B8] mt-0.5 mb-2">Use your own brand URL</p>
                  <Link href="/domains">
                    <button className="text-[10px] font-bold text-[#4F46E5] hover:text-[#4338CA] flex items-center gap-0.5 transition-colors">
                      Set up now <ChevronRight className="w-3 h-3" />
                    </button>
                  </Link>
                </>
            }
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════
            D — BENTO SECONDARY GRID
            Row A: Top Links (7) + Device Donut (5)
        ════════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

          {/* Top Performing Links — col-span-7 */}
          <div className="lg:col-span-7">
            <BentoCard
              title="Top Performing Links"
              icon={<LinkIcon className="w-3 h-3" />}
              action={<Link href="/links" className="flex items-center gap-1 text-[10px] font-semibold text-[#94A3B8] hover:text-[#4F46E5] transition-colors">View all <ArrowRight className="w-3 h-3" /></Link>}
            >
              {isLoading
                ? <SkeletonRows n={5} />
                : topLinks.length === 0
                  ? <EmptySection icon={<LinkIcon className="w-5 h-5 text-[#CBD5E1]" />} title="No links yet" hint="Create your first short link to track performance here." cta={<Link href="/links"><span className="text-[11px] font-bold text-[#4F46E5] flex items-center gap-1">Create a link <ArrowRight className="w-3 h-3" /></span></Link>} />
                  : <div className="divide-y divide-[#F8FAFC]">
                      {topLinks.map((link: Link, i: number) => {
                        const clicks = clickCounts[link.id] ?? 0;
                        const maxC   = Math.max(...topLinks.map((l: Link) => clickCounts[l.id] ?? 0), 1);
                        const pct    = Math.max((clicks / maxC) * 100, 2);
                        const domain = link.domainId ? domainMap[link.domainId] : null;
                        const shortUrl = domain ? `https://${domain}/${link.slug}` : `${origin}/r/${link.slug}`;
                        return <LinkLeaderRow key={link.id} rank={i+1} slug={link.slug} domain={domain} shortUrl={shortUrl} enabled={link.enabled} clicks={clicks} pct={pct} />;
                      })}
                    </div>
              }
            </BentoCard>
          </div>

          {/* Device Breakdown — col-span-5 */}
          <div className="lg:col-span-5">
            <BentoCard
              title="Traffic by Device"
              icon={<PieChart className="w-3 h-3" />}
            >
              <div className="flex-1 flex items-center">
                <DeviceDonutChart data={topDevices} />
              </div>
            </BentoCard>
          </div>
        </div>

        {/* Row B: Countries (5) + Traffic Sources (4) + Recent Activity (3) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

          {/* Top Countries — col-span-5 */}
          <div className="lg:col-span-5">
            <BentoCard title="Top Countries" icon={<MapPin className="w-3 h-3" />}>
              {topCountries.length === 0
                ? <EmptySection icon={<Globe className="w-5 h-5 text-[#CBD5E1]" />} title="No geographic data yet" hint="Country-level data appears after your first clicks from different regions." />
                : <div className="grid grid-cols-2 gap-x-4 gap-y-2 pt-1">
                    {topCountries.map((c: TopEntry) => {
                      const pct = Math.round((c.count / Math.max(...topCountries.map((x: TopEntry) => x.count), 1)) * 100);
                      return (
                        <div key={c.label} className="flex items-center gap-2 py-1">
                          <span className="text-[16px] shrink-0">{getFlagEmoji(c.label)}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[11px] font-semibold text-[#1E293B] truncate">{COUNTRY[c.label] ?? c.label}</span>
                              <span className="text-[10px] text-[#475569] tabular-nums font-semibold ml-1 shrink-0">{fmtNum(c.count)}</span>
                            </div>
                            <div className="h-1 bg-[#F1F5F9] rounded-full overflow-hidden">
                              <div className="h-full rounded-full bg-[#14B8A6]" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
              }
            </BentoCard>
          </div>

          {/* Traffic Sources — col-span-4 */}
          <div className="lg:col-span-4">
            <BentoCard title="Traffic Sources" icon={<Wifi className="w-3 h-3" />}>
              {topRefs.length === 0
                ? <EmptySection icon={<Wifi className="w-5 h-5 text-[#CBD5E1]" />} title="No referrer data yet" hint="Traffic sources appear when your links receive clicks from other websites or apps." />
                : <div className="space-y-2.5 pt-1">
                    {topRefs.map((r: TopEntry, i: number) => {
                      const total = Math.max(...topRefs.map((x: TopEntry) => x.count), 1);
                      const pct   = Math.round((r.count / total) * 100);
                      return (
                        <div key={i} className="flex items-center gap-2.5">
                          <div className="w-5 h-5 rounded bg-[#F1F5F9] border border-[#E2E8F0] flex items-center justify-center shrink-0">
                            <Globe className="w-2.5 h-2.5 text-[#94A3B8]" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[11px] font-semibold text-[#1E293B] truncate">{cleanReferrer(r.label)}</span>
                              <span className="text-[10px] text-[#475569] font-semibold tabular-nums ml-2 shrink-0">{r.count.toLocaleString()}</span>
                            </div>
                            <div className="h-1 bg-[#F1F5F9] rounded-full overflow-hidden">
                              <div className="h-full rounded-full bg-gradient-to-r from-[#4F46E5] to-[#818CF8]" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
              }
            </BentoCard>
          </div>

          {/* Recent Activity — col-span-3 */}
          <div className="lg:col-span-3">
            <BentoCard title="Recent Activity" icon={<Clock className="w-3 h-3" />}>
              {isLoading
                ? <SkeletonRows n={4} />
                : recentLinks.length === 0
                  ? <EmptySection icon={<Clock className="w-5 h-5 text-[#CBD5E1]" />} title="No links yet" hint="Your newly created links will appear here." />
                  : <div className="space-y-1 pt-1">
                      {recentLinks.map((link: Link) => (
                        <div key={link.id} className="group flex items-start gap-2.5 py-2 rounded-lg hover:bg-[#F8FAFC] -mx-2 px-2 transition-colors">
                          <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${link.enabled ? "bg-[#14B8A6]" : "bg-[#CBD5E1]"}`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-semibold text-[#1E293B] truncate">{link.slug}</p>
                            <p className="text-[10px] text-[#94A3B8] mt-0.5">{fmtAgo(link.createdAt)}</p>
                          </div>
                          <span className="text-[10px] font-bold text-[#475569] tabular-nums shrink-0 mt-0.5">
                            {fmtNum(clickCounts[link.id] ?? 0)}
                          </span>
                        </div>
                      ))}
                    </div>
              }
            </BentoCard>
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════
            E — LOWER ACTIONABLE STRIP
        ════════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Panel 1: Disabled links */}
          <ActionPanel
            icon={<ToggleLeft className="w-4 h-4 text-[#F59E0B]" />}
            title="Paused Links"
            badge={isLoading ? undefined : disabledLinks.length}
            badgeColor="warning"
            emptyTitle="All links are active"
            emptyHint="Disabled links will appear here when you need to pause them."
          >
            {!isLoading && disabledLinks.length > 0 && (
              <div className="space-y-1.5">
                {disabledLinks.map((link: Link) => (
                  <div key={link.id} className="flex items-center gap-2.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#CBD5E1] shrink-0" />
                    <p className="text-[11px] font-medium text-[#475569] truncate flex-1 min-w-0">{link.slug}</p>
                    <Link href="/links">
                      <span className="text-[9px] font-bold text-[#4F46E5] hover:text-[#4338CA] transition-colors shrink-0">Enable</span>
                    </Link>
                  </div>
                ))}
                {disabledLinks.length < (links?.filter((l: Link) => !l.enabled).length ?? 0) && (
                  <Link href="/links" className="text-[10px] text-[#94A3B8] hover:text-[#4F46E5] transition-colors flex items-center gap-0.5 mt-1">
                    +{(links?.filter((l: Link) => !l.enabled).length ?? 0) - disabledLinks.length} more <ArrowRight className="w-2.5 h-2.5" />
                  </Link>
                )}
              </div>
            )}
          </ActionPanel>

          {/* Panel 2: Zero-click links */}
          <ActionPanel
            icon={<MousePointerClick className="w-4 h-4 text-[#EF4444]" />}
            title="No Clicks Yet"
            badge={isLoading ? undefined : zeroClickLinks.length}
            badgeColor="danger"
            emptyTitle="All links have clicks"
            emptyHint="Active links with no clicks yet will show here so you can share or promote them."
          >
            {!isLoading && zeroClickLinks.length > 0 && (
              <div className="space-y-1.5">
                {zeroClickLinks.map((link: Link) => (
                  <div key={link.id} className="flex items-center gap-2.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#FCA5A5] shrink-0" />
                    <p className="text-[11px] font-medium text-[#475569] truncate flex-1 min-w-0">{link.slug}</p>
                    <button onClick={() => navigator.clipboard.writeText(`${origin}/r/${link.slug}`)}
                      className="text-[9px] font-bold text-[#4F46E5] hover:text-[#4338CA] transition-colors shrink-0">
                      Copy
                    </button>
                  </div>
                ))}
              </div>
            )}
          </ActionPanel>

          {/* Panel 3: Suggestions */}
          <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_14px_rgba(0,0,0,0.05)] p-4 flex flex-col gap-3">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#7C3AED]" />
              <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#94A3B8]">Suggestions</p>
            </div>

            {latestAI ? (
              <div className="bg-[#FAFAFA] border border-[#F1F5F9] rounded-xl p-3">
                <p className="text-[11px] text-[#475569] leading-relaxed line-clamp-4">{latestAI.content}</p>
                <Link href="/ai" className="inline-flex items-center gap-1 text-[10px] font-bold text-[#7C3AED] hover:text-[#6D28D9] transition-colors mt-2">
                  Full analysis <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {domainCount === 0 && (
                  <SuggestionItem icon={<Globe className="w-3.5 h-3.5 text-[#14B8A6]" />} label="Set up a custom domain" href="/domains" />
                )}
                <SuggestionItem icon={<Share2 className="w-3.5 h-3.5 text-[#4F46E5]" />} label="Share your top link" href="/links" />
                <SuggestionItem icon={<BarChart3 className="w-3.5 h-3.5 text-[#0EA5E9]" />} label="View full analytics" href="/analytics" />
              </div>
            )}

            <button
              onClick={async () => {
                try { await summaryMutation.mutateAsync(); queryClient.invalidateQueries({ queryKey: getGetAiInsightsQueryKey() }); } catch {}
              }}
              disabled={summaryMutation.isPending}
              className="w-full flex items-center gap-2 text-[11px] font-semibold text-[#7C3AED] hover:text-[#6D28D9] bg-[#F5F3FF] hover:bg-[#EDE9FE] border border-[#DDD6FE] rounded-lg px-3 py-2 transition-colors disabled:opacity-50">
              {summaryMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
              {summaryMutation.isPending ? "Analyzing…" : latestAI ? "Regenerate insights" : "Generate AI insights"}
            </button>
          </div>
        </div>

      </div>
    </ProtectedLayout>
  );
}

/* ─── sub-components ───────────────────────────────────────── */

function HeroStat({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div className={`shrink-0 ${accent ? "text-[#14B8A6]" : "text-[#94A3B8]"}`}>{icon}</div>
      <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
        <span className="text-[10px] text-[#94A3B8] truncate">{label}</span>
        <span className={`text-[11px] font-bold tabular-nums shrink-0 ${accent ? "text-[#14B8A6]" : "text-[#475569]"}`}>{value}</span>
      </div>
    </div>
  );
}

function BentoCard({ title, icon, action, children }: {
  title: string; icon?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_14px_rgba(0,0,0,0.05)] overflow-hidden h-full flex flex-col">
      <div className="px-4 py-3 border-b border-[#F1F5F9] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1.5 text-[#94A3B8]">
          {icon}
          <p className="text-[10px] font-bold uppercase tracking-[0.1em]">{title}</p>
        </div>
        {action}
      </div>
      <div className="px-4 pb-4 flex-1 flex flex-col">{children}</div>
    </div>
  );
}

function ActionPanel({ icon, title, badge, badgeColor, emptyTitle, emptyHint, children }: {
  icon: React.ReactNode; title: string; badge?: number;
  badgeColor?: "warning" | "danger"; emptyTitle: string; emptyHint: string; children?: React.ReactNode;
}) {
  const hasItems = badge !== undefined && badge > 0;
  return (
    <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_14px_rgba(0,0,0,0.05)] p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {icon}
          <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#94A3B8]">{title}</p>
        </div>
        {badge !== undefined && badge > 0 && (
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badgeColor === "warning" ? "bg-[#FFFBEB] text-[#D97706]" : "bg-[#FEF2F2] text-[#DC2626]"}`}>
            {badge}
          </span>
        )}
      </div>
      {hasItems
        ? <div className="flex-1">{children}</div>
        : <div className="flex flex-col items-center justify-center gap-2 py-4 text-center">
            <CheckCircle2 className="w-6 h-6 text-[#CBD5E1]" />
            <div>
              <p className="text-[11px] font-semibold text-[#475569]">{emptyTitle}</p>
              <p className="text-[10px] text-[#94A3B8] mt-0.5 max-w-[160px]">{emptyHint}</p>
            </div>
          </div>
      }
    </div>
  );
}

function SuggestionItem({ icon, label, href }: { icon: React.ReactNode; label: string; href: string }) {
  return (
    <Link href={href}>
      <div className="group flex items-center gap-2 py-1.5 rounded-lg hover:bg-[#F8FAFC] -mx-1 px-1 transition-colors cursor-pointer">
        <div className="w-6 h-6 rounded-md bg-[#F1F5F9] border border-[#E2E8F0] flex items-center justify-center shrink-0">{icon}</div>
        <span className="text-[11px] font-medium text-[#475569] group-hover:text-[#0F172A] transition-colors flex-1">{label}</span>
        <ArrowRight className="w-3 h-3 text-[#CBD5E1] group-hover:translate-x-0.5 transition-transform shrink-0" />
      </div>
    </Link>
  );
}

function EmptySection({ icon, title, hint, cta }: { icon: React.ReactNode; title: string; hint?: string; cta?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2.5 py-8 text-center flex-1">
      <div className="w-10 h-10 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-center">{icon}</div>
      <div>
        <p className="text-[11px] font-semibold text-[#475569]">{title}</p>
        {hint && <p className="text-[10px] text-[#94A3B8] mt-0.5 max-w-[180px] mx-auto leading-relaxed">{hint}</p>}
      </div>
      {cta}
    </div>
  );
}

function ChartEmpty() {
  return (
    <div className="h-full flex flex-col items-center justify-center gap-3">
      <div className="w-12 h-12 rounded-2xl bg-[#F1F5F9] flex items-center justify-center">
        <BarChart3 className="w-5 h-5 text-[#CBD5E1]" />
      </div>
      <div className="text-center">
        <p className="text-[12px] font-semibold text-[#475569]">No click data yet</p>
        <p className="text-[10px] text-[#94A3B8] mt-0.5">Share your short links to see activity here.</p>
      </div>
    </div>
  );
}

function SkeletonRows({ n }: { n: number }) {
  return (
    <div className="space-y-3 pt-3">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 animate-pulse">
          <div className="w-4 h-4 rounded bg-[#F1F5F9]" />
          <div className="flex-1 h-3 rounded bg-[#F1F5F9]" />
          <div className="w-10 h-3 rounded bg-[#F1F5F9]" />
        </div>
      ))}
    </div>
  );
}

function LinkLeaderRow({ rank, slug, domain, shortUrl, enabled, clicks, pct }: {
  rank: number; slug: string; domain: string | null; shortUrl: string;
  enabled: boolean; clicks: number; pct: number;
}) {
  const [copied, setCopied] = useState(false);
  function copy() { navigator.clipboard.writeText(shortUrl); setCopied(true); setTimeout(() => setCopied(false), 1500); }
  return (
    <div className="group flex items-center gap-3 py-2.5 hover:bg-[#F8FAFC] -mx-4 px-4 transition-colors">
      <span className="text-[10px] font-bold text-[#CBD5E1] w-4 text-right tabular-nums shrink-0">{rank}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-1.5">
          <p className="text-[12px] font-semibold text-[#1E293B] truncate">
            {domain ? <span className="text-[#94A3B8]">{domain}/</span> : null}{slug}
          </p>
          <span className={`text-[7px] font-black px-1.5 py-0.5 rounded-full shrink-0 tracking-wider ${enabled ? "bg-[#F0FDF4] text-[#16A34A]" : "bg-[#F8FAFC] text-[#94A3B8]"}`}>
            {enabled ? "LIVE" : "OFF"}
          </span>
        </div>
        <div className="h-1.5 bg-[#F1F5F9] rounded-full overflow-hidden">
          <div className="h-full rounded-full bg-gradient-to-r from-[#4F46E5] to-[#818CF8] transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <span className="text-[13px] font-extrabold text-[#0F172A] tabular-nums shrink-0 min-w-[32px] text-right">{fmtNum(clicks)}</span>
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button onClick={copy} className="p-1.5 rounded-lg hover:bg-[#EEF2FF] transition-colors">
          {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-[#16A34A]" /> : <Copy className="w-3.5 h-3.5 text-[#CBD5E1]" />}
        </button>
        <a href={shortUrl} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg hover:bg-[#EEF2FF] transition-colors">
          <ExternalLink className="w-3.5 h-3.5 text-[#CBD5E1]" />
        </a>
      </div>
    </div>
  );
}
