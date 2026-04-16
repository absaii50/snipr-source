"use client";
import { useState, useMemo } from "react";
import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { useGetConversions, useGetRevenueReport } from "@workspace/api-client-react";
import type { ConversionRow, RevenueReport } from "@workspace/api-client-react";
import {
  Target, DollarSign, TrendingUp, Activity,
  TerminalSquare, Loader2, Search, Copy, Check,
  ChevronDown, ArrowUpDown, ArrowUp, ArrowDown,
  Filter, X, Info, Zap,
} from "lucide-react";
import { format, subDays } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

type PeriodKey = "7d" | "30d" | "90d" | "all";
const PERIODS: { key: PeriodKey; label: string; days: number | null }[] = [
  { key: "7d", label: "7D", days: 7 },
  { key: "30d", label: "30D", days: 30 },
  { key: "90d", label: "90D", days: 90 },
  { key: "all", label: "All", days: null },
];

type SortCol = "date" | "link" | "event" | "revenue";
type SortDir = "asc" | "desc";

function formatCurrency(val: number | string | null | undefined, currency = "USD") {
  if (val === null || val === undefined) return "—";
  const num = typeof val === "string" ? parseFloat(val) : val;
  if (isNaN(num)) return "—";
  if (num === 0) return "$0.00";
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(num);
}

function isoDate(d: Date) {
  return d.toISOString().split("T")[0];
}

const EVENT_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  purchase: { bg: "rgba(16,185,129,0.1)", text: "#10B981", border: "rgba(16,185,129,0.25)" },
  signup: { bg: "rgba(96,165,250,0.1)", text: "#60A5FA", border: "rgba(96,165,250,0.25)" },
  add_to_cart: { bg: "rgba(251,191,36,0.1)", text: "#FBBF24", border: "rgba(251,191,36,0.25)" },
  download: { bg: "rgba(167,139,250,0.1)", text: "#A78BFA", border: "rgba(167,139,250,0.25)" },
  inquiry: { bg: "rgba(6,182,212,0.1)", text: "#06B6D4", border: "rgba(6,182,212,0.25)" },
  star: { bg: "rgba(250,204,21,0.1)", text: "#FACC15", border: "rgba(250,204,21,0.25)" },
  follow: { bg: "rgba(244,114,182,0.1)", text: "#F472B6", border: "rgba(244,114,182,0.25)" },
};

const DEFAULT_EVENT_COLOR = { bg: "rgba(255,255,255,0.03)", text: "#E4E4E7", border: "#27272A" };

function getEventColor(event: string) {
  return EVENT_COLORS[event] || DEFAULT_EVENT_COLOR;
}

const solidCard = {
  background: "#18181B",
  border: "1px solid #27272A",
  borderRadius: "12px",
};

export default function Conversions() {
  const [period, setPeriod] = useState<PeriodKey>("30d");
  const [searchQuery, setSearchQuery] = useState("");
  const [eventFilter, setEventFilter] = useState<string | null>(null);
  const [showEventDropdown, setShowEventDropdown] = useState(false);
  const [sortCol, setSortCol] = useState<SortCol>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [copiedSnippet, setCopiedSnippet] = useState(false);
  const { toast } = useToast();

  const now = useMemo(() => new Date(), []);
  const periodDef = PERIODS.find((p) => p.key === period)!;
  const dateParams = useMemo(() => {
    if (!periodDef.days) return {};
    return { from: isoDate(subDays(now, periodDef.days)), to: isoDate(now) };
  }, [period, now, periodDef.days]);

  const { data: rawRevenue, isLoading: isLoadingRevenue, error: revenueError } = useGetRevenueReport(dateParams);
  const { data: rawConversions, isLoading: isLoadingConversions, error: conversionsError } = useGetConversions(dateParams);

  const report = rawRevenue as RevenueReport | undefined;
  const conversions = (rawConversions ?? []) as ConversionRow[];

  const totalConversions = report?.totalConversions ?? 0;
  const totalRevenue = report?.totalRevenue ?? 0;
  const avgRevenue = totalConversions > 0 ? totalRevenue / totalConversions : 0;
  const topLinkSlug = report?.byLink?.[0]?.slug ?? null;

  const allEvents = useMemo(() => {
    const set = new Set<string>();
    conversions.forEach((c) => set.add(c.eventName));
    return Array.from(set).sort();
  }, [conversions]);

  const filteredConversions = useMemo(() => {
    let rows = conversions;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      rows = rows.filter(
        (c) =>
          (c.slug || "").toLowerCase().includes(q) ||
          c.eventName.toLowerCase().includes(q) ||
          (c.utmCampaign || "").toLowerCase().includes(q) ||
          (c.utmSource || "").toLowerCase().includes(q)
      );
    }

    if (eventFilter) {
      rows = rows.filter((c) => c.eventName === eventFilter);
    }

    rows = [...rows].sort((a, b) => {
      let cmp = 0;
      switch (sortCol) {
        case "date":
          cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case "link":
          cmp = (a.slug || "").localeCompare(b.slug || "");
          break;
        case "event":
          cmp = a.eventName.localeCompare(b.eventName);
          break;
        case "revenue":
          cmp = parseFloat(a.revenue || "0") - parseFloat(b.revenue || "0");
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return rows;
  }, [conversions, searchQuery, eventFilter, sortCol, sortDir]);

  const filteredStats = useMemo(() => {
    let revWithValue = 0;
    let revTotal = 0;
    for (const c of filteredConversions) {
      const r = parseFloat(c.revenue || "0");
      if (r > 0) {
        revWithValue++;
        revTotal += r;
      }
    }
    return { withRevenue: revWithValue, revenue: revTotal };
  }, [filteredConversions]);

  const handleSort = (col: SortCol) => {
    if (sortCol === col) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortCol(col);
      setSortDir(col === "date" ? "desc" : "asc");
    }
  };

  const SortIcon = ({ col }: { col: SortCol }) => {
    if (sortCol !== col) return <ArrowUpDown className="w-3 h-3 text-[#A1A1AA]" />;
    return sortDir === "asc" ? (
      <ArrowUp className="w-3 h-3 text-[#8B5CF6]" />
    ) : (
      <ArrowDown className="w-3 h-3 text-[#8B5CF6]" />
    );
  };

  const curlSnippet = `curl -X POST https://your-domain.com/api/conversions \\
  -H "Content-Type: application/json" \\
  -d '{
    "slug": "your-slug",
    "eventName": "purchase",
    "revenue": 49.99,
    "currency": "USD",
    "utmCampaign": "summer_sale",
    "utmSource": "facebook"
  }'`;

  const handleCopySnippet = async () => {
    try {
      await navigator.clipboard.writeText(curlSnippet);
      setCopiedSnippet(true);
      toast({ title: "Copied to clipboard" });
      setTimeout(() => setCopiedSnippet(false), 2000);
    } catch {
      toast({ title: "Failed to copy", variant: "destructive" });
    }
  };

  const hasError = revenueError || conversionsError;

  const kpis = [
    {
      label: "Total Conversions",
      value: isLoadingRevenue ? null : totalConversions.toLocaleString(),
      icon: <Target className="w-4 h-4 text-[#8B5CF6]" />,
      iconBg: "rgba(139,92,246,0.12)",
    },
    {
      label: "Total Revenue",
      value: isLoadingRevenue ? null : formatCurrency(totalRevenue),
      icon: <DollarSign className="w-4 h-4 text-[#10B981]" />,
      iconBg: "rgba(16,185,129,0.12)",
      valueColor: "text-[#10B981]",
    },
    {
      label: "Avg. Order Value",
      value: isLoadingRevenue ? null : formatCurrency(avgRevenue),
      icon: <TrendingUp className="w-4 h-4 text-[#A78BFA]" />,
      iconBg: "rgba(167,139,250,0.12)",
    },
    {
      label: "Top Converting Link",
      value: isLoadingRevenue ? null : topLinkSlug ? `/${topLinkSlug}` : "—",
      icon: <Activity className="w-4 h-4 text-[#FB923C]" />,
      iconBg: "rgba(251,146,60,0.12)",
      valueColor: topLinkSlug ? "text-[#A1A1AA] font-mono text-lg" : undefined,
    },
  ];

  return (
    <ProtectedLayout>
      <div className="p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6">

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "linear-gradient(135deg, #8B5CF6, #A78BFA)" }}
            >
              <Target className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="font-[family-name:var(--font-space-grotesk)] text-[28px] font-extrabold tracking-tight text-[#FAFAFA]">Conversions</h1>
                {totalConversions > 0 && !isLoadingRevenue && (
                  <span
                    className="text-xs font-bold px-2.5 py-1 rounded-full bg-[#27272A] text-[#71717A] border border-[#27272A]"
                  >
                    {totalConversions}
                  </span>
                )}
              </div>
              <p className="text-[#A1A1AA] mt-1">
                Track events and revenue driven by your short links.
              </p>
            </div>
          </div>

          <div
            className="flex items-center p-1 rounded-lg bg-[#18181B] border border-[#27272A]"
          >
            {PERIODS.map((p) => (
              <button
                key={p.key}
                onClick={() => setPeriod(p.key)}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  period === p.key
                    ? "text-[#A78BFA] shadow-sm"
                    : "text-[#A1A1AA] hover:text-[#71717A]"
                }`}
                style={period === p.key ? { background: "rgba(139,92,246,0.12)" } : undefined}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {kpis.map(({ label, value, icon, iconBg, valueColor }) => (
            <div key={label} className="p-5 rounded-xl bg-[#18181B] border border-[#27272A]">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] font-semibold text-[#A1A1AA] uppercase tracking-wide">{label}</p>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: iconBg }}>{icon}</div>
              </div>
              {value === null ? (
                <div className="h-7 w-20 rounded-lg animate-pulse bg-[#27272A]" />
              ) : (
                <p className={`text-[28px] font-extrabold truncate ${valueColor ?? "text-[#FAFAFA]"}`}>{value}</p>
              )}
            </div>
          ))}
        </div>

        {hasError ? (
          <div className="rounded-xl bg-[#18181B] border border-[#F87171]/30">
            <div className="py-16 flex flex-col items-center gap-3 text-center">
              <div className="w-14 h-14 rounded-xl flex items-center justify-center bg-[#F87171]/10">
                <Target className="w-7 h-7 text-[#F87171]" />
              </div>
              <h3 className="text-lg font-bold font-[family-name:var(--font-space-grotesk)] text-[#FAFAFA]">Failed to load conversions</h3>
              <p className="text-sm text-[#71717A] max-w-md">Something went wrong. Please try refreshing.</p>
            </div>
          </div>
        ) : (
          <div className="rounded-xl bg-[#18181B] border border-[#27272A] overflow-hidden">
            <div
              className="px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              style={{ borderBottom: "1px solid #27272A" }}
            >
              <div>
                <h2 className="text-sm font-bold font-[family-name:var(--font-space-grotesk)] text-[#FAFAFA]">Recent Conversions</h2>
                <p className="text-xs text-[#A1A1AA] mt-0.5">
                  {periodDef.days ? `Last ${periodDef.days} days` : "All time"} · showing up to 200 events
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative max-w-[200px]">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#A1A1AA]" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search..."
                    className="pl-8 h-8 text-xs rounded-lg text-[#E4E4E7] placeholder:text-[#71717A] bg-[#09090B] border-[#27272A] focus:border-[#8B5CF6]/40 focus:ring-2 focus:ring-[#8B5CF6]/10"
                  />
                </div>

                <div className="relative">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs rounded-lg gap-1.5 text-[#E4E4E7] bg-[#27272A] border-[#3F3F46]"
                    onClick={() => setShowEventDropdown(!showEventDropdown)}
                  >
                    <Filter className="w-3 h-3" />
                    {eventFilter || "All Events"}
                    <ChevronDown className="w-3 h-3" />
                  </Button>
                  {showEventDropdown && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowEventDropdown(false)} />
                      <div
                        className="absolute right-0 top-full mt-1 z-50 p-1 min-w-[160px] rounded-xl bg-[#18181B] border border-[#27272A]"
                      >
                        <button
                          onClick={() => { setEventFilter(null); setShowEventDropdown(false); }}
                          className={`w-full text-left px-3 py-1.5 text-xs rounded-lg text-[#E4E4E7] ${
                            !eventFilter ? "font-semibold" : ""
                          }`}
                          style={!eventFilter ? { background: "rgba(139,92,246,0.12)" } : undefined}
                          onMouseEnter={(e) => { if (eventFilter) (e.target as HTMLElement).style.background = "#27272A"; }}
                          onMouseLeave={(e) => { if (eventFilter) (e.target as HTMLElement).style.background = "transparent"; }}
                        >
                          All Events
                        </button>
                        {allEvents.map((ev) => (
                          <button
                            key={ev}
                            onClick={() => { setEventFilter(ev); setShowEventDropdown(false); }}
                            className={`w-full text-left px-3 py-1.5 text-xs rounded-lg capitalize text-[#E4E4E7] ${
                              eventFilter === ev ? "font-semibold" : ""
                            }`}
                            style={eventFilter === ev ? { background: "rgba(139,92,246,0.12)" } : undefined}
                            onMouseEnter={(e) => { if (eventFilter !== ev) (e.target as HTMLElement).style.background = "#27272A"; }}
                            onMouseLeave={(e) => { if (eventFilter !== ev) (e.target as HTMLElement).style.background = "transparent"; }}
                          >
                            {ev.replace(/_/g, " ")}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                {(eventFilter || searchQuery) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs rounded-lg gap-1 text-[#A1A1AA]"
                    onClick={() => { setEventFilter(null); setSearchQuery(""); }}
                  >
                    <X className="w-3 h-3" /> Clear
                  </Button>
                )}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="bg-[#09090B]/50" style={{ borderBottom: "1px solid #27272A" }}>
                    {([
                      { col: "date" as SortCol, label: "Date", align: "" },
                      { col: "link" as SortCol, label: "Link", align: "" },
                      { col: "event" as SortCol, label: "Event", align: "" },
                      { col: null, label: "Campaign", align: "" },
                      { col: null, label: "Source", align: "" },
                      { col: "revenue" as SortCol, label: "Revenue", align: "text-right" },
                    ] as const).map(({ col, label, align }) => (
                      <th
                        key={label}
                        className={`px-5 py-3 text-xs font-semibold text-[#A1A1AA] uppercase tracking-wide ${align} ${col ? "cursor-pointer select-none hover:text-[#71717A]" : ""}`}
                        onClick={col ? () => handleSort(col) : undefined}
                      >
                        <span className="inline-flex items-center gap-1">
                          {label}
                          {col && <SortIcon col={col} />}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#27272A]">
                  {isLoadingConversions ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-16 text-center">
                        <Loader2 className="w-6 h-6 animate-spin text-[#A1A1AA] mx-auto" />
                      </td>
                    </tr>
                  ) : filteredConversions.length === 0 && (searchQuery || eventFilter) ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center">
                        <Search className="w-6 h-6 text-[#A1A1AA] mx-auto mb-2" />
                        <p className="text-sm text-[#71717A]">
                          No conversions match your filters
                        </p>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mt-2 text-xs"
                          onClick={() => { setEventFilter(null); setSearchQuery(""); }}
                        >
                          Clear filters
                        </Button>
                      </td>
                    </tr>
                  ) : filteredConversions.length === 0 ? (
                    <tr>
                      <td colSpan={6}>
                        <div className="py-16 flex flex-col items-center gap-4 text-center px-6">
                          <div className="w-14 h-14 rounded-xl flex items-center justify-center bg-[#8B5CF6]/12">
                            <TerminalSquare className="w-7 h-7 text-[#8B5CF6]" />
                          </div>
                          <div>
                            <p className="text-base font-bold font-[family-name:var(--font-space-grotesk)] text-[#FAFAFA]">No conversions tracked yet</p>
                            <p className="text-sm text-[#71717A] mt-1 max-w-sm mx-auto">
                              Send a POST request to start recording conversion events from your checkout or signup flow.
                            </p>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredConversions.map((conv) => {
                      const rev = parseFloat(conv.revenue || "0");
                      const ec = getEventColor(conv.eventName);
                      return (
                        <tr key={conv.id} className="transition-colors hover:bg-[#27272A]/50">
                          <td className="px-5 py-3 text-xs text-[#71717A] whitespace-nowrap">
                            {format(new Date(conv.createdAt), "MMM d, yyyy")}
                            <span className="text-[#A1A1AA] ml-1.5">
                              {format(new Date(conv.createdAt), "HH:mm")}
                            </span>
                          </td>
                          <td className="px-5 py-3">
                            <span className="text-xs font-semibold text-[#8B5CF6] font-mono">
                              /{conv.slug ?? "—"}
                            </span>
                          </td>
                          <td className="px-5 py-3">
                            <span
                              className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize"
                              style={{ background: ec.bg, color: ec.text, border: `1px solid ${ec.border}` }}
                            >
                              {conv.eventName.replace(/_/g, " ")}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-xs text-[#71717A]">
                            {conv.utmCampaign ?? "—"}
                          </td>
                          <td className="px-5 py-3 text-xs text-[#71717A]">
                            {conv.utmSource ?? "—"}
                          </td>
                          <td className={`px-5 py-3 text-right text-sm font-bold ${rev > 0 ? "text-[#10B981]" : "text-[#A1A1AA]"}`}>
                            {rev > 0 ? formatCurrency(rev, conv.currency) : "—"}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {filteredConversions.length > 0 && (
              <div
                className="px-5 py-3 flex items-center justify-between text-xs text-[#71717A] bg-[#09090B]/50"
                style={{ borderTop: "1px solid #27272A" }}
              >
                <span>
                  Showing {filteredConversions.length} conversion{filteredConversions.length !== 1 ? "s" : ""}
                  {(searchQuery || eventFilter) && ` (filtered)`}
                </span>
                <span>
                  {filteredStats.withRevenue} with revenue · {formatCurrency(filteredStats.revenue)} total
                </span>
              </div>
            )}
          </div>
        )}

        <div className="rounded-xl bg-[#18181B] border border-[#27272A] overflow-hidden">
          <div
            className="px-5 py-4 flex items-center justify-between"
            style={{ borderBottom: "1px solid #27272A" }}
          >
            <div className="flex items-center gap-2">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: "linear-gradient(135deg, #8B5CF6, #A78BFA)" }}
              >
                <Zap className="w-4 h-4 text-white" />
              </div>
              <div>
                <h2 className="text-sm font-bold font-[family-name:var(--font-space-grotesk)] text-[#FAFAFA]">Quick Integration</h2>
                <p className="text-xs text-[#A1A1AA]">Send conversion events via API</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs rounded-lg gap-1.5 text-[#E4E4E7] bg-[#27272A] border-[#3F3F46]"
              onClick={handleCopySnippet}
            >
              {copiedSnippet ? (
                <><Check className="w-3 h-3 text-[#10B981]" /> Copied</>
              ) : (
                <><Copy className="w-3 h-3" /> Copy</>
              )}
            </Button>
          </div>
          <pre
            className="text-[#d1d1d6] text-xs font-mono p-5 overflow-x-auto leading-relaxed bg-[#09090B]"
          >
            {curlSnippet}
          </pre>
        </div>

        <div className="p-5 rounded-xl bg-[#18181B] border border-[#27272A]">
          <div className="flex items-center gap-2 mb-4">
            <Info className="w-4 h-4 text-[#8B5CF6]" />
            <p className="text-xs font-bold text-[#FAFAFA] uppercase tracking-wider font-[family-name:var(--font-space-grotesk)]">How conversion tracking works</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 text-xs">
            {[
              {
                step: "1",
                title: "Create a short link",
                body: "Create a link to your product or landing page. Note the slug (e.g. /buy or /promo).",
              },
              {
                step: "2",
                title: "Fire an event on action",
                body: "When a user completes an action (purchase, signup, download), POST to /api/conversions with the slug, event name, and revenue.",
              },
              {
                step: "3",
                title: "View attribution",
                body: "Conversions appear here and on the Revenue page, broken down by link, campaign, source, and event type.",
              },
            ].map(({ step, title, body }) => (
              <div
                key={step}
                className="flex gap-3 p-4 rounded-lg bg-[#09090B] border border-[#27272A]"
              >
                <div
                  className="w-6 h-6 rounded-full text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: "linear-gradient(135deg, #8B5CF6, #A78BFA)" }}
                >
                  {step}
                </div>
                <div>
                  <p className="font-semibold text-[#E4E4E7]">{title}</p>
                  <p className="text-[#71717A] mt-1 leading-relaxed">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </ProtectedLayout>
  );
}
