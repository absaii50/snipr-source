"use client";
import { useState, useMemo } from "react";
import { keepPreviousData } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import {
  useGetLink,
  getGetLinkQueryKey,
  useGetLinkAnalytics,
  getGetLinkAnalyticsQueryKey,
  useGetLinkTimeseries,
  getGetLinkTimeseriesQueryKey,
  useGetLinkEvents,
  getGetLinkEventsQueryKey,
} from "@workspace/api-client-react";
import {
  ArrowLeft,
  MousePointerClick,
  Users,
  Globe,
  QrCode,
  Loader2,
  CalendarDays,
  ExternalLink,
  Copy,
  Check,
  Activity,
  Monitor,
  Smartphone,
  Chrome,
} from "lucide-react";
import dynamic from "next/dynamic";
const LinkAnalyticsChart = dynamic(
  () => import("@/components/charts/LinkAnalyticsChart"),
  { ssr: false }
);
import { format, parseISO, subDays } from "date-fns";

const iso = (d: Date) => d.toISOString().split("T")[0];
function hoursAgo(now: Date, h: number) {
  return new Date(now.getTime() - h * 60 * 60 * 1000).toISOString();
}

type PeriodKey = "1h" | "6h" | "24h" | "7d" | "30d" | "90d";
interface PeriodDef {
  key: PeriodKey;
  label: string;
  getRange: (now: Date) => { from: string; to: string };
  tsInterval: string;
  staleMs: number;
}

const PERIODS: PeriodDef[] = [
  {
    key: "1h", label: "1H",
    getRange: (now) => ({ from: hoursAgo(now, 1), to: now.toISOString() }),
    tsInterval: "hour", staleMs: 15_000,
  },
  {
    key: "6h", label: "6H",
    getRange: (now) => ({ from: hoursAgo(now, 6), to: now.toISOString() }),
    tsInterval: "hour", staleMs: 30_000,
  },
  {
    key: "24h", label: "24H",
    getRange: (now) => ({ from: hoursAgo(now, 24), to: now.toISOString() }),
    tsInterval: "hour", staleMs: 30_000,
  },
  {
    key: "7d", label: "7D",
    getRange: (now) => ({ from: iso(subDays(now, 6)), to: iso(now) }),
    tsInterval: "day", staleMs: 5 * 60 * 1000,
  },
  {
    key: "30d", label: "30D",
    getRange: (now) => ({ from: iso(subDays(now, 29)), to: iso(now) }),
    tsInterval: "day", staleMs: 5 * 60 * 1000,
  },
  {
    key: "90d", label: "90D",
    getRange: (now) => ({ from: iso(subDays(now, 89)), to: iso(now) }),
    tsInterval: "day", staleMs: 5 * 60 * 1000,
  },
];

const COUNTRY_FLAGS: Record<string, string> = {
  US: "🇺🇸", GB: "🇬🇧", DE: "🇩🇪", FR: "🇫🇷", CA: "🇨🇦", AU: "🇦🇺", IN: "🇮🇳", BR: "🇧🇷",
  JP: "🇯🇵", KR: "🇰🇷", CN: "🇨🇳", MX: "🇲🇽", IT: "🇮🇹", ES: "🇪🇸", NL: "🇳🇱", RU: "🇷🇺",
  PL: "🇵🇱", SE: "🇸🇪", NO: "🇳🇴", DK: "🇩🇰", FI: "🇫🇮", TR: "🇹🇷", ID: "🇮🇩", TH: "🇹🇭",
  SG: "🇸🇬", ZA: "🇿🇦", NG: "🇳🇬", EG: "🇪🇬", AR: "🇦🇷", CL: "🇨🇱", CO: "🇨🇴", PT: "🇵🇹",
};

export default function LinkAnalytics() {
  const rawParams = useParams();
  const linkId = (rawParams?.linkId as string) ?? "";
  const [periodKey, setPeriodKey] = useState<PeriodKey>("30d");
  const [copied, setCopied] = useState(false);

  const period = PERIODS.find(p => p.key === periodKey)!;
  const now = useMemo(() => new Date(), []);
  const { from, to } = useMemo(() => period.getRange(now), [period, now]);
  const queryParams = { from, to };
  const ST5 = period.staleMs;

  const { data: link, isLoading: isLoadingLink } = useGetLink(linkId || "", { query: { queryKey: getGetLinkQueryKey(linkId || ""), staleTime: ST5 } });
  const { data: stats, isLoading: isLoadingStats } = useGetLinkAnalytics(linkId || "", queryParams, {
    query: { queryKey: getGetLinkAnalyticsQueryKey(linkId || "", queryParams), placeholderData: keepPreviousData, enabled: !!linkId, staleTime: ST5 }
  });
  const tsParams = { from, to, interval: period.tsInterval as "hour" | "day" | "week" };
  const { data: timeseries, isLoading: isLoadingTimeseries } = useLinkTimeseriesWithFormatting(linkId || "", tsParams, ST5);
  const { data: events, isLoading: isLoadingEvents } = useGetLinkEvents(linkId || "", { limit: 50 }, {
    query: { queryKey: getGetLinkEventsQueryKey(linkId || "", { limit: 50 }), enabled: !!linkId, staleTime: ST5 }
  });

  const handleCopyUrl = () => {
    if (!link) return;
    navigator.clipboard.writeText(link.destinationUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (isLoadingLink) {
    return (
      <ProtectedLayout>
        <div className="flex h-full min-h-[50vh] items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-[#6366F1]" />
        </div>
      </ProtectedLayout>
    );
  }

  if (!link) {
    return (
      <ProtectedLayout>
        <div className="p-8 max-w-7xl mx-auto text-center py-20">
          <div className="w-12 h-12 rounded-xl bg-[rgba(255,255,255,0.06)] flex items-center justify-center mx-auto mb-4">
            <Activity className="w-5 h-5 text-[#64748B]" />
          </div>
          <h2 className="text-xl font-semibold mb-2 text-[#F1F5F9]">Link not found</h2>
          <p className="text-[13px] text-[#94A3B8] mb-4">This link may have been deleted or doesn't exist.</p>
          <Link href="/analytics" className="text-[13px] font-medium text-[#6366F1] hover:text-[#4F46E5] transition-colors">
            Return to Analytics
          </Link>
        </div>
      </ProtectedLayout>
    );
  }

  return (
    <ProtectedLayout>
      <div className="px-4 sm:px-8 py-6 sm:py-8 max-w-[1280px] mx-auto w-full pt-14 lg:pt-8">

        {/* ── Breadcrumb ── */}
        <Link href="/analytics" className="inline-flex items-center text-[13px] font-medium text-[#64748B] hover:text-[#CBD5E1] transition-colors mb-6 group">
          <ArrowLeft className="w-3.5 h-3.5 mr-1.5 transition-transform group-hover:-translate-x-0.5" />
          Back to Analytics
        </Link>

        {/* ── Header Card ── */}
        <div className="bg-[rgba(17,24,39,0.65)] rounded-xl border border-[rgba(255,255,255,0.06)] p-5 sm:p-6 mb-6" style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.3)" }}>
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-1.5">
                <h1 className="text-[22px] sm:text-[24px] font-[family-name:var(--font-space-grotesk)] font-extrabold tracking-[-0.02em] text-[#F1F5F9] truncate">
                  /{link.slug}
                </h1>
                <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md leading-none ${
                  link.enabled ? "bg-[rgba(52,211,153,0.1)] text-[#34D399]" : "bg-[rgba(255,255,255,0.06)] text-[#64748B]"
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${link.enabled ? "bg-[#34D399]" : "bg-[#475569]"}`} />
                  {link.enabled ? 'Active' : 'Disabled'}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <a
                  href={link.destinationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[13px] text-[#64748B] hover:text-[#6366F1] transition-colors truncate max-w-[500px]"
                >
                  {link.destinationUrl}
                </a>
                <button
                  onClick={handleCopyUrl}
                  className={`w-6 h-6 flex items-center justify-center rounded-md shrink-0 transition-all ${
                    copied ? "text-[#34D399] bg-[rgba(52,211,153,0.1)]" : "text-[#64748B] hover:text-[#6366F1] hover:bg-[rgba(129,140,248,0.1)]"
                  }`}
                  title="Copy URL"
                >
                  {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                </button>
                <a
                  href={link.destinationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-6 h-6 flex items-center justify-center rounded-md text-[#64748B] hover:text-[#6366F1] hover:bg-[rgba(129,140,248,0.1)] transition-all shrink-0"
                  title="Open destination"
                >
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

            {/* Period selector */}
            <div className="flex bg-[rgba(255,255,255,0.06)] rounded-lg p-0.5 shrink-0">
              {PERIODS.map((p) => (
                <button
                  key={p.key}
                  onClick={() => setPeriodKey(p.key)}
                  className={`px-3 sm:px-4 py-1.5 text-[12px] font-medium rounded-md transition-all ${
                    periodKey === p.key
                      ? "bg-[rgba(129,140,248,0.12)] text-[#A5B4FC] shadow-none"
                      : "text-[#94A3B8] hover:text-[#CBD5E1]"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── KPI Cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <KpiCard
            title="Total Clicks"
            value={stats?.totalClicks}
            icon={<MousePointerClick className="w-4 h-4" />}
            color="#6366F1"
            isLoading={isLoadingStats}
          />
          <KpiCard
            title="Unique Visitors"
            value={stats?.uniqueClicks}
            icon={<Users className="w-4 h-4" />}
            color="#8B5CF6"
            isLoading={isLoadingStats}
          />
          <KpiCard
            title="Direct Clicks"
            value={stats?.directClicks}
            icon={<Globe className="w-4 h-4" />}
            color="#10B981"
            isLoading={isLoadingStats}
          />
          <KpiCard
            title="QR Scans"
            value={stats?.qrClicks}
            icon={<QrCode className="w-4 h-4" />}
            color="#F59E0B"
            isLoading={isLoadingStats}
          />
        </div>

        {/* ── Chart ── */}
        <div className="bg-[rgba(17,24,39,0.65)] rounded-xl border border-[rgba(255,255,255,0.06)] p-5 sm:p-6 mb-6" style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.3)" }}>
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-[#64748B]" />
              <h3 className="text-[14px] font-semibold text-[#F1F5F9]">Click Performance</h3>
            </div>
            <span className="text-[11px] text-[#64748B]">Last {period.label}</span>
          </div>
          <div className="h-[320px] w-full">
            {isLoadingTimeseries ? (
              <div className="h-full w-full flex items-center justify-center">
                <Loader2 className="w-5 h-5 animate-spin text-[#6366F1]" />
              </div>
            ) : timeseries?.length === 0 ? (
              <div className="h-full w-full flex flex-col items-center justify-center gap-2">
                <Activity className="w-5 h-5 text-[#64748B]" />
                <span className="text-[13px] text-[#64748B]">No click data for this period</span>
              </div>
            ) : (
              <LinkAnalyticsChart data={timeseries} />
            )}
          </div>
        </div>

        {/* ── Demographics Grid ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
          <TopList title="Countries" data={stats?.topCountries} isLoading={isLoadingStats} icon={<Globe className="w-3.5 h-3.5" />} color="#6366F1" />
          <TopList title="Referrers" data={stats?.topReferrers} isLoading={isLoadingStats} icon={<ExternalLink className="w-3.5 h-3.5" />} color="#8B5CF6" />
          <div className="flex flex-col gap-4">
            <TopList title="Browsers" data={stats?.topBrowsers} isLoading={isLoadingStats} compact icon={<Chrome className="w-3.5 h-3.5" />} color="#10B981" />
            <TopList title="OS" data={stats?.topOs} isLoading={isLoadingStats} compact icon={<Monitor className="w-3.5 h-3.5" />} color="#F59E0B" />
          </div>
          <TopList title="Devices" data={stats?.topDevices} isLoading={isLoadingStats} icon={<Smartphone className="w-3.5 h-3.5" />} color="#EC4899" />
        </div>

        {/* ── Recent Events Table ── */}
        <div className="bg-[rgba(17,24,39,0.65)] rounded-xl border border-[rgba(255,255,255,0.06)] overflow-hidden mb-8" style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.3)" }}>
          <div className="px-5 py-3.5 border-b border-[rgba(255,255,255,0.06)] flex items-center justify-between">
            <h3 className="text-[14px] font-semibold text-[#F1F5F9]">Recent Clicks</h3>
            <span className="text-[11px] text-[#64748B]">Last 50 events</span>
          </div>
          <div className="overflow-x-auto">
            {isLoadingEvents ? (
              <div className="py-16 flex justify-center">
                <Loader2 className="w-5 h-5 animate-spin text-[#6366F1]" />
              </div>
            ) : !events || events.length === 0 ? (
              <div className="py-16 flex flex-col items-center justify-center gap-2">
                <Activity className="w-5 h-5 text-[#64748B]" />
                <span className="text-[13px] text-[#64748B]">No clicks recorded yet</span>
              </div>
            ) : (
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-[rgba(255,255,255,0.06)]">
                    <th className="px-5 py-2.5 text-[11px] font-semibold text-[#64748B] uppercase tracking-[0.06em]">Time</th>
                    <th className="px-5 py-2.5 text-[11px] font-semibold text-[#64748B] uppercase tracking-[0.06em]">Location</th>
                    <th className="px-5 py-2.5 text-[11px] font-semibold text-[#64748B] uppercase tracking-[0.06em]">System</th>
                    <th className="px-5 py-2.5 text-[11px] font-semibold text-[#64748B] uppercase tracking-[0.06em]">Referrer</th>
                    <th className="px-5 py-2.5 text-[11px] font-semibold text-[#64748B] uppercase tracking-[0.06em] text-center">Type</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((event, idx) => {
                    const flag = event.country ? (COUNTRY_FLAGS[event.country] ?? null) : null;
                    return (
                      <tr key={event.id} className={`transition-colors hover:bg-[#FAFBFC] ${idx !== events.length - 1 ? "border-b border-[#F3F4F6]" : ""}`}>
                        <td className="px-5 py-3 whitespace-nowrap text-[12px] text-[#94A3B8] tabular-nums">
                          {format(parseISO(event.timestamp), "MMM d, HH:mm:ss")}
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-1.5">
                            {flag && <span className="text-[13px]">{flag}</span>}
                            <div className="flex flex-col">
                              <span className="text-[12px] font-medium text-[#F1F5F9]">{event.country || "Unknown"}</span>
                              {event.city && <span className="text-[11px] text-[#64748B]">{event.city}</span>}
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex flex-col">
                            <span className="text-[12px] font-medium text-[#F1F5F9]">{event.browser || "Unknown"}</span>
                            <span className="text-[11px] text-[#64748B]">{event.os || "Unknown"} · {event.device || "Desktop"}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3 max-w-[200px]">
                          <span className="text-[12px] text-[#94A3B8] truncate block" title={event.referrer || "Direct"}>
                            {event.referrer || <span className="text-[#64748B] italic">Direct</span>}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-center">
                          {event.isQr ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#FFFBEB] text-[#D97706] text-[10px] font-medium">
                              <QrCode className="w-3 h-3" /> QR
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[rgba(255,255,255,0.06)] text-[#94A3B8] text-[10px] font-medium">
                              <Globe className="w-3 h-3" /> Link
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

      </div>
    </ProtectedLayout>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Timeseries hook
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
interface TimeseriesQueryParams {
  from?: string;
  to?: string;
  interval?: "hour" | "day" | "week";
}

function useLinkTimeseriesWithFormatting(id: string, params: TimeseriesQueryParams, staleTime?: number) {
  const result = useGetLinkTimeseries(id, params, { query: { queryKey: getGetLinkTimeseriesQueryKey(id, params), placeholderData: keepPreviousData, enabled: !!id, staleTime }});

  const formattedData = useMemo(() => {
    if (!result.data) return [];
    const isHourly = params.interval === "hour";
    return result.data.map(pt => ({
      ...pt,
      formattedTime: isHourly ? format(parseISO(pt.time), 'HH:mm') : format(parseISO(pt.time), 'MMM d')
    }));
  }, [result.data, params.interval]);

  return { ...result, data: formattedData };
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   KpiCard
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
interface KpiCardProps {
  title: string;
  value: number | null | undefined;
  icon: React.ReactNode;
  color: string;
  isLoading: boolean;
}

function KpiCard({ title, value, icon, color, isLoading }: KpiCardProps) {
  return (
    <div
      className="bg-[rgba(17,24,39,0.65)] rounded-xl border border-[rgba(255,255,255,0.06)] p-4 sm:p-5 transition-all duration-200 hover:shadow-[0_4px_12px_rgba(0,0,0,0.2)] hover:border-[rgba(255,255,255,0.08)]"
      style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.3)" }}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-[12px] font-medium text-[#94A3B8]">{title}</span>
        <span style={{ color }}>{icon}</span>
      </div>
      <div className="text-[28px] sm:text-[32px] font-[family-name:var(--font-space-grotesk)] font-extrabold text-[#F1F5F9] leading-none tabular-nums tracking-tight">
        {isLoading ? (
          <span className="inline-block w-12 h-7 bg-[rgba(255,255,255,0.06)] animate-pulse rounded-md" />
        ) : (
          (value?.toLocaleString() || "0")
        )}
      </div>
    </div>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   TopList
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
interface TopListItem {
  label: string;
  count: number;
}

interface TopListProps {
  title: string;
  data: TopListItem[] | null | undefined;
  isLoading: boolean;
  compact?: boolean;
  icon?: React.ReactNode;
  color?: string;
}

function TopList({ title, data, isLoading, compact = false, icon, color = "#6366F1" }: TopListProps) {
  const max = Math.max(...(data?.map((d) => d.count) || [0]), 1);

  return (
    <div
      className="bg-[rgba(17,24,39,0.65)] rounded-xl border border-[rgba(255,255,255,0.06)] overflow-hidden flex flex-col h-full transition-all duration-200 hover:shadow-[0_4px_12px_rgba(0,0,0,0.2)] hover:border-[rgba(255,255,255,0.08)]"
      style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.3)" }}
    >
      <div className="px-4 py-3 border-b border-[rgba(255,255,255,0.06)] flex items-center gap-2">
        {icon && <span style={{ color }}>{icon}</span>}
        <h3 className="text-[13px] font-semibold text-[#F1F5F9]">{title}</h3>
      </div>
      <div className={`p-4 flex-1 ${compact ? "" : ""}`}>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex justify-between items-center">
                <div className="w-1/3 h-3.5 rounded bg-[rgba(255,255,255,0.06)] animate-pulse" />
                <div className="w-1/4 h-3.5 rounded bg-[rgba(255,255,255,0.06)] animate-pulse" />
              </div>
            ))}
          </div>
        ) : !data || data.length === 0 ? (
          <div className="h-full flex items-center justify-center py-4">
            <span className="text-[12px] text-[#64748B]">No data yet</span>
          </div>
        ) : (
          <div className="space-y-2.5">
            {data.map((item, idx) => {
              const pct = (item.count / max) * 100;
              const flag = title === "Countries" ? (COUNTRY_FLAGS[item.label] ?? null) : null;
              return (
                <div key={item.label || 'unknown'} className="group">
                  <div className="flex justify-between items-center mb-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {flag && <span className="text-[12px] shrink-0">{flag}</span>}
                      {idx < 3 && (
                        <span className="text-[10px] font-semibold w-4 h-4 rounded flex items-center justify-center shrink-0" style={{ color, backgroundColor: `${color}10` }}>
                          {idx + 1}
                        </span>
                      )}
                      <span className="text-[12px] font-medium truncate text-[#CBD5E1]">
                        {item.label || 'Unknown'}
                      </span>
                    </div>
                    <span className="text-[12px] font-semibold text-[#F1F5F9] tabular-nums ml-2 shrink-0">{item.count.toLocaleString()}</span>
                  </div>
                  <div className="w-full h-1 rounded-full bg-[rgba(255,255,255,0.06)] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700 ease-out"
                      style={{ width: `${pct}%`, backgroundColor: color, opacity: 0.7 + (0.3 * (pct / 100)) }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
