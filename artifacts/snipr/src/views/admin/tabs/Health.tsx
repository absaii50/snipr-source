"use client";
import { useEffect, useState, useCallback } from "react";
import { Activity, AlertTriangle, AlertCircle, CheckCircle2, Loader2, Play, RefreshCw, Clock } from "lucide-react";
import { apiFetch, fmtTime } from "../utils";
import { useToast } from "../Toast";

/* ────────────────────────────────────────────────────────────────────── */
/* Types                                                                  */
/* ────────────────────────────────────────────────────────────────────── */

interface Finding {
  id: string;
  checkName: string;
  severity: "critical" | "warning" | "info";
  status: "open" | "resolved";
  message: string;
  details: Record<string, unknown> | null;
  firstSeenAt: string;
  lastSeenAt: string;
  resolvedAt: string | null;
  occurrenceCount: number;
}

interface CheckSpec { name: string; intervalMs: number; }
interface HealthPayload {
  findings: Finding[];
  checks: CheckSpec[];
  summary: Record<string, { open: number; resolved: number }>;
}

/* ────────────────────────────────────────────────────────────────────── */
/* Helpers                                                                 */
/* ────────────────────────────────────────────────────────────────────── */

const SEVERITY_TONE: Record<Finding["severity"], { bg: string; text: string; ring: string; icon: React.ElementType; label: string }> = {
  critical: { bg: "bg-red-50",    text: "text-red-700",    ring: "ring-red-200",    icon: AlertCircle,    label: "Critical" },
  warning:  { bg: "bg-amber-50",  text: "text-amber-700",  ring: "ring-amber-200",  icon: AlertTriangle,  label: "Warning"  },
  info:     { bg: "bg-blue-50",   text: "text-blue-700",   ring: "ring-blue-200",   icon: Activity,       label: "Info"     },
};

function formatInterval(ms: number): string {
  if (ms >= 60 * 60 * 1000) return `every ${Math.round(ms / 3_600_000)}h`;
  if (ms >= 60 * 1000) return `every ${Math.round(ms / 60_000)}m`;
  return `every ${Math.round(ms / 1_000)}s`;
}

const CHECK_DESCRIPTIONS: Record<string, string> = {
  signup_flow: "New-user signup creates user + workspace rows correctly",
  link_create: "POST /links inserts and is readable via the redirect cache",
  link_update_busts_cache: "Editing a link's destination URL clears the cache immediately",
  plan_gate_blocks_free: "Free users get HTTP 402 on Pro endpoints",
  free_link_cap_enforced: "5-link cap blocks Free users at the 6th link",
  redirect_server_alive: "Server 2 (custom-domain redirect) reachable over HTTPS",
  dns_verifier_smoke: "checkDomainDns() fan-out still resolves A records",
  plan_stripe_inconsistency: "No user is on a paid plan with a long-canceled Stripe sub",
  ssl_expiring_soon: "No custom-domain cert expires in <14 days",
};

/* ────────────────────────────────────────────────────────────────────── */
/* Component                                                              */
/* ────────────────────────────────────────────────────────────────────── */

export default function Health() {
  const { toast } = useToast();
  const [data, setData] = useState<HealthPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"open" | "all" | "resolved">("open");
  const [severity, setSeverity] = useState<"all" | "critical" | "warning" | "info">("all");
  const [running, setRunning] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const qs = `?status=${filter}${severity !== "all" ? `&severity=${severity}` : ""}`;
      const d = await apiFetch(`/admin/health/findings${qs}`);
      setData(d);
    } catch (err: any) {
      toast(`Failed to load health findings: ${err?.message ?? "unknown"}`, "error");
    } finally {
      setLoading(false);
    }
  }, [filter, severity, toast]);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh every 30s so the page stays fresh while admin watches.
  useEffect(() => {
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [load]);

  async function resolve(id: string) {
    try {
      await apiFetch(`/admin/health/findings/${id}/resolve`, { method: "POST" });
      toast("Marked resolved", "success");
      load();
    } catch (err: any) {
      toast(`Failed: ${err?.message ?? "unknown"}`, "error");
    }
  }

  async function runNow(check: string) {
    setRunning(check);
    try {
      await apiFetch("/admin/health/run-now", {
        method: "POST",
        body: JSON.stringify({ check }),
        headers: { "Content-Type": "application/json" },
      });
      toast(`Triggered ${check}`, "success");
      // Give the check a few seconds to write its finding before refresh
      setTimeout(load, 2_000);
    } catch (err: any) {
      toast(`Failed: ${err?.message ?? "unknown"}`, "error");
    } finally {
      setRunning(null);
    }
  }

  if (loading && !data) {
    return (
      <div className="p-8 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[#728DA7]" />
      </div>
    );
  }

  const allOpen = data?.findings.filter((f) => f.status === "open") ?? [];
  const criticalOpen = allOpen.filter((f) => f.severity === "critical");
  const warningOpen = allOpen.filter((f) => f.severity === "warning");

  return (
    <div className="p-6 space-y-6">
      {/* ─── Health summary banner ─── */}
      <div className={`p-5 rounded-2xl border ${
        criticalOpen.length > 0
          ? "bg-red-50 border-red-200"
          : warningOpen.length > 0
          ? "bg-amber-50 border-amber-200"
          : "bg-emerald-50 border-emerald-200"
      }`}>
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
            criticalOpen.length > 0 ? "bg-red-100" : warningOpen.length > 0 ? "bg-amber-100" : "bg-emerald-100"
          }`}>
            {criticalOpen.length > 0 ? (
              <AlertCircle className="w-6 h-6 text-red-600" />
            ) : warningOpen.length > 0 ? (
              <AlertTriangle className="w-6 h-6 text-amber-600" />
            ) : (
              <CheckCircle2 className="w-6 h-6 text-emerald-600" />
            )}
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-[#1A1A1F]">
              {criticalOpen.length > 0
                ? `${criticalOpen.length} critical issue${criticalOpen.length > 1 ? "s" : ""}`
                : warningOpen.length > 0
                ? `${warningOpen.length} warning${warningOpen.length > 1 ? "s" : ""}`
                : "All systems operational"}
            </h2>
            <p className="text-sm text-[#5A5C60]">
              {data?.checks.length ?? 0} synthetic checks running in the background.
              {warningOpen.length > 0 && criticalOpen.length === 0 && " No critical failures."}
              {criticalOpen.length === 0 && warningOpen.length === 0 && " Last refresh: " + fmtTime(new Date().toISOString())}
            </p>
          </div>
          <button
            onClick={load}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-[#E2E2E6] text-sm font-medium text-[#1A1A1F] hover:bg-[#F4F4F6]"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>
      </div>

      {/* ─── Check registry ─── */}
      <div>
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-[#5A5C60] mb-3">Synthetic checks</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {data?.checks.map((c) => {
            const open = data.summary[c.name]?.open ?? 0;
            const isRunning = running === c.name;
            return (
              <div key={c.name} className="p-4 rounded-xl bg-white border border-[#E2E2E6]">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <code className="text-[13px] font-mono font-semibold text-[#1A1A1F]">{c.name}</code>
                      {open > 0 ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700">
                          {open} OPEN
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">
                          OK
                        </span>
                      )}
                    </div>
                    <p className="text-[12px] text-[#5A5C60] mt-1 leading-relaxed">
                      {CHECK_DESCRIPTIONS[c.name] ?? "Synthetic check"}
                    </p>
                    <p className="text-[11px] text-[#9B9DA0] mt-1.5 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {formatInterval(c.intervalMs)}
                    </p>
                  </div>
                  <button
                    onClick={() => runNow(c.name)}
                    disabled={isRunning}
                    className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-[#1A1A1F] text-white text-[11px] font-medium hover:bg-[#2A2A2F] disabled:opacity-40"
                    title="Run check now"
                  >
                    {isRunning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                    Run
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── Findings list ─── */}
      <div>
        <div className="flex items-center justify-between mb-3 gap-3">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-[#5A5C60]">Findings</h3>
          <div className="flex items-center gap-2">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
              className="px-2.5 py-1.5 rounded-md border border-[#E2E2E6] text-[12px] bg-white"
            >
              <option value="open">Open only</option>
              <option value="resolved">Resolved only</option>
              <option value="all">All</option>
            </select>
            <select
              value={severity}
              onChange={(e) => setSeverity(e.target.value as any)}
              className="px-2.5 py-1.5 rounded-md border border-[#E2E2E6] text-[12px] bg-white"
            >
              <option value="all">All severities</option>
              <option value="critical">Critical</option>
              <option value="warning">Warning</option>
              <option value="info">Info</option>
            </select>
          </div>
        </div>

        {(data?.findings.length ?? 0) === 0 ? (
          <div className="p-8 text-center rounded-xl bg-white border border-dashed border-[#E2E2E6]">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
            <p className="text-sm text-[#5A5C60]">No {filter !== "all" ? filter + " " : ""}findings — everything is healthy.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {data?.findings.map((f) => {
              const t = SEVERITY_TONE[f.severity];
              const Icon = t.icon;
              return (
                <div key={f.id} className={`p-4 rounded-xl border ${t.bg} ring-1 ${t.ring} border-transparent`}>
                  <div className="flex items-start gap-3">
                    <Icon className={`w-5 h-5 ${t.text} mt-0.5 shrink-0`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <code className="text-[12px] font-mono font-semibold text-[#1A1A1F]">{f.checkName}</code>
                        <span className={`inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded ${t.text} ${t.bg} ring-1 ${t.ring}`}>
                          {t.label.toUpperCase()}
                        </span>
                        {f.occurrenceCount > 1 && (
                          <span className="inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#1A1A1F]/10 text-[#1A1A1F]">
                            ×{f.occurrenceCount}
                          </span>
                        )}
                        {f.status === "resolved" && (
                          <span className="inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">
                            RESOLVED
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-[#1A1A1F] mt-1 font-medium leading-snug">{f.message}</p>
                      <p className="text-[11px] text-[#5A5C60] mt-1">
                        First seen {fmtTime(f.firstSeenAt)} · Last seen {fmtTime(f.lastSeenAt)}
                        {f.resolvedAt && ` · Resolved ${fmtTime(f.resolvedAt)}`}
                      </p>
                      {f.details && Object.keys(f.details).length > 0 && (
                        <details className="mt-2">
                          <summary className="text-[11px] text-[#5A5C60] cursor-pointer hover:text-[#1A1A1F]">Show details</summary>
                          <pre className="mt-1.5 text-[10px] font-mono text-[#1A1A1F] bg-[#F4F4F6] p-2 rounded overflow-x-auto">
                            {JSON.stringify(f.details, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                    {f.status === "open" && (
                      <button
                        onClick={() => resolve(f.id)}
                        className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white border border-[#E2E2E6] text-[11px] font-medium text-[#1A1A1F] hover:bg-[#F4F4F6]"
                      >
                        Mark resolved
                      </button>
                    )}
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
