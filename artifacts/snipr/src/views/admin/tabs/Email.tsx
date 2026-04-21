"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Mail, Send, CheckCircle2, XCircle, AlertCircle, RefreshCw, Search, Download,
  Loader2, Clock, Users, MailCheck, MailX, ChevronLeft, ChevronRight, X,
  BarChart3, Activity, Filter as FilterIcon, Zap, ExternalLink,
} from "lucide-react";
import { apiFetch, fmtDate, fmtNum } from "../utils";
import { useToast } from "../Toast";

/* ── Types ───────────────────────────────────────────── */
interface EmailStats {
  totalEmails: number;
  todayEmails: number;
  last7dEmails: number;
  sentEmails: number;
  failedEmails: number;
  skippedEmails: number;
  deliveryRate: number;
  totalUsers: number;
  verifiedUsers: number;
  verificationRate: number;
  byType: Array<{ type: string; count: number }>;
  byStatus: Array<{ status: string; count: number }>;
  timeline: Array<{ day: string; total: number; sent: number; failed: number }>;
}

interface EmailLog {
  id: string;
  to: string;
  subject: string;
  type: string;
  status: string;
  resendId: string | null;
  error: string | null;
  createdAt: string;
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
}

interface EmailLogDetail extends EmailLog {
  userPlan: string | null;
}

/* ── Styling maps ────────────────────────────────────── */
const TYPE_META: Record<string, { label: string; bg: string; text: string }> = {
  verification:                { label: "Verification",      bg: "bg-blue-50",    text: "text-blue-700" },
  welcome:                     { label: "Welcome",           bg: "bg-emerald-50", text: "text-emerald-700" },
  password_reset:              { label: "Password Reset",    bg: "bg-violet-50",  text: "text-violet-700" },
  team_invite:                 { label: "Team Invite",       bg: "bg-indigo-50",  text: "text-indigo-700" },
  admin_notification:          { label: "Admin Notif",       bg: "bg-rose-50",    text: "text-rose-700" },
  admin_force_verify:          { label: "Admin Verify",      bg: "bg-purple-50",  text: "text-purple-700" },
  upgrade_monthly_cap:         { label: "Upgrade (cap)",     bg: "bg-amber-50",   text: "text-amber-700" },
  upgrade_monthly_cap_reminder:{ label: "Upgrade (reminder)",bg: "bg-amber-100",  text: "text-amber-800" },
  upgrade_monthly_cap_apology: { label: "Upgrade (apology)", bg: "bg-slate-100",  text: "text-slate-700" },
  abuse_warning_1:             { label: "Warning #1",        bg: "bg-orange-50",  text: "text-orange-700" },
  abuse_warning_2:             { label: "Warning #2",        bg: "bg-red-50",     text: "text-red-700" },
  support_new_ticket:          { label: "Support: New",      bg: "bg-teal-50",    text: "text-teal-700" },
  support_user_reply:          { label: "Support: User",     bg: "bg-teal-50",    text: "text-teal-700" },
  support_admin_reply:         { label: "Support: Admin",    bg: "bg-teal-50",    text: "text-teal-700" },
};

const STATUS_META: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  sent:      { label: "Sent",      bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" },
  delivered: { label: "Delivered", bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" },
  failed:    { label: "Failed",    bg: "bg-red-50",     text: "text-red-700",     dot: "bg-red-500" },
  skipped:   { label: "Skipped",   bg: "bg-gray-100",   text: "text-gray-600",    dot: "bg-gray-400" },
  bounced:   { label: "Bounced",   bg: "bg-amber-50",   text: "text-amber-700",   dot: "bg-amber-500" },
};

function typeMeta(type: string) {
  return TYPE_META[type] ?? { label: type, bg: "bg-gray-100", text: "text-gray-700" };
}
function statusMeta(status: string) {
  return STATUS_META[status] ?? { label: status, bg: "bg-gray-100", text: "text-gray-700", dot: "bg-gray-400" };
}

/* ══════════════════════════════════════════════════════════════════════
 * Email Tab
 * ═════════════════════════════════════════════════════════════════════ */
export default function EmailTab() {
  const { toast } = useToast();
  const [stats, setStats] = useState<EmailStats | null>(null);
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  // Filters
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);
  const limit = 50;

  // Detail drawer
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const loadStats = useCallback(() => {
    apiFetch("/admin/email-stats").then(setStats).catch(() => toast("Failed to load email stats", "error"));
  }, [toast]);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (typeFilter !== "all") params.set("type", typeFilter);
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (search.trim()) params.set("search", search.trim());
      if (fromDate) params.set("from", fromDate);
      if (toDate) params.set("to", toDate);
      const data = await apiFetch(`/admin/email-logs?${params}`);
      setLogs(data.logs);
      setTotal(data.total);
    } catch {
      toast("Failed to load email logs", "error");
    } finally { setLoading(false); }
  }, [page, typeFilter, statusFilter, search, fromDate, toDate, toast]);

  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => {
    const t = setTimeout(() => loadLogs(), search ? 300 : 0);
    return () => clearTimeout(t);
  }, [loadLogs, search]);

  const resetFilters = () => {
    setTypeFilter("all"); setStatusFilter("all"); setSearch("");
    setFromDate(""); setToDate(""); setPage(1);
  };

  const exportCsv = () => {
    const params = new URLSearchParams();
    if (typeFilter !== "all") params.set("type", typeFilter);
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (search.trim()) params.set("search", search.trim());
    if (fromDate) params.set("from", fromDate);
    if (toDate) params.set("to", toDate);
    window.open(`/api/admin/email-logs/export?${params}`, "_blank");
  };

  const pages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="space-y-5">

      {/* ── KPI Cards ───────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Total emails" value={stats ? fmtNum(Number(stats.totalEmails)) : "—"} icon={<Mail className="w-4 h-4" />} accent="#728DA7" bg="#EEF3F7" sub={stats ? `${fmtNum(Number(stats.todayEmails))} in last 24h` : ""} />
        <Kpi label="Delivery rate" value={stats ? `${stats.deliveryRate}%` : "—"} icon={<CheckCircle2 className="w-4 h-4" />} accent="#10B981" bg="#ECFDF5" sub={stats ? `${fmtNum(Number(stats.sentEmails))} sent / ${fmtNum(Number(stats.failedEmails))} failed` : ""} />
        <Kpi label="Last 7 days" value={stats ? fmtNum(Number(stats.last7dEmails)) : "—"} icon={<Activity className="w-4 h-4" />} accent="#8B5CF6" bg="#F5F3FF" sub="emails sent" />
        <Kpi label="Verified users" value={stats ? `${stats.verificationRate}%` : "—"} icon={<MailCheck className="w-4 h-4" />} accent="#0EA5E9" bg="#F0F9FF" sub={stats ? `${fmtNum(Number(stats.verifiedUsers))} of ${fmtNum(Number(stats.totalUsers))}` : ""} />
      </div>

      {/* ── Charts: Timeline + By Type ───────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5 lg:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-4 h-4 text-[#728DA7]" />
            <h3 className="text-sm font-semibold text-[#0A0A0A]">Emails — last 7 days</h3>
          </div>
          <TimelineChart timeline={stats?.timeline ?? []} />
        </div>
        <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-4 h-4 text-[#728DA7]" />
            <h3 className="text-sm font-semibold text-[#0A0A0A]">By type (30d)</h3>
          </div>
          <TypeBreakdown byType={stats?.byType ?? []} />
        </div>
      </div>

      {/* ── Filters toolbar ──────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-[#E2E8F0] p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8888A0]" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search recipient or subject..."
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-[#E2E8F0] bg-white text-[13px] text-[#0A0A0A] placeholder:text-[#8888A0] outline-none focus:border-[#728DA7] transition-colors"
            />
          </div>
          <Select value={typeFilter} onChange={(v) => { setTypeFilter(v); setPage(1); }} options={[
            { value: "all", label: "All types" },
            ...Object.entries(TYPE_META).map(([k, v]) => ({ value: k, label: v.label })),
          ]} />
          <Select value={statusFilter} onChange={(v) => { setStatusFilter(v); setPage(1); }} options={[
            { value: "all", label: "All statuses" },
            { value: "sent", label: "Sent" },
            { value: "delivered", label: "Delivered" },
            { value: "failed", label: "Failed" },
            { value: "skipped", label: "Skipped" },
            { value: "bounced", label: "Bounced" },
          ]} />
          <input
            type="date"
            value={fromDate}
            onChange={(e) => { setFromDate(e.target.value); setPage(1); }}
            className="px-3 py-2 rounded-lg border border-[#E2E8F0] bg-white text-[12px] text-[#0A0A0A] outline-none focus:border-[#728DA7]"
            title="From date"
          />
          <span className="text-[11px] text-[#8888A0]">to</span>
          <input
            type="date"
            value={toDate}
            onChange={(e) => { setToDate(e.target.value); setPage(1); }}
            className="px-3 py-2 rounded-lg border border-[#E2E8F0] bg-white text-[12px] text-[#0A0A0A] outline-none focus:border-[#728DA7]"
            title="To date"
          />
          {(typeFilter !== "all" || statusFilter !== "all" || search || fromDate || toDate) && (
            <button
              onClick={resetFilters}
              className="inline-flex items-center gap-1 px-2.5 py-2 text-[12px] text-[#8888A0] hover:text-[#0A0A0A]"
              title="Clear filters"
            >
              <X className="w-3.5 h-3.5" /> Clear
            </button>
          )}
          <div className="flex-1" />
          <button
            onClick={loadLogs}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#E2E8F0] text-[12px] text-[#3A3A3E] hover:bg-[#F8F8FC] transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            onClick={exportCsv}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#0A0A0A] text-white text-[12px] font-semibold hover:bg-[#1A1A1A] transition-colors"
          >
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
        </div>
      </div>

      {/* ── Log table ─────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[960px]">
            <thead>
              <tr className="bg-[#F8F8FC] border-b border-[#E2E8F0]">
                {["Time", "Recipient", "Subject", "Type", "Status", ""].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-[11px] font-semibold text-[#8888A0] uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F4F4F6]">
              {loading && [...Array(6)].map((_, i) => (
                <tr key={i}>{[...Array(6)].map((_, j) => (
                  <td key={j} className="px-4 py-3"><div className="h-3 bg-[#F0F4F8] rounded animate-pulse" /></td>
                ))}</tr>
              ))}
              {!loading && logs.length === 0 && (
                <tr><td colSpan={6} className="py-16 text-center">
                  <Mail className="w-8 h-8 mx-auto text-[#C8C8D8] mb-3" />
                  <p className="text-sm text-[#8888A0]">No emails match your filters</p>
                </td></tr>
              )}
              {!loading && logs.map((l) => {
                const tm = typeMeta(l.type);
                const sm = statusMeta(l.status);
                return (
                  <tr key={l.id} className="hover:bg-[#F8F8FC] transition-colors cursor-pointer" onClick={() => setSelectedId(l.id)}>
                    <td className="px-4 py-3 text-[11px] text-[#8888A0] whitespace-nowrap">{fmtDate(l.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="text-[12px] font-medium text-[#0A0A0A]">{l.userName || "—"}</span>
                        <span className="text-[11px] text-[#8888A0]">{l.to}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[12px] text-[#3A3A3E] max-w-[320px] truncate">{l.subject}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${tm.bg} ${tm.text}`}>{tm.label}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${sm.bg} ${sm.text}`}>
                        <span className={`w-1 h-1 rounded-full ${sm.dot}`} />{sm.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button className="text-[11px] text-[#728DA7] hover:text-[#4A7A94] font-medium">
                        Details →
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && total > limit && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-[#E2E8F0] bg-[#F8F8FC]">
            <p className="text-[11px] text-[#8888A0]">
              Showing <strong className="text-[#0A0A0A]">{((page - 1) * limit) + 1}</strong>–<strong className="text-[#0A0A0A]">{Math.min(page * limit, total)}</strong> of <strong className="text-[#0A0A0A]">{fmtNum(total)}</strong>
            </p>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] text-[#3A3A3E] hover:bg-[#E8EEF4] disabled:opacity-40">
                <ChevronLeft className="w-3 h-3" /> Prev
              </button>
              <span className="text-[11px] text-[#8888A0] mx-2">Page {page} of {pages}</span>
              <button onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page >= pages}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] text-[#3A3A3E] hover:bg-[#E8EEF4] disabled:opacity-40">
                Next <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}
      </div>

      {selectedId && (
        <EmailDetailDrawer
          logId={selectedId}
          onClose={() => setSelectedId(null)}
          onResent={() => { loadLogs(); loadStats(); }}
        />
      )}
    </div>
  );
}

/* ── Sub-components ───────────────────────────────────── */

function Kpi({ label, value, sub, icon, accent, bg }: { label: string; value: string; sub?: string; icon: React.ReactNode; accent: string; bg: string }) {
  return (
    <div className="bg-white rounded-2xl border border-[#E2E8F0] p-4">
      <div className="flex items-center gap-2 mb-2.5">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: bg, color: accent }}>
          {icon}
        </div>
        <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#8888A0]">{label}</span>
      </div>
      <div className="text-[22px] font-bold text-[#0A0A0A] tabular-nums">{value}</div>
      {sub && <p className="text-[11px] text-[#8888A0] mt-0.5">{sub}</p>}
    </div>
  );
}

function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}
      className="px-3 py-2 rounded-lg border border-[#E2E8F0] bg-white text-[12px] text-[#0A0A0A] outline-none focus:border-[#728DA7] cursor-pointer">
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function TimelineChart({ timeline }: { timeline: EmailStats["timeline"] }) {
  const days = useMemo(() => {
    const out: { day: string; label: string; total: number; sent: number; failed: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setUTCHours(0, 0, 0, 0);
      d.setUTCDate(d.getUTCDate() - i);
      const iso = d.toISOString().slice(0, 10);
      const match = timeline.find((t) => new Date(t.day).toISOString().slice(0, 10) === iso);
      out.push({
        day: iso,
        label: d.toLocaleDateString("en-US", { weekday: "short", day: "numeric" }),
        total: Number(match?.total ?? 0),
        sent: Number(match?.sent ?? 0),
        failed: Number(match?.failed ?? 0),
      });
    }
    return out;
  }, [timeline]);
  const max = Math.max(1, ...days.map((d) => d.total));

  return (
    <div className="space-y-2">
      <div className="flex items-end gap-2 h-[140px]">
        {days.map((d) => {
          const totalHeight = (d.total / max) * 100;
          const sentPct = d.total > 0 ? (d.sent / d.total) * totalHeight : 0;
          const failedPct = d.total > 0 ? (d.failed / d.total) * totalHeight : 0;
          return (
            <div key={d.day} className="flex-1 flex flex-col items-center gap-1 group relative">
              <div className="w-full flex-1 flex flex-col-reverse rounded-t overflow-hidden bg-[#F4F4F6]">
                {sentPct > 0 && <div style={{ height: `${sentPct}%`, background: "linear-gradient(to top, #10B981, #34D399)" }} />}
                {failedPct > 0 && <div style={{ height: `${failedPct}%`, background: "#EF4444" }} />}
              </div>
              <span className="text-[9px] text-[#8888A0] tabular-nums">{d.label}</span>
              <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-[#0A0A0A] text-white text-[10px] rounded-md px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                {d.total} total · {d.sent} sent · {d.failed} failed
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-3 text-[10px] text-[#8888A0] pt-1">
        <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-emerald-500" /> Sent</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-red-500" /> Failed</span>
      </div>
    </div>
  );
}

function TypeBreakdown({ byType }: { byType: EmailStats["byType"] }) {
  const total = byType.reduce((s, t) => s + Number(t.count), 0);
  if (total === 0) return <p className="text-[12px] text-[#8888A0] py-6 text-center">No emails in the last 30 days.</p>;
  return (
    <div className="space-y-2">
      {byType.slice(0, 8).map((t) => {
        const tm = typeMeta(t.type);
        const pct = Math.round((Number(t.count) / total) * 100);
        return (
          <div key={t.type}>
            <div className="flex items-center justify-between mb-1 gap-2">
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${tm.bg} ${tm.text}`}>{tm.label}</span>
              <span className="text-[11px] font-semibold text-[#0A0A0A] tabular-nums">{fmtNum(Number(t.count))} <span className="text-[#8888A0] font-normal">({pct}%)</span></span>
            </div>
            <div className="h-1.5 bg-[#F0F4F8] rounded-full overflow-hidden">
              <div className="h-full rounded-full bg-[#728DA7]" style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Detail drawer ───────────────────────────────────── */
function EmailDetailDrawer({ logId, onClose, onResent }: { logId: string; onClose: () => void; onResent: () => void }) {
  const { toast } = useToast();
  const [log, setLog] = useState<EmailLogDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    apiFetch(`/admin/email-logs/${logId}`)
      .then(setLog)
      .catch(() => toast("Failed to load email details", "error"))
      .finally(() => setLoading(false));
  }, [logId, toast]);

  const resend = async () => {
    if (!log) return;
    setResending(true);
    try {
      await apiFetch(`/admin/email-logs/${log.id}/resend`, { method: "POST" });
      toast("Verification email resent", "success");
      onResent();
      onClose();
    } catch (e: any) {
      toast(e?.error || e?.detail || "Resend failed", "error");
    } finally { setResending(false); }
  };

  const tm = log && typeMeta(log.type);
  const sm = log && statusMeta(log.status);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div className="w-full max-w-xl h-full bg-white border-l border-[#E2E8F0] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-[#E2E8F0] flex items-start gap-3">
          <button onClick={onClose} className="p-1.5 text-[#8888A0] hover:text-[#0A0A0A]"><ChevronLeft className="w-5 h-5" /></button>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#8888A0]">Email details</p>
            {log && <h2 className="text-[14px] font-semibold text-[#0A0A0A] truncate">{log.subject}</h2>}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-16"><Loader2 className="w-5 h-5 text-[#728DA7] animate-spin" /></div>
          ) : !log ? (
            <p className="text-sm text-[#8888A0]">Email log not found.</p>
          ) : (
            <>
              <div className="flex items-center gap-2 flex-wrap">
                {tm && <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${tm.bg} ${tm.text}`}>{tm.label}</span>}
                {sm && (
                  <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${sm.bg} ${sm.text}`}>
                    <span className={`w-1 h-1 rounded-full ${sm.dot}`} />{sm.label}
                  </span>
                )}
              </div>

              <Field label="To">
                <p className="text-[13px] text-[#0A0A0A] font-mono">{log.to}</p>
                {log.userEmail && log.userEmail !== log.to && <p className="text-[11px] text-[#8888A0] mt-0.5">Account: {log.userEmail}</p>}
              </Field>

              {log.userId && (
                <Field label="User">
                  <div className="flex items-center gap-2">
                    <div className="flex flex-col">
                      <span className="text-[13px] font-medium text-[#0A0A0A]">{log.userName ?? "Unknown"}</span>
                      <span className="text-[11px] text-[#8888A0]">{log.userEmail}</span>
                    </div>
                    {log.userPlan && <span className="ml-auto text-[10px] font-bold text-[#728DA7] bg-[#EEF3F7] px-2 py-0.5 rounded-full capitalize">{log.userPlan}</span>}
                  </div>
                </Field>
              )}

              <Field label="Subject"><p className="text-[13px] text-[#0A0A0A]">{log.subject}</p></Field>
              <Field label="Type"><p className="text-[13px] text-[#3A3A3E] font-mono">{log.type}</p></Field>
              <Field label="Sent at"><p className="text-[13px] text-[#3A3A3E]">{new Date(log.createdAt).toLocaleString()}</p></Field>

              {log.resendId && (
                <Field label="Resend ID">
                  <div className="flex items-center gap-2">
                    <code className="text-[12px] text-[#3A3A3E] bg-[#F0F4F8] px-2 py-1 rounded font-mono">{log.resendId}</code>
                    <a href={`https://resend.com/emails/${log.resendId}`} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] text-[#728DA7] hover:text-[#4A7A94]">
                      View on Resend <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </Field>
              )}

              {log.error && (
                <Field label="Error">
                  <div className="rounded-lg bg-red-50 border border-red-200 p-3 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                    <p className="text-[12px] text-red-700 leading-relaxed">{log.error}</p>
                  </div>
                </Field>
              )}

              {log.type === "verification" && log.userId && (
                <div className="pt-2 border-t border-[#E2E8F0]">
                  <button
                    onClick={resend}
                    disabled={resending}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0A0A0A] text-white text-[13px] font-semibold hover:bg-[#1A1A1A] disabled:opacity-50 transition-colors"
                  >
                    {resending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    Resend verification email
                  </button>
                  <p className="text-[11px] text-[#8888A0] mt-2">Sends a fresh verification link (new token) to the user.</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#8888A0] mb-1">{label}</p>
      {children}
    </div>
  );
}
