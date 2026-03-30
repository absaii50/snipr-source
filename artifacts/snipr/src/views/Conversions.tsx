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
import { Card } from "@/components/ui/card";
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

const EVENT_COLORS: Record<string, string> = {
  purchase: "bg-emerald-50 text-emerald-700 border-emerald-200",
  signup: "bg-blue-50 text-blue-700 border-blue-200",
  add_to_cart: "bg-amber-50 text-amber-700 border-amber-200",
  download: "bg-violet-50 text-violet-700 border-violet-200",
  inquiry: "bg-sky-50 text-sky-700 border-sky-200",
  star: "bg-yellow-50 text-yellow-700 border-yellow-200",
  follow: "bg-pink-50 text-pink-700 border-pink-200",
};

function getEventColor(event: string) {
  return EVENT_COLORS[event] || "bg-slate-50 text-slate-700 border-slate-200";
}

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
    if (sortCol !== col) return <ArrowUpDown className="w-3 h-3 text-slate-400" />;
    return sortDir === "asc" ? (
      <ArrowUp className="w-3 h-3 text-indigo-500" />
    ) : (
      <ArrowDown className="w-3 h-3 text-indigo-500" />
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
      icon: <Target className="w-4 h-4 text-indigo-500" />,
      iconBg: "bg-indigo-50",
    },
    {
      label: "Total Revenue",
      value: isLoadingRevenue ? null : formatCurrency(totalRevenue),
      icon: <DollarSign className="w-4 h-4 text-emerald-600" />,
      iconBg: "bg-emerald-50",
      valueColor: "text-emerald-600",
    },
    {
      label: "Avg. Order Value",
      value: isLoadingRevenue ? null : formatCurrency(avgRevenue),
      icon: <TrendingUp className="w-4 h-4 text-violet-600" />,
      iconBg: "bg-violet-50",
    },
    {
      label: "Top Converting Link",
      value: isLoadingRevenue ? null : topLinkSlug ? `/${topLinkSlug}` : "—",
      icon: <Activity className="w-4 h-4 text-orange-500" />,
      iconBg: "bg-orange-50",
      valueColor: topLinkSlug ? "text-indigo-600 font-mono text-lg" : undefined,
    },
  ];

  return (
    <ProtectedLayout>
      <div className="p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6">

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-display font-extrabold tracking-tight">Conversions</h1>
              {totalConversions > 0 && !isLoadingRevenue && (
                <span className="text-xs font-bold bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full">
                  {totalConversions}
                </span>
              )}
            </div>
            <p className="text-muted-foreground mt-1">
              Track events and revenue driven by your short links.
            </p>
          </div>

          <div className="flex items-center bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
            {PERIODS.map((p) => (
              <button
                key={p.key}
                onClick={() => setPeriod(p.key)}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  period === p.key
                    ? "bg-slate-900 text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {kpis.map(({ label, value, icon, iconBg, valueColor }) => (
            <Card key={label} className="rounded-2xl border-slate-200 shadow-sm p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>
                <div className={`w-7 h-7 rounded-lg ${iconBg} flex items-center justify-center`}>{icon}</div>
              </div>
              {value === null ? (
                <div className="h-7 w-20 bg-slate-100 rounded-lg animate-pulse" />
              ) : (
                <p className={`text-2xl font-bold truncate ${valueColor ?? "text-slate-900"}`}>{value}</p>
              )}
            </Card>
          ))}
        </div>

        {hasError ? (
          <Card className="rounded-2xl border-red-200 shadow-sm">
            <div className="py-16 flex flex-col items-center gap-3 text-center">
              <div className="w-14 h-14 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center">
                <Target className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-bold font-display">Failed to load conversions</h3>
              <p className="text-sm text-muted-foreground max-w-md">Something went wrong. Please try refreshing.</p>
            </div>
          </Card>
        ) : (
          <Card className="rounded-2xl border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Recent Conversions</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {periodDef.days ? `Last ${periodDef.days} days` : "All time"} · showing up to 200 events
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative max-w-[200px]">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search..."
                    className="pl-8 h-8 text-xs rounded-lg bg-white"
                  />
                </div>

                <div className="relative">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs rounded-lg gap-1.5"
                    onClick={() => setShowEventDropdown(!showEventDropdown)}
                  >
                    <Filter className="w-3 h-3" />
                    {eventFilter || "All Events"}
                    <ChevronDown className="w-3 h-3" />
                  </Button>
                  {showEventDropdown && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowEventDropdown(false)} />
                      <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-slate-200 rounded-xl shadow-lg p-1 min-w-[160px]">
                        <button
                          onClick={() => { setEventFilter(null); setShowEventDropdown(false); }}
                          className={`w-full text-left px-3 py-1.5 text-xs rounded-lg ${
                            !eventFilter ? "bg-slate-100 font-semibold" : "hover:bg-slate-50"
                          }`}
                        >
                          All Events
                        </button>
                        {allEvents.map((ev) => (
                          <button
                            key={ev}
                            onClick={() => { setEventFilter(ev); setShowEventDropdown(false); }}
                            className={`w-full text-left px-3 py-1.5 text-xs rounded-lg capitalize ${
                              eventFilter === ev ? "bg-slate-100 font-semibold" : "hover:bg-slate-50"
                            }`}
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
                    className="h-8 text-xs rounded-lg gap-1 text-muted-foreground"
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
                  <tr className="bg-slate-50/80 border-b border-slate-100">
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
                        className={`px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide ${align} ${col ? "cursor-pointer select-none hover:text-slate-700" : ""}`}
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
                <tbody className="divide-y divide-slate-100">
                  {isLoadingConversions ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-16 text-center">
                        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground mx-auto" />
                      </td>
                    </tr>
                  ) : filteredConversions.length === 0 && (searchQuery || eventFilter) ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center">
                        <Search className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">
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
                          <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center">
                            <TerminalSquare className="w-7 h-7 text-indigo-500" />
                          </div>
                          <div>
                            <p className="text-base font-bold font-display">No conversions tracked yet</p>
                            <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
                              Send a POST request to start recording conversion events from your checkout or signup flow.
                            </p>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredConversions.map((conv) => {
                      const rev = parseFloat(conv.revenue || "0");
                      return (
                        <tr key={conv.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-5 py-3 text-xs text-muted-foreground whitespace-nowrap">
                            {format(new Date(conv.createdAt), "MMM d, yyyy")}
                            <span className="text-muted-foreground/50 ml-1.5">
                              {format(new Date(conv.createdAt), "HH:mm")}
                            </span>
                          </td>
                          <td className="px-5 py-3">
                            <span className="text-xs font-semibold text-indigo-600 font-mono">
                              /{conv.slug ?? "—"}
                            </span>
                          </td>
                          <td className="px-5 py-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border capitalize ${getEventColor(conv.eventName)}`}>
                              {conv.eventName.replace(/_/g, " ")}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-xs text-muted-foreground">
                            {conv.utmCampaign ?? "—"}
                          </td>
                          <td className="px-5 py-3 text-xs text-muted-foreground">
                            {conv.utmSource ?? "—"}
                          </td>
                          <td className={`px-5 py-3 text-right text-sm font-bold ${rev > 0 ? "text-emerald-600" : "text-muted-foreground"}`}>
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
              <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  Showing {filteredConversions.length} conversion{filteredConversions.length !== 1 ? "s" : ""}
                  {(searchQuery || eventFilter) && ` (filtered)`}
                </span>
                <span>
                  {filteredStats.withRevenue} with revenue · {formatCurrency(filteredStats.revenue)} total
                </span>
              </div>
            )}
          </Card>
        )}

        <Card className="rounded-2xl border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center">
                <Zap className="w-4 h-4 text-indigo-500" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">Quick Integration</h2>
                <p className="text-xs text-muted-foreground">Send conversion events via API</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs rounded-lg gap-1.5"
              onClick={handleCopySnippet}
            >
              {copiedSnippet ? (
                <><Check className="w-3 h-3 text-green-500" /> Copied</>
              ) : (
                <><Copy className="w-3 h-3" /> Copy</>
              )}
            </Button>
          </div>
          <pre className="bg-slate-950 text-slate-300 text-xs font-mono p-5 overflow-x-auto leading-relaxed">
            {curlSnippet}
          </pre>
        </Card>

        <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Info className="w-4 h-4 text-indigo-500" />
            <p className="text-xs font-bold text-slate-900 uppercase tracking-wider">How conversion tracking works</p>
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
              <div key={step} className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-indigo-500 text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                  {step}
                </div>
                <div>
                  <p className="font-semibold text-slate-900">{title}</p>
                  <p className="text-muted-foreground mt-1 leading-relaxed">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </ProtectedLayout>
  );
}
