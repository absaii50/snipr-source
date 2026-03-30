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
  type Link as LinkType,
} from "@workspace/api-client-react";
import {
  MousePointerClick,
  Users,
  LinkIcon,
  Activity,
  Loader2,
  Globe,
  Monitor,
  ExternalLink,
  ArrowUpRight,
  ArrowDownRight,
  ChevronDown,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import dynamic from "next/dynamic";
const AnalyticsAreaChart = dynamic(
  () => import("@/components/charts/AnalyticsAreaChart"),
  { ssr: false }
);
import { format, parseISO } from "date-fns";

function getDateRange(days: number) {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - days);
  return {
    from: from.toISOString().split("T")[0],
    to: to.toISOString().split("T")[0],
  };
}

const PERIODS = [
  { label: "7d", value: 7 },
  { label: "30d", value: 30 },
  { label: "90d", value: 90 },
];

function getPreviousPeriodRange(days: number) {
  const to = new Date();
  to.setDate(to.getDate() - days);
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
  return {
    from: from.toISOString().split("T")[0],
    to: to.toISOString().split("T")[0],
  };
}

export default function Analytics() {
  const [days, setDays] = useState<number>(30);
  const [selectedLinkId, setSelectedLinkId] = useState<string>("");

  const { from, to } = useMemo(() => getDateRange(days), [days]);
  const prevPeriodRange = useMemo(() => getPreviousPeriodRange(days), [days]);

  const queryParams = {
    from,
    to,
    ...(selectedLinkId ? { linkId: selectedLinkId } : {}),
  };

  const ST5 = 5 * 60 * 1000;
  const { data: links } = useGetLinks(undefined, { query: { staleTime: ST5 } });
  const { data: stats, isLoading: isLoadingStats } = useGetWorkspaceAnalytics(queryParams, {
    query: { queryKey: getGetWorkspaceAnalyticsQueryKey(queryParams), placeholderData: keepPreviousData, staleTime: ST5 },
  });
  const prevPeriodParams = { from: prevPeriodRange.from, to: prevPeriodRange.to, ...(selectedLinkId ? { linkId: selectedLinkId } : {}) };
  const { data: prevPeriodStats } = useGetWorkspaceAnalytics(
    prevPeriodParams,
    { query: { queryKey: getGetWorkspaceAnalyticsQueryKey(prevPeriodParams), placeholderData: keepPreviousData, staleTime: ST5 } }
  );
  const { data: timeseries, isLoading: isLoadingTimeseries } = useWorkspaceTimeseriesWithFormatting(queryParams, ST5);

  const clickDelta = useMemo(() => {
    const cur = stats?.totalClicks ?? 0;
    const prev = prevPeriodStats?.totalClicks ?? 0;
    if (!cur || !prev) return null;
    return Math.round(((cur - prev) / prev) * 100);
  }, [stats, prevPeriodStats]);

  const uniqueDelta = useMemo(() => {
    const cur = stats?.uniqueClicks ?? 0;
    const prev = prevPeriodStats?.uniqueClicks ?? 0;
    if (!cur || !prev) return null;
    return Math.round(((cur - prev) / prev) * 100);
  }, [stats, prevPeriodStats]);

  const prevLinkCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const l of prevPeriodStats?.topLinks ?? []) m[l.label] = l.count;
    return m;
  }, [prevPeriodStats]);

  return (
    <ProtectedLayout>
      <div className="px-7 py-7 max-w-[1200px] mx-auto w-full space-y-5">

        {/* ── Header ───────────────────────────────────────────────── */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.2em] uppercase text-[#728DA7] mb-1">Performance</p>
            <h1 className="text-[22px] font-bold tracking-tight text-[#0A0A0A]">Analytics</h1>
            <p className="text-[13px] text-[#9090A0] mt-0.5">Track performance across all your links.</p>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2.5">
            {/* Link filter */}
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#C0C0CC] pointer-events-none" />
              <select
                className="pl-8 pr-8 py-2.5 text-[12.5px] font-medium bg-white border border-[#EBEBF0] rounded-xl outline-none focus:border-[#728DA7] focus:ring-2 focus:ring-[#728DA7]/10 cursor-pointer appearance-none text-[#0A0A0A] min-w-[160px] shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
                value={selectedLinkId}
                onChange={(e) => setSelectedLinkId(e.target.value)}
              >
                <option value="">All Links</option>
                {links?.map((link) => (
                  <option key={link.id} value={link.id}>
                    /{link.slug}{link.title ? ` (${link.title})` : ""}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-[#B0B0BA] pointer-events-none" />
            </div>

            {/* Period tabs */}
            <div className="flex bg-[#F2F2F6] p-1 rounded-xl">
              {PERIODS.map((p) => (
                <button
                  key={p.value}
                  onClick={() => setDays(p.value)}
                  className={`px-3.5 py-1.5 text-[12px] font-semibold rounded-lg transition-all ${
                    days === p.value
                      ? "bg-white text-[#0A0A0A] shadow-sm"
                      : "text-[#9090A0] hover:text-[#0A0A0A]"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── KPIs ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          <AnalyticsKpi title="Total Clicks"    value={stats?.totalClicks}  icon={<MousePointerClick className="w-4 h-4" />} accent="#728DA7"  bgAccent="#EEF3F7" delta={clickDelta}  isLoading={isLoadingStats} />
          <AnalyticsKpi title="Unique Visitors" value={stats?.uniqueClicks} icon={<Users className="w-4 h-4" />}            accent="#7C5CC4"  bgAccent="#F3EEFF" delta={uniqueDelta} isLoading={isLoadingStats} />
          <AnalyticsKpi title="Total Links"     value={stats?.totalLinks}   icon={<LinkIcon className="w-4 h-4" />}         accent="#E07B30"  bgAccent="#FEF3E8" isLoading={isLoadingStats} />
          <AnalyticsKpi title="Active Links"    value={stats?.enabledLinks} icon={<Activity className="w-4 h-4" />}         accent="#2E9A72"  bgAccent="#E8F7F1" isLoading={isLoadingStats} />
        </div>

        {/* ── Timeseries Chart ──────────────────────────────────────── */}
        <div className="bg-white border border-[#EBEBF0] rounded-2xl overflow-hidden shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
          <div className="px-5 pt-5 pb-3 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-[14px] text-[#0A0A0A]">Clicks Over Time</h3>
              <p className="text-[12px] text-[#9090A0] mt-0.5">Total and unique visitor trends</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#728DA7]" />
                <span className="text-[11px] text-[#9090A0] font-medium">Total</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#D0C0F0]" />
                <span className="text-[11px] text-[#9090A0] font-medium">Unique</span>
              </div>
            </div>
          </div>
          <div className="px-2 pb-3 h-[240px]">
            {isLoadingTimeseries ? (
              <div className="h-full w-full flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-[#728DA7]/30" />
              </div>
            ) : !timeseries || timeseries.length === 0 ? (
              <div className="h-full w-full flex flex-col items-center justify-center gap-2 text-center">
                <MousePointerClick className="w-8 h-8 text-[#DDDDE8]" />
                <p className="text-[13px] text-[#9090A0]">No click data for this period</p>
              </div>
            ) : (
              <AnalyticsAreaChart data={timeseries} />
            )}
          </div>
        </div>

        {/* ── Breakdown grids ───────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <TopList title="Top Links"     icon={<LinkIcon className="w-3.5 h-3.5 text-[#728DA7]" />}    data={stats?.topLinks}     isLoading={isLoadingStats} links={links} isLinkTarget accentColor="#728DA7" barColor="#EEF3F7" prevLinkCounts={prevLinkCounts} />
          <TopList title="Top Countries" icon={<Globe className="w-3.5 h-3.5 text-[#2E9A72]" />}        data={stats?.topCountries} isLoading={isLoadingStats} accentColor="#2E9A72" barColor="#E8F7F1" />
          <TopList title="Top Referrers" icon={<ExternalLink className="w-3.5 h-3.5 text-[#7C5CC4]" />} data={stats?.topReferrers} isLoading={isLoadingStats} accentColor="#7C5CC4" barColor="#F3EEFF" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <TopList title="Top Browsers" icon={<Monitor className="w-3.5 h-3.5 text-[#E07B30]" />}   data={stats?.topBrowsers} isLoading={isLoadingStats} compact accentColor="#E07B30" barColor="#FEF0E4" />
            <TopList title="Top Devices"  icon={<Activity className="w-3.5 h-3.5 text-[#728DA7]" />}  data={stats?.topDevices}  isLoading={isLoadingStats} compact accentColor="#728DA7" barColor="#EEF3F7" />
          </div>
        </div>

      </div>
    </ProtectedLayout>
  );
}

function useWorkspaceTimeseriesWithFormatting(params: any, staleTime?: number) {
  const result = useGetWorkspaceTimeseries(params, { query: { queryKey: getGetWorkspaceTimeseriesQueryKey(params), placeholderData: keepPreviousData, staleTime } });
  const formattedData = useMemo(() => {
    if (!result.data) return [];
    return result.data.map((pt) => ({
      ...pt,
      formattedTime: format(parseISO(pt.time), "MMM d"),
    }));
  }, [result.data]);
  return { ...result, data: formattedData };
}

function AnalyticsKpi({
  title, value, icon, accent, bgAccent, delta, isLoading,
}: {
  title: string; value?: number; icon: React.ReactNode; accent: string; bgAccent: string; delta?: number | null; isLoading: boolean;
}) {
  return (
    <div className="bg-white border border-[#EBEBF0] rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_2px_10px_rgba(0,0,0,0.07)] transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <p className="text-[11px] font-semibold text-[#A0A0AE] tracking-wide">{title}</p>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: bgAccent, color: accent }}>
          {icon}
        </div>
      </div>
      <div className="text-[28px] font-bold text-[#0A0A0A] leading-none tracking-tight tabular-nums">
        {isLoading
          ? <span className="inline-block w-14 h-6 bg-[#F2F2F6] rounded-lg animate-pulse" />
          : (value?.toLocaleString() || "0")}
      </div>
      <div className="mt-2 h-5 flex items-center">
        {delta !== null && delta !== undefined && !isLoading ? (
          <span className={`text-[11px] font-semibold flex items-center gap-0.5 ${delta >= 0 ? "text-[#2E9A72]" : "text-[#E05050]"}`}>
            {delta >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {Math.abs(delta)}%
            <span className="text-[#B0B0BA] font-normal ml-0.5">vs prior</span>
          </span>
        ) : (
          <span className="text-[11px] text-[#C0C0CC]">—</span>
        )}
      </div>
    </div>
  );
}

interface TopEntry { label: string; count: number; }

function getLinkTrend(current: number, prev?: number): "up" | "down" | "flat" | null {
  if (prev === undefined) return null;
  if (prev === 0) return current > 0 ? "up" : null;
  const ratio = current / prev;
  if (ratio > 1.1) return "up";
  if (ratio < 0.9) return "down";
  return "flat";
}

function TopList({
  title,
  icon,
  data,
  isLoading,
  compact = false,
  links = [],
  isLinkTarget = false,
  accentColor = "#728DA7",
  barColor = "#EEF3F7",
  prevLinkCounts = {},
}: {
  title: string;
  icon: React.ReactNode;
  data?: TopEntry[];
  isLoading: boolean;
  compact?: boolean;
  links?: LinkType[];
  isLinkTarget?: boolean;
  accentColor?: string;
  barColor?: string;
  prevLinkCounts?: Record<string, number>;
}) {
  const max = Math.max(...(data?.map((d) => d.count) ?? [0]), 1);

  return (
    <div className="bg-white border border-[#EBEBF0] rounded-2xl overflow-hidden flex flex-col shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <div className="px-5 py-4 border-b border-[#F2F2F6] flex items-center gap-2">
        <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: `${accentColor}18` }}>
          {icon}
        </div>
        <h3 className="font-semibold text-[13.5px] text-[#0A0A0A]">{title}</h3>
      </div>
      <div className={`${compact ? "p-4" : "p-5"} flex-1`}>
        {isLoading ? (
          <div className="space-y-3.5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex justify-between items-center gap-3">
                <div className="flex-1 h-3 bg-[#F2F2F6] rounded-lg animate-pulse" style={{ width: `${60 + i * 10}%` }} />
                <div className="w-8 h-3 bg-[#F2F2F6] rounded-lg animate-pulse" />
              </div>
            ))}
          </div>
        ) : !data || data.length === 0 ? (
          <div className="h-full flex items-center justify-center py-8 text-[13px] text-[#9090A0]">
            No data for this period
          </div>
        ) : (
          <div className="space-y-3">
            {data.map((item, i) => {
              const labelRaw = item.label || "Unknown";
              let displayLabel = labelRaw;
              let targetHref: string | null = null;
              let matchedId: string | null = null;

              if (isLinkTarget && links.length > 0) {
                const matchedLink = links.find((l) => l.slug === item.label);
                if (matchedLink) {
                  displayLabel = `/${matchedLink.slug}`;
                  targetHref = `/analytics/${matchedLink.id}`;
                  matchedId = matchedLink.id;
                } else {
                  displayLabel = `/${item.label}`;
                }
              }

              const pct = Math.max((item.count / max) * 100, 3);
              const trend = isLinkTarget
                ? getLinkTrend(item.count, prevLinkCounts[item.label])
                : null;

              const inner = (
                <div className="flex items-center gap-2.5">
                  <span className="text-[11px] font-bold text-[#DDDDE8] w-4 shrink-0 tabular-nums">{i + 1}</span>
                  <div className="flex-1 min-w-0 relative h-6 flex items-center">
                    <div
                      className="absolute inset-y-0 left-0 rounded-lg transition-all duration-700"
                      style={{ width: `${pct}%`, background: barColor }}
                    />
                    <span className="relative text-[12.5px] font-medium text-[#0A0A0A] truncate pr-2 pl-1.5 block" title={displayLabel}>
                      {displayLabel}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {trend === "up" && <TrendingUp className="w-3.5 h-3.5 text-[#2E9A72]" aria-label="Trending up" />}
                    {trend === "down" && <TrendingDown className="w-3.5 h-3.5 text-[#E05050]" aria-label="Trending down" />}
                    {trend === "flat" && <Minus className="w-3.5 h-3.5 text-[#C0C0CC]" aria-label="Stable" />}
                    <span className="text-[12.5px] font-bold tabular-nums" style={{ color: accentColor }}>
                      {item.count.toLocaleString()}
                    </span>
                  </div>
                </div>
              );

              return isLinkTarget && targetHref ? (
                <Link key={item.label} href={targetHref} className="block hover:opacity-75 transition-opacity">
                  {inner}
                </Link>
              ) : (
                <div key={item.label}>{inner}</div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
