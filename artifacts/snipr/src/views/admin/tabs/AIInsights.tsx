"use client";
import { useState } from "react";
import {
  Sparkles, TrendingUp, AlertTriangle, Zap, BarChart3,
  Brain, Globe, Monitor, RefreshCw, CheckCircle,
  ArrowUpRight, ArrowDownRight, Minus,
} from "lucide-react";
import { apiFetch } from "../utils";

interface Insight {
  category: string;
  title: string;
  summary: string;
  severity: "positive" | "info" | "warning" | "alert";
  recommendation: string;
}

interface InsightsResult {
  overview: string;
  insights: Insight[];
  generatedAt: string;
}

/* ── Severity config ────────────────────────────────────────────────── */
const SEVERITY = {
  positive: { bg: "#E6F7F1", border: "#B6E8D6", text: "#2E9A72", dot: "bg-green-500", label: "Positive" },
  info:     { bg: "#EEF3F7", border: "#C8D8E8", text: "#728DA7", dot: "bg-blue-400",  label: "Info" },
  warning:  { bg: "#FEF9E7", border: "#F9E4A0", text: "#B08200", dot: "bg-amber-400", label: "Warning" },
  alert:    { bg: "#FEF2F2", border: "#FCC8C8", text: "#DC2626", dot: "bg-red-500",   label: "Alert" },
};

/* ── Category icon map ──────────────────────────────────────────────── */
const CAT_ICON: Record<string, React.ElementType> = {
  Growth:     TrendingUp,
  Traffic:    BarChart3,
  Users:      Brain,
  Geographic: Globe,
  Devices:    Monitor,
  Risk:       AlertTriangle,
};

const CAT_COLOR: Record<string, { accent: string; bg: string }> = {
  Growth:     { accent: "#2E9A72", bg: "#E6F7F1" },
  Traffic:    { accent: "#728DA7", bg: "#EEF3F7" },
  Users:      { accent: "#7C5CC4", bg: "#F0EBF9" },
  Geographic: { accent: "#4A7A94", bg: "#E8EEF4" },
  Devices:    { accent: "#D4875A", bg: "#FAF0E9" },
  Risk:       { accent: "#DC2626", bg: "#FEF2F2" },
};

/* ── Severity icon ─────────────────────────────────────────────────── */
function SeverityIcon({ s }: { s: Insight["severity"] }) {
  if (s === "positive") return <ArrowUpRight className="w-3.5 h-3.5" style={{ color: SEVERITY.positive.text }} />;
  if (s === "warning")  return <Minus className="w-3.5 h-3.5" style={{ color: SEVERITY.warning.text }} />;
  if (s === "alert")    return <ArrowDownRight className="w-3.5 h-3.5" style={{ color: SEVERITY.alert.text }} />;
  return <CheckCircle className="w-3.5 h-3.5" style={{ color: SEVERITY.info.text }} />;
}

/* ── Single insight card ───────────────────────────────────────────── */
function InsightCard({ insight, idx }: { insight: Insight; idx: number }) {
  const sev = SEVERITY[insight.severity] ?? SEVERITY.info;
  const cat = CAT_COLOR[insight.category] ?? { accent: "#728DA7", bg: "#EEF3F7" };
  const Icon = CAT_ICON[insight.category] ?? Sparkles;

  return (
    <div
      className="bg-white rounded-2xl border overflow-hidden hover:shadow-md transition-all hover:-translate-y-0.5"
      style={{ borderColor: sev.border }}
    >
      {/* Top strip */}
      <div className="h-1.5 w-full" style={{ backgroundColor: sev.text, opacity: 0.6 }} />

      <div className="p-5">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: cat.bg }}
            >
              <Icon className="w-4.5 h-4.5" style={{ color: cat.accent }} />
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: cat.accent }}>
                {insight.category}
              </div>
              <h3 className="text-sm font-bold text-[#0A0A0A] leading-snug">{insight.title}</h3>
            </div>
          </div>
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 mt-1"
            style={{ backgroundColor: sev.bg, color: sev.text }}
          >
            <SeverityIcon s={insight.severity} />
            {sev.label}
          </span>
        </div>

        {/* Summary */}
        <p className="text-xs text-[#3A3A3E] leading-relaxed mb-3">{insight.summary}</p>

        {/* Recommendation */}
        <div className="flex items-start gap-2 p-3 rounded-xl" style={{ backgroundColor: sev.bg }}>
          <Zap className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: sev.text }} />
          <p className="text-xs font-medium leading-relaxed" style={{ color: sev.text }}>
            {insight.recommendation}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ── Loading skeleton ──────────────────────────────────────────────── */
function Skeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="bg-white rounded-2xl border border-[#E4E4EC] overflow-hidden">
          <div className="h-1.5 bg-[#E4E4EC] animate-pulse" />
          <div className="p-5 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#F4F4F6] animate-pulse" />
              <div className="flex-1 space-y-1.5">
                <div className="h-2.5 bg-[#F4F4F6] rounded animate-pulse w-16" />
                <div className="h-3.5 bg-[#F4F4F6] rounded animate-pulse w-40" />
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="h-3 bg-[#F4F4F6] rounded animate-pulse" />
              <div className="h-3 bg-[#F4F4F6] rounded animate-pulse w-4/5" />
              <div className="h-3 bg-[#F4F4F6] rounded animate-pulse w-3/5" />
            </div>
            <div className="h-10 bg-[#F4F4F6] rounded-xl animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Main tab ──────────────────────────────────────────────────────── */
export default function AIInsightsTab() {
  const [result, setResult]   = useState<InsightsResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch("/admin/ai-insights", { method: "POST" });
      setResult(data);
    } catch (err: any) {
      setError(err?.error ?? "Failed to generate insights. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function fmtTime(iso: string) {
    return new Date(iso).toLocaleString("en-US", {
      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    });
  }

  return (
    <div className="space-y-6">
      {/* Header card */}
      <div className="bg-gradient-to-br from-[#F0EBF9] via-[#EEF3F7] to-[#E8EEF4] border border-[#D4C8EF] rounded-2xl p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center shrink-0">
              <Sparkles className="w-6 h-6 text-[#7C5CC4]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#0A0A0A]">Platform AI Insights</h2>
              <p className="text-sm text-[#3A3A3E] mt-1 leading-relaxed max-w-xl">
                DeepSeek analyzes your real platform data — users, clicks, links, geography, and more —
                to surface actionable intelligence for you.
              </p>
              {result && (
                <div className="flex items-center gap-1.5 mt-2 text-xs text-[#8888A0]">
                  <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                  Last generated {fmtTime(result.generatedAt)}
                </div>
              )}
            </div>
          </div>

          <button
            onClick={generate}
            disabled={loading}
            className="shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0A0A0A] text-white text-sm font-semibold hover:bg-[#1A1A1A] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Analyzing…
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                {result ? "Regenerate" : "Generate Insights"}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="flex items-start gap-3 px-5 py-4 bg-red-50 border border-red-100 rounded-2xl text-sm text-red-700">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {/* Loading skeletons */}
      {loading && (
        <div className="space-y-4">
          <div className="h-16 bg-white border border-[#E4E4EC] rounded-2xl animate-pulse" />
          <Skeleton />
        </div>
      )}

      {/* Results */}
      {!loading && result && (
        <div className="space-y-5">
          {/* Executive overview */}
          <div className="bg-white rounded-2xl border border-[#E4E4EC] p-5">
            <div className="flex items-center gap-2 mb-3">
              <Brain className="w-4 h-4 text-[#7C5CC4]" />
              <h3 className="text-sm font-semibold text-[#0A0A0A]">Executive Summary</h3>
              <span className="ml-auto text-[10px] font-medium text-[#8888A0] bg-[#F4F4F6] px-2 py-0.5 rounded-full flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-[#7C5CC4]" />
                Powered by DeepSeek
              </span>
            </div>
            <p className="text-sm text-[#3A3A3E] leading-relaxed">{result.overview}</p>
          </div>

          {/* Insight cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {result.insights.map((ins, i) => (
              <InsightCard key={i} insight={ins} idx={i} />
            ))}
          </div>
        </div>
      )}

      {/* Empty state — not yet generated */}
      {!loading && !result && !error && (
        <div className="bg-white rounded-2xl border border-[#E4E4EC] py-16 flex flex-col items-center text-center px-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#F0EBF9] to-[#EEF3F7] flex items-center justify-center mb-4">
            <Sparkles className="w-7 h-7 text-[#7C5CC4]" />
          </div>
          <h3 className="text-base font-bold text-[#0A0A0A] mb-2">Ready to analyze your platform</h3>
          <p className="text-sm text-[#8888A0] max-w-sm leading-relaxed mb-6">
            Click "Generate Insights" above to run a real-time AI analysis across your users,
            links, clicks, and traffic patterns.
          </p>
          <button
            onClick={generate}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#0A0A0A] text-white text-sm font-semibold hover:bg-[#1A1A1A] active:scale-[0.98] transition-all"
          >
            <Sparkles className="w-4 h-4" />
            Generate Insights
          </button>
        </div>
      )}
    </div>
  );
}
