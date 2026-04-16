"use client";
import { useState, useMemo } from "react";
import { keepPreviousData } from "@tanstack/react-query";
import Link from "next/link";
import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import {
  useGetWorkspaceAnalytics,
  getGetWorkspaceAnalyticsQueryKey,
  useGetWorkspaceTimeseries,
  getGetWorkspaceTimeseriesQueryKey,
  useGetLinks,
  getGetLinksQueryKey,
  type Link as LinkType,
} from "@workspace/api-client-react";
import {
  MousePointerClick, Users, LinkIcon, Activity, Loader2,
  Globe, Monitor, Smartphone, Tablet, ExternalLink,
  ArrowUpRight, ArrowDownRight, ChevronDown,
  TrendingUp, TrendingDown, Minus, Calendar,
  Zap, Eye, Layers, Clock, QrCode, Link2,
  MapPin, Tag, Megaphone, Filter,
  Laptop,
} from "lucide-react";
import dynamic from "next/dynamic";
const AnalyticsAreaChart = dynamic(
  () => import("@/components/charts/AnalyticsAreaChart"),
  { ssr: false }
);
import { format, parseISO, subDays } from "date-fns";
import { BrowserIcon } from "@/components/icons/BrowserIcon";
import { OsIcon } from "@/components/icons/OsIcon";
import { CountryFlag } from "@/components/icons/CountryFlag";

const iso = (d: Date) => d.toISOString().split("T")[0];

type PeriodKey = "1h" | "6h" | "today" | "7d" | "30d" | "90d" | "1y";
interface PeriodDef {
  key: PeriodKey;
  label: string;
  getRange: (now: Date) => { from: string; to: string };
  getPrevRange: (now: Date) => { from: string; to: string };
  tsInterval: string;
  staleMs: number;
  displayLabel: string;
}

function hoursAgo(now: Date, h: number) {
  return new Date(now.getTime() - h * 60 * 60 * 1000).toISOString();
}

const PERIODS: PeriodDef[] = [
  {
    key: "1h", label: "1H", displayLabel: "1 hour",
    getRange: (now) => ({ from: hoursAgo(now, 1), to: now.toISOString() }),
    getPrevRange: (now) => ({ from: hoursAgo(now, 2), to: hoursAgo(now, 1) }),
    tsInterval: "hour", staleMs: 15_000,
  },
  {
    key: "6h", label: "6H", displayLabel: "6 hours",
    getRange: (now) => ({ from: hoursAgo(now, 6), to: now.toISOString() }),
    getPrevRange: (now) => ({ from: hoursAgo(now, 12), to: hoursAgo(now, 6) }),
    tsInterval: "hour", staleMs: 30_000,
  },
  {
    key: "today", label: "Today", displayLabel: "today",
    getRange: (now) => {
      const sod = new Date(now); sod.setHours(0,0,0,0);
      return { from: sod.toISOString(), to: now.toISOString() };
    },
    getPrevRange: (now) => {
      const yStart = subDays(now, 1); yStart.setHours(0,0,0,0);
      const yEnd = new Date(yStart); yEnd.setHours(23,59,59,999);
      return { from: yStart.toISOString(), to: yEnd.toISOString() };
    },
    tsInterval: "hour", staleMs: 30_000,
  },
  {
    key: "7d", label: "7D", displayLabel: "7 days",
    getRange: (now) => ({ from: iso(subDays(now, 6)), to: iso(now) }),
    getPrevRange: (now) => ({ from: iso(subDays(now, 13)), to: iso(subDays(now, 7)) }),
    tsInterval: "day", staleMs: 5 * 60 * 1000,
  },
  {
    key: "30d", label: "30D", displayLabel: "30 days",
    getRange: (now) => ({ from: iso(subDays(now, 29)), to: iso(now) }),
    getPrevRange: (now) => ({ from: iso(subDays(now, 59)), to: iso(subDays(now, 30)) }),
    tsInterval: "day", staleMs: 5 * 60 * 1000,
  },
  {
    key: "90d", label: "90D", displayLabel: "90 days",
    getRange: (now) => ({ from: iso(subDays(now, 89)), to: iso(now) }),
    getPrevRange: (now) => ({ from: iso(subDays(now, 179)), to: iso(subDays(now, 90)) }),
    tsInterval: "day", staleMs: 5 * 60 * 1000,
  },
  {
    key: "1y", label: "1Y", displayLabel: "1 year",
    getRange: (now) => ({ from: iso(subDays(now, 364)), to: iso(now) }),
    getPrevRange: (now) => ({ from: iso(subDays(now, 729)), to: iso(subDays(now, 365)) }),
    tsInterval: "day", staleMs: 5 * 60 * 1000,
  },
];

function countryName(code: string | null): string {
  if (!code) return "Unknown";
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

function deviceIcon(device: string) {
  const d = device.toLowerCase();
  if (d === "mobile") return <Smartphone className="w-4 h-4 text-[#8B5CF6]" />;
  if (d === "tablet") return <Tablet className="w-4 h-4 text-[#06B6D4]" />;
  return <Monitor className="w-4 h-4 text-[#06B6D4]" />;
}

function deviceColor(device: string) {
  const d = device.toLowerCase();
  if (d === "mobile") return "#8B5CF6";
  if (d === "tablet") return "#06B6D4";
  return "#06B6D4";
}

function fmtNum(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 10_000) return (n / 1_000).toFixed(0) + "K";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return n.toLocaleString();
}

export default function Analytics() {
  const [periodKey, setPeriodKey] = useState<PeriodKey>("30d");
  const [selectedLinkId, setSelectedLinkId] = useState<string>("");

  const period = PERIODS.find(p => p.key === periodKey)!;
  const now = useMemo(() => new Date(), []);

  const { from, to } = useMemo(() => period.getRange(now), [period, now]);
  const { from: prevFrom, to: prevTo } = useMemo(() => period.getPrevRange(now), [period, now]);
  const sevenFrom = useMemo(() => iso(subDays(now, 6)), [now]);

  const linkFilter: Record<string, string> = selectedLinkId ? { linkId: selectedLinkId } : {};

  const { data: links } = useGetLinks(undefined, { query: { queryKey: getGetLinksQueryKey(), staleTime: 5 * 60 * 1000 } });

  const periodParams = { from, to, ...linkFilter };
  const prevParams = { from: prevFrom, to: prevTo, ...linkFilter };
  const sevenParams = { from: sevenFrom, to: iso(now), ...linkFilter };

  const { data: stats, isLoading: statsLoading } = useGetWorkspaceAnalytics(periodParams, {
    query: { queryKey: getGetWorkspaceAnalyticsQueryKey(periodParams), placeholderData: keepPreviousData, staleTime: period.staleMs },
  });
  const { data: prevStats } = useGetWorkspaceAnalytics(prevParams, {
    query: { queryKey: getGetWorkspaceAnalyticsQueryKey(prevParams), placeholderData: keepPreviousData, staleTime: period.staleMs },
  });
  const { data: sevenStats } = useGetWorkspaceAnalytics(sevenParams, {
    query: { queryKey: getGetWorkspaceAnalyticsQueryKey(sevenParams), staleTime: 5 * 60 * 1000 },
  });

  const tsParams = { from, to, interval: period.tsInterval, ...linkFilter };
  const isHourly = period.tsInterval === "hour";
  const { data: timeseries, isLoading: tsLoading } = useWorkspaceTimeseriesWithFormatting(tsParams, period.staleMs, isHourly);

  const clickDelta = useMemo(() => {
    const cur = stats?.totalClicks ?? 0;
    const prev = prevStats?.totalClicks ?? 0;
    if (!cur || !prev) return null;
    return Math.round(((cur - prev) / prev) * 100);
  }, [stats, prevStats]);

  const uniqueDelta = useMemo(() => {
    const cur = stats?.uniqueClicks ?? 0;
    const prev = prevStats?.uniqueClicks ?? 0;
    if (!cur || !prev) return null;
    return Math.round(((cur - prev) / prev) * 100);
  }, [stats, prevStats]);

  const prevLinkCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const l of prevStats?.topLinks ?? []) m[l.label] = l.count;
    return m;
  }, [prevStats]);

  const topDevices = stats?.topDevices ?? [];
  const deviceTotal = topDevices.reduce((s: number, d: { count: number }) => s + d.count, 0) || 1;

  const topBrowsers = stats?.topBrowsers ?? [];
  const topCountries = stats?.topCountries ?? [];
  const countryTotal = topCountries.reduce((s: number, c: { count: number }) => s + c.count, 0) || 1;

  const topOs = (stats as any)?.topOs ?? [];
  const osTotal = topOs.reduce((s: number, o: { count: number }) => s + o.count, 0) || 1;
  const topCities = (stats as any)?.topCities ?? [];
  const cityTotal = topCities.reduce((s: number, c: { count: number }) => s + c.count, 0) || 1;
  const topUtmSources = (stats as any)?.topUtmSources ?? [];
  const topUtmMediums = (stats as any)?.topUtmMediums ?? [];
  const topUtmCampaigns = (stats as any)?.topUtmCampaigns ?? [];
  const qrClicks = (stats as any)?.qrClicks ?? 0;
  const directClicks = (stats as any)?.directClicks ?? 0;
  const qrTotal = qrClicks + directClicks || 1;
  const hourOfDay: { hour: number; count: number }[] = (stats as any)?.hourOfDay ?? [];
  const maxHourCount = Math.max(...hourOfDay.map(h => h.count), 1);

  const prevPeriodLabel = `prior ${period.displayLabel}`;

  return (
    <ProtectedLayout>
      <div className="px-5 lg:px-8 py-6 max-w-[1400px] mx-auto w-full space-y-5">

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 animate-fade-up">
          <div>
            <p className="text-[10px] font-bold tracking-[0.24em] uppercase text-[#71717A] mb-1">In-Depth</p>
            <h1 className="text-[28px] font-[family-name:var(--font-space-grotesk)] font-bold tracking-tight text-[#FAFAFA] leading-none">Analytics</h1>
            <p className="text-[13px] text-[#71717A] mt-1">Complete performance intelligence across all your links.</p>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2.5">
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#71717A] pointer-events-none" />
              <select
                className="pl-8 pr-8 py-2 text-[12px] font-medium bg-[#09090B] border border-[#27272A] rounded-lg outline-none focus:border-[#8B5CF6]/40 focus:ring-2 focus:ring-[#8B5CF6]/10 cursor-pointer appearance-none text-[#FAFAFA] min-w-[160px]"
                value={selectedLinkId}
                onChange={(e) => setSelectedLinkId(e.target.value)}
              >
                <option value="">All Links</option>
                {links?.map((link) => (
                  <option key={link.id} value={link.id}>
                    /{link.slug}{link.title ? ` — ${link.title}` : ""}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-[#71717A] pointer-events-none" />
            </div>

            <div className="flex bg-[#27272A] p-1 rounded-xl flex-wrap">
              {PERIODS.map((p) => (
                <button
                  key={p.key}
                  onClick={() => setPeriodKey(p.key)}
                  className={`px-3 py-1.5 text-[11px] font-semibold rounded-lg transition-all ${
                    periodKey === p.key
                      ? "bg-[#18181B] text-[#FAFAFA]"
                      : "text-[#71717A] hover:text-[#A1A1AA]"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 [&>*:nth-child(1)]:animate-fade-up [&>*:nth-child(2)]:[animation-delay:60ms] [&>*:nth-child(2)]:animate-fade-up [&>*:nth-child(3)]:[animation-delay:120ms] [&>*:nth-child(3)]:animate-fade-up [&>*:nth-child(4)]:[animation-delay:180ms] [&>*:nth-child(4)]:animate-fade-up">
          <KpiCard title="Total Clicks" value={stats?.totalClicks} delta={clickDelta} icon={<MousePointerClick className="w-4 h-4" />} color="text-[#8B5CF6]" bg="bg-[#8B5CF6]/10" loading={statsLoading} periodLabel={period.displayLabel} />
          <KpiCard title="Unique Visitors" value={stats?.uniqueClicks} delta={uniqueDelta} icon={<Users className="w-4 h-4" />} color="text-[#8B5CF6]" bg="bg-[#8B5CF6]/10" loading={statsLoading} periodLabel={period.displayLabel} />
          <KpiCard title="Total Links" value={stats?.totalLinks} icon={<LinkIcon className="w-4 h-4" />} color="text-[#F59E0B]" bg="bg-[#F59E0B]/10" loading={statsLoading} />
          <KpiCard title="Active Links" value={stats?.enabledLinks} icon={<Activity className="w-4 h-4" />} color="text-[#10B981]" bg="bg-[#10B981]/10" loading={statsLoading} />
        </div>

        <div className="bg-[#18181B] border border-[#27272A] rounded-xl overflow-hidden">
          <div className="px-5 pt-5 pb-3 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-[14px] text-[#FAFAFA]">Clicks Over Time</h3>
              <p className="text-[12px] text-[#71717A] mt-0.5">Total and unique visitor trends</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#8B5CF6]" />
                <span className="text-[11px] text-[#71717A] font-medium">Total</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#A78BFA]" />
                <span className="text-[11px] text-[#71717A] font-medium">Unique</span>
              </div>
            </div>
          </div>
          <div className="px-2 pb-3 h-[260px]">
            {tsLoading ? (
              <div className="h-full w-full flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-[#3F3F46]" />
              </div>
            ) : !timeseries || timeseries.length === 0 ? (
              <div className="h-full w-full flex flex-col items-center justify-center gap-2 text-center">
                <MousePointerClick className="w-8 h-8 text-[#3F3F46]" />
                <p className="text-[13px] text-[#71717A]">No click data for this period</p>
              </div>
            ) : (
              <AnalyticsAreaChart data={timeseries} />
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <TopLinksCard
            title={`Top Links — ${period.label}`}
            icon={<Zap className="w-4 h-4 text-[#8B5CF6]" />}
            data={stats?.topLinks}
            links={links}
            loading={statsLoading}
            accentColor="#7C3AED"
          />
          <TopLinksCard
            title="Top Links — Last 7 Days"
            icon={<Calendar className="w-4 h-4 text-[#8B5CF6]" />}
            data={sevenStats?.topLinks}
            links={links}
            loading={!sevenStats}
            accentColor="#8B5CF6"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

          <div className="lg:col-span-5 bg-[#18181B] border border-[#27272A] rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[#27272A]">
              <h3 className="font-semibold text-[14px] text-[#FAFAFA] flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-[#8B5CF6]" />
                Device Breakdown
              </h3>
            </div>
            <div className="p-5 space-y-4">
              {statsLoading ? (
                <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-8 bg-[#27272A] rounded animate-pulse" />)}</div>
              ) : topDevices.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-10 h-10 rounded-lg bg-[#8B5CF6]/10 border border-[#8B5CF6]/15 flex items-center justify-center mx-auto mb-2">
                    <Smartphone className="w-5 h-5 text-[#8B5CF6]" />
                  </div>
                  <p className="text-[12px] text-[#71717A]">No device data for this period</p>
                </div>
              ) : (
                <>
                  {topDevices.map((d: { label: string; count: number }) => {
                    const pct = Math.round((d.count / deviceTotal) * 100);
                    return (
                      <div key={d.label} className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-[#27272A] flex items-center justify-center shrink-0">
                          {deviceIcon(d.label)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-[13px] font-semibold text-[#FAFAFA] capitalize">{d.label}</span>
                            <span className="text-[12px] font-bold text-[#A1A1AA]">{fmtNum(d.count)} <span className="text-[#71717A] font-normal">({pct}%)</span></span>
                          </div>
                          <div className="h-2 bg-[#27272A] rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: deviceColor(d.label) }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  <div className="border-t border-[#27272A] pt-4 mt-2">
                    <p className="text-[10px] font-bold text-[#71717A] uppercase tracking-[0.12em] mb-3">Browsers</p>
                    <div className="space-y-2">
                      {topBrowsers.map((b: { label: string; count: number }) => {
                        const bPct = Math.round((b.count / deviceTotal) * 100);
                        return (
                          <div key={b.label} className="flex items-center justify-between">
                            <span className="text-[12px] text-[#A1A1AA] flex items-center gap-1.5">
                              <BrowserIcon browser={b.label} size={13} className="text-[#71717A]" />
                              {b.label}
                            </span>
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-1.5 bg-[#27272A] rounded-full overflow-hidden">
                                <div className="h-full bg-[#8B5CF6] rounded-full" style={{ width: `${bPct}%` }} />
                              </div>
                              <span className="text-[11px] font-semibold text-[#A1A1AA] w-6 text-right">{b.count}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="lg:col-span-7 bg-[#18181B] border border-[#27272A] rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[#27272A] flex items-center justify-between">
              <h3 className="font-semibold text-[14px] text-[#FAFAFA] flex items-center gap-2">
                <Globe className="w-4 h-4 text-[#06B6D4]" />
                Top Countries
              </h3>
              {stats?.topCountries && (
                <span className="text-[10px] font-bold bg-[#06B6D4]/10 text-[#06B6D4] px-2 py-0.5 rounded-full border border-[#06B6D4]/15">
                  {stats.topCountries.length} region{stats.topCountries.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>
            <div className="divide-y divide-[#27272A]">
              {statsLoading ? (
                <div className="p-5 space-y-3">{[1,2,3,4].map(i => <div key={i} className="h-8 bg-[#27272A] rounded animate-pulse" />)}</div>
              ) : !stats?.topCountries || stats.topCountries.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-10 h-10 rounded-lg bg-[#06B6D4]/10 border border-[#06B6D4]/15 flex items-center justify-center mx-auto mb-2">
                    <Globe className="w-5 h-5 text-[#06B6D4]" />
                  </div>
                  <p className="text-[12px] text-[#71717A]">No country data for this period</p>
                </div>
              ) : (
                stats.topCountries.map((c: { label: string; count: number }, i: number) => {
                  const maxCount = stats.topCountries![0].count;
                  const pct = Math.round((c.count / countryTotal) * 100);
                  return (
                    <div key={c.label} className="flex items-center gap-3 px-5 py-3 hover:bg-[#27272A]/50 transition-colors">
                      <span className="text-[10px] font-bold text-[#3F3F46] w-4 shrink-0">#{i + 1}</span>
                      <span className="flex items-center shrink-0 w-5"><CountryFlag code={c.label} width={20} /></span>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-[13px] font-semibold text-[#FAFAFA]">{countryName(c.label)}</span>
                          <span className="text-[12px] font-bold text-[#A1A1AA]">{fmtNum(c.count)} <span className="text-[#71717A] font-normal">({pct}%)</span></span>
                        </div>
                        <div className="h-1.5 bg-[#27272A] rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{ width: `${(c.count / maxCount) * 100}%`, background: `hsl(${170 + i * 20}, 60%, 45%)` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <TopList
            title="Traffic Sources"
            icon={<ExternalLink className="w-4 h-4 text-[#8B5CF6]" />}
            data={stats?.topReferrers}
            isLoading={statsLoading}
            accentColor="#8B5CF6"
            barColor="#8B5CF6"
            emptyIcon={<ExternalLink className="w-5 h-5 text-[#8B5CF6]" />}
            emptyText="No referrer data for this period"
          />

          <div className="bg-[#18181B] border border-[#27272A] rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[#27272A]">
              <h3 className="font-semibold text-[14px] text-[#FAFAFA] flex items-center gap-2">
                <Eye className="w-4 h-4 text-[#06B6D4]" />
                Visitors by Device — {period.label}
              </h3>
            </div>
            <div className="p-5">
              {statsLoading ? (
                <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-6 bg-[#27272A] rounded animate-pulse" />)}</div>
              ) : topDevices.length === 0 ? (
                <div className="text-center py-6">
                  <div className="w-10 h-10 rounded-lg bg-[#06B6D4]/10 border border-[#06B6D4]/15 flex items-center justify-center mx-auto mb-2">
                    <Eye className="w-5 h-5 text-[#06B6D4]" />
                  </div>
                  <p className="text-[12px] text-[#71717A]">No visitors in this period</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {topDevices.map((d: { label: string; count: number }) => {
                    const pct = Math.round((d.count / deviceTotal) * 100);
                    return (
                      <div key={d.label} className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-[#27272A] flex items-center justify-center shrink-0">
                          {deviceIcon(d.label)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-[12px] font-semibold text-[#FAFAFA] capitalize">{d.label}</span>
                            <span className="text-[11px] font-bold text-[#A1A1AA]">{d.count} <span className="text-[#71717A] font-normal">({pct}%)</span></span>
                          </div>
                          <div className="h-1.5 bg-[#27272A] rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: deviceColor(d.label) }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {topBrowsers.length > 0 && (
                    <div className="border-t border-[#27272A] pt-3 mt-1">
                      <p className="text-[10px] font-bold text-[#71717A] uppercase tracking-[0.12em] mb-2">Browsers</p>
                      <div className="space-y-1.5">
                        {topBrowsers.map((b: { label: string; count: number }) => (
                          <div key={b.label} className="flex items-center justify-between">
                            <span className="text-[11px] text-[#A1A1AA] flex items-center gap-1.5">
                              <BrowserIcon browser={b.label} size={12} className="text-[#71717A]" />
                              {b.label}
                            </span>
                            <span className="text-[11px] font-semibold text-[#A1A1AA]">{b.count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {topCountries.length > 0 && (
                    <div className="border-t border-[#27272A] pt-3 mt-1">
                      <p className="text-[10px] font-bold text-[#71717A] uppercase tracking-[0.12em] mb-2">Countries</p>
                      <div className="space-y-1.5">
                        {topCountries.map((c: { label: string; count: number }) => (
                          <div key={c.label} className="flex items-center justify-between">
                            <span className="text-[11px] text-[#A1A1AA] flex items-center gap-1.5">
                              <span className="flex items-center w-5"><CountryFlag code={c.label} width={20} /></span>
                              {countryName(c.label)}
                            </span>
                            <span className="text-[11px] font-semibold text-[#A1A1AA]">{c.count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* QR vs Direct + Hour of Day */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="bg-[#18181B] border border-[#27272A] rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[#27272A]">
              <h3 className="font-semibold text-[14px] text-[#FAFAFA] flex items-center gap-2">
                <QrCode className="w-4 h-4 text-pink-500" />
                QR Code vs Direct Clicks
              </h3>
            </div>
            <div className="p-5">
              {statsLoading ? (
                <div className="space-y-3">{[1,2].map(i => <div key={i} className="h-10 bg-[#27272A] rounded animate-pulse" />)}</div>
              ) : qrClicks === 0 && directClicks === 0 ? (
                <div className="text-center py-8">
                  <div className="w-10 h-10 rounded-lg bg-pink-500/10 border border-pink-500/15 flex items-center justify-center mx-auto mb-2">
                    <QrCode className="w-5 h-5 text-pink-400" />
                  </div>
                  <p className="text-[12px] text-[#71717A]">No click data for this period</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {[
                    { label: "Direct Clicks", count: directClicks, color: "#7C3AED", icon: <Link2 className="w-4 h-4 text-[#8B5CF6]" /> },
                    { label: "QR Code Scans", count: qrClicks, color: "#EC4899", icon: <QrCode className="w-4 h-4 text-pink-500" /> },
                  ].map(item => {
                    const pct = Math.round((item.count / qrTotal) * 100);
                    return (
                      <div key={item.label} className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-[#27272A] flex items-center justify-center shrink-0">
                          {item.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-[13px] font-semibold text-[#FAFAFA]">{item.label}</span>
                            <span className="text-[12px] font-bold text-[#A1A1AA]">{fmtNum(item.count)} <span className="text-[#71717A] font-normal">({pct}%)</span></span>
                          </div>
                          <div className="h-2.5 bg-[#27272A] rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: item.color }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div className="mt-2 pt-3 border-t border-[#27272A] flex items-center justify-between">
                    <span className="text-[11px] text-[#71717A]">QR Scan Rate</span>
                    <span className="text-[13px] font-bold text-pink-500">{Math.round((qrClicks / qrTotal) * 100)}%</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="bg-[#18181B] border border-[#27272A] rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[#27272A]">
              <h3 className="font-semibold text-[14px] text-[#FAFAFA] flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#F59E0B]" />
                Clicks by Hour of Day
              </h3>
            </div>
            <div className="p-5">
              {statsLoading ? (
                <div className="h-[140px] bg-[#27272A] rounded animate-pulse" />
              ) : hourOfDay.every(h => h.count === 0) ? (
                <div className="text-center py-8">
                  <div className="w-10 h-10 rounded-lg bg-[#F59E0B]/10 border border-[#F59E0B]/15 flex items-center justify-center mx-auto mb-2">
                    <Clock className="w-5 h-5 text-[#F59E0B]" />
                  </div>
                  <p className="text-[12px] text-[#71717A]">No hourly data for this period</p>
                </div>
              ) : (
                <div>
                  <div className="flex items-end gap-[3px] h-[120px]">
                    {hourOfDay.map((h) => {
                      const heightPct = Math.max((h.count / maxHourCount) * 100, 2);
                      const intensity = h.count / maxHourCount;
                      const bg = intensity > 0.75 ? "#7C3AED" : intensity > 0.5 ? "#8B5CF6" : intensity > 0.25 ? "#A78BFA" : "#3F3F46";
                      return (
                        <div key={h.hour} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                          <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-[#27272A] text-[#FAFAFA] text-[10px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                            {h.hour}:00 — {h.count} clicks
                          </div>
                          <div
                            className="w-full rounded-t-sm transition-all duration-300 hover:opacity-80 cursor-pointer min-h-[2px]"
                            style={{ height: `${heightPct}%`, background: bg }}
                          />
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex justify-between mt-2">
                    <span className="text-[10px] text-[#71717A]">12am</span>
                    <span className="text-[10px] text-[#71717A]">6am</span>
                    <span className="text-[10px] text-[#71717A]">12pm</span>
                    <span className="text-[10px] text-[#71717A]">6pm</span>
                    <span className="text-[10px] text-[#71717A]">11pm</span>
                  </div>
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#27272A]">
                    <span className="text-[11px] text-[#71717A]">Peak Hour</span>
                    <span className="text-[13px] font-bold text-[#8B5CF6]">
                      {(() => { const peak = hourOfDay.reduce((a, b) => b.count > a.count ? b : a, hourOfDay[0]); return `${peak.hour}:00 (${fmtNum(peak.count)} clicks)`; })()}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* OS Breakdown + Top Cities */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="bg-[#18181B] border border-[#27272A] rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[#27272A] flex items-center justify-between">
              <h3 className="font-semibold text-[14px] text-[#FAFAFA] flex items-center gap-2">
                <Laptop className="w-4 h-4 text-[#06B6D4]" />
                Operating Systems
              </h3>
              {topOs.length > 0 && (
                <span className="text-[10px] font-bold bg-[#06B6D4]/10 text-[#06B6D4] px-2 py-0.5 rounded-full border border-[#06B6D4]/15">
                  {topOs.length} OS{topOs.length !== 1 ? "es" : ""}
                </span>
              )}
            </div>
            <div className="p-5">
              {statsLoading ? (
                <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-8 bg-[#27272A] rounded animate-pulse" />)}</div>
              ) : topOs.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-10 h-10 rounded-lg bg-[#06B6D4]/10 border border-[#06B6D4]/15 flex items-center justify-center mx-auto mb-2">
                    <Laptop className="w-5 h-5 text-[#06B6D4]" />
                  </div>
                  <p className="text-[12px] text-[#71717A]">No OS data for this period</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {topOs.map((o: { label: string; count: number }, i: number) => {
                    const pct = Math.round((o.count / osTotal) * 100);
                    const colors = ["#06B6D4", "#0891B2", "#22D3EE", "#67E8F9", "#A5F3FC"];
                    return (
                      <div key={o.label} className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-[#27272A] flex items-center justify-center shrink-0">
                          <OsIcon os={o.label} size={14} className="text-[#A1A1AA]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-[13px] font-semibold text-[#FAFAFA]">{o.label}</span>
                            <span className="text-[12px] font-bold text-[#A1A1AA]">{fmtNum(o.count)} <span className="text-[#71717A] font-normal">({pct}%)</span></span>
                          </div>
                          <div className="h-1.5 bg-[#27272A] rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: colors[i % colors.length] }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="bg-[#18181B] border border-[#27272A] rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[#27272A] flex items-center justify-between">
              <h3 className="font-semibold text-[14px] text-[#FAFAFA] flex items-center gap-2">
                <MapPin className="w-4 h-4 text-rose-500" />
                Top Cities
              </h3>
              {topCities.length > 0 && (
                <span className="text-[10px] font-bold bg-rose-500/10 text-rose-500 px-2 py-0.5 rounded-full border border-rose-500/15">
                  {topCities.length} cities
                </span>
              )}
            </div>
            <div className="divide-y divide-[#27272A]">
              {statsLoading ? (
                <div className="p-5 space-y-3">{[1,2,3,4].map(i => <div key={i} className="h-6 bg-[#27272A] rounded animate-pulse" />)}</div>
              ) : topCities.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-10 h-10 rounded-lg bg-rose-500/10 border border-rose-500/15 flex items-center justify-center mx-auto mb-2">
                    <MapPin className="w-5 h-5 text-rose-400" />
                  </div>
                  <p className="text-[12px] text-[#71717A]">No city data for this period</p>
                </div>
              ) : (
                topCities.map((c: { label: string; count: number }, i: number) => {
                  const maxCount = topCities[0].count;
                  const pct = Math.round((c.count / cityTotal) * 100);
                  return (
                    <div key={c.label} className="flex items-center gap-3 px-5 py-2.5 hover:bg-[#27272A]/50 transition-colors">
                      <span className="text-[10px] font-bold text-[#3F3F46] w-4 shrink-0">#{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-[13px] font-semibold text-[#FAFAFA]">{c.label}</span>
                          <span className="text-[12px] font-bold text-[#A1A1AA]">{fmtNum(c.count)} <span className="text-[#71717A] font-normal">({pct}%)</span></span>
                        </div>
                        <div className="h-1.5 bg-[#27272A] rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{ width: `${(c.count / maxCount) * 100}%`, background: `hsl(${350 + i * 12}, 60%, 50%)` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* UTM Campaign Analytics */}
        <div className="bg-[#18181B] border border-[#27272A] rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#27272A]">
            <h3 className="font-semibold text-[14px] text-[#FAFAFA] flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-[#F59E0B]" />
              UTM Campaign Analytics
            </h3>
            <p className="text-[11px] text-[#71717A] mt-0.5">Track your marketing campaigns, sources, and mediums</p>
          </div>
          <div className="p-5">
            {statsLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[1,2,3].map(i => <div key={i} className="space-y-3">{[1,2,3].map(j => <div key={j} className="h-6 bg-[#27272A] rounded animate-pulse" />)}</div>)}
              </div>
            ) : topUtmSources.length === 0 && topUtmMediums.length === 0 && topUtmCampaigns.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-10 h-10 rounded-lg bg-[#F59E0B]/10 border border-[#F59E0B]/15 flex items-center justify-center mx-auto mb-2">
                  <Megaphone className="w-5 h-5 text-[#F59E0B]" />
                </div>
                <p className="text-[12px] text-[#71717A]">No UTM data for this period</p>
                <p className="text-[11px] text-[#3F3F46] mt-1">Add utm_source, utm_medium, or utm_campaign parameters to your links</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <UtmColumn title="Sources" icon={<Tag className="w-3.5 h-3.5 text-[#F59E0B]" />} data={topUtmSources} color="#F59E0B" />
                <UtmColumn title="Mediums" icon={<Filter className="w-3.5 h-3.5 text-[#F59E0B]" />} data={topUtmMediums} color="#F59E0B" />
                <UtmColumn title="Campaigns" icon={<Megaphone className="w-3.5 h-3.5 text-[#F59E0B]" />} data={topUtmCampaigns} color="#F59E0B" />
              </div>
            )}
          </div>
        </div>

      </div>
    </ProtectedLayout>
  );
}

function useWorkspaceTimeseriesWithFormatting(params: Record<string, string>, staleTime?: number, hourly?: boolean) {
  const result = useGetWorkspaceTimeseries(params, {
    query: { queryKey: getGetWorkspaceTimeseriesQueryKey(params), placeholderData: keepPreviousData, staleTime },
  });
  const formattedData = useMemo(() => {
    if (!result.data) return [];
    return result.data.map((pt) => ({
      ...pt,
      formattedTime: format(parseISO(pt.time), hourly ? "HH:mm" : "MMM d"),
    }));
  }, [result.data, hourly]);
  return { ...result, data: formattedData };
}

function KpiCard({
  title, value, delta, icon, color, bg, loading, periodLabel,
}: {
  title: string; value?: number; delta?: number | null; icon: React.ReactNode;
  color: string; bg: string; loading: boolean; periodLabel?: string;
}) {
  return (
    <div className="bg-[#18181B] border border-[#27272A] rounded-xl p-4 hover:border-[#3F3F46] transition-colors">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-bold text-[#71717A] uppercase tracking-[0.12em]">{title}</p>
        <div className={`w-7 h-7 rounded-lg ${bg} border border-current/15 ${color} flex items-center justify-center`}>{icon}</div>
      </div>
      <div className="text-[28px] font-[family-name:var(--font-space-grotesk)] font-bold text-[#FAFAFA] leading-none tabular-nums">
        {loading ? <span className="inline-block w-12 h-7 bg-[#27272A] rounded animate-pulse" /> : fmtNum(value ?? 0)}
      </div>
      <div className="mt-1.5 h-5 flex items-center">
        {delta !== null && delta !== undefined && !loading ? (
          <span className={`text-[11px] font-semibold flex items-center gap-0.5 ${delta >= 0 ? "text-[#10B981]" : "text-red-500"}`}>
            {delta >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {Math.abs(delta)}%
            <span className="text-[#71717A] font-normal ml-0.5">vs prior {periodLabel}</span>
          </span>
        ) : (
          <span className="text-[11px] text-[#3F3F46]">—</span>
        )}
      </div>
    </div>
  );
}

function TopLinksCard({
  title, icon, data, links, loading, accentColor, prevLinkCounts,
}: {
  title: string; icon: React.ReactNode; data?: { label: string; count: number }[];
  links?: LinkType[]; loading: boolean; accentColor: string;
  prevLinkCounts?: Record<string, number>;
}) {
  const max = Math.max(...(data?.map(d => d.count) ?? [0]), 1);

  return (
    <div className="bg-[#18181B] border border-[#27272A] rounded-xl overflow-hidden hover:border-[#3F3F46] transition-colors">
      <div className="px-5 py-3.5 border-b border-[#27272A] flex items-center gap-2">
        {icon}
        <h3 className="font-semibold text-[14px] text-[#FAFAFA]">{title}</h3>
      </div>
      <div className="p-5">
        {loading ? (
          <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-6 bg-[#27272A] rounded animate-pulse" />)}</div>
        ) : !data || data.length === 0 ? (
          <div className="text-center py-6">
            <div className="w-10 h-10 rounded-lg bg-[#8B5CF6]/10 border border-[#8B5CF6]/15 flex items-center justify-center mx-auto mb-2">
              <Layers className="w-5 h-5 text-[#8B5CF6]" />
            </div>
            <p className="text-[12px] text-[#71717A]">No link activity for this period</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {data.map((item, i) => {
              const matchedLink = links?.find(l => l.slug === item.label);
              const href = matchedLink ? `/analytics/${matchedLink.id}` : null;
              const pct = Math.max((item.count / max) * 100, 3);
              const trend = prevLinkCounts
                ? getLinkTrend(item.count, prevLinkCounts[item.label])
                : null;

              const row = (
                <div className="flex items-center gap-2.5">
                  <span className="text-[10px] font-bold text-[#3F3F46] w-4 shrink-0 tabular-nums">#{i + 1}</span>
                  <div className="flex-1 min-w-0 relative h-7 flex items-center">
                    <div
                      className="absolute inset-y-0 left-0 rounded-lg transition-all duration-700 opacity-15"
                      style={{ width: `${pct}%`, background: accentColor }}
                    />
                    <span className="relative text-[12px] font-semibold text-[#FAFAFA] truncate pr-2 pl-2">
                      /{item.label}
                      {matchedLink?.title && <span className="text-[#71717A] font-normal ml-1.5 text-[11px]">{matchedLink.title}</span>}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {trend === "up" && <TrendingUp className="w-3.5 h-3.5 text-[#10B981]" />}
                    {trend === "down" && <TrendingDown className="w-3.5 h-3.5 text-red-400" />}
                    {trend === "flat" && <Minus className="w-3.5 h-3.5 text-[#3F3F46]" />}
                    <span className="text-[12px] font-bold tabular-nums" style={{ color: accentColor }}>
                      {item.count.toLocaleString()}
                    </span>
                  </div>
                </div>
              );

              return href ? (
                <Link key={item.label} href={href} className="block hover:opacity-75 transition-opacity">
                  {row}
                </Link>
              ) : (
                <div key={item.label}>{row}</div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function getLinkTrend(current: number, prev?: number): "up" | "down" | "flat" | null {
  if (prev === undefined) return null;
  if (prev === 0) return current > 0 ? "up" : null;
  const ratio = current / prev;
  if (ratio > 1.1) return "up";
  if (ratio < 0.9) return "down";
  return "flat";
}


function UtmColumn({
  title, icon, data, color,
}: {
  title: string; icon: React.ReactNode; data: { label: string; count: number }[]; color: string;
}) {
  const max = Math.max(...(data?.map(d => d.count) ?? [0]), 1);

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-3">
        {icon}
        <p className="text-[11px] font-bold text-[#71717A] uppercase tracking-[0.1em]">{title}</p>
      </div>
      {data.length === 0 ? (
        <p className="text-[11px] text-[#3F3F46] italic">No data</p>
      ) : (
        <div className="space-y-2">
          {data.map((item, i) => {
            const pct = Math.max((item.count / max) * 100, 3);
            return (
              <div key={item.label} className="flex items-center gap-2">
                <div className="flex-1 min-w-0 relative h-6 flex items-center">
                  <div
                    className="absolute inset-y-0 left-0 rounded-md transition-all duration-700 opacity-15"
                    style={{ width: `${pct}%`, background: color }}
                  />
                  <span className="relative text-[11px] font-semibold text-[#A1A1AA] truncate pl-2 pr-1">
                    {item.label || "Unknown"}
                  </span>
                </div>
                <span className="text-[11px] font-bold tabular-nums shrink-0" style={{ color }}>
                  {item.count.toLocaleString()}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TopList({
  title, icon, data, isLoading, accentColor = "#8B5CF6", barColor = "#8B5CF6",
  emptyIcon, emptyText,
}: {
  title: string; icon: React.ReactNode; data?: { label: string; count: number }[];
  isLoading: boolean; accentColor?: string; barColor?: string;
  emptyIcon?: React.ReactNode; emptyText?: string;
}) {
  const max = Math.max(...(data?.map((d) => d.count) ?? [0]), 1);

  return (
    <div className="bg-[#18181B] border border-[#27272A] rounded-xl overflow-hidden hover:border-[#3F3F46] transition-colors">
      <div className="px-5 py-3.5 border-b border-[#27272A] flex items-center gap-2">
        {icon}
        <h3 className="font-semibold text-[14px] text-[#FAFAFA]">{title}</h3>
      </div>
      <div className="p-5">
        {isLoading ? (
          <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-6 bg-[#27272A] rounded animate-pulse" />)}</div>
        ) : !data || data.length === 0 ? (
          <div className="text-center py-6">
            {emptyIcon && <div className="w-10 h-10 rounded-lg bg-[#27272A] flex items-center justify-center mx-auto mb-2">{emptyIcon}</div>}
            <p className="text-[12px] text-[#71717A]">{emptyText ?? "No data for this period"}</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {data.map((item, i) => {
              const pct = Math.max((item.count / max) * 100, 3);
              return (
                <div key={item.label} className="flex items-center gap-2.5">
                  <span className="text-[10px] font-bold text-[#3F3F46] w-4 shrink-0 tabular-nums">#{i + 1}</span>
                  <div className="flex-1 min-w-0 relative h-7 flex items-center">
                    <div
                      className="absolute inset-y-0 left-0 rounded-lg transition-all duration-700 opacity-15"
                      style={{ width: `${pct}%`, background: barColor }}
                    />
                    <span className="relative text-[12px] font-semibold text-[#FAFAFA] truncate pr-2 pl-2">
                      {item.label || "Unknown"}
                    </span>
                  </div>
                  <span className="text-[12px] font-bold tabular-nums shrink-0" style={{ color: accentColor }}>
                    {item.count.toLocaleString()}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
