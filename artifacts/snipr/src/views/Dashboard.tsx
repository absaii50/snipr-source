"use client";
import { useMemo, useState, useEffect, useCallback } from "react";
import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import {
  useGetLinks, getGetLinksQueryKey, useGetWorkspaceAnalytics, getGetWorkspaceAnalyticsQueryKey,
  useGetWorkspaceTimeseries, getGetWorkspaceTimeseriesQueryKey, useGetDomains, getGetDomainsQueryKey,
  useCreateLink,
} from "@workspace/api-client-react";
import type { Link as LinkType, Domain, TopEntry, TimeseriesPoint } from "@workspace/api-client-react";
import {
  LinkIcon, Loader2, ArrowRight, Plus, BarChart3,
  MousePointerClick, ExternalLink, ArrowUpRight, ArrowDownRight,
  Globe, Copy, CheckCircle2, Rocket, Wifi,
  TrendingUp, Activity, Eye, MapPin, Zap,
  Clock, Sparkles, Users, Link2, Settings2,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";
import { format, parseISO, subDays, formatDistanceToNow } from "date-fns";
import dynamic from "next/dynamic";
import { LinkModal } from "@/components/LinkModal";
import { CountryFlag } from "@/components/icons/CountryFlag";

const DashboardAreaChart = dynamic(() => import("@/components/charts/DashboardAreaChart"), { ssr: false });
const DeviceDonutChart  = dynamic(() => import("@/components/charts/DeviceDonutChart"),   { ssr: false });

/* ─── types & helpers ─── */
type Period = "1h" | "6h" | "24h" | "7d" | "30d" | "3m" | "all";

function getPeriodConfig(p: Period) {
  const now = new Date();
  const isoFull = (d: Date) => d.toISOString();
  const isoDate = (d: Date) => d.toISOString().split("T")[0];
  if (p === "1h")  return { from: isoFull(new Date(now.getTime() - 60 * 60 * 1000)),       to: isoFull(now), interval: "hour" as const, days: 0.04 };
  if (p === "6h")  return { from: isoFull(new Date(now.getTime() - 6 * 60 * 60 * 1000)),   to: isoFull(now), interval: "hour" as const, days: 0.25 };
  if (p === "24h") return { from: isoFull(new Date(now.getTime() - 24 * 60 * 60 * 1000)),  to: isoFull(now), interval: "hour" as const, days: 1    };
  if (p === "7d")  return { from: isoDate(subDays(now, 6)),  to: isoDate(now), interval: "day"   as const, days: 7   };
  if (p === "30d") return { from: isoDate(subDays(now, 29)), to: isoDate(now), interval: "day"   as const, days: 30  };
  if (p === "3m")  return { from: isoDate(subDays(now, 89)), to: isoDate(now), interval: "week"  as const, days: 90  };
  return            { from: isoDate(subDays(now, 364)),       to: isoDate(now), interval: "week" as const, days: 365 };
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
    if (interval === "hour")  return format(d, "h:mm a");
    if (p === "all")          return format(d, "MMM ''yy");
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
  "1h": "Last hour", "6h": "Last 6 hours", "24h": "Last 24 hours",
  "7d": "Last 7 days", "30d": "Last 30 days", "3m": "Last 3 months", "all": "Last 12 months",
};

const PLAN_CLICK_LIMITS: Record<string, number | null> = {
  free: 10_000, starter: 1_000_000, growth: 5_000_000,
  pro: 25_000_000, business: 100_000_000, enterprise: null,
};
const PLAN_LABELS: Record<string, string> = {
  free: "Free", starter: "Starter", growth: "Growth",
  pro: "Pro", business: "Business", enterprise: "Enterprise",
};

interface UserContext {
  greeting: string; dateFormatted: string; localTime: string;
  timezone: string; country: string | null; countryName: string | null;
  city: string | null; ip: string;
}

async function fetchTodayClicks({ signal }: { signal: AbortSignal }): Promise<number> {
  try { const r = await fetch("/api/stats/today", { credentials: "include", signal }); return r.ok ? (await r.json()).clicks ?? 0 : 0; }
  catch { return 0; }
}
async function fetchLinkClicks({ signal }: { signal: AbortSignal }): Promise<Record<string, { total: number; unique: number }>> {
  try { const r = await fetch("/api/links/clicks", { credentials: "include", signal }); return r.ok ? r.json() : {}; }
  catch { return {}; }
}
async function fetchUserContext({ signal }: { signal: AbortSignal }): Promise<UserContext | null> {
  try { const r = await fetch("/api/auth/context", { credentials: "include", signal }); return r.ok ? r.json() : null; }
  catch { return null; }
}
async function fetchSubscription({ signal }: { signal: AbortSignal }): Promise<{ plan: string } | null> {
  try { const r = await fetch("/api/billing/subscription", { credentials: "include", signal }); return r.ok ? r.json() : null; }
  catch { return null; }
}

interface ClickEvent {
  id: string; slug: string; domain?: string; timestamp: string;
  country?: string; city?: string; browser?: string; os?: string; device?: string;
  referrer?: string;
}
async function fetchRecentClicks({ signal }: { signal: AbortSignal }): Promise<ClickEvent[]> {
  try { const r = await fetch("/api/analytics/events?limit=6", { credentials: "include", signal }); return r.ok ? (await r.json()).events ?? [] : []; }
  catch { return []; }
}

/* ─── main component ─── */
export default function Dashboard() {
  const { user }     = useAuth();
  const [mounted, setMounted] = useState(false);
  const [origin, setOrigin]   = useState("");
  const [period, setPeriod]   = useState<Period>("30d");
  const [periodTs, setPeriodTs] = useState(() => Date.now());
  const handlePeriodChange = useCallback((p: Period) => {
    setPeriod(p);
    setPeriodTs(Date.now());
  }, []);

  useEffect(() => { setMounted(true); setOrigin(window.location.origin); }, []);

  const ST5 = 5 * 60 * 1000;
  const { data: links, isLoading } = useGetLinks(undefined, { query: { queryKey: getGetLinksQueryKey(), staleTime: ST5 } });
  const { data: allDomains } = useGetDomains({ query: { queryKey: getGetDomainsQueryKey(), staleTime: ST5 } });
  const domainMap = useMemo(() => {
    const m: Record<string, string> = {};
    allDomains?.forEach((d: Domain) => { if (d.id) m[d.id] = d.domain; });
    return m;
  }, [allDomains]);

  const { from, to, interval, days } = useMemo(() => getPeriodConfig(period), [period, periodTs]);
  const { prevFrom, prevTo } = useMemo(() => {
    const fromMs = new Date(from).getTime();
    const periodMs = days * 24 * 60 * 60 * 1000;
    return {
      prevFrom: days < 1
        ? new Date(fromMs - periodMs).toISOString()
        : subDays(new Date(from), days).toISOString().split("T")[0],
      prevTo: days < 1
        ? new Date(fromMs - 1).toISOString()
        : subDays(new Date(from), 1).toISOString().split("T")[0],
    };
  }, [from, days]);

  const allStatsFrom = useMemo(() => subDays(new Date(), 364).toISOString().split("T")[0], []);
  const allStatsParams = { from: allStatsFrom, to: new Date().toISOString().split("T")[0] };
  const { data: allStats }  = useGetWorkspaceAnalytics(allStatsParams, { query: { queryKey: getGetWorkspaceAnalyticsQueryKey(allStatsParams), staleTime: 10 * 60 * 1000 } });
  const statsParams = { from, to };
  const { data: stats }     = useGetWorkspaceAnalytics(statsParams, { query: { queryKey: getGetWorkspaceAnalyticsQueryKey(statsParams), staleTime: ST5 } });
  const prevStatsParams = { from: prevFrom, to: prevTo };
  const { data: prevStats } = useGetWorkspaceAnalytics(prevStatsParams, { query: { queryKey: getGetWorkspaceAnalyticsQueryKey(prevStatsParams), staleTime: ST5 } });
  const { data: todayClicks = 0 } = useQuery({ queryKey: ["stats-today"], queryFn: fetchTodayClicks, staleTime: 30_000 });
  const { data: clickCounts = {} } = useQuery({ queryKey: ["links-clicks"], queryFn: fetchLinkClicks, staleTime: 60_000 });
  const { data: userContext } = useQuery({ queryKey: ["user-context"], queryFn: fetchUserContext, staleTime: 5 * 60 * 1000 });
  const { data: subscription } = useQuery({ queryKey: ["subscription"], queryFn: fetchSubscription, staleTime: 10 * 60 * 1000 });
  const { data: recentClicks = [] } = useQuery({ queryKey: ["recent-clicks"], queryFn: fetchRecentClicks, staleTime: 30_000, refetchInterval: 30_000 });

  const monthFrom = useMemo(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`; }, []);
  const monthTo = useMemo(() => new Date().toISOString().split("T")[0], []);
  const monthParams = { from: monthFrom, to: monthTo };
  const { data: monthStats } = useGetWorkspaceAnalytics(monthParams, { query: { queryKey: getGetWorkspaceAnalyticsQueryKey(monthParams), staleTime: ST5 } });

  const tsParams2 = { from, to, interval } as const;
  const tsResult   = useGetWorkspaceTimeseries(tsParams2 as any, { query: { queryKey: getGetWorkspaceTimeseriesQueryKey(tsParams2 as any), staleTime: ST5 } });
  const timeseries = useMemo(() => {
    if (!tsResult.data) return [];
    return (tsResult.data as TimeseriesPoint[]).map((pt) => ({ ...pt, day: fmtDay(pt.time, interval, period) }));
  }, [tsResult.data, interval, period]);

  const totalLinks  = links?.length ?? 0;
  const activeLinks = links?.filter((l: LinkType) => l.enabled).length ?? 0;
  const firstName   = user?.name?.split(" ")[0] ?? "there";

  const clicksNow  = stats?.totalClicks ?? 0;
  const clicksPrev = prevStats?.totalClicks ?? 0;
  const delta      = clicksPrev > 0 ? Math.round(((clicksNow - clicksPrev) / clicksPrev) * 100) : null;
  const allTime    = allStats?.totalClicks ?? 0;
  const uniqueNow  = stats?.uniqueClicks ?? 0;
  const uniquePrev = prevStats?.uniqueClicks ?? 0;
  const uniqueDelta = uniquePrev > 0 ? Math.round(((uniqueNow - uniquePrev) / uniquePrev) * 100) : null;

  const topLinks = useMemo(() =>
    !links ? [] : [...links].sort((a: LinkType, b: LinkType) => (clickCounts[b.id]?.total ?? 0) - (clickCounts[a.id]?.total ?? 0)).slice(0, 7),
    [links, clickCounts]
  );
  const topCountries = useMemo(() => (stats?.topCountries ?? []).slice(0, 8), [stats]);
  const topRefs      = useMemo(() => (stats?.topReferrers ?? []).slice(0, 7), [stats]);
  const topDevices   = useMemo(() => (stats?.topDevices   ?? []).slice(0, 5), [stats]);

  const recentLinks  = useMemo(() =>
    !links ? [] : [...links].sort((a: LinkType, b: LinkType) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5),
    [links]
  );

  const topLinkEntry   = topLinks[0] ?? null;
  const topLinkClicks  = topLinkEntry ? (clickCounts[topLinkEntry.id]?.total ?? 0) : 0;
  const topLinkDomain  = topLinkEntry?.domainId ? domainMap[topLinkEntry.domainId] : null;
  const topLinkDisplay = topLinkDomain ? `${topLinkDomain}/${topLinkEntry?.slug}` : (topLinkEntry?.slug ?? "\u2014");

  const topCountryEntry: TopEntry | null = topCountries[0] ?? null;
  const topCountryTotal = topCountries.reduce((s: number, c: TopEntry) => s + c.count, 0) || 1;
  const topCountryPct   = topCountryEntry ? Math.round((topCountryEntry.count / topCountryTotal) * 100) : 0;

  const domainCount     = (allDomains ?? []).filter((d: Domain) => !d.isPlatformDomain).length;
  const showOnboarding  = !isLoading && totalLinks === 0;

  const queryClient = useQueryClient();
  const createMutation = useCreateLink();
  const [quickUrl, setQuickUrl] = useState("");
  const [quickResult, setQuickResult] = useState<string | null>(null);
  const [quickCopied, setQuickCopied] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const handleQuickCreate = async () => {
    if (!quickUrl.trim()) return;
    let url = quickUrl.trim();
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
    try {
      const newLink = await createMutation.mutateAsync({ data: { destinationUrl: url } });
      const slug = newLink.slug;
      const domainName = newLink.domainId ? domainMap[newLink.domainId] : null;
      const short = domainName ? `https://${domainName}/${slug}` : `${origin}/r/${slug}`;
      setQuickResult(short);
      setQuickUrl("");
      queryClient.invalidateQueries({ queryKey: getGetLinksQueryKey() });
    } catch { /* toast handled by mutation */ }
  };
  const copyQuickResult = () => {
    if (quickResult) { navigator.clipboard.writeText(quickResult); setQuickCopied(true); setTimeout(() => setQuickCopied(false), 2000); }
  };

  const currentPlan = subscription?.plan ?? "free";
  const planLimit = PLAN_CLICK_LIMITS[currentPlan] ?? null;
  const monthClicks = monthStats?.totalClicks ?? 0;
  const planUsagePct = planLimit ? Math.min(Math.round((monthClicks / planLimit) * 100), 100) : null;

  return (
    <ProtectedLayout>
      <div className="min-h-full" style={{ background: "#09090B" }}>

        {/* Subtle ambient glow */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden -z-10" aria-hidden>
          <div className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full opacity-[0.04]" style={{ background: "radial-gradient(circle, #8B5CF6, transparent 70%)" }} />
          <div className="absolute top-1/3 -right-40 w-[500px] h-[500px] rounded-full opacity-[0.03]" style={{ background: "radial-gradient(circle, #06B6D4, transparent 70%)" }} />
        </div>

        <div className="px-4 sm:px-6 lg:px-8 pt-14 lg:pt-6 pb-20 max-w-[1280px] mx-auto w-full space-y-6">

          {/* ── PLAN USAGE BANNER (warning / over_cap / flagged) ── */}
          <PlanUsageBanner usage={subscription?.usage} />

          {/* ── HEADER ── */}
          <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 pt-2">
            <div>
              <p className="text-[11px] font-medium text-[#52525B] tracking-wide uppercase mb-1.5" suppressHydrationWarning>
                {userContext ? userContext.dateFormatted : mounted ? format(new Date(), "EEEE, MMMM d") : "\u00A0"}
              </p>
              <h1 className="text-[26px] sm:text-[32px] font-bold text-[#FAFAFA] leading-[1.15] tracking-[-0.025em] font-[family-name:var(--font-space-grotesk)]" suppressHydrationWarning>
                {userContext?.greeting ? `${userContext.greeting}, ${firstName}` : `Welcome back, ${firstName}`}
              </h1>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {userContext?.localTime && (
                <span className="text-[12px] text-[#52525B] hidden sm:block tabular-nums font-medium">{userContext.localTime}</span>
              )}
              <Link href="/links">
                <button className="group inline-flex items-center gap-2 text-[13px] font-semibold px-4 py-2 rounded-lg text-white transition-all duration-200 active:scale-[0.97]" style={{ background: "linear-gradient(135deg, #8B5CF6, #7C3AED)", boxShadow: "0 2px 12px rgba(139,92,246,0.25)" }}>
                  <Plus className="w-4 h-4 transition-transform group-hover:rotate-90 duration-300" /> New Link
                </button>
              </Link>
            </div>
          </header>

          {/* ── QUICK CREATE ── */}
          <div className="rounded-xl bg-[#18181B] border border-[#27272A]">
            <div className="px-4 sm:px-5 py-3.5">
              <div className="flex flex-col sm:flex-row gap-2.5">
                <div className="relative flex-1">
                  <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#52525B]" />
                  <input
                    type="text"
                    value={quickUrl}
                    onChange={e => { setQuickUrl(e.target.value); setQuickResult(null); setQuickCopied(false); }}
                    onKeyDown={e => { if (e.key === "Enter") handleQuickCreate(); }}
                    placeholder="Paste a long URL to shorten..."
                    className="w-full pl-9 pr-4 py-2.5 text-[13px] font-medium text-[#FAFAFA] placeholder:text-[#52525B] rounded-lg outline-none transition-all duration-200 bg-[#09090B] border border-[#27272A] focus:border-[#8B5CF6]/40 focus:ring-2 focus:ring-[#8B5CF6]/10"
                  />
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={handleQuickCreate}
                    disabled={createMutation.isPending || !quickUrl.trim()}
                    className="inline-flex items-center justify-center gap-2 text-[13px] font-semibold px-4 py-2.5 rounded-lg text-white transition-all duration-200 active:scale-[0.97] disabled:opacity-50"
                    style={{ background: "linear-gradient(135deg, #8B5CF6, #7C3AED)", boxShadow: "0 2px 10px rgba(139,92,246,0.2)" }}
                  >
                    {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                    Shorten
                  </button>
                  <button
                    onClick={() => setShowLinkModal(true)}
                    className="inline-flex items-center justify-center w-10 h-10 rounded-lg transition-all duration-200 active:scale-[0.95] hover:bg-[#27272A] text-[#52525B] hover:text-[#A1A1AA] border border-[#27272A]"
                    title="Advanced options"
                  >
                    <Settings2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {quickResult && (
                <div className="mt-3 flex items-center gap-3 px-3.5 py-2.5 rounded-lg bg-[#052E16] border border-[#166534]/40">
                  <CheckCircle2 className="w-4 h-4 text-[#4ADE80] shrink-0" />
                  <span className="text-[13px] font-semibold text-[#FAFAFA] truncate flex-1 font-[family-name:var(--font-space-grotesk)]">{quickResult}</span>
                  <button
                    onClick={copyQuickResult}
                    className={`inline-flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-md transition-all duration-200 shrink-0 ${
                      quickCopied ? "bg-[#166534]/40 text-[#4ADE80]" : "bg-[#27272A] text-[#A1A1AA] hover:text-[#FAFAFA]"
                    }`}
                  >
                    {quickCopied ? <><CheckCircle2 className="w-3.5 h-3.5" /> Copied</> : <><Copy className="w-3.5 h-3.5" /> Copy</>}
                  </button>
                </div>
              )}
              {createMutation.isError && (
                <p className="mt-2 text-[12px] text-[#FCA5A5] font-medium px-1">
                  {(createMutation.error as any)?.message || "Failed to create link. Please try again."}
                </p>
              )}
            </div>
          </div>

          {/* ── ONBOARDING ── */}
          {showOnboarding && (
            <div className="rounded-xl p-6 bg-[#18181B] border border-[#27272A]">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: "linear-gradient(135deg, #8B5CF6, #06B6D4)" }}>
                  <Rocket className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-[16px] text-[#FAFAFA] tracking-[-0.01em]">Create your first short link</p>
                  <p className="text-[13px] text-[#71717A] mt-1">Track clicks, see traffic sources, and understand your audience in real time.</p>
                </div>
                <Link href="/links">
                  <button className="text-white text-[13px] font-semibold px-5 py-2.5 rounded-lg transition-all active:scale-[0.98] shrink-0" style={{ background: "linear-gradient(135deg, #8B5CF6, #7C3AED)", boxShadow: "0 2px 10px rgba(139,92,246,0.2)" }}>
                    Get started &rarr;
                  </button>
                </Link>
              </div>
            </div>
          )}

          {/* ── KPI CARDS ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard label="Total Clicks" value={stats == null ? "\u2014" : fmtNum(clicksNow)} sub={PERIOD_LABEL[period]} delta={delta} accent="#8B5CF6" icon={<MousePointerClick className="w-4 h-4" />} />
            <KpiCard label="Unique Visitors" value={stats == null ? "\u2014" : fmtNum(uniqueNow)} sub={PERIOD_LABEL[period]} delta={uniqueDelta} accent="#06B6D4" icon={<Users className="w-4 h-4" />} />
            <KpiCard label="Total Links" value={isLoading ? "\u2014" : String(totalLinks)} sub={`${activeLinks} active`} delta={null} accent="#10B981" icon={<Link2 className="w-4 h-4" />} />
            <KpiCard label="Today" value={fmtNum(todayClicks)} sub="Clicks today" delta={null} accent="#F59E0B" icon={<Zap className="w-4 h-4" />} />
          </div>

          {/* ── PLAN USAGE ── */}
          {planLimit !== null && (
            <div className="rounded-xl bg-[#18181B] border border-[#27272A] px-4 sm:px-5 py-3.5">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-[#8B5CF6]/10 border border-[#8B5CF6]/15">
                    <Activity className="w-4 h-4 text-[#8B5CF6]" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-semibold text-[#FAFAFA]">Monthly Usage</span>
                      <span className="text-[10px] font-bold text-[#8B5CF6] bg-[#8B5CF6]/10 px-1.5 py-0.5 rounded-md border border-[#8B5CF6]/15">
                        {PLAN_LABELS[currentPlan] ?? currentPlan}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#52525B] font-medium mt-0.5">
                      {fmtNum(monthClicks)} of {fmtNum(planLimit)} clicks used
                    </p>
                  </div>
                </div>

                <div className="flex-1 flex items-center gap-3">
                  <div className="flex-1 h-[6px] rounded-full overflow-hidden bg-[#27272A]">
                    <div
                      className="h-full rounded-full transition-all duration-700 ease-out"
                      style={{
                        width: `${Math.max(planUsagePct ?? 0, 1)}%`,
                        background: (planUsagePct ?? 0) >= 90
                          ? "#EF4444"
                          : (planUsagePct ?? 0) >= 70
                            ? "#F59E0B"
                            : "linear-gradient(90deg, #8B5CF6, #06B6D4)",
                      }}
                    />
                  </div>
                  <span className="text-[12px] font-bold tabular-nums text-[#FAFAFA] shrink-0">{planUsagePct ?? 0}%</span>
                </div>

                {(currentPlan === "free" || currentPlan === "starter") && (
                  <Link href="/billing" className="shrink-0">
                    <button className="text-[11px] font-semibold text-[#8B5CF6] hover:text-white px-3 py-1.5 rounded-md transition-all duration-200 hover:bg-[#8B5CF6] border border-[#8B5CF6]/30">
                      Upgrade
                    </button>
                  </Link>
                )}
              </div>
            </div>
          )}

          {/* ── CHART ── */}
          <div className="rounded-xl bg-[#18181B] border border-[#27272A] overflow-hidden">
            <div className="px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#27272A]">
              <div>
                <h2 className="text-[15px] font-bold text-[#FAFAFA] font-[family-name:var(--font-space-grotesk)] tracking-[-0.01em]">Click Activity</h2>
                <p className="text-[12px] text-[#52525B] mt-0.5 font-medium">{PERIOD_LABEL[period]}</p>
              </div>
              <div className="flex items-center gap-0.5 p-[3px] rounded-lg bg-[#09090B] border border-[#27272A] overflow-x-auto">
                {(["1h","6h","24h","7d","30d","3m","all"] as Period[]).map(p => (
                  <button key={p} onClick={() => handlePeriodChange(p)}
                    className={`text-[11px] font-semibold px-2.5 sm:px-3 py-1.5 rounded-md transition-all duration-200 shrink-0 ${
                      period === p
                        ? "text-[#FAFAFA] bg-[#27272A]"
                        : "text-[#52525B] hover:text-[#A1A1AA]"
                    }`}>
                    {p === "1h" ? "1H" : p === "6h" ? "6H" : p === "24h" ? "24H" : p === "7d" ? "7D" : p === "30d" ? "30D" : p === "3m" ? "3M" : "1Y"}
                  </button>
                ))}
              </div>
            </div>
            <div className="h-[260px] sm:h-[300px] px-4 sm:px-5 py-5">
              {tsResult.isLoading
                ? <div className="h-full flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-[#8B5CF6]" /></div>
                : timeseries.length > 0
                  ? <DashboardAreaChart data={timeseries} period={period} />
                  : <ChartEmpty />
              }
            </div>
          </div>

          {/* ── INSIGHT ROW ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <InsightCard label="Top Link" value={topLinkEntry ? fmtNum(topLinkClicks) : "\u2014"} sub={topLinkEntry ? topLinkDisplay : "No clicks yet"} icon={<TrendingUp className="w-4 h-4" />} accent="#8B5CF6" />
            <InsightCard label="Top Country" value={topCountryEntry ? (COUNTRY[topCountryEntry.label] ?? topCountryEntry.label) : "\u2014"} sub={topCountryEntry ? `${fmtNum(topCountryEntry.count)} visits \u00B7 ${topCountryPct}%` : "No data yet"} icon={topCountryEntry ? <span className="flex items-center"><CountryFlag code={topCountryEntry.label} width={20} /></span> : <Globe className="w-4 h-4" />} accent="#F59E0B" />
            <InsightCard label="Domains" value={String(domainCount)} sub={domainCount > 0 ? "Custom configured" : "None configured"} icon={<Globe className="w-4 h-4" />} accent="#10B981" cta={domainCount === 0 ? <Link href="/domains" className="text-[11px] font-semibold text-[#8B5CF6] hover:underline mt-1 inline-block">Set up &rarr;</Link> : undefined} />
            <InsightCard label="All-time" value={allStats == null ? "\u2014" : fmtNum(allTime)} sub="Lifetime clicks" icon={<MousePointerClick className="w-4 h-4" />} accent="#06B6D4" />
          </div>

          {/* ── ANALYTICS BENTO ── */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
            {/* Top Links */}
            <div className="lg:col-span-7">
              <AnalyticsPanel title="Top Performing Links" badge={topLinks.length > 0 ? `${topLinks.length}` : undefined} action={<Link href="/links" className="flex items-center gap-1 text-[12px] font-semibold text-[#52525B] hover:text-[#8B5CF6] transition-colors">View all <ArrowRight className="w-3.5 h-3.5" /></Link>}>
                {isLoading
                  ? <SkeletonRows n={5} />
                  : topLinks.length === 0
                    ? <EmptyCard icon={<LinkIcon className="w-5 h-5 text-[#A78BFA]" />} title="No links yet" hint="Create your first short link to start tracking." ctaHref="/links" ctaText="Create a link" />
                    : <div className="space-y-0.5">
                        {topLinks.map((link: LinkType, i: number) => {
                          const clicks = clickCounts[link.id]?.total ?? 0;
                          const maxC = Math.max(...topLinks.map((l: LinkType) => clickCounts[l.id]?.total ?? 0), 1);
                          const pct = Math.max((clicks / maxC) * 100, 3);
                          const domain = link.domainId ? domainMap[link.domainId] : null;
                          const shortUrl = domain ? `https://${domain}/${link.slug}` : `${origin}/r/${link.slug}`;
                          return <LinkRow key={link.id} rank={i+1} slug={link.slug} domain={domain} shortUrl={shortUrl} enabled={link.enabled} clicks={clicks} pct={pct} />;
                        })}
                      </div>
                }
              </AnalyticsPanel>
            </div>

            {/* Device Donut */}
            <div className="lg:col-span-5">
              <AnalyticsPanel title="Traffic by Device">
                <div className="flex-1 flex items-center justify-center py-2">
                  <DeviceDonutChart data={topDevices} />
                </div>
              </AnalyticsPanel>
            </div>
          </div>

          {/* ── ROW 2: Countries + Sources + Recent ── */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">

            {/* Countries */}
            <div className="lg:col-span-5">
              <div className="h-full rounded-xl bg-[#18181B] border border-[#27272A] overflow-hidden">
                <div className="px-5 py-4 flex items-center justify-between border-b border-[#27272A]">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-[#10B981]/10 border border-[#10B981]/15">
                      <MapPin className="w-3.5 h-3.5 text-[#10B981]" />
                    </div>
                    <h3 className="text-[14px] font-bold text-[#FAFAFA] font-[family-name:var(--font-space-grotesk)]">Top Countries</h3>
                  </div>
                  {topCountries.length > 0 && (
                    <span className="text-[10px] font-bold text-[#10B981] px-2 py-0.5 rounded-md bg-[#10B981]/10 border border-[#10B981]/15">{topCountries.length} regions</span>
                  )}
                </div>
                <div className="px-5 py-4">
                  {topCountries.length === 0
                    ? <EmptyCard icon={<Globe className="w-5 h-5 text-[#6EE7B7]" />} title="No geographic data" hint="Country data appears after your links get clicks." ctaHref="/links" ctaText="Share a link" accentColor="#10B981" />
                    : <div className="space-y-1">
                        {topCountries.map((c: TopEntry, idx: number) => {
                          const maxCount = Math.max(...topCountries.map((x: TopEntry) => x.count), 1);
                          const pct = Math.round((c.count / maxCount) * 100);
                          const totalAll = topCountries.reduce((s: number, x: TopEntry) => s + x.count, 0) || 1;
                          const sharePct = Math.round((c.count / totalAll) * 100);
                          const isTop3 = idx < 3;
                          return (
                            <div key={c.label} className="group flex items-center gap-3 py-2.5 px-3 -mx-3 rounded-lg transition-colors hover:bg-[#27272A]/50">
                              <span className={`text-[11px] font-bold tabular-nums w-4 text-center shrink-0 ${isTop3 ? "text-[#10B981]" : "text-[#3F3F46]"}`}>{idx + 1}</span>
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isTop3 ? "bg-[#10B981]/10 border border-[#10B981]/15" : "bg-[#27272A] border border-[#3F3F46]/30"}`}>
                                <CountryFlag code={c.label} width={20} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-[13px] font-medium text-[#E4E4E7] truncate">{COUNTRY[c.label] ?? c.label}</span>
                                  <div className="flex items-center gap-2 shrink-0 ml-2">
                                    <span className="text-[10px] font-semibold text-[#10B981] px-1 py-0.5 rounded bg-[#10B981]/5">{sharePct}%</span>
                                    <span className="text-[13px] text-[#FAFAFA] tabular-nums font-bold font-[family-name:var(--font-space-grotesk)]">{fmtNum(c.count)}</span>
                                  </div>
                                </div>
                                <div className="h-[5px] rounded-full overflow-hidden bg-[#27272A]">
                                  <div className="h-full rounded-full transition-all duration-700 ease-out" style={{ width: `${pct}%`, background: isTop3 ? "linear-gradient(90deg, #10B981, #06B6D4)" : "#3F3F46" }} />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                  }
                </div>
              </div>
            </div>

            {/* Traffic Sources */}
            <div className="lg:col-span-4">
              <div className="h-full rounded-xl bg-[#18181B] border border-[#27272A] overflow-hidden">
                <div className="px-5 py-4 flex items-center justify-between border-b border-[#27272A]">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-[#8B5CF6]/10 border border-[#8B5CF6]/15">
                      <Wifi className="w-3.5 h-3.5 text-[#8B5CF6]" />
                    </div>
                    <h3 className="text-[14px] font-bold text-[#FAFAFA] font-[family-name:var(--font-space-grotesk)]">Traffic Sources</h3>
                  </div>
                  {topRefs.length > 0 && (
                    <span className="text-[10px] font-bold text-[#8B5CF6] px-2 py-0.5 rounded-md bg-[#8B5CF6]/10 border border-[#8B5CF6]/15">{topRefs.length} sources</span>
                  )}
                </div>
                <div className="px-5 py-4">
                  {topRefs.length === 0
                    ? <EmptyCard icon={<Wifi className="w-5 h-5 text-[#A78BFA]" />} title="No referrer data" hint="Traffic sources appear when your links get clicks." ctaHref="/links" ctaText="Share a link" />
                    : <div className="space-y-1">
                        {topRefs.map((r: TopEntry, i: number) => {
                          const maxRef = Math.max(...topRefs.map((x: TopEntry) => x.count), 1);
                          const pct = Math.round((r.count / maxRef) * 100);
                          const totalRefs = topRefs.reduce((s: number, x: TopEntry) => s + x.count, 0) || 1;
                          const sharePct = Math.round((r.count / totalRefs) * 100);
                          const isTop = i < 2;
                          const name = cleanReferrer(r.label);
                          const isDirect = name === "Direct";
                          return (
                            <div key={i} className="group flex items-center gap-3 py-2.5 px-3 -mx-3 rounded-lg transition-colors hover:bg-[#27272A]/50">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isTop ? "bg-[#8B5CF6]/10 border border-[#8B5CF6]/15" : "bg-[#27272A] border border-[#3F3F46]/30"}`}>
                                {isDirect ? <MousePointerClick className="w-3.5 h-3.5 text-[#8B5CF6]" /> : <Globe className="w-3.5 h-3.5 text-[#8B5CF6]" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-1">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <span className="text-[13px] font-medium text-[#E4E4E7] truncate">{name}</span>
                                    {isDirect && <span className="text-[9px] font-bold text-[#52525B] bg-[#27272A] px-1 py-0.5 rounded shrink-0">DIRECT</span>}
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0 ml-2">
                                    <span className="text-[10px] font-semibold text-[#8B5CF6] px-1 py-0.5 rounded bg-[#8B5CF6]/5">{sharePct}%</span>
                                    <span className="text-[13px] text-[#FAFAFA] tabular-nums font-bold font-[family-name:var(--font-space-grotesk)]">{fmtNum(r.count)}</span>
                                  </div>
                                </div>
                                <div className="h-[5px] rounded-full overflow-hidden bg-[#27272A]">
                                  <div className="h-full rounded-full transition-all duration-700 ease-out" style={{ width: `${pct}%`, background: isTop ? "linear-gradient(90deg, #8B5CF6, #06B6D4)" : "#3F3F46" }} />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                  }
                </div>
              </div>
            </div>

            {/* Recent Clicks */}
            <div className="lg:col-span-3">
              <div className="h-full rounded-xl bg-[#18181B] border border-[#27272A] overflow-hidden">
                <div className="px-5 py-4 flex items-center justify-between border-b border-[#27272A]">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-[#F59E0B]/10 border border-[#F59E0B]/15">
                      <Activity className="w-3.5 h-3.5 text-[#F59E0B]" />
                    </div>
                    <h3 className="text-[14px] font-bold text-[#FAFAFA] font-[family-name:var(--font-space-grotesk)]">Recent Clicks</h3>
                  </div>
                  <Link href="/live" className="flex items-center gap-1 text-[11px] font-semibold text-[#52525B] hover:text-[#F59E0B] transition-colors">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E] animate-pulse" />
                    Live
                  </Link>
                </div>
                <div className="px-5 py-4">
                  {recentClicks.length === 0
                    ? <EmptyCard icon={<Eye className="w-5 h-5 text-[#FCD34D]" />} title="No clicks yet" hint="Click events appear here in real time." ctaHref="/links" ctaText="Share a link" accentColor="#F59E0B" />
                    : <div className="space-y-0.5">
                        {recentClicks.slice(0, 6).map((click: ClickEvent, idx: number) => (
                          <div key={click.id || idx} className="group flex items-center gap-2.5 py-2 px-2.5 -mx-2.5 rounded-lg transition-colors hover:bg-[#27272A]/50">
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 bg-[#27272A] border border-[#3F3F46]/30">
                              {click.country ? <CountryFlag code={click.country} width={16} /> : <Globe className="w-3 h-3 text-[#52525B]" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[12px] font-semibold text-[#FAFAFA] truncate leading-tight">
                                {click.domain ? `${click.domain}/` : ""}{click.slug}
                              </p>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                {click.country && <span className="text-[10px] text-[#52525B] font-medium">{COUNTRY[click.country] ?? click.country}</span>}
                                {click.browser && <><span className="text-[#3F3F46]">&middot;</span><span className="text-[10px] text-[#52525B] font-medium">{click.browser}</span></>}
                              </div>
                            </div>
                            <span className="text-[10px] text-[#52525B] font-medium shrink-0 tabular-nums">{fmtAgo(click.timestamp)}</span>
                          </div>
                        ))}
                      </div>
                  }
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
      <LinkModal isOpen={showLinkModal} onClose={() => setShowLinkModal(false)} />
    </ProtectedLayout>
  );
}


/* ═══ KPI CARD ═══ */
function KpiCard({ label, value, sub, delta, accent, icon }: {
  label: string; value: string; sub: string; delta: number | null;
  accent: string; icon: React.ReactNode;
}) {
  return (
    <div className="group rounded-xl bg-[#18181B] border border-[#27272A] p-4 sm:p-5 transition-all duration-200 hover:border-[#3F3F46]">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] font-semibold tracking-[0.06em] uppercase text-[#52525B]">{label}</p>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center transition-transform duration-200 group-hover:scale-110" style={{ background: `${accent}15`, color: accent, border: `1px solid ${accent}20` }}>
          {icon}
        </div>
      </div>

      <p className="text-[28px] sm:text-[36px] font-bold text-[#FAFAFA] leading-[1] tabular-nums tracking-[-0.03em] font-[family-name:var(--font-space-grotesk)]">
        {value}
      </p>

      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[#27272A]">
        {delta !== null && (
          <span className={`inline-flex items-center gap-0.5 text-[12px] font-bold px-2 py-0.5 rounded-md ${
            delta >= 0 ? "text-[#4ADE80] bg-[#4ADE80]/10" : "text-[#FCA5A5] bg-[#FCA5A5]/10"
          }`}>
            {delta >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {delta >= 0 ? "+" : ""}{delta}%
          </span>
        )}
        <span className="text-[12px] font-medium text-[#52525B]">{sub}</span>
      </div>
    </div>
  );
}


/* ═══ INSIGHT CARD ═══ */
function InsightCard({ label, value, sub, icon, accent, cta }: {
  label: string; value: string; sub: string;
  icon: React.ReactNode; accent: string; cta?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl bg-[#18181B] border border-[#27272A] overflow-hidden transition-all duration-200 hover:border-[#3F3F46]">
      <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-r-full" style={{ background: accent }} />
      <div className="pl-5 pr-4 py-4 flex items-center gap-3 relative">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${accent}12`, color: accent, border: `1px solid ${accent}18` }}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold text-[#52525B] tracking-[0.06em] uppercase">{label}</p>
          <p className="text-[20px] sm:text-[24px] font-bold text-[#FAFAFA] leading-none tabular-nums tracking-[-0.02em] mt-0.5 font-[family-name:var(--font-space-grotesk)]">{value}</p>
          <p className="text-[12px] text-[#52525B] mt-0.5 truncate font-medium">{sub}</p>
          {cta}
        </div>
      </div>
    </div>
  );
}


/* ═══ ANALYTICS PANEL ═══ */
function AnalyticsPanel({ title, badge, action, children }: {
  title: string; badge?: string; action?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl bg-[#18181B] border border-[#27272A] overflow-hidden h-full flex flex-col">
      <div className="px-5 py-4 flex items-center justify-between shrink-0 border-b border-[#27272A]">
        <div className="flex items-center gap-2">
          <h3 className="text-[14px] font-bold text-[#FAFAFA] font-[family-name:var(--font-space-grotesk)]">{title}</h3>
          {badge && (
            <span className="text-[10px] font-bold text-[#8B5CF6] bg-[#8B5CF6]/10 px-1.5 py-0.5 rounded-md tabular-nums border border-[#8B5CF6]/15">{badge}</span>
          )}
        </div>
        {action}
      </div>
      <div className="px-5 pb-5 pt-3 flex-1 flex flex-col">{children}</div>
    </div>
  );
}


/* ═══ EMPTY STATE ═══ */
function EmptyCard({ icon, title, hint, ctaHref, ctaText, accentColor = "#8B5CF6" }: {
  icon: React.ReactNode; title: string; hint?: string;
  ctaHref: string; ctaText: string; accentColor?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center flex-1">
      <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4" style={{ background: `${accentColor}12`, border: `1px solid ${accentColor}18` }}>
        {icon}
      </div>
      <p className="text-[14px] font-bold text-[#FAFAFA]">{title}</p>
      {hint && <p className="text-[13px] text-[#52525B] mt-1.5 max-w-[240px] mx-auto leading-relaxed">{hint}</p>}
      <Link href={ctaHref}>
        <button className="mt-4 text-[13px] font-semibold px-4 py-2 rounded-lg text-white transition-all hover:scale-[1.02] active:scale-[0.97]" style={{ background: `linear-gradient(135deg, ${accentColor}, ${accentColor}CC)` }}>
          {ctaText} <ArrowRight className="w-3.5 h-3.5 inline ml-1" />
        </button>
      </Link>
    </div>
  );
}

function ChartEmpty() {
  return (
    <div className="h-full flex flex-col items-center justify-center gap-4">
      <div className="w-14 h-14 rounded-xl flex items-center justify-center bg-[#8B5CF6]/10 border border-[#8B5CF6]/15">
        <BarChart3 className="w-6 h-6 text-[#8B5CF6]" />
      </div>
      <div className="text-center">
        <p className="text-[15px] font-bold text-[#FAFAFA]">No click data yet</p>
        <p className="text-[13px] text-[#52525B] mt-1">Share your short links to see activity here</p>
      </div>
      <Link href="/links">
        <button className="text-[13px] font-semibold text-white px-4 py-2 rounded-lg transition-all hover:scale-[1.02] active:scale-[0.97]" style={{ background: "linear-gradient(135deg, #8B5CF6, #7C3AED)" }}>
          Create a link <ArrowRight className="w-3.5 h-3.5 inline ml-1" />
        </button>
      </Link>
    </div>
  );
}


/* ═══ LINK ROW ═══ */
function LinkRow({ rank, slug, domain, shortUrl, enabled, clicks, pct }: {
  rank: number; slug: string; domain: string | null; shortUrl: string;
  enabled: boolean; clicks: number; pct: number;
}) {
  const [copied, setCopied] = useState(false);
  function copy() { navigator.clipboard.writeText(shortUrl); setCopied(true); setTimeout(() => setCopied(false), 1500); }
  return (
    <div className="group flex items-center gap-3 py-3 px-3 -mx-3 rounded-lg transition-colors hover:bg-[#27272A]/50">
      <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 text-[11px] font-bold tabular-nums hidden sm:flex ${
        rank <= 3 ? "bg-[#8B5CF6]/10 text-[#8B5CF6] border border-[#8B5CF6]/15" : "bg-[#27272A] text-[#52525B] border border-[#3F3F46]/30"
      }`}>
        {rank}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1.5">
          <p className="text-[13px] font-semibold text-[#E4E4E7] truncate leading-tight">
            {domain ? <span className="text-[#71717A] font-medium hidden sm:inline">{domain}/</span> : null}{slug}
          </p>
          <span className={`text-[9px] font-bold px-2 py-[2px] rounded shrink-0 tracking-wider ${
            enabled ? "text-[#4ADE80] bg-[#4ADE80]/10" : "text-[#71717A] bg-[#27272A]"
          }`}>
            {enabled ? "LIVE" : "OFF"}
          </span>
        </div>
        <div className="h-[5px] rounded-full overflow-hidden bg-[#27272A]">
          <div className="h-full rounded-full transition-all duration-700 ease-out" style={{ width: `${pct}%`, background: "linear-gradient(90deg, #8B5CF6, #06B6D4)" }} />
        </div>
      </div>

      <div className="text-right shrink-0 min-w-[44px]">
        <p className="text-[16px] font-bold text-[#FAFAFA] tabular-nums tracking-[-0.02em] font-[family-name:var(--font-space-grotesk)]">{fmtNum(clicks)}</p>
        <p className="text-[10px] text-[#52525B] font-medium">clicks</p>
      </div>

      <div className="flex items-center gap-0.5 sm:opacity-0 sm:group-hover:opacity-100 transition-all shrink-0">
        <button onClick={copy} className="p-2 rounded-md hover:bg-[#27272A] transition-all" aria-label="Copy link">
          {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-[#4ADE80]" /> : <Copy className="w-3.5 h-3.5 text-[#52525B] group-hover:text-[#A1A1AA]" />}
        </button>
        <a href={shortUrl} target="_blank" rel="noopener noreferrer" className="p-2 rounded-md hover:bg-[#27272A] transition-all hidden sm:block" aria-label="Open link">
          <ExternalLink className="w-3.5 h-3.5 text-[#52525B] group-hover:text-[#A1A1AA]" />
        </a>
      </div>
    </div>
  );
}


/* ═══ SKELETON ═══ */
function SkeletonRows({ n }: { n: number }) {
  return (
    <div className="space-y-2 pt-1">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 py-3 animate-pulse">
          <div className="w-6 h-6 rounded-md bg-[#27272A]" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 rounded-md w-3/4 bg-[#27272A]" />
            <div className="h-[5px] rounded-full w-full bg-[#1C1C1E]" />
          </div>
          <div className="w-10 h-5 rounded-md bg-[#27272A]" />
        </div>
      ))}
    </div>
  );
}

/* ─────────────── Plan Usage Banner ─────────────── */
interface PlanUsage {
  clicks30d: number;
  cap: number | null;
  percent: number;
  overCap: boolean;
  isFlagged: boolean;
  flaggedLinksCount: number;
  bannerState: "ok" | "warning" | "over_cap" | "flagged";
  hoursUntilEnforcement: number | null;
  nextPlanHint: string | null;
}

function PlanUsageBanner({ usage }: { usage: PlanUsage | undefined }) {
  if (!usage || usage.bannerState === "ok") return null;

  const themes = {
    warning: {
      bg: "rgba(245,158,11,0.08)",
      border: "rgba(245,158,11,0.35)",
      iconBg: "rgba(245,158,11,0.15)",
      iconColor: "#F59E0B",
      titleColor: "#FBBF24",
      bodyColor: "#FCD34D",
    },
    over_cap: {
      bg: "rgba(239,68,68,0.08)",
      border: "rgba(239,68,68,0.35)",
      iconBg: "rgba(239,68,68,0.15)",
      iconColor: "#EF4444",
      titleColor: "#FCA5A5",
      bodyColor: "#FECACA",
    },
    flagged: {
      bg: "rgba(220,38,38,0.12)",
      border: "rgba(220,38,38,0.5)",
      iconBg: "rgba(220,38,38,0.2)",
      iconColor: "#DC2626",
      titleColor: "#FCA5A5",
      bodyColor: "#FECACA",
    },
    ok: { bg: "", border: "", iconBg: "", iconColor: "", titleColor: "", bodyColor: "" },
  } as const;
  const t = themes[usage.bannerState];

  const title =
    usage.bannerState === "warning" ? "You're approaching your monthly click limit" :
    usage.bannerState === "over_cap" ? "You've exceeded your monthly click limit" :
    "Your links are currently unavailable";

  const body =
    usage.bannerState === "warning"
      ? `You've used ${fmtNum(usage.clicks30d)} of your ${fmtNum(usage.cap ?? 0)} monthly clicks (${usage.percent}%). Upgrade now to avoid any interruption.`
      : usage.bannerState === "over_cap"
        ? usage.hoursUntilEnforcement !== null && usage.hoursUntilEnforcement > 0
          ? `You've used ${fmtNum(usage.clicks30d)} of your ${fmtNum(usage.cap ?? 0)} allowance. Your links will be throttled in approximately ${usage.hoursUntilEnforcement} hour${usage.hoursUntilEnforcement === 1 ? "" : "s"} unless you upgrade.`
          : `You've used ${fmtNum(usage.clicks30d)} of your ${fmtNum(usage.cap ?? 0)} allowance. Your links may be throttled at any time — upgrade to keep them running.`
        : `${usage.flaggedLinksCount} of your links are currently showing a "temporarily unavailable" page to visitors. Upgrade your plan to restore access immediately.`;

  return (
    <div
      className="rounded-xl border p-4 flex flex-col sm:flex-row sm:items-center gap-3"
      style={{ background: t.bg, borderColor: t.border }}
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: t.iconBg }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={t.iconColor} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <path d="M12 9v4"/>
          <path d="M12 17h.01"/>
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-semibold leading-tight" style={{ color: t.titleColor }}>{title}</p>
        <p className="text-[12px] mt-1 leading-relaxed" style={{ color: t.bodyColor }}>{body}</p>
      </div>
      <Link href="/billing" className="shrink-0">
        <button
          className="px-4 py-2 rounded-lg text-[13px] font-semibold text-white transition-all hover:-translate-y-0.5"
          style={{ background: "linear-gradient(135deg, #8B5CF6, #06B6D4)", boxShadow: "0 4px 14px rgba(139,92,246,0.25)" }}
        >
          {usage.nextPlanHint ? `Upgrade to ${usage.nextPlanHint.charAt(0).toUpperCase() + usage.nextPlanHint.slice(1)}` : "Upgrade Plan"}
        </button>
      </Link>
    </div>
  );
}
