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
  Clock, PieChart, Sparkles, Users, Link2, Settings2,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";
import { format, parseISO, subDays, formatDistanceToNow } from "date-fns";
import dynamic from "next/dynamic";
import { LinkModal } from "@/components/LinkModal";

const DashboardAreaChart = dynamic(() => import("@/components/charts/DashboardAreaChart"), { ssr: false });
const DeviceDonutChart  = dynamic(() => import("@/components/charts/DeviceDonutChart"),   { ssr: false });

/* ─── types & helpers ──────────────────────────────────────── */
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

function getFlagEmoji(code: string) {
  if (!code || code.length !== 2) return <span className="text-[16px]">🌍</span>;
  return (
    <img
      src={`https://flagcdn.com/w20/${code.toLowerCase()}.png`}
      srcSet={`https://flagcdn.com/w40/${code.toLowerCase()}.png 2x`}
      width={20}
      height={15}
      alt={code}
      className="rounded-[3px] object-cover"
      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
    />
  );
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

/* Plan monthly click limits */
const PLAN_CLICK_LIMITS: Record<string, number | null> = {
  free: 10_000,
  starter: 1_000_000,
  growth: 5_000_000,
  pro: 25_000_000,
  business: 100_000_000,
  enterprise: null, // unlimited
};
const PLAN_LABELS: Record<string, string> = {
  free: "Free", starter: "Starter", growth: "Growth",
  pro: "Pro", business: "Business", enterprise: "Enterprise",
};

interface UserContext {
  greeting: string;
  dateFormatted: string;
  localTime: string;
  timezone: string;
  country: string | null;
  countryName: string | null;
  city: string | null;
  ip: string;
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

/* ─── main component ───────────────────────────────────────── */
export default function Dashboard() {
  const { user }     = useAuth();
  const [mounted, setMounted] = useState(false);
  const [origin, setOrigin]   = useState("");
  const [period, setPeriod]   = useState<Period>("30d");
  // Stable timestamp: only changes when the period changes, so query keys remain stable
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

  // Memoize period config so query keys are stable between renders
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

  // Current calendar month stats for plan usage bar
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

  // Quick Create
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

  // Plan usage
  const currentPlan = subscription?.plan ?? "free";
  const planLimit = PLAN_CLICK_LIMITS[currentPlan] ?? null;
  const monthClicks = monthStats?.totalClicks ?? 0;
  const planUsagePct = planLimit ? Math.min(Math.round((monthClicks / planLimit) * 100), 100) : null;

  /* ── RENDER ── */
  return (
    <ProtectedLayout>
      <div className="min-h-full relative" style={{ background: "#0B0F1A" }}>

        {/* Ambient background shapes — dark blobs */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden -z-10" aria-hidden>
          <div className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full opacity-[0.07]" style={{ background: "radial-gradient(circle, #818CF8, transparent 70%)" }} />
          <div className="absolute top-1/3 -right-40 w-[600px] h-[600px] rounded-full opacity-[0.05]" style={{ background: "radial-gradient(circle, #34D399, transparent 70%)" }} />
          <div className="absolute bottom-0 left-1/3 w-[400px] h-[400px] rounded-full opacity-[0.04]" style={{ background: "radial-gradient(circle, #FB923C, transparent 70%)" }} />
        </div>

        <div className="px-4 sm:px-6 lg:px-8 pt-14 lg:pt-6 pb-20 max-w-[1280px] mx-auto w-full space-y-8">

          {/* ═══════ HEADER ═══════ */}
          <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 pt-2">
            <div>
              <p className="text-[11px] font-semibold text-[#8B8FA3] tracking-[0.12em] uppercase mb-2" suppressHydrationWarning>
                {userContext ? userContext.dateFormatted : mounted ? format(new Date(), "EEEE, MMMM d") : "\u00A0"}
              </p>
              <h1 className="text-[28px] sm:text-[34px] font-extrabold text-[#F1F5F9] leading-[1.1] tracking-[-0.03em] font-[family-name:var(--font-space-grotesk)]" suppressHydrationWarning>
                {userContext?.greeting ? `${userContext.greeting}, ${firstName}` : `Welcome back, ${firstName}`}
              </h1>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {userContext?.localTime && (
                <span className="text-[12px] text-[#8B8FA3] hidden sm:block tabular-nums font-medium">{userContext.localTime}</span>
              )}
              <Link href="/links">
                <button className="group inline-flex items-center gap-2 text-[13px] font-semibold px-5 py-2.5 rounded-[12px] text-white transition-all duration-200 active:scale-[0.97]" style={{ background: "linear-gradient(135deg, #818CF8 0%, #6366F1 50%, #A78BFA 100%)", boxShadow: "0 4px 15px rgba(129,140,248,0.35), 0 1px 3px rgba(0,0,0,0.3)" }}>
                  <Plus className="w-4 h-4 transition-transform group-hover:rotate-90 duration-300" /> New Link
                </button>
              </Link>
            </div>
          </header>

          {/* ═══════ QUICK CREATE ═══════ */}
          <div
            className="rounded-[16px] overflow-hidden"
            style={{
              background: "rgba(17,24,39,0.65)",
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
              border: "1px solid rgba(255,255,255,0.06)",
              boxShadow: "0 1px 2px rgba(0,0,0,0.3), 0 4px 12px rgba(0,0,0,0.3)",
            }}
          >
            <div className="px-5 sm:px-6 py-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <LinkIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
                  <input
                    type="text"
                    value={quickUrl}
                    onChange={e => { setQuickUrl(e.target.value); setQuickResult(null); setQuickCopied(false); }}
                    onKeyDown={e => { if (e.key === "Enter") handleQuickCreate(); }}
                    placeholder="Paste a long URL to shorten…"
                    className="w-full pl-10 pr-4 py-2.5 text-[13px] font-medium text-[#F1F5F9] placeholder:text-[#64748B] rounded-[12px] outline-none transition-all duration-200 focus:ring-2 focus:ring-[#818CF8]/20"
                    style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.06)" }}
                  />
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={handleQuickCreate}
                    disabled={createMutation.isPending || !quickUrl.trim()}
                    className="inline-flex items-center justify-center gap-2 text-[13px] font-semibold px-5 py-2.5 rounded-[12px] text-white transition-all duration-200 active:scale-[0.97] disabled:opacity-50"
                    style={{ background: "linear-gradient(135deg, #818CF8, #6366F1)", boxShadow: "0 3px 12px rgba(129,140,248,0.25)" }}
                  >
                    {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                    Shorten
                  </button>
                  <button
                    onClick={() => setShowLinkModal(true)}
                    className="inline-flex items-center justify-center w-10 h-10 rounded-[12px] transition-all duration-200 active:scale-[0.95] hover:bg-[rgba(255,255,255,0.03)] group"
                    style={{ border: "1px solid rgba(255,255,255,0.06)" }}
                    title="Advanced options"
                  >
                    <Settings2 className="w-4 h-4 text-[#94A3B8] group-hover:text-[#818CF8] transition-colors" />
                  </button>
                </div>
              </div>

              {/* Result row */}
              {quickResult && (
                <div className="mt-3 flex items-center gap-3 px-4 py-3 rounded-[12px]" style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.15)" }}>
                  <CheckCircle2 className="w-4 h-4 text-[#34D399] shrink-0" />
                  <span className="text-[13px] font-semibold text-[#F1F5F9] truncate flex-1 font-[family-name:var(--font-space-grotesk)]">{quickResult}</span>
                  <button
                    onClick={copyQuickResult}
                    className="inline-flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-[8px] transition-all duration-200 shrink-0"
                    style={{
                      background: quickCopied ? "rgba(34,197,94,0.1)" : "rgba(129,140,248,0.08)",
                      color: quickCopied ? "#34D399" : "#818CF8",
                      border: `1px solid ${quickCopied ? "rgba(34,197,94,0.2)" : "rgba(129,140,248,0.15)"}`,
                    }}
                  >
                    {quickCopied ? <><CheckCircle2 className="w-3.5 h-3.5" /> Copied</> : <><Copy className="w-3.5 h-3.5" /> Copy</>}
                  </button>
                </div>
              )}
              {createMutation.isError && (
                <p className="mt-2 text-[12px] text-[#F87171] font-medium px-1">
                  {(createMutation.error as any)?.message || "Failed to create link. Please try again."}
                </p>
              )}
            </div>
          </div>

          {/* ═══════ ONBOARDING ═══════ */}
          {showOnboarding && (
            <div className="relative overflow-hidden rounded-[20px] p-8" style={{ background: "linear-gradient(135deg, rgba(129,140,248,0.1) 0%, rgba(167,139,250,0.08) 50%, rgba(236,72,153,0.04) 100%)", border: "1px solid rgba(129,140,248,0.15)" }}>
              <div className="absolute top-0 right-0 w-[300px] h-[300px] opacity-20 pointer-events-none" style={{ background: "radial-gradient(circle at top right, rgba(129,140,248,0.3), transparent 70%)" }} />
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 relative">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0" style={{ background: "linear-gradient(135deg, #818CF8, #A78BFA)", boxShadow: "0 8px 24px rgba(129,140,248,0.3)" }}>
                  <Rocket className="w-7 h-7 text-white" />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-[17px] text-[#F1F5F9] tracking-[-0.01em]">Create your first short link</p>
                  <p className="text-[13px] text-[#64748B] mt-1 leading-relaxed">Track clicks, see traffic sources, and understand your audience in real time.</p>
                </div>
                <Link href="/links">
                  <button className="text-white text-[13px] font-semibold px-6 py-3 rounded-[12px] transition-all hover:scale-[1.02] active:scale-[0.98] shrink-0" style={{ background: "linear-gradient(135deg, #818CF8, #6366F1)", boxShadow: "0 4px 14px rgba(129,140,248,0.3)" }}>
                    Get started &rarr;
                  </button>
                </Link>
              </div>
            </div>
          )}

          {/* ═══════ KPI CARDS — completely new split-panel design ═══════ */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            <KpiCard
              label="Total Clicks"
              value={stats == null ? "\u2014" : fmtNum(clicksNow)}
              sub={PERIOD_LABEL[period]}
              delta={delta}
              color="indigo"
              icon={<MousePointerClick className="w-5 h-5" />}
            />
            <KpiCard
              label="Unique Visitors"
              value={stats == null ? "\u2014" : fmtNum(uniqueNow)}
              sub={PERIOD_LABEL[period]}
              delta={uniqueDelta}
              color="violet"
              icon={<Users className="w-5 h-5" />}
            />
            <KpiCard
              label="Total Links"
              value={isLoading ? "\u2014" : String(totalLinks)}
              sub={`${activeLinks} active`}
              delta={null}
              color="teal"
              icon={<Link2 className="w-5 h-5" />}
            />
            <KpiCard
              label="Today"
              value={fmtNum(todayClicks)}
              sub="Clicks today"
              delta={null}
              color="amber"
              icon={<Zap className="w-5 h-5" />}
            />
          </div>

          {/* ═══════ PLAN USAGE BAR ═══════ */}
          {planLimit !== null && (
            <div
              className="rounded-[16px] overflow-hidden transition-all duration-200"
              style={{
                background: "rgba(17,24,39,0.65)",
                backdropFilter: "blur(16px)",
                WebkitBackdropFilter: "blur(16px)",
                border: "1px solid rgba(255,255,255,0.06)",
                boxShadow: "0 1px 2px rgba(0,0,0,0.3), 0 4px 12px rgba(0,0,0,0.3)",
              }}
            >
              <div className="px-5 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-3">
                {/* Left: label + plan badge */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0" style={{ background: "rgba(129,140,248,0.1)", border: "1px solid rgba(129,140,248,0.12)" }}>
                    <Activity className="w-4 h-4 text-[#818CF8]" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-semibold text-[#F1F5F9]">Monthly Usage</span>
                      <span className="text-[10px] font-bold text-[#818CF8] bg-[rgba(129,140,248,0.1)] px-2 py-0.5 rounded-[6px]" style={{ border: "1px solid rgba(129,140,248,0.1)" }}>
                        {PLAN_LABELS[currentPlan] ?? currentPlan}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#8B8FA3] font-medium mt-0.5">
                      {fmtNum(monthClicks)} of {fmtNum(planLimit)} clicks used
                    </p>
                  </div>
                </div>

                {/* Middle: progress bar */}
                <div className="flex-1 flex items-center gap-3">
                  <div className="flex-1 h-[8px] rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                    <div
                      className="h-full rounded-full transition-all duration-700 ease-out"
                      style={{
                        width: `${Math.max(planUsagePct ?? 0, 1)}%`,
                        background: (planUsagePct ?? 0) >= 90
                          ? "linear-gradient(90deg, #DC2626, #EF4444)"
                          : (planUsagePct ?? 0) >= 70
                            ? "linear-gradient(90deg, #D97706, #F59E0B)"
                            : "linear-gradient(90deg, #818CF8, #6366F1, #A5B4FC)",
                        boxShadow: (planUsagePct ?? 0) >= 90
                          ? "0 0 8px rgba(220,38,38,0.3)"
                          : (planUsagePct ?? 0) >= 70
                            ? "0 0 8px rgba(245,158,11,0.3)"
                            : "0 0 8px rgba(129,140,248,0.2)",
                      }}
                    />
                  </div>
                  <span className="text-[12px] font-bold tabular-nums text-[#F1F5F9] shrink-0">{planUsagePct ?? 0}%</span>
                </div>

                {/* Right: upgrade CTA (only on free/starter) */}
                {(currentPlan === "free" || currentPlan === "starter") && (
                  <Link href="/billing" className="shrink-0">
                    <button className="text-[11px] font-semibold text-[#818CF8] hover:text-white px-3.5 py-1.5 rounded-[8px] transition-all duration-200 hover:bg-[#818CF8]" style={{ border: "1px solid rgba(129,140,248,0.2)" }}>
                      Upgrade
                    </button>
                  </Link>
                )}
              </div>
            </div>
          )}

          {/* ═══════ CHART CARD — frosted panel ═══════ */}
          <div className="rounded-[20px] overflow-hidden" style={{ background: "rgba(17,24,39,0.65)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)", border: "1px solid rgba(255,255,255,0.06)", boxShadow: "0 1px 2px rgba(0,0,0,0.3), 0 8px 32px rgba(0,0,0,0.3)" }}>
            <div className="px-5 sm:px-7 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <div>
                <h2 className="text-[16px] font-bold text-[#F1F5F9] font-[family-name:var(--font-space-grotesk)] tracking-[-0.02em]">Click Activity</h2>
                <p className="text-[12px] text-[#8B8FA3] mt-0.5 font-medium">{PERIOD_LABEL[period]}</p>
              </div>
              {/* Period pills */}
              <div className="flex items-center gap-1 p-1 rounded-[14px] overflow-x-auto" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.06)" }}>
                {(["1h","6h","24h","7d","30d","3m","all"] as Period[]).map(p => (
                  <button key={p} onClick={() => handlePeriodChange(p)}
                    className={`text-[11px] font-semibold px-2.5 sm:px-3.5 py-2 rounded-[10px] transition-all duration-200 shrink-0 ${
                      period === p
                        ? "text-[#A5B4FC]"
                        : "text-[#64748B] hover:text-[#CBD5E1] hover:bg-[rgba(255,255,255,0.03)]"
                    }`}
                    style={period === p ? { background: "rgba(129,140,248,0.12)", boxShadow: "0 2px 8px rgba(129,140,248,0.15)" } : {}}>
                    {p === "1h" ? "1H" : p === "6h" ? "6H" : p === "24h" ? "24H" : p === "7d" ? "7D" : p === "30d" ? "30D" : p === "3m" ? "3M" : "1Y"}
                  </button>
                ))}
              </div>
            </div>
            <div className="h-[260px] sm:h-[300px] px-4 sm:px-5 py-5">
              {tsResult.isLoading
                ? <div className="h-full flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-[#818CF8]" /></div>
                : timeseries.length > 0
                  ? <DashboardAreaChart data={timeseries} period={period} />
                  : <ChartEmpty />
              }
            </div>
          </div>

          {/* ═══════ INSIGHT RIBBON — horizontal scroll cards ═══════ */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            <InsightCard
              label="Top Link"
              value={topLinkEntry ? fmtNum(topLinkClicks) : "\u2014"}
              sub={topLinkEntry ? topLinkDisplay : "No clicks yet"}
              icon={<TrendingUp className="w-[18px] h-[18px]" />}
              accent="#818CF8"
            />
            <InsightCard
              label="Top Country"
              value={topCountryEntry ? (COUNTRY[topCountryEntry.label] ?? topCountryEntry.label) : "\u2014"}
              sub={topCountryEntry ? `${fmtNum(topCountryEntry.count)} visits \u00B7 ${topCountryPct}%` : "No data yet"}
              icon={topCountryEntry ? <span className="flex items-center">{getFlagEmoji(topCountryEntry.label)}</span> : <Globe className="w-[18px] h-[18px]" />}
              accent="#FB923C"
            />
            <InsightCard
              label="Domains"
              value={String(domainCount)}
              sub={domainCount > 0 ? "Custom configured" : "None configured"}
              icon={<Globe className="w-[18px] h-[18px]" />}
              accent="#34D399"
              cta={domainCount === 0 ? <Link href="/domains" className="text-[11px] font-semibold text-[#818CF8] hover:underline mt-1 inline-block">Set up &rarr;</Link> : undefined}
            />
            <InsightCard
              label="All-time"
              value={allStats == null ? "\u2014" : fmtNum(allTime)}
              sub="Lifetime clicks"
              icon={<MousePointerClick className="w-[18px] h-[18px]" />}
              accent="#A5B4FC"
            />
          </div>

          {/* ═══════ ANALYTICS CARDS — bento grid ═══════ */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

            {/* Top Performing Links */}
            <div className="lg:col-span-7">
              <AnalyticsPanel
                title="Top Performing Links"
                badge={topLinks.length > 0 ? `${topLinks.length}` : undefined}
                action={<Link href="/links" className="flex items-center gap-1.5 text-[12px] font-semibold text-[#8B8FA3] hover:text-[#818CF8] transition-colors duration-200">View all <ArrowRight className="w-3.5 h-3.5" /></Link>}
              >
                {isLoading
                  ? <SkeletonRows n={5} />
                  : topLinks.length === 0
                    ? <EmptyCard icon={<LinkIcon className="w-6 h-6 text-[#A5B4FC]" />} title="No links yet" hint="Create your first short link to start tracking performance." ctaHref="/links" ctaText="Create a link" />
                    : <div className="space-y-1">
                        {topLinks.map((link: LinkType, i: number) => {
                          const clicks = clickCounts[link.id]?.total ?? 0;
                          const maxC   = Math.max(...topLinks.map((l: LinkType) => clickCounts[l.id]?.total ?? 0), 1);
                          const pct    = Math.max((clicks / maxC) * 100, 3);
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

          {/* Row 2: Countries + Sources + Recent — PREMIUM WIDGETS */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

            {/* ═══════ TOP COUNTRIES — Premium Analytics Widget ═══════ */}
            <div className="lg:col-span-5">
              <div className="h-full rounded-[20px] overflow-hidden" style={{ background: "rgba(17,24,39,0.65)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)", border: "1px solid rgba(255,255,255,0.06)", boxShadow: "0 1px 2px rgba(0,0,0,0.3), 0 8px 32px rgba(0,0,0,0.3)" }}>
                {/* Header with accent line */}
                <div className="relative">
                  <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: "linear-gradient(90deg, #34D399, #6EE7B7, #A7F3D0, #D1FAE5)" }} />
                  <div className="px-5 sm:px-7 py-5 flex items-center justify-between" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-[10px] flex items-center justify-center" style={{ background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.15)" }}>
                        <MapPin className="w-4 h-4 text-[#34D399]" />
                      </div>
                      <h3 className="text-[14px] font-bold text-[#F1F5F9] font-[family-name:var(--font-space-grotesk)] tracking-[-0.01em]">Top Countries</h3>
                    </div>
                    {topCountries.length > 0 && (
                      <span className="text-[10px] font-bold text-[#34D399] px-2.5 py-1 rounded-[8px]" style={{ background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.12)" }}>{topCountries.length} regions</span>
                    )}
                  </div>
                </div>
                {/* Content */}
                <div className="px-5 sm:px-7 py-5">
                  {topCountries.length === 0
                    ? <EmptyCard icon={<Globe className="w-6 h-6 text-[#6EE7B7]" />} title="No geographic data" hint="Country data appears after your links get clicks from different regions." ctaHref="/links" ctaText="Share a link" accentColor="#34D399" />
                    : <div className="space-y-1.5">
                        {topCountries.map((c: TopEntry, idx: number) => {
                          const maxCount = Math.max(...topCountries.map((x: TopEntry) => x.count), 1);
                          const pct = Math.round((c.count / maxCount) * 100);
                          const totalAll = topCountries.reduce((s: number, x: TopEntry) => s + x.count, 0) || 1;
                          const sharePct = Math.round((c.count / totalAll) * 100);
                          // Rank-based intensity: top 3 get richer treatment
                          const isTop3 = idx < 3;
                          return (
                            <div
                              key={c.label}
                              className="group flex items-center gap-3.5 py-3 px-3.5 -mx-3.5 rounded-[14px] transition-all duration-250"
                              style={{ background: "transparent" }}
                              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(52,211,153,0.04)"; }}
                              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                            >
                              {/* Rank number */}
                              <span className={`text-[11px] font-bold tabular-nums w-4 text-center shrink-0 ${isTop3 ? "text-[#34D399]" : "text-[#475569]"}`}>{idx + 1}</span>
                              {/* Flag container */}
                              <div
                                className="w-10 h-10 rounded-[12px] flex items-center justify-center shrink-0 transition-all duration-250 group-hover:scale-110 group-hover:shadow-md"
                                style={{
                                  background: isTop3 ? "rgba(52,211,153,0.1)" : "rgba(255,255,255,0.06)",
                                  border: isTop3 ? "1px solid rgba(52,211,153,0.18)" : "1px solid rgba(255,255,255,0.06)",
                                  boxShadow: isTop3 ? "0 2px 8px rgba(52,211,153,0.08)" : "none",
                                }}
                              >
                                {getFlagEmoji(c.label)}
                              </div>
                              {/* Data */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-1.5">
                                  <span className="text-[13px] font-semibold text-[#E2E8F0] truncate">{COUNTRY[c.label] ?? c.label}</span>
                                  <div className="flex items-center gap-2 shrink-0 ml-2">
                                    <span className="text-[10px] font-semibold text-[#34D399] px-1.5 py-0.5 rounded-[5px]" style={{ background: "rgba(52,211,153,0.06)" }}>{sharePct}%</span>
                                    <span className="text-[13px] text-[#F1F5F9] tabular-nums font-bold font-[family-name:var(--font-space-grotesk)]">{fmtNum(c.count)}</span>
                                  </div>
                                </div>
                                <div className="h-[7px] rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                                  <div
                                    className="h-full rounded-full transition-all duration-700 ease-out"
                                    style={{
                                      width: `${pct}%`,
                                      background: isTop3
                                        ? "linear-gradient(90deg, #0D9488 0%, #14B8A6 30%, #2DD4BF 60%, #5EEAD4 100%)"
                                        : "linear-gradient(90deg, #475569, #64748B)",
                                      boxShadow: isTop3 ? "0 0 12px rgba(52,211,153,0.2)" : "none",
                                    }}
                                  />
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

            {/* ═══════ TRAFFIC SOURCES — Premium Data Widget ═══════ */}
            <div className="lg:col-span-4">
              <div className="h-full rounded-[20px] overflow-hidden" style={{ background: "rgba(17,24,39,0.65)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)", border: "1px solid rgba(255,255,255,0.06)", boxShadow: "0 1px 2px rgba(0,0,0,0.3), 0 8px 32px rgba(0,0,0,0.3)" }}>
                {/* Header with accent line */}
                <div className="relative">
                  <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: "linear-gradient(90deg, #818CF8, #6366F1, #A5B4FC, #C7D2FE)" }} />
                  <div className="px-5 sm:px-7 py-5 flex items-center justify-between" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-[10px] flex items-center justify-center" style={{ background: "rgba(129,140,248,0.1)", border: "1px solid rgba(129,140,248,0.15)" }}>
                        <Wifi className="w-4 h-4 text-[#818CF8]" />
                      </div>
                      <h3 className="text-[14px] font-bold text-[#F1F5F9] font-[family-name:var(--font-space-grotesk)] tracking-[-0.01em]">Traffic Sources</h3>
                    </div>
                    {topRefs.length > 0 && (
                      <span className="text-[10px] font-bold text-[#818CF8] px-2.5 py-1 rounded-[8px]" style={{ background: "rgba(129,140,248,0.1)", border: "1px solid rgba(129,140,248,0.12)" }}>{topRefs.length} sources</span>
                    )}
                  </div>
                </div>
                {/* Content */}
                <div className="px-5 sm:px-7 py-5">
                  {topRefs.length === 0
                    ? <EmptyCard icon={<Wifi className="w-6 h-6 text-[#A5B4FC]" />} title="No referrer data" hint="Traffic sources appear when your links get clicks from other websites." ctaHref="/links" ctaText="Share a link" />
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
                            <div
                              key={i}
                              className="group flex items-center gap-3.5 py-3 px-3.5 -mx-3.5 rounded-[14px] transition-all duration-250"
                              style={{ background: "transparent" }}
                              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(129,140,248,0.04)"; }}
                              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                            >
                              {/* Icon */}
                              <div
                                className="w-10 h-10 rounded-[12px] flex items-center justify-center shrink-0 transition-all duration-250 group-hover:scale-110 group-hover:shadow-md"
                                style={{
                                  background: isTop ? "rgba(129,140,248,0.1)" : "rgba(255,255,255,0.06)",
                                  border: isTop ? "1px solid rgba(129,140,248,0.15)" : "1px solid rgba(255,255,255,0.06)",
                                  boxShadow: isTop ? "0 2px 8px rgba(129,140,248,0.08)" : "none",
                                }}
                              >
                                {isDirect
                                  ? <MousePointerClick className="w-4 h-4 text-[#818CF8]" />
                                  : <Globe className="w-4 h-4 text-[#818CF8]" />
                                }
                              </div>
                              {/* Data */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-1.5">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className="text-[13px] font-semibold text-[#E2E8F0] truncate">{name}</span>
                                    {isDirect && <span className="text-[9px] font-bold text-[#8B8FA3] bg-[rgba(255,255,255,0.06)] px-1.5 py-0.5 rounded-[4px] shrink-0">DIRECT</span>}
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0 ml-2">
                                    <span className="text-[10px] font-semibold text-[#818CF8] px-1.5 py-0.5 rounded-[5px]" style={{ background: "rgba(129,140,248,0.06)" }}>{sharePct}%</span>
                                    <span className="text-[13px] text-[#F1F5F9] tabular-nums font-bold font-[family-name:var(--font-space-grotesk)]">{fmtNum(r.count)}</span>
                                  </div>
                                </div>
                                <div className="h-[7px] rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                                  <div
                                    className="h-full rounded-full transition-all duration-700 ease-out"
                                    style={{
                                      width: `${pct}%`,
                                      background: isTop
                                        ? "linear-gradient(90deg, #818CF8 0%, #6366F1 30%, #A5B4FC 60%, #C7D2FE 100%)"
                                        : "linear-gradient(90deg, #475569, #64748B)",
                                      boxShadow: isTop ? "0 0 12px rgba(129,140,248,0.2)" : "none",
                                    }}
                                  />
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

            {/* ═══════ RECENT CLICKS — Live Click Feed ═══════ */}
            <div className="lg:col-span-3">
              <div className="h-full rounded-[20px] overflow-hidden" style={{ background: "rgba(17,24,39,0.65)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)", border: "1px solid rgba(255,255,255,0.06)", boxShadow: "0 1px 2px rgba(0,0,0,0.3), 0 8px 32px rgba(0,0,0,0.3)" }}>
                {/* Header with accent line */}
                <div className="relative">
                  <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: "linear-gradient(90deg, #FB923C, #FBBF24, #FCD34D, #FDE68A)" }} />
                  <div className="px-6 py-5 flex items-center justify-between" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-[10px] flex items-center justify-center" style={{ background: "rgba(251,146,60,0.1)", border: "1px solid rgba(251,146,60,0.15)" }}>
                        <Activity className="w-4 h-4 text-[#FB923C]" />
                      </div>
                      <h3 className="text-[14px] font-bold text-[#F1F5F9] font-[family-name:var(--font-space-grotesk)] tracking-[-0.01em]">Recent Clicks</h3>
                    </div>
                    <Link href="/live" className="flex items-center gap-1 text-[11px] font-semibold text-[#8B8FA3] hover:text-[#FB923C] transition-colors">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E] animate-pulse" />
                      Live
                    </Link>
                  </div>
                </div>
                {/* Content — Click Feed */}
                <div className="px-6 py-5">
                  {recentClicks.length === 0
                    ? <EmptyCard icon={<Eye className="w-6 h-6 text-[#FBBF24]" />} title="No clicks yet" hint="Click events will appear here in real time." ctaHref="/links" ctaText="Share a link" accentColor="#FB923C" />
                    : <div className="space-y-1">
                        {recentClicks.slice(0, 6).map((click: ClickEvent, idx: number) => (
                          <div
                            key={click.id || idx}
                            className="group flex items-center gap-3 py-2.5 px-3 -mx-3 rounded-[12px] transition-all duration-200"
                            style={{ background: "transparent" }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(251,146,60,0.04)"; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                          >
                            {/* Flag or globe */}
                            <div className="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.06)" }}>
                              {click.country ? getFlagEmoji(click.country) : <Globe className="w-3.5 h-3.5 text-[#94A3B8]" />}
                            </div>
                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              <p className="text-[12px] font-semibold text-[#F1F5F9] truncate leading-tight">
                                {click.domain ? `${click.domain}/` : ""}{click.slug}
                              </p>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                {click.country && <span className="text-[10px] text-[#8B8FA3] font-medium">{COUNTRY[click.country] ?? click.country}</span>}
                                {click.browser && <><span className="text-[#475569]">&middot;</span><span className="text-[10px] text-[#8B8FA3] font-medium">{click.browser}</span></>}
                              </div>
                            </div>
                            {/* Time */}
                            <span className="text-[10px] text-[#8B8FA3] font-medium shrink-0 tabular-nums">{fmtAgo(click.timestamp)}</span>
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


/* ═══════════════════════════════════════════════════════════════
   CARD TYPE A — KPI CARD
   Split-panel: colored accent side + data side
   Completely new layout vs old vertical stack
═══════════════════════════════════════════════════════════════ */

const KPI_THEMES = {
  indigo: {
    gradient: "linear-gradient(135deg, #818CF8 0%, #6366F1 50%, #A5B4FC 100%)",
    light: "rgba(129,140,248,0.1)",
    shadow: "rgba(129,140,248,0.20)",
    text: "#818CF8",
    ring: "rgba(129,140,248,0.12)",
  },
  violet: {
    gradient: "linear-gradient(135deg, #A78BFA 0%, #8B5CF6 50%, #C4B5FD 100%)",
    light: "rgba(167,139,250,0.1)",
    shadow: "rgba(167,139,250,0.20)",
    text: "#A78BFA",
    ring: "rgba(167,139,250,0.12)",
  },
  teal: {
    gradient: "linear-gradient(135deg, #34D399 0%, #14B8A6 50%, #6EE7B7 100%)",
    light: "rgba(52,211,153,0.1)",
    shadow: "rgba(52,211,153,0.20)",
    text: "#34D399",
    ring: "rgba(52,211,153,0.12)",
  },
  amber: {
    gradient: "linear-gradient(135deg, #FB923C 0%, #F59E0B 50%, #FBBF24 100%)",
    light: "rgba(251,146,60,0.1)",
    shadow: "rgba(251,146,60,0.20)",
    text: "#FB923C",
    ring: "rgba(251,146,60,0.12)",
  },
};

function KpiCard({ label, value, sub, delta, color, icon }: {
  label: string; value: string; sub: string; delta: number | null;
  color: keyof typeof KPI_THEMES; icon: React.ReactNode;
}) {
  const t = KPI_THEMES[color];
  return (
    <div
      className="group relative rounded-[20px] overflow-hidden transition-all duration-300 ease-out hover:-translate-y-[3px] hover:scale-[1.015] cursor-default"
      style={{
        background: "rgba(17,24,39,0.65)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        border: "1px solid rgba(255,255,255,0.06)",
        boxShadow: `0 1px 2px rgba(0,0,0,0.3), 0 4px 16px rgba(0,0,0,0.3), 0 0 0 0 ${t.shadow}`,
      }}
    >
      {/* Top accent gradient bar — full width, 4px */}
      <div className="h-[4px] w-full" style={{ background: t.gradient }} />

      <div className="p-5 sm:p-6">
        {/* Row: label left, icon right */}
        <div className="flex items-start justify-between mb-4">
          <p className="text-[11px] font-bold tracking-[0.1em] uppercase" style={{ color: t.text }}>{label}</p>
          <div
            className="w-10 h-10 rounded-[14px] flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:rotate-[-4deg]"
            style={{ background: t.light, color: t.text, boxShadow: `0 2px 8px ${t.shadow}`, border: `1px solid ${t.ring}` }}
          >
            {icon}
          </div>
        </div>

        {/* Big number */}
        <p className="text-[36px] sm:text-[44px] font-extrabold text-[#F1F5F9] leading-[1] tabular-nums tracking-[-0.035em] font-[family-name:var(--font-space-grotesk)]">
          {value}
        </p>

        {/* Footer: delta + sub */}
        <div className="flex items-center gap-2.5 mt-4 pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          {delta !== null && (
            <span
              className="inline-flex items-center gap-1 text-[12px] font-bold px-2.5 py-1 rounded-[8px]"
              style={{
                color: delta >= 0 ? "#34D399" : "#F87171",
                background: delta >= 0 ? "rgba(52,211,153,0.08)" : "rgba(248,113,113,0.08)",
                border: `1px solid ${delta >= 0 ? "rgba(52,211,153,0.12)" : "rgba(248,113,113,0.12)"}`,
              }}
            >
              {delta >= 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
              {delta >= 0 ? "+" : ""}{delta}%
            </span>
          )}
          <span className="text-[12px] font-medium text-[#8B8FA3]">{sub}</span>
        </div>
      </div>

      {/* Hover glow effect */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-[20px]"
        style={{ background: `radial-gradient(ellipse 140% 60% at 50% -10%, ${t.shadow} 0%, transparent 70%)` }}
      />
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════════
   CARD TYPE B — INSIGHT CARD (secondary metrics)
   Horizontal layout with left accent line
═══════════════════════════════════════════════════════════════ */
function InsightCard({ label, value, sub, icon, accent, cta }: {
  label: string; value: string; sub: string;
  icon: React.ReactNode; accent: string; cta?: React.ReactNode;
}) {
  return (
    <div
      className="group relative rounded-[18px] overflow-hidden transition-all duration-250 ease-out hover:-translate-y-[2px] cursor-default"
      style={{
        background: "rgba(17,24,39,0.65)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        border: "1px solid rgba(255,255,255,0.06)",
        boxShadow: "0 1px 2px rgba(0,0,0,0.3), 0 4px 12px rgba(0,0,0,0.3)",
      }}
    >
      {/* Left accent stripe — 4px */}
      <div className="absolute left-0 top-0 bottom-0 w-[4px]" style={{ background: accent }} />

      <div className="pl-6 pr-5 py-5 flex items-center gap-4">
        {/* Icon */}
        <div
          className="w-11 h-11 rounded-[14px] flex items-center justify-center shrink-0 transition-all duration-250 group-hover:scale-105"
          style={{ background: `${accent}12`, color: accent, border: `1px solid ${accent}18` }}
        >
          {icon}
        </div>
        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-bold text-[#8B8FA3] tracking-[0.08em] uppercase">{label}</p>
          <p className="text-[24px] sm:text-[28px] font-extrabold text-[#F1F5F9] leading-none tabular-nums tracking-[-0.02em] mt-1 font-[family-name:var(--font-space-grotesk)]">{value}</p>
          <p className="text-[12px] text-[#8B8FA3] mt-1 truncate font-medium">{sub}</p>
          {cta}
        </div>
      </div>
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════════
   CARD TYPE C — ANALYTICS PANEL (data cards)
   Two-zone: header strip + content body with depth layers
═══════════════════════════════════════════════════════════════ */
function AnalyticsPanel({ title, badge, action, children }: {
  title: string; badge?: string; action?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-[20px] overflow-hidden h-full flex flex-col"
      style={{
        background: "rgba(17,24,39,0.65)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        border: "1px solid rgba(255,255,255,0.06)",
        boxShadow: "0 1px 2px rgba(0,0,0,0.3), 0 6px 24px rgba(0,0,0,0.3)",
      }}
    >
      {/* Header zone — subtle tinted bg */}
      <div className="px-6 sm:px-7 py-4 flex items-center justify-between shrink-0" style={{ background: "rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="flex items-center gap-2.5">
          <h3 className="text-[14px] font-bold text-[#F1F5F9] font-[family-name:var(--font-space-grotesk)] tracking-[-0.01em]">{title}</h3>
          {badge && (
            <span className="text-[10px] font-bold text-[#818CF8] bg-[rgba(129,140,248,0.1)] px-2 py-0.5 rounded-md tabular-nums" style={{ border: "1px solid rgba(129,140,248,0.1)" }}>{badge}</span>
          )}
        </div>
        {action}
      </div>
      {/* Content zone */}
      <div className="px-6 sm:px-7 pb-6 pt-4 flex-1 flex flex-col">{children}</div>
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════════
   EMPTY STATE CARD — glowing, inviting, designed
═══════════════════════════════════════════════════════════════ */
function EmptyCard({ icon, title, hint, ctaHref, ctaText, accentColor = "#818CF8" }: {
  icon: React.ReactNode; title: string; hint?: string;
  ctaHref: string; ctaText: string; accentColor?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center flex-1 relative">
      {/* Background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[280px] h-[220px] rounded-full pointer-events-none" style={{ background: `radial-gradient(circle, ${accentColor}08 0%, transparent 70%)` }} />

      {/* Decorative rings */}
      <div className="relative mb-5">
        <div className="absolute -inset-3 rounded-full opacity-30 animate-pulse" style={{ border: `2px dashed ${accentColor}20` }} />
        <div className="absolute -inset-6 rounded-full opacity-15" style={{ border: `1px dashed ${accentColor}15` }} />
        <div
          className="relative w-16 h-16 rounded-[18px] flex items-center justify-center"
          style={{ background: `linear-gradient(135deg, ${accentColor}08, ${accentColor}15)`, border: `1px solid ${accentColor}15`, boxShadow: `0 4px 16px ${accentColor}10` }}
        >
          {icon}
        </div>
      </div>

      <p className="text-[15px] font-bold text-[#F1F5F9] tracking-[-0.01em] relative">{title}</p>
      {hint && <p className="text-[13px] text-[#8B8FA3] mt-2 max-w-[260px] mx-auto leading-relaxed relative font-medium">{hint}</p>}

      <Link href={ctaHref}>
        <button
          className="mt-5 relative text-[13px] font-semibold px-5 py-2.5 rounded-[12px] text-white transition-all duration-200 hover:scale-[1.03] active:scale-[0.97]"
          style={{ background: `linear-gradient(135deg, ${accentColor}, ${accentColor}CC)`, boxShadow: `0 3px 12px ${accentColor}30` }}
        >
          {ctaText} <ArrowRight className="w-3.5 h-3.5 inline ml-1" />
        </button>
      </Link>
    </div>
  );
}

function ChartEmpty() {
  return (
    <div className="h-full flex flex-col items-center justify-center gap-5 relative">
      <div className="absolute w-[300px] h-[250px] rounded-full pointer-events-none" style={{ background: "radial-gradient(circle, rgba(129,140,248,0.06) 0%, transparent 70%)" }} />
      <div className="relative">
        <div className="absolute -inset-4 rounded-full opacity-20 animate-pulse" style={{ border: "2px dashed rgba(129,140,248,0.2)" }} />
        <div className="w-16 h-16 rounded-[18px] flex items-center justify-center" style={{ background: "rgba(129,140,248,0.1)", border: "1px solid rgba(129,140,248,0.12)", boxShadow: "0 4px 16px rgba(129,140,248,0.1)" }}>
          <BarChart3 className="w-7 h-7 text-[#818CF8]" />
        </div>
      </div>
      <div className="text-center relative">
        <p className="text-[16px] font-bold text-[#F1F5F9] tracking-[-0.01em]">No click data yet</p>
        <p className="text-[13px] text-[#8B8FA3] mt-1.5 font-medium">Share your short links to see activity here</p>
      </div>
      <Link href="/links">
        <button className="text-[13px] font-semibold text-white px-5 py-2.5 rounded-[12px] transition-all hover:scale-[1.03] active:scale-[0.97]" style={{ background: "linear-gradient(135deg, #818CF8, #6366F1)", boxShadow: "0 3px 12px rgba(129,140,248,0.3)" }}>
          Create a link <ArrowRight className="w-3.5 h-3.5 inline ml-1" />
        </button>
      </Link>
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════════
   LINK ROW — for analytics panel (Top Performing Links)
═══════════════════════════════════════════════════════════════ */
function LinkRow({ rank, slug, domain, shortUrl, enabled, clicks, pct }: {
  rank: number; slug: string; domain: string | null; shortUrl: string;
  enabled: boolean; clicks: number; pct: number;
}) {
  const [copied, setCopied] = useState(false);
  function copy() { navigator.clipboard.writeText(shortUrl); setCopied(true); setTimeout(() => setCopied(false), 1500); }
  return (
    <div className="group relative flex items-center gap-4 py-3.5 px-4 -mx-4 rounded-[14px] transition-all duration-200 hover:bg-[rgba(255,255,255,0.03)]">

      {/* Rank badge */}
      <div
        className="w-7 h-7 rounded-[8px] flex items-center justify-center shrink-0 text-[11px] font-bold tabular-nums hidden sm:flex transition-all duration-200"
        style={{
          background: rank <= 3 ? "rgba(129,140,248,0.1)" : "rgba(255,255,255,0.06)",
          color: rank <= 3 ? "#818CF8" : "#94A3B8",
          border: rank <= 3 ? "1px solid rgba(129,140,248,0.12)" : "1px solid rgba(255,255,255,0.06)",
        }}
      >
        {rank}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2.5 mb-2">
          <p className="text-[13px] sm:text-[14px] font-semibold text-[#E2E8F0] truncate leading-tight">
            {domain ? <span className="text-[#94A3B8] font-medium hidden sm:inline">{domain}/</span> : null}{slug}
          </p>
          <span
            className="text-[9px] font-black px-2.5 py-[3px] rounded-[6px] shrink-0 tracking-wider"
            style={{
              background: enabled ? "rgba(34,197,94,0.08)" : "rgba(148,163,184,0.08)",
              color: enabled ? "#34D399" : "#94A3B8",
              border: `1px solid ${enabled ? "rgba(34,197,94,0.15)" : "rgba(148,163,184,0.1)"}`,
            }}
          >
            {enabled ? "LIVE" : "OFF"}
          </span>
        </div>
        {/* Progress bar — thicker, gradient, glow */}
        <div className="h-[7px] rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
          <div
            className="h-full rounded-full transition-all duration-700 ease-out"
            style={{
              width: `${pct}%`,
              background: "linear-gradient(90deg, #818CF8 0%, #6366F1 40%, #A5B4FC 70%, #C7D2FE 100%)",
              boxShadow: "0 0 10px rgba(129,140,248,0.25)",
            }}
          />
        </div>
      </div>

      {/* Click count */}
      <div className="text-right shrink-0 min-w-[48px]">
        <p className="text-[18px] font-extrabold text-[#F1F5F9] tabular-nums tracking-[-0.02em] font-[family-name:var(--font-space-grotesk)]">{fmtNum(clicks)}</p>
        <p className="text-[10px] text-[#8B8FA3] font-semibold">clicks</p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-0.5 sm:opacity-0 sm:group-hover:opacity-100 transition-all duration-200 shrink-0">
        <button onClick={copy} className="p-2.5 rounded-[10px] hover:bg-[rgba(255,255,255,0.06)] transition-all duration-200" aria-label="Copy link" style={{ boxShadow: "none" }}>
          {copied ? <CheckCircle2 className="w-4 h-4 text-[#34D399]" /> : <Copy className="w-4 h-4 text-[#475569] group-hover:text-[#818CF8] transition-colors" />}
        </button>
        <a href={shortUrl} target="_blank" rel="noopener noreferrer" className="p-2.5 rounded-[10px] hover:bg-[rgba(255,255,255,0.06)] transition-all duration-200 hidden sm:block" aria-label="Open link">
          <ExternalLink className="w-4 h-4 text-[#475569] group-hover:text-[#818CF8] transition-colors" />
        </a>
      </div>
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════════
   SKELETON LOADER
═══════════════════════════════════════════════════════════════ */
function SkeletonRows({ n }: { n: number }) {
  return (
    <div className="space-y-3 pt-2">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 py-3 animate-pulse">
          <div className="w-7 h-7 rounded-[8px]" style={{ background: "rgba(255,255,255,0.06)" }} />
          <div className="flex-1 space-y-2">
            <div className="h-4 rounded-lg w-3/4" style={{ background: "rgba(255,255,255,0.06)" }} />
            <div className="h-[6px] rounded-full w-full" style={{ background: "rgba(255,255,255,0.04)" }} />
          </div>
          <div className="w-12 h-6 rounded-lg" style={{ background: "rgba(255,255,255,0.06)" }} />
        </div>
      ))}
    </div>
  );
}
