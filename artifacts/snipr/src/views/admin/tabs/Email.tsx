"use client";
import { useEffect, useState } from "react";
import {
  Mail, Send, CheckCircle2, XCircle, AlertCircle, RefreshCw, Search,
  ShieldCheck, Loader2, Clock, Users, MailCheck, MailX,
} from "lucide-react";
import { apiFetch, fmtDate, fmtNum } from "../utils";

interface EmailStats {
  totalEmails: number;
  todayEmails: number;
  failedEmails: number;
  totalUsers: number;
  verifiedUsers: number;
  verificationRate: number;
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
}

interface UnverifiedUser {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

const TYPE_BADGES: Record<string, { bg: string; text: string }> = {
  verification: { bg: "bg-blue-50 text-blue-700", text: "Verification" },
  welcome: { bg: "bg-green-50 text-green-700", text: "Welcome" },
  admin_force_verify: { bg: "bg-purple-50 text-purple-700", text: "Admin Verify" },
};

const STATUS_BADGES: Record<string, { bg: string; text: string }> = {
  sent: { bg: "bg-green-50 text-green-700", text: "Sent" },
  delivered: { bg: "bg-green-50 text-green-700", text: "Delivered" },
  failed: { bg: "bg-red-50 text-red-700", text: "Failed" },
  skipped: { bg: "bg-gray-100 text-gray-600", text: "Skipped" },
  bounced: { bg: "bg-amber-50 text-amber-700", text: "Bounced" },
};

export default function EmailTab() {
  const [stats, setStats] = useState<EmailStats | null>(null);
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [unverified, setUnverified] = useState<UnverifiedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [tab, setTab] = useState<"logs" | "unverified">("logs");
  const [busy, setBusy] = useState<string | null>(null);

  async function loadAll() {
    setLoading(true);
    try {
      const [s, l, u] = await Promise.all([
        apiFetch("/admin/email-stats"),
        apiFetch("/admin/email-logs?limit=50"),
        apiFetch("/admin/users?limit=200"),
      ]);
      setStats(s);
      setLogs(l.logs || []);
      setUnverified((u || []).filter((u: any) => !u.emailVerified));
    } catch (err) {
      console.error("Failed to load email data", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadAll(); }, []);

  async function forceVerify(userId: string) {
    if (!confirm("Force verify this user's email?")) return;
    setBusy(userId);
    try {
      await apiFetch(`/admin/force-verify/${userId}`, { method: "POST" });
      loadAll();
    } catch { alert("Failed to force verify"); }
    finally { setBusy(null); }
  }

  async function resendVerification(userId: string) {
    setBusy(userId);
    try {
      await apiFetch(`/admin/resend-verification/${userId}`, { method: "POST" });
      alert("Verification email sent!");
      loadAll();
    } catch { alert("Failed to send email"); }
    finally { setBusy(null); }
  }

  const filteredLogs = logs.filter((l) => {
    const matchSearch = !search || l.to.toLowerCase().includes(search.toLowerCase()) || l.subject.toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === "all" || l.type === typeFilter;
    return matchSearch && matchType;
  });

  return (
    <div className="space-y-6">
      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Total Emails", value: fmtNum(stats.totalEmails), icon: Mail, color: "text-blue-600 bg-blue-50" },
            { label: "Sent Today", value: fmtNum(stats.todayEmails), icon: Send, color: "text-green-600 bg-green-50" },
            { label: "Verification Rate", value: `${stats.verificationRate}%`, icon: MailCheck, color: "text-purple-600 bg-purple-50" },
            { label: "Failed", value: fmtNum(stats.failedEmails), icon: MailX, color: "text-red-600 bg-red-50" },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-2xl border border-[#E4E4EC] p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-[#8888A0] uppercase tracking-wide">{s.label}</span>
                <div className={`p-2 rounded-xl ${s.color}`}><s.icon className="w-4 h-4" /></div>
              </div>
              <p className="text-2xl font-bold text-[#0A0A0A]">{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Sub-tabs */}
      <div className="flex items-center gap-2">
        {(["logs", "unverified"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              tab === t ? "bg-[#0A0A0A] text-white" : "bg-white border border-[#E4E4EC] text-[#3A3A3E] hover:bg-[#F4F4F6]"
            }`}
          >
            {t === "logs" ? "Email Logs" : `Unverified Users (${unverified.length})`}
          </button>
        ))}
        <div className="flex-1" />
        <button onClick={loadAll} className="p-2 rounded-xl border border-[#E4E4EC] bg-white hover:bg-[#F4F4F6] transition-all" title="Refresh">
          <RefreshCw className="w-3.5 h-3.5 text-[#8888A0]" />
        </button>
      </div>

      {tab === "logs" && (
        <>
          {/* Search + Filter */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8888A0]" />
              <input
                value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by email or subject..."
                className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-[#E4E4EC] bg-white text-sm outline-none focus:border-[#728DA7] focus:ring-2 focus:ring-[#728DA7]/15 transition-all"
              />
            </div>
            <select
              value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border border-[#E4E4EC] bg-white text-sm outline-none"
            >
              <option value="all">All Types</option>
              <option value="verification">Verification</option>
              <option value="welcome">Welcome</option>
              <option value="admin_force_verify">Admin Verify</option>
            </select>
          </div>

          {/* Logs table */}
          <div className="bg-white rounded-2xl border border-[#E4E4EC] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[700px]">
                <thead>
                  <tr className="bg-[#F8F8FC] border-b border-[#E4E4EC]">
                    {["Recipient", "Subject", "Type", "Status", "Date"].map((h) => (
                      <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-[#8888A0] uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F4F4F6]">
                  {loading && [...Array(5)].map((_, i) => (
                    <tr key={i}>{[...Array(5)].map((_, j) => (
                      <td key={j} className="px-5 py-4"><div className="h-4 bg-[#F4F4F6] rounded animate-pulse" /></td>
                    ))}</tr>
                  ))}
                  {!loading && filteredLogs.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-5 py-16 text-center">
                        <Mail className="w-8 h-8 text-[#C8C8D8] mx-auto mb-3" />
                        <p className="text-[#8888A0] text-sm">No emails found</p>
                      </td>
                    </tr>
                  )}
                  {!loading && filteredLogs.map((l) => {
                    const typeBadge = TYPE_BADGES[l.type] || { bg: "bg-gray-100 text-gray-600", text: l.type };
                    const statusBadge = STATUS_BADGES[l.status] || { bg: "bg-gray-100 text-gray-600", text: l.status };
                    return (
                      <tr key={l.id} className="hover:bg-[#F8F8FC] transition-colors">
                        <td className="px-5 py-3.5 font-medium text-[#0A0A0A]">{l.to}</td>
                        <td className="px-5 py-3.5 text-[#3A3A3E] max-w-[200px] truncate">{l.subject}</td>
                        <td className="px-5 py-3.5">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${typeBadge.bg}`}>{typeBadge.text}</span>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge.bg}`}>
                            {l.status === "sent" ? <CheckCircle2 className="w-3 h-3" /> : l.status === "failed" ? <XCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                            {statusBadge.text}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-xs text-[#8888A0]">{fmtDate(l.createdAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {tab === "unverified" && (
        <div className="bg-white rounded-2xl border border-[#E4E4EC] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="bg-[#F8F8FC] border-b border-[#E4E4EC]">
                  {["User", "Email", "Joined", "Actions"].map((h) => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-[#8888A0] uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F4F4F6]">
                {loading && [...Array(3)].map((_, i) => (
                  <tr key={i}>{[...Array(4)].map((_, j) => (
                    <td key={j} className="px-5 py-4"><div className="h-4 bg-[#F4F4F6] rounded animate-pulse" /></td>
                  ))}</tr>
                ))}
                {!loading && unverified.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-5 py-16 text-center">
                      <CheckCircle2 className="w-8 h-8 text-green-400 mx-auto mb-3" />
                      <p className="text-[#8888A0] text-sm">All users have verified their email!</p>
                    </td>
                  </tr>
                )}
                {!loading && unverified.map((u) => (
                  <tr key={u.id} className="hover:bg-[#F8F8FC] transition-colors">
                    <td className="px-5 py-3.5 font-medium text-[#0A0A0A]">{u.name}</td>
                    <td className="px-5 py-3.5 text-[#3A3A3E]">{u.email}</td>
                    <td className="px-5 py-3.5 text-xs text-[#8888A0]">{fmtDate(u.createdAt)}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex gap-2">
                        <button
                          onClick={() => forceVerify(u.id)}
                          disabled={busy === u.id}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-green-50 text-green-700 text-xs font-medium hover:bg-green-100 disabled:opacity-50 transition-all"
                        >
                          {busy === u.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <ShieldCheck className="w-3 h-3" />}
                          Force Verify
                        </button>
                        <button
                          onClick={() => resendVerification(u.id)}
                          disabled={busy === u.id}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 text-xs font-medium hover:bg-blue-100 disabled:opacity-50 transition-all"
                        >
                          {busy === u.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                          Resend
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
