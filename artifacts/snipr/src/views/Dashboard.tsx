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
  Rocket, Monitor, Smartphone, Chrome, Wifi,
  Users, TrendingUp, Activity, Eye, MapPin,
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

/* ─── helpers ──────────────────────────────────────────────── */
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

const PERIOD_LABEL: Record<Period, string> = {
  "7d": "Last 7 days", "30d": "Last 30 days", "3m": "Last 3 months", "all": "Last 12 months",
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

/* ─── dashboard ────────────────────────────────────────────── */
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
    !links ? [] : [...links].sort((a, b) => (clickCounts[b.id] ?? 0) - (clickCounts[a.id] ?? 0)).slice(0, 7),
    [links, clickCounts]
  );
  const topCountries = useMemo(() => (stats?.topCountries ?? []).slice(0, 8), [stats]);
  const topRefs      = useMemo(() => (stats?.topReferrers ?? []).slice(0, 7), [stats]);
  const breakdownData = useMemo(() => {
    if (breakdownTab === "browser") return (stats?.topBrowsers  ?? []).slice(0, 6);
    if (breakdownTab === "device")  return (stats?.topDevices   ?? []).slice(0, 6);
    return                                 ((stats as any)?.topOs ?? []).slice(0, 6);
  }, [stats, breakdownTab]);
  const maxBreakdown = Math.max(...breakdownData.map((d: any) => d.count), 1);

  const showOnboarding = !isLoading && totalLinks === 0;

  return (
    <ProtectedLayout>
      <div className="min-h-full px-5 lg:px-8 pt-6 pb-10 space-y-4 max-w-[1280px] mx-auto w-full">

        {/* ═══════════════════════════════════════════════════════
            A — HEADER
        ════════════════════════════════════════════════════════ */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-[22px] font-extrabold text-[#0F172A] tracking-tight leading-none" suppressHydrationWarning>
              {mounted
                ? (new Date().getHours() < 12 ? "Good morning" : new Date().getHours() < 17 ? "Good afternoon" : "Good evening")
                : "Welcome"
              },{" "}
              <span className="text-[#4F46E5]">{firstName}</span>
            </h1>
            <p className="text-[13px] text-[#64748B] mt-1" suppressHydrationWarning>
              {mounted ? format(new Date(), "EEEE, MMMM d") : ""} · Link Intelligence Overview
            </p>
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            {/* Period selector */}
            <div className="hidden sm:flex items-center gap-0.5 bg-[#F1F5F9] rounded-xl p-1 border border-[#E2E8F0]">
              {(["7d","30d","3m","all"] as Period[]).map(p => (
                <button key={p} onClick={() => setPeriod(p)}
                  className={`text-[11px] font-bold px-3 py-1.5 rounded-lg transition-all ${period === p ? "bg-white text-[#0F172A] shadow-sm" : "text-[#94A3B8] hover:text-[#475569]"}`}>
                  {p === "7d" ? "7D" : p === "30d" ? "30D" : p === "3m" ? "3M" : "1Y"}
                </button>
              ))}
            </div>
            <Link href="/links">
              <button className="inline-flex items-center gap-1.5 bg-[#4F46E5] hover:bg-[#4338CA] active:scale-[0.97] text-white text-[13px] font-semibold px-4 py-2.5 rounded-xl transition-all shadow-[0_2px_12px_rgba(79,70,229,0.32)]">
                <Plus className="w-3.5 h-3.5" />
                New Link
              </button>
            </Link>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════
            ONBOARDING (conditional)
        ════════════════════════════════════════════════════════ */}
        {showOnboarding && (
          <div className="relative overflow-hidden rounded-2xl border border-[#C7D2FE] bg-gradient-to-r from-[#EEF2FF] to-[#F5F3FF] p-5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-[#4F46E5] flex items-center justify-center shrink-0 shadow-[0_4px_10px_rgba(79,70,229,0.3)]">
                <Rocket className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <p className="font-bold text-[15px] text-[#1E1B4B]">Create your first short link to unlock insights</p>
                <p className="text-[12px] text-[#4338CA]/70 mt-0.5">Track clicks, measure traffic sources, and understand your audience in real time.</p>
              </div>
              <Link href="/links">
                <button className="bg-[#4F46E5] hover:bg-[#4338CA] text-white text-[12px] font-bold px-4 py-2 rounded-lg transition-colors shadow-sm shrink-0">
                  Create first link →
                </button>
              </Link>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════
            B — HERO: split metrics panel + chart
        ════════════════════════════════════════════════════════ */}
        <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.06)] overflow-hidden">
          <div className="flex flex-col lg:flex-row">

            {/* Left: primary metrics panel */}
            <div className="lg:w-[256px] shrink-0 bg-[#F8FAFC] border-b lg:border-b-0 lg:border-r border-[#E2E8F0] p-6 flex flex-col gap-5">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#94A3B8]">Click Activity</p>
                <p className="text-[11px] text-[#CBD5E1] mt-0.5">{PERIOD_LABEL[period]}</p>
              </div>

              <div>
                {stats == null ? (
                  <div className="h-12 w-32 bg-[#E2E8F0] rounded-xl animate-pulse" />
                ) : (
                  <p className="text-[44px] font-extrabold text-[#0F172A] leading-none tabular-nums tracking-tight">
                    {fmtNum(clicksNow)}
                  </p>
                )}
                {delta !== null && (
                  <span className={`inline-flex items-center gap-0.5 text-[11px] font-bold mt-3 px-2 py-1 rounded-lg ${delta >= 0 ? "bg-[#F0FDF4] text-[#16A34A]" : "bg-[#FEF2F2] text-[#DC2626]"}`}>
                    {delta >= 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                    {Math.abs(delta)}% vs prior period
                  </span>
                )}
              </div>

              <div className="space-y-3 border-t border-[#E2E8F0] pt-4">
                <MetaStat icon={<Eye className="w-3.5 h-3.5" />} label="Unique visitors" value={stats == null ? "—" : fmtNum(uniqueNow)} />
                <MetaStat icon={<Activity className="w-3.5 h-3.5" />} label="Today's clicks" value={fmtNum(todayClicks)} accent />
                <MetaStat icon={<MapPin className="w-3.5 h-3.5" />} label="Countries reached" value={topCountries.length > 0 ? `${topCountries.length}` : "—"} />
                <MetaStat icon={<MousePointerClick className="w-3.5 h-3.5" />} label="All-time clicks" value={allStats == null ? "—" : fmtNum(allTime)} />
              </div>
            </div>

            {/* Right: chart */}
            <div className="flex-1 flex flex-col min-h-[260px]">
              {/* Chart header (mobile period tabs) */}
              <div className="flex sm:hidden items-center justify-between px-5 pt-4 pb-2">
                <p className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider">Trend</p>
                <div className="flex gap-0.5 bg-[#F1F5F9] rounded-lg p-0.5">
                  {(["7d","30d","3m","all"] as Period[]).map(p => (
                    <button key={p} onClick={() => setPeriod(p)}
                      className={`text-[10px] font-bold px-2 py-1 rounded-md transition-all ${period === p ? "bg-white text-[#0F172A] shadow-sm" : "text-[#94A3B8]"}`}>
                      {p === "7d" ? "7D" : p === "30d" ? "30D" : p === "3m" ? "3M" : "1Y"}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex-1 px-3 py-4">
                {tsResult.isLoading ? (
                  <div className="h-full flex items-center justify-center">
                    <Loader2 className="w-5 h-5 animate-spin text-[#CBD5E1]" />
                  </div>
                ) : timeseries.length > 0 ? (
                  <DashboardAreaChart data={timeseries} period={period} />
                ) : (
                  <div className="h-full flex flex-col items-center justify-center gap-3">
                    <div className="w-14 h-14 rounded-2xl bg-[#F1F5F9] flex items-center justify-center">
                      <BarChart3 className="w-6 h-6 text-[#CBD5E1]" />
                    </div>
                    <div className="text-center">
                      <p className="text-[13px] font-semibold text-[#475569]">No click data yet</p>
                      <p className="text-[11px] text-[#94A3B8] mt-0.5">Share your short links and watch activity appear here.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════
            C — KPI BAND
        ════════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard
            label="All-Time Clicks"
            value={allStats == null ? null : allTime}
            sub={allStats?.uniqueClicks != null ? `${fmtNum(allStats.uniqueClicks)} unique` : undefined}
            icon={<TrendingUp className="w-4 h-4" />}
            iconColor="#4F46E5" iconBg="#EEF2FF"
          />
          <KpiCard
            label="Unique Visitors"
            value={stats == null ? null : uniqueNow}
            sub={PERIOD_LABEL[period]}
            icon={<Users className="w-4 h-4" />}
            iconColor="#0EA5E9" iconBg="#F0F9FF"
          />
          <KpiCard
            label="Active Links"
            value={isLoading ? null : activeLinks}
            sub={isLoading ? undefined : `of ${totalLinks} total`}
            icon={<LinkIcon className="w-4 h-4" />}
            iconColor="#14B8A6" iconBg="#F0FDFA"
          />
          <KpiCard
            label="Today's Clicks"
            value={todayClicks}
            sub="Last 24 hours"
            icon={<Activity className="w-4 h-4" />}
            iconColor="#F59E0B" iconBg="#FFFBEB"
            highlight={todayClicks > 0}
          />
        </div>

        {/* ═══════════════════════════════════════════════════════
            D — SECONDARY INSIGHTS
            Row 1: Top Links (wide) | Traffic Sources
        ════════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

          {/* Top Performing Links — 3 cols */}
          <div className="lg:col-span-3">
            <InsightCard
              title="Top Performing Links"
              icon={<LinkIcon className="w-3.5 h-3.5" />}
              action={<Link href="/links" className="flex items-center gap-1 text-[11px] font-semibold text-[#94A3B8] hover:text-[#4F46E5] transition-colors">All links <ArrowRight className="w-3 h-3" /></Link>}
            >
              {isLoading ? (
                <SkeletonRows n={5} />
              ) : topLinks.length === 0 ? (
                <EmptyPanel
                  icon={<LinkIcon className="w-5 h-5 text-[#CBD5E1]" />}
                  title="No links yet"
                  hint="Create your first short link to see performance data here."
                  cta={<Link href="/links"><button className="text-[11px] font-bold text-[#4F46E5] hover:text-[#4338CA] flex items-center gap-1">Create a link <ArrowRight className="w-3 h-3" /></button></Link>}
                />
              ) : (
                <div className="divide-y divide-[#F8FAFC]">
                  {topLinks.map((link, i) => {
                    const clicks = clickCounts[link.id] ?? 0;
                    const maxC   = Math.max(...topLinks.map(l => clickCounts[l.id] ?? 0), 1);
                    const pct    = Math.max((clicks / maxC) * 100, 2);
                    const domain = link.domainId ? domainMap[link.domainId] : null;
                    const shortUrl = domain ? `https://${domain}/${link.slug}` : `${origin}/r/${link.slug}`;
                    return (
                      <LinkLeaderRow key={link.id} rank={i + 1} slug={link.slug}
                        domain={domain} shortUrl={shortUrl}
                        enabled={link.enabled} clicks={clicks} pct={pct} />
                    );
                  })}
                </div>
              )}
            </InsightCard>
          </div>

          {/* Traffic Sources — 2 cols */}
          <div className="lg:col-span-2">
            <InsightCard
              title="Traffic Sources"
              icon={<Globe className="w-3.5 h-3.5" />}
            >
              {topRefs.length === 0 ? (
                <EmptyPanel
                  icon={<Wifi className="w-5 h-5 text-[#CBD5E1]" />}
                  title="No referrer data"
                  hint="Traffic sources appear once your links start receiving clicks from other sites."
                />
              ) : (
                <div className="space-y-3 pt-1">
                  {topRefs.map((r: any, i: number) => {
                    const label = cleanReferrer(r.label);
                    const total = Math.max(...topRefs.map((x: any) => x.count), 1);
                    const pct   = Math.round((r.count / total) * 100);
                    return (
                      <div key={i} className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded-md bg-[#F1F5F9] border border-[#E2E8F0] flex items-center justify-center shrink-0">
                          <Globe className="w-3 h-3 text-[#94A3B8]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[12px] font-semibold text-[#1E293B] truncate">{label}</span>
                            <span className="text-[11px] text-[#475569] font-semibold tabular-nums ml-2 shrink-0">{r.count.toLocaleString()}</span>
                          </div>
                          <div className="h-1.5 bg-[#F1F5F9] rounded-full overflow-hidden">
                            <div className="h-full rounded-full bg-gradient-to-r from-[#4F46E5] to-[#818CF8]" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </InsightCard>
          </div>
        </div>

        {/* Row 2: Audience | Geographic */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

          {/* Audience Breakdown — 2 cols */}
          <div className="lg:col-span-2">
            <InsightCard
              title="Audience"
              icon={<Users className="w-3.5 h-3.5" />}
              action={
                <div className="flex gap-0.5 bg-[#F1F5F9] rounded-lg p-0.5">
                  {(["browser","device","os"] as const).map(t => (
                    <button key={t} onClick={() => setBreakdownTab(t)}
                      className={`text-[9px] font-bold px-2 py-1 rounded-md transition-all capitalize ${breakdownTab === t ? "bg-white text-[#0F172A] shadow-sm" : "text-[#94A3B8]"}`}>
                      {t === "os" ? "OS" : t === "browser" ? "Browser" : "Device"}
                    </button>
                  ))}
                </div>
              }
            >
              {breakdownData.length === 0 ? (
                <EmptyPanel
                  icon={<Monitor className="w-5 h-5 text-[#CBD5E1]" />}
                  title="No audience data yet"
                  hint="Device and browser breakdown will appear after your first clicks."
                />
              ) : (
                <div className="space-y-3 pt-1">
                  {breakdownData.map((d: any, i: number) => {
                    const pct = Math.round((d.count / maxBreakdown) * 100);
                    const ico = breakdownTab === "device"
                      ? (d.label?.toLowerCase().includes("mobile") || d.label?.toLowerCase().includes("phone")
                          ? <Smartphone className="w-3 h-3 text-[#94A3B8]" />
                          : <Monitor className="w-3 h-3 text-[#94A3B8]" />)
                      : <Chrome className="w-3 h-3 text-[#94A3B8]" />;
                    return (
                      <div key={i} className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded-md bg-[#F1F5F9] border border-[#E2E8F0] flex items-center justify-center shrink-0">{ico}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[12px] font-semibold text-[#1E293B] truncate">{d.label || "Unknown"}</span>
                            <span className="text-[11px] text-[#475569] font-semibold shrink-0">{pct}%</span>
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
            </InsightCard>
          </div>

          {/* Geographic — 3 cols */}
          <div className="lg:col-span-3">
            <InsightCard
              title="Geographic Distribution"
              icon={<MapPin className="w-3.5 h-3.5" />}
            >
              {topCountries.length === 0 ? (
                <EmptyPanel
                  icon={<Globe className="w-5 h-5 text-[#CBD5E1]" />}
                  title="No geographic data yet"
                  hint="Country-level data will appear once your links receive traffic from different regions."
                />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 pt-1">
                  {topCountries.map((c: any) => {
                    const pct = Math.round((c.count / Math.max(...topCountries.map((x: any) => x.count), 1)) * 100);
                    return (
                      <div key={c.label} className="flex items-center gap-2.5 py-1">
                        <span className="text-[18px] shrink-0 leading-none">{getFlagEmoji(c.label)}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[12px] font-semibold text-[#1E293B] truncate">{COUNTRY[c.label] ?? c.label}</span>
                            <span className="text-[11px] text-[#475569] font-semibold tabular-nums ml-2 shrink-0">{fmtNum(c.count)}</span>
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
            </InsightCard>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════
            E — AI INSIGHTS + QUICK ACTIONS
        ════════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

          {/* AI Insights — 3 cols */}
          <div className="lg:col-span-3">
            <InsightCard
              title="AI Insights"
              icon={<Sparkles className="w-3.5 h-3.5 text-[#7C3AED]" />}
              action={
                <button onClick={async () => {
                  try { await summaryMutation.mutateAsync(); queryClient.invalidateQueries({ queryKey: getGetAiInsightsQueryKey() }); }
                  catch {}
                }} disabled={summaryMutation.isPending}
                  className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide bg-[#F5F3FF] text-[#7C3AED] hover:bg-[#EDE9FE] border border-[#DDD6FE] px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-40">
                  {summaryMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                  {summaryMutation.isPending ? "Analyzing…" : "Generate"}
                </button>
              }
            >
              {summaryMutation.isPending ? (
                <div className="flex flex-col items-center justify-center gap-3 py-12">
                  <div className="relative w-12 h-12 rounded-2xl bg-[#F5F3FF] flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-[#7C3AED]" />
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-[#7C3AED] rounded-full animate-ping opacity-60" />
                  </div>
                  <p className="text-[12px] text-[#94A3B8]">Analyzing your link performance…</p>
                </div>
              ) : latestAI ? (
                <div className="flex flex-col gap-3 pt-1">
                  <div className="bg-[#FAFAFA] border border-[#F1F5F9] rounded-xl p-4">
                    <p className="text-[13px] text-[#475569] leading-[1.75] line-clamp-5">{latestAI.content}</p>
                  </div>
                  <Link href="/ai" className="inline-flex items-center gap-1 text-[11px] font-bold text-[#7C3AED] hover:text-[#6D28D9] transition-colors">
                    Read full analysis <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 py-6">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#F5F3FF] to-[#EEF2FF] border border-[#E9D5FF] flex items-center justify-center shrink-0">
                    <Sparkles className="w-5 h-5 text-[#7C3AED]" />
                  </div>
                  <div className="flex-1">
                    <p className="text-[14px] font-bold text-[#1E293B]">Get AI-powered insights</p>
                    <p className="text-[12px] text-[#64748B] mt-0.5">Generate a weekly summary of your top-performing links, traffic patterns, and growth opportunities.</p>
                  </div>
                  <button onClick={async () => {
                    try { await summaryMutation.mutateAsync(); queryClient.invalidateQueries({ queryKey: getGetAiInsightsQueryKey() }); }
                    catch {}
                  }} className="inline-flex items-center gap-1.5 text-[12px] font-bold bg-[#7C3AED] hover:bg-[#6D28D9] text-white px-4 py-2 rounded-xl transition-colors shadow-[0_2px_8px_rgba(124,58,237,0.28)] shrink-0 whitespace-nowrap">
                    <Zap className="w-3.5 h-3.5" /> Analyze now
                  </button>
                </div>
              )}
            </InsightCard>
          </div>

          {/* Quick Actions — 2 cols */}
          <div className="lg:col-span-2 flex flex-col gap-3">
            {[
              { icon: Plus,      label: "New Link",    desc: "Shorten any URL",    href: "/links",     dark: true },
              { icon: BarChart3, label: "Analytics",   desc: "Deep traffic dive",  href: "/analytics", iconColor: "#0EA5E9", bg: "bg-[#F0F9FF]" },
              { icon: Globe,     label: "Domains",     desc: "Custom domains",      href: "/domains",   iconColor: "#14B8A6", bg: "bg-[#F0FDFA]" },
              { icon: Sparkles,  label: "AI Insights", desc: "Smart summaries",     href: "/ai",        iconColor: "#7C3AED", bg: "bg-[#F5F3FF]" },
            ].map(a => (
              <Link key={a.href} href={a.href} className="flex-1">
                <div className={`group flex items-center gap-3 rounded-xl px-4 py-3 h-full cursor-pointer transition-all border ${a.dark ? "bg-[#4F46E5] border-[#4338CA] hover:bg-[#4338CA] shadow-[0_2px_8px_rgba(79,70,229,0.2)]" : "bg-white border-[#E2E8F0] hover:border-[#C7D2FE] hover:shadow-[0_2px_8px_rgba(79,70,229,0.06)]"}`}>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${a.dark ? "bg-white/15 text-white" : `${a.bg}`}`}
                    style={a.dark ? {} : { color: (a as any).iconColor }}>
                    <a.icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-[13px] font-bold leading-none ${a.dark ? "text-white" : "text-[#0F172A]"}`}>{a.label}</p>
                    <p className={`text-[11px] mt-0.5 ${a.dark ? "text-indigo-200" : "text-[#94A3B8]"}`}>{a.desc}</p>
                  </div>
                  <ArrowRight className={`w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform shrink-0 ${a.dark ? "text-indigo-200" : "text-[#CBD5E1]"}`} />
                </div>
              </Link>
            ))}
          </div>
        </div>

      </div>
    </ProtectedLayout>
  );
}

/* ─── shared sub-components ────────────────────────────────── */

function MetaStat({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className={`shrink-0 ${accent ? "text-[#14B8A6]" : "text-[#94A3B8]"}`}>{icon}</div>
      <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
        <span className="text-[11px] text-[#94A3B8] truncate">{label}</span>
        <span className={`text-[12px] font-bold tabular-nums shrink-0 ${accent ? "text-[#14B8A6]" : "text-[#475569]"}`}>{value}</span>
      </div>
    </div>
  );
}

function KpiCard({ label, value, sub, icon, iconColor, iconBg, highlight }: {
  label: string; value: number | null; sub?: string;
  icon: React.ReactNode; iconColor: string; iconBg: string; highlight?: boolean;
}) {
  return (
    <div className={`bg-white rounded-2xl border shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_16px_rgba(0,0,0,0.05)] p-5 ${highlight ? "border-[#FDE68A]" : "border-[#E2E8F0]"}`}>
      <div className="flex items-start justify-between mb-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#94A3B8] leading-tight">{label}</p>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: iconBg, color: iconColor }}>
          {icon}
        </div>
      </div>
      {value === null
        ? <div className="h-8 w-20 bg-[#F1F5F9] rounded-lg animate-pulse" />
        : <p className="text-[30px] font-extrabold text-[#0F172A] leading-none tabular-nums tracking-tight">{fmtNum(value)}</p>
      }
      {sub && <p className="text-[10px] text-[#94A3B8] font-medium mt-1.5">{sub}</p>}
    </div>
  );
}

function InsightCard({ title, icon, action, children }: {
  title: string; icon?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_16px_rgba(0,0,0,0.05)] overflow-hidden h-full flex flex-col">
      <div className="px-5 py-3.5 border-b border-[#F1F5F9] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1.5 text-[#94A3B8]">
          {icon}
          <p className="text-[11px] font-bold uppercase tracking-[0.09em]">{title}</p>
        </div>
        {action}
      </div>
      <div className="px-5 pb-5 flex-1 flex flex-col">{children}</div>
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

function EmptyPanel({ icon, title, hint, cta }: { icon: React.ReactNode; title: string; hint?: string; cta?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-10 text-center flex-1">
      <div className="w-11 h-11 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-center">
        {icon}
      </div>
      <div>
        <p className="text-[12px] font-semibold text-[#475569]">{title}</p>
        {hint && <p className="text-[11px] text-[#94A3B8] mt-0.5 max-w-[200px] mx-auto leading-relaxed">{hint}</p>}
      </div>
      {cta}
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
    <div className="group flex items-center gap-3 py-2.5 hover:bg-[#F8FAFC] transition-colors -mx-5 px-5">
      <span className="text-[10px] font-bold text-[#CBD5E1] w-4 shrink-0 tabular-nums text-right">{rank}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-1.5">
          <p className="text-[12px] font-semibold text-[#1E293B] truncate">
            {domain ? <span className="text-[#94A3B8]">{domain}/</span> : null}{slug}
          </p>
          <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full shrink-0 tracking-wide ${enabled ? "bg-[#F0FDF4] text-[#16A34A]" : "bg-[#F8FAFC] text-[#94A3B8]"}`}>
            {enabled ? "LIVE" : "OFF"}
          </span>
        </div>
        <div className="h-1.5 bg-[#F1F5F9] rounded-full overflow-hidden">
          <div className="h-full rounded-full bg-gradient-to-r from-[#4F46E5] to-[#818CF8] transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <span className="text-[13px] font-extrabold text-[#0F172A] tabular-nums shrink-0 min-w-[36px] text-right">{fmtNum(clicks)}</span>
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
