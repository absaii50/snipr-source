"use client";
import { useEffect, useState, useCallback } from "react";
import {
  Search, RefreshCw, MousePointer, Globe, Monitor, Link2,
  AlertCircle, BarChart3, Users, MapPin, ExternalLink, Clock,
  TrendingUp,
} from "lucide-react";
import { apiFetch, fmtTime, fmtNum } from "../utils";

/* ── Types ─────────────────────────────────────────────────── */

interface ActivityEvent {
  id: string; slug: string; linkId: string;
  timestamp: string; country: string | null; device: string | null;
  browser: string | null; referrer: string | null;
}

interface TopSlug { slug: string; domain: string | null; count: number }
interface TopCountry { country: string; count: number }
interface TopReferrer { referrer: string | null; count: number }

interface ReportSummary {
  totalClicks: number;
  uniqueVisitors: number;
  topCountry: TopCountry | null;
  topReferrer: TopReferrer | null;
  topSlugs: TopSlug[];
  hourlyBreakdown: number[];
}

type RangeOption = { label: string; days: number };
const RANGES: RangeOption[] = [
  { label: "Today", days: 1 },
  { label: "7 Days", days: 7 },
  { label: "30 Days", days: 30 },
];

/* ── Component ─────────────────────────────────────────────── */

export default function ReportsTab() {
  const [range, setRange] = useState<number>(1);

  // Summary state
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  // Activity state
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const [activityError, setActivityError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  /* ── Loaders ───────────────────────────────────────────── */

  const loadSummary = useCallback(async (days: number) => {
    setSummaryLoading(true);
    setSummaryError(null);
    try {
      const data = await apiFetch(`/admin/reports/summary?days=${days}`);
      setSummary(data);
    } catch (e: any) {
      setSummaryError(e?.error ?? "Failed to load report summary");
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  const loadActivity = useCallback(async () => {
    setActivityLoading(true);
    setActivityError(null);
    try {
      const data = await apiFetch("/admin/activity");
      setEvents(data);
    } catch (e: any) {
      setActivityError(e?.error ?? "Failed to load activity feed");
    } finally {
      setActivityLoading(false);
    }
  }, []);

  async function refreshActivity() {
    setRefreshing(true);
    try {
      const data = await apiFetch("/admin/activity");
      setEvents(data);
      setActivityError(null);
    } catch (e: any) {
      setActivityError(e?.error ?? "Failed to refresh");
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => { loadSummary(range); }, [range, loadSummary]);
  useEffect(() => { loadActivity(); }, [loadActivity]);

  const filtered = events.filter((e) =>
    !search ||
    e.slug.toLowerCase().includes(search.toLowerCase()) ||
    (e.country ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (e.device ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (e.browser ?? "").toLowerCase().includes(search.toLowerCase())
  );

  /* ── Heatmap helpers ───────────────────────────────────── */

  const hourly = summary?.hourlyBreakdown ?? Array(24).fill(0);
  const maxHour = Math.max(...hourly, 1);
  const peakHourIndex = hourly.indexOf(Math.max(...hourly));

  /* ── Render ────────────────────────────────────────────── */

  return (
    <div className="space-y-5">

      {/* ── Time Range Selector ─────────────────────────── */}
      <div className="flex items-center gap-2">
        {RANGES.map((r) => (
          <button
            key={r.days}
            onClick={() => setRange(r.days)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              range === r.days
                ? "bg-[#0A0A0A] text-white shadow-sm"
                : "bg-white text-[#3A3A3E] border border-[#E2E8F0] hover:bg-[#F8F8FC]"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* ── Summary Cards ───────────────────────────────── */}
      {summaryError && (
        <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{summaryError}</span>
          <button onClick={() => loadSummary(range)} className="ml-auto text-xs underline hover:no-underline">Retry</button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<BarChart3 className="w-4 h-4 text-[#728DA7]" />}
          label="Total Clicks"
          value={summaryLoading ? null : fmtNum(summary?.totalClicks ?? 0)}
          loading={summaryLoading}
        />
        <StatCard
          icon={<Users className="w-4 h-4 text-[#728DA7]" />}
          label="Unique Visitors"
          value={summaryLoading ? null : fmtNum(summary?.uniqueVisitors ?? 0)}
          loading={summaryLoading}
        />
        <StatCard
          icon={<MapPin className="w-4 h-4 text-[#728DA7]" />}
          label="Top Country"
          value={summaryLoading ? null : summary?.topCountry
            ? `${summary.topCountry.country} (${fmtNum(summary.topCountry.count)})`
            : "N/A"}
          loading={summaryLoading}
        />
        <StatCard
          icon={<ExternalLink className="w-4 h-4 text-[#728DA7]" />}
          label="Top Referrer"
          value={summaryLoading ? null : summary?.topReferrer
            ? `${summary.topReferrer.referrer ?? "Direct"} (${fmtNum(summary.topReferrer.count)})`
            : "N/A"}
          loading={summaryLoading}
        />
      </div>

      {/* ── Hourly Click Heatmap ────────────────────────── */}
      <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-4 h-4 text-[#728DA7]" />
          <h3 className="text-sm font-semibold text-[#0A0A0A]">Hourly Click Distribution</h3>
        </div>
        {summaryLoading ? (
          <div className="h-[140px] flex items-end gap-[3px]">
            {[...Array(24)].map((_, i) => (
              <div key={i} className="flex-1 bg-[#F4F4F6] rounded-t animate-pulse" style={{ height: "60%" }} />
            ))}
          </div>
        ) : (
          <div>
            <div className="h-[140px] flex items-end gap-[3px]">
              {hourly.map((count, i) => {
                const pct = maxHour > 0 ? (count / maxHour) * 100 : 0;
                const isPeak = i === peakHourIndex && count > 0;
                return (
                  <div
                    key={i}
                    className="flex-1 relative group"
                    style={{ height: "100%" }}
                  >
                    <div
                      className={`absolute bottom-0 w-full rounded-t transition-all ${
                        isPeak ? "bg-[#0A0A0A]" : "bg-[#728DA7]/40"
                      } hover:bg-[#728DA7]/70`}
                      style={{ height: `${Math.max(pct, 2)}%` }}
                    />
                    <div className="opacity-0 group-hover:opacity-100 absolute -top-7 left-1/2 -translate-x-1/2 bg-[#0A0A0A] text-white text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap pointer-events-none transition-opacity">
                      {count}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-[3px] mt-1.5">
              {hourly.map((_, i) => (
                <div key={i} className="flex-1 text-center text-[9px] text-[#8888A0] leading-none">
                  {i % 3 === 0 ? i : ""}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Top Slugs Table ─────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-4 h-4 text-[#728DA7]" />
          <h3 className="text-sm font-semibold text-[#0A0A0A]">Top Slugs</h3>
        </div>
        {summaryLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-8 bg-[#F4F4F6] rounded animate-pulse" />
            ))}
          </div>
        ) : (summary?.topSlugs?.length ?? 0) === 0 ? (
          <p className="text-sm text-[#8888A0] py-6 text-center">No slug data for this period</p>
        ) : (
          <div className="space-y-2.5">
            {summary!.topSlugs.map((s, i) => {
              const topCount = summary!.topSlugs[0]?.count ?? 1;
              const pct = (s.count / topCount) * 100;
              return (
                <div key={s.slug} className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-[#8888A0] w-5 text-right">#{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono text-xs text-[#0A0A0A] truncate">{s.domain || "snipr.sh"}/{s.slug}</span>
                      <span className="text-xs text-[#8888A0] ml-2 shrink-0">{fmtNum(s.count)}</span>
                    </div>
                    <div className="h-1.5 bg-[#F4F4F6] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#728DA7] rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Live Activity Table ──────────────────────────── */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8888A0]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by slug, country, browser..."
              className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-[#E2E8F0] bg-white text-sm outline-none focus:border-[#728DA7] focus:ring-2 focus:ring-[#728DA7]/15 transition-all"
            />
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-[#728DA7] bg-[#EEF3F7] px-2.5 py-1.5 rounded-full">
              <div className="w-1.5 h-1.5 rounded-full bg-[#728DA7] animate-pulse" />
              Live feed
            </div>
            <button
              onClick={refreshActivity}
              disabled={refreshing || activityLoading}
              className="p-2 rounded-xl border border-[#E2E8F0] bg-white hover:bg-[#F4F4F6] transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#8888A0] ${refreshing ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {activityError && (
          <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{activityError}</span>
            <button onClick={loadActivity} className="ml-auto text-xs underline hover:no-underline">Retry</button>
          </div>
        )}

        {!activityError && (
          <div className="text-xs text-[#8888A0]">
            {filtered.length} recent click event{filtered.length !== 1 ? "s" : ""}
          </div>
        )}

        <div className="bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="bg-[#F8F8FC] border-b border-[#E2E8F0]">
                  {["Event", "Link", "Country", "Device / Browser", "Referrer", "Time"].map((h) => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-[#8888A0] uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F4F4F6]">
                {activityLoading && [...Array(8)].map((_, i) => (
                  <tr key={i}>{[...Array(6)].map((_, j) => (
                    <td key={j} className="px-5 py-4"><div className="h-4 bg-[#F4F4F6] rounded animate-pulse" /></td>
                  ))}</tr>
                ))}
                {!activityLoading && !activityError && filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-16 text-center">
                      <MousePointer className="w-8 h-8 text-[#C8C8D8] mx-auto mb-3" />
                      <p className="text-[#8888A0] text-sm">No activity events found</p>
                    </td>
                  </tr>
                )}
                {!activityLoading && !activityError && filtered.map((e) => (
                  <tr key={e.id} className="hover:bg-[#F8F8FC] transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-[#E8EEF4] flex items-center justify-center">
                          <MousePointer className="w-3 h-3 text-[#728DA7]" />
                        </div>
                        <span className="text-xs font-medium text-[#0A0A0A]">Click</span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1.5">
                        <Link2 className="w-3 h-3 text-[#728DA7] shrink-0" />
                        <span className="font-mono text-xs text-[#3A3A3E]">/{e.slug}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1.5">
                        <Globe className="w-3 h-3 text-[#8888A0] shrink-0" />
                        <span className="text-xs text-[#3A3A3E]">{e.country ?? "Unknown"}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1.5">
                        <Monitor className="w-3 h-3 text-[#8888A0] shrink-0" />
                        <span className="text-xs text-[#3A3A3E]">
                          {[e.device, e.browser].filter(Boolean).join(" · ") || "Unknown"}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-xs text-[#8888A0] truncate max-w-[120px] block">
                        {e.referrer || "Direct"}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs text-[#8888A0] whitespace-nowrap">
                      {fmtTime(e.timestamp)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Stat Card ───────────────────────────────────────────── */

function StatCard({ icon, label, value, loading }: {
  icon: React.ReactNode; label: string; value: string | null; loading: boolean;
}) {
  return (
    <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-xl bg-[#EEF3F7] flex items-center justify-center">{icon}</div>
        <span className="text-xs font-medium text-[#8888A0] uppercase tracking-wide">{label}</span>
      </div>
      {loading ? (
        <div className="h-7 w-24 bg-[#F4F4F6] rounded animate-pulse" />
      ) : (
        <p className="text-xl font-bold text-[#0A0A0A]">{value}</p>
      )}
    </div>
  );
}
