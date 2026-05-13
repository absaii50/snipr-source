"use client";
import { useMemo, useState } from "react";
import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import {
  useGetUtmOverview, useGetUtmTimeseries, useGetUtmCrossTab,
  getGetUtmOverviewQueryKey, getGetUtmTimeseriesQueryKey, getGetUtmCrossTabQueryKey,
} from "@workspace/api-client-react";
import type { UtmBreakdownRow } from "@workspace/api-client-react";
import {
  Target, TrendingUp, Layers, DollarSign,
  Download, Loader2, ArrowUpDown, BarChart3,
} from "lucide-react";
import { format, subDays } from "date-fns";
import dynamic from "next/dynamic";

const UtmStackedChart = dynamic(() => import("@/components/charts/UtmStackedChart"), { ssr: false });

type PeriodKey = "7d" | "30d" | "90d" | "all";
const PERIODS: { key: PeriodKey; label: string; days: number | null }[] = [
  { key: "7d",  label: "7D",  days: 7 },
  { key: "30d", label: "30D", days: 30 },
  { key: "90d", label: "90D", days: 90 },
  { key: "all", label: "All", days: null },
];

type Dimension = "source" | "medium" | "campaign";
const DIMENSIONS: { key: Dimension; label: string }[] = [
  { key: "source",   label: "Source" },
  { key: "medium",   label: "Medium" },
  { key: "campaign", label: "Campaign" },
];

function fmtNum(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000)     return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return n.toLocaleString();
}
function fmtMoney(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(n);
}
const isoDate = (d: Date) => d.toISOString().split("T")[0];

const SERIES_COLORS = ["#8B5CF6", "#06B6D4", "#10B981", "#F59E0B", "#EC4899", "#A78BFA", "#FB923C", "#22D3EE", "#34D399", "#FACC15"];

export default function Utm() {
  const [period, setPeriod] = useState<PeriodKey>("30d");
  const [dimension, setDimension] = useState<Dimension>("source");

  const now = useMemo(() => new Date(), []);
  const periodDef = PERIODS.find((p) => p.key === period)!;
  const dateParams = useMemo(() => {
    if (!periodDef.days) return {};
    return { from: isoDate(subDays(now, periodDef.days)), to: isoDate(now) };
  }, [period, now, periodDef.days]);

  const overviewQ = useGetUtmOverview(dateParams, {
    query: { queryKey: getGetUtmOverviewQueryKey(dateParams) },
  });
  const tsParams = { ...dateParams, dimension, top: 6 };
  const tsQ = useGetUtmTimeseries(tsParams, {
    query: { queryKey: getGetUtmTimeseriesQueryKey(tsParams) },
  });
  const crossTabQ = useGetUtmCrossTab(dateParams, {
    query: { queryKey: getGetUtmCrossTabQueryKey(dateParams) },
  });

  const overview = overviewQ.data;
  const ts = tsQ.data;
  const crossTab = crossTabQ.data;

  // Pick the right breakdown rows for the table based on which dimension the
  // user is exploring. This is the single source of truth so the chart and
  // table never go out of sync.
  const breakdown: UtmBreakdownRow[] =
    dimension === "source"   ? (overview?.bySource ?? []) :
    dimension === "medium"   ? (overview?.byMedium ?? []) :
    /* campaign */             (overview?.byCampaign ?? []);

  const handleExport = () => {
    const url = new URL("/api/analytics/utm/export", window.location.origin);
    if (dateParams.from) url.searchParams.set("from", dateParams.from);
    if (dateParams.to) url.searchParams.set("to", dateParams.to);
    window.location.href = url.toString();
  };

  const kpis = [
    {
      label: "UTM Clicks",
      value: overview ? fmtNum(overview.kpis.utmClicks) : "—",
      sub: overview ? `of ${fmtNum(overview.kpis.totalClicks)} total` : "",
      icon: <Target className="w-4 h-4 text-[#8B5CF6]" />,
      bg: "rgba(139,92,246,0.12)",
    },
    {
      label: "Distinct Campaigns",
      value: overview ? overview.kpis.distinctCampaigns.toString() : "—",
      sub: overview ? `${overview.kpis.distinctSources} sources` : "",
      icon: <Layers className="w-4 h-4 text-[#06B6D4]" />,
      bg: "rgba(6,182,212,0.12)",
    },
    {
      label: "Conversions",
      value: overview ? fmtNum(overview.kpis.conversions) : "—",
      sub: overview && overview.kpis.utmClicks > 0
        ? `${((overview.kpis.conversions / overview.kpis.utmClicks) * 100).toFixed(2)}% conv rate`
        : "",
      icon: <TrendingUp className="w-4 h-4 text-[#10B981]" />,
      bg: "rgba(16,185,129,0.12)",
    },
    {
      label: "Attributed Revenue",
      value: overview ? fmtMoney(overview.kpis.revenue) : "—",
      sub: "from UTM-tagged conversions",
      icon: <DollarSign className="w-4 h-4 text-[#F59E0B]" />,
      bg: "rgba(245,158,11,0.12)",
    },
  ];

  return (
    <ProtectedLayout>
      <div className="p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6">

        {/* ── Header + period selector ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #06B6D4, #0891B2)" }}>
              <BarChart3 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-[28px] font-[family-name:var(--font-space-grotesk)] font-extrabold tracking-tight text-[#FAFAFA]">UTM Analytics</h1>
              <p className="text-[#A1A1AA] mt-1">Attribution breakdown across source, medium, and campaign.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center p-1 rounded-lg bg-[#18181B] border border-[#27272A]">
              {PERIODS.map((p) => (
                <button
                  key={p.key}
                  onClick={() => setPeriod(p.key)}
                  className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    period === p.key
                      ? "text-[#06D7DE] shadow-sm"
                      : "text-[#A1A1AA] hover:text-[#71717A]"
                  }`}
                  style={period === p.key ? { background: "rgba(6,182,212,0.12)" } : undefined}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <button
              onClick={handleExport}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-semibold text-[#E4E4E7] bg-[#27272A] border border-[#3F3F46] hover:bg-[#3F3F46]"
              title="Download CSV of every UTM-tagged click in the current window"
            >
              <Download className="w-3.5 h-3.5" /> CSV
            </button>
          </div>
        </div>

        {/* ── KPI cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {kpis.map((k) => (
            <div key={k.label} className="p-5 rounded-xl bg-[#18181B] border border-[#27272A]">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] font-semibold text-[#A1A1AA] uppercase tracking-wide">{k.label}</p>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: k.bg }}>{k.icon}</div>
              </div>
              <p className="text-[28px] font-extrabold text-[#FAFAFA] truncate">{k.value}</p>
              {k.sub && <p className="text-[11px] text-[#71717A] mt-1">{k.sub}</p>}
            </div>
          ))}
        </div>

        {/* ── Dimension switch ── */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center p-1 rounded-lg bg-[#18181B] border border-[#27272A]">
            {DIMENSIONS.map((d) => (
              <button
                key={d.key}
                onClick={() => setDimension(d.key)}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  dimension === d.key
                    ? "text-[#A78BFA] shadow-sm"
                    : "text-[#A1A1AA] hover:text-[#71717A]"
                }`}
                style={dimension === d.key ? { background: "rgba(139,92,246,0.12)" } : undefined}
              >
                {d.label}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-[#71717A]">Drives the chart + breakdown table below</p>
        </div>

        {/* ── Time-series chart ── */}
        <div className="rounded-xl bg-[#18181B] border border-[#27272A] p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-[#FAFAFA] flex items-center gap-2">
                <TrendingUp className="w-3.5 h-3.5 text-[#06B6D4]" />
                Daily clicks · top {ts?.labels?.length ?? 0} {dimension}s
              </h2>
              <p className="text-[11px] text-[#71717A] mt-0.5">
                {periodDef.days ? `Last ${periodDef.days} days` : "All time"}
              </p>
            </div>
          </div>
          <div className="h-[280px]">
            {tsQ.isLoading ? (
              <div className="h-full flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-[#71717A]" /></div>
            ) : !ts || ts.series.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center">
                <BarChart3 className="w-8 h-8 text-[#3F3F46] mb-2" />
                <p className="text-[13px] text-[#71717A]">No UTM-tagged clicks in this window.</p>
              </div>
            ) : (
              <UtmStackedChart
                labels={ts.labels}
                data={ts.series as Array<{ day: string } & Record<string, number>>}
                colors={SERIES_COLORS}
              />
            )}
          </div>
        </div>

        {/* ── Cross-tab heatmap ── */}
        <div className="rounded-xl bg-[#18181B] border border-[#27272A] overflow-hidden">
          <div className="px-5 py-4 border-b border-[#27272A]">
            <h2 className="text-sm font-bold text-[#FAFAFA] flex items-center gap-2">
              <Layers className="w-3.5 h-3.5 text-[#10B981]" /> Source × Medium intersection
            </h2>
            <p className="text-[11px] text-[#71717A] mt-0.5">Click volume at each crossing. Darker = more clicks.</p>
          </div>
          <div className="p-5 overflow-x-auto">
            {crossTabQ.isLoading ? (
              <div className="py-8 flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-[#71717A]" /></div>
            ) : !crossTab || crossTab.cells.length === 0 ? (
              <p className="text-[13px] text-[#71717A] py-8 text-center">No data.</p>
            ) : (
              <CrossTabHeatmap data={crossTab} />
            )}
          </div>
        </div>

        {/* ── Breakdown table for the active dimension ── */}
        <div className="rounded-xl bg-[#18181B] border border-[#27272A] overflow-hidden">
          <div className="px-5 py-4 border-b border-[#27272A] flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-[#FAFAFA] capitalize flex items-center gap-2">
                <ArrowUpDown className="w-3.5 h-3.5 text-[#A78BFA]" /> Top {dimension}s
              </h2>
              <p className="text-[11px] text-[#71717A] mt-0.5">Clicks, conversions, revenue per {dimension}.</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="bg-[#09090B]/50 border-b border-[#27272A]">
                  <th className="px-5 py-3 text-xs font-semibold text-[#A1A1AA] uppercase tracking-wide capitalize">{dimension}</th>
                  <th className="px-5 py-3 text-xs font-semibold text-[#A1A1AA] uppercase tracking-wide text-right">Clicks</th>
                  <th className="px-5 py-3 text-xs font-semibold text-[#A1A1AA] uppercase tracking-wide text-right">Conversions</th>
                  <th className="px-5 py-3 text-xs font-semibold text-[#A1A1AA] uppercase tracking-wide text-right">Conv rate</th>
                  <th className="px-5 py-3 text-xs font-semibold text-[#A1A1AA] uppercase tracking-wide text-right">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#27272A]">
                {overviewQ.isLoading ? (
                  <tr><td colSpan={5} className="px-5 py-10 text-center"><Loader2 className="w-5 h-5 animate-spin text-[#71717A] mx-auto" /></td></tr>
                ) : breakdown.length === 0 ? (
                  <tr><td colSpan={5} className="px-5 py-10 text-center text-[13px] text-[#71717A]">No {dimension}s recorded in this window.</td></tr>
                ) : breakdown.map((row, i) => {
                  const maxClicks = Math.max(...breakdown.map((r) => r.clicks), 1);
                  const pct = (row.clicks / maxClicks) * 100;
                  return (
                    <tr key={row.label || `(none)-${i}`} className="hover:bg-[#27272A]/40 transition-colors">
                      <td className="px-5 py-3">
                        <span className="text-[13px] font-semibold text-[#E4E4E7] font-mono">{row.label || "(none)"}</span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <div className="inline-flex items-center gap-2">
                          <div className="w-16 h-1.5 rounded-full bg-[#27272A] overflow-hidden">
                            <div className="h-full" style={{ width: `${pct}%`, background: "linear-gradient(90deg, #8B5CF6, #06B6D4)" }} />
                          </div>
                          <span className="text-[13px] tabular-nums text-[#E4E4E7] font-semibold w-14 text-right">{fmtNum(row.clicks)}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-right text-[13px] tabular-nums text-[#A1A1AA]">{row.conversions}</td>
                      <td className="px-5 py-3 text-right text-[13px] tabular-nums text-[#A1A1AA]">{row.conversionRate.toFixed(2)}%</td>
                      <td className="px-5 py-3 text-right text-[13px] tabular-nums font-bold" style={{ color: row.revenue > 0 ? "#10B981" : "#52525B" }}>
                        {row.revenue > 0 ? fmtMoney(row.revenue) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </ProtectedLayout>
  );
}

/* ── Inline source × medium heatmap ── */
function CrossTabHeatmap({ data }: { data: { sources: string[]; mediums: string[]; cells: { source: string; medium: string; clicks: number }[] } }) {
  const max = Math.max(...data.cells.map((c) => c.clicks), 1);
  const cellMap: Record<string, number> = {};
  for (const c of data.cells) cellMap[`${c.source}|${c.medium}`] = c.clicks;
  return (
    <table className="min-w-full text-xs border-collapse">
      <thead>
        <tr>
          <th className="text-left p-2 text-[10px] font-bold text-[#71717A] uppercase tracking-wide">Source ↓ / Medium →</th>
          {data.mediums.map((m) => (
            <th key={m} className="text-center p-2 text-[10px] font-bold text-[#A1A1AA] tracking-wide font-mono">{m}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.sources.map((s) => (
          <tr key={s}>
            <td className="p-2 text-[11px] font-semibold text-[#A1A1AA] font-mono whitespace-nowrap">{s}</td>
            {data.mediums.map((m) => {
              const v = cellMap[`${s}|${m}`] ?? 0;
              const intensity = max > 0 ? Math.min(1, v / max) : 0;
              const bg = v === 0
                ? "rgba(255,255,255,0.02)"
                : `rgba(139,92,246,${0.15 + intensity * 0.65})`;
              return (
                <td
                  key={m}
                  className="p-2 text-center text-[11px] tabular-nums font-semibold"
                  style={{ background: bg, color: intensity > 0.4 ? "#fff" : "#A1A1AA", minWidth: 60 }}
                  title={`${s} · ${m}: ${v} clicks`}
                >
                  {v > 0 ? v.toLocaleString() : "—"}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
