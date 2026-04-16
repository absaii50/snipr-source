"use client";
import { useEffect, useState, useCallback } from "react";
import { Search, RefreshCw, Shield, ChevronDown, Clock, User, Link2, Globe, Settings, Mail, Zap, Calendar } from "lucide-react";
import { apiFetch, fmtTime } from "../utils";

interface AuditEntry {
  id: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  details: Record<string, unknown> | null;
  adminIp: string | null;
  createdAt: string;
}

const ACTION_ICONS: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  suspend_user: { icon: User, color: "text-amber-600", bg: "bg-amber-50" },
  activate_user: { icon: User, color: "text-green-600", bg: "bg-green-50" },
  delete_user: { icon: User, color: "text-red-600", bg: "bg-red-50" },
  bulk_suspend: { icon: User, color: "text-amber-600", bg: "bg-amber-50" },
  bulk_activate: { icon: User, color: "text-green-600", bg: "bg-green-50" },
  bulk_delete: { icon: User, color: "text-red-600", bg: "bg-red-50" },
  bulk_plan_change: { icon: Zap, color: "text-purple-600", bg: "bg-purple-50" },
  impersonate_user: { icon: Shield, color: "text-blue-600", bg: "bg-blue-50" },
  stop_impersonate: { icon: Shield, color: "text-gray-600", bg: "bg-gray-100" },
  link_health_check: { icon: Link2, color: "text-teal-600", bg: "bg-teal-50" },
  update_announcement: { icon: Globe, color: "text-indigo-600", bg: "bg-indigo-50" },
  mass_email: { icon: Mail, color: "text-pink-600", bg: "bg-pink-50" },
  edit_user: { icon: User, color: "text-cyan-600", bg: "bg-cyan-50" },
  change_plan: { icon: Zap, color: "text-purple-600", bg: "bg-purple-50" },
};

const ACTION_LABELS: Record<string, string> = {
  suspend_user: "Suspended User",
  activate_user: "Activated User",
  delete_user: "Deleted User",
  bulk_suspend: "Bulk Suspended",
  bulk_activate: "Bulk Activated",
  bulk_delete: "Bulk Deleted",
  bulk_plan_change: "Bulk Plan Change",
  impersonate_user: "Impersonated User",
  stop_impersonate: "Stopped Impersonation",
  link_health_check: "Link Health Check",
  update_announcement: "Updated Announcement",
  mass_email: "Sent Mass Email",
  edit_user: "Edited User",
  change_plan: "Changed Plan",
};

const ACTION_FILTER_OPTIONS = [
  "all", "suspend_user", "activate_user", "delete_user",
  "bulk_suspend", "bulk_activate", "bulk_delete", "bulk_plan_change",
  "impersonate_user", "link_health_check", "update_announcement", "mass_email",
  "edit_user", "change_plan",
];

export default function AuditLogTab() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [filterOpen, setFilterOpen] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [total, setTotal] = useState(0);

  const doLoad = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (actionFilter !== "all") params.set("action", actionFilter);
      if (search) params.set("search", search);
      if (dateFrom) params.set("from", dateFrom);
      if (dateTo) params.set("to", dateTo);
      const data = await apiFetch(`/admin/audit-log?${params}`);
      setLogs(data.logs);
      setTotal(data.total);
    } finally {
      setLoading(false);
    }
  }, [actionFilter, search, dateFrom, dateTo]);

  useEffect(() => {
    const t = setTimeout(doLoad, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [doLoad, search]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8888A0]" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search audit logs…"
            className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-[#E2E8F0] bg-white text-sm text-[#0A0A0A] outline-none focus:border-[#728DA7] focus:ring-2 focus:ring-[#728DA7]/15 transition-all" />
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <button onClick={() => setFilterOpen(v => !v)}
              className="flex items-center gap-1.5 px-3 py-2 bg-white border border-[#E2E8F0] rounded-xl text-xs text-[#3A3A3E] hover:bg-[#F4F4F6] transition-all">
              <Shield className="w-3 h-3 text-[#8888A0]" />
              {actionFilter === "all" ? "All Actions" : (ACTION_LABELS[actionFilter] || actionFilter)}
              <ChevronDown className="w-3 h-3 text-[#8888A0]" />
            </button>
            {filterOpen && (
              <div className="absolute right-0 top-full mt-1 w-52 bg-white border border-[#E2E8F0] rounded-xl shadow-xl z-20 overflow-hidden max-h-64 overflow-y-auto">
                {ACTION_FILTER_OPTIONS.map((a) => (
                  <button key={a} onClick={() => { setActionFilter(a); setFilterOpen(false); }}
                    className={`w-full text-left px-3 py-2.5 text-xs transition-colors ${actionFilter === a ? "bg-[#EEF3F7] text-[#4A7A94] font-medium" : "text-[#3A3A3E] hover:bg-[#F8F8FC]"}`}>
                    {a === "all" ? "All Actions" : (ACTION_LABELS[a] || a)}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button onClick={doLoad}
            className="p-2 rounded-xl border border-[#E2E8F0] bg-white hover:bg-[#F4F4F6] transition-all">
            <RefreshCw className={`w-3.5 h-3.5 text-[#8888A0] ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 text-xs text-[#8888A0]">
          <Calendar className="w-3 h-3" />
          <span>From</span>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
            className="px-2 py-1.5 rounded-lg border border-[#E2E8F0] bg-white text-xs text-[#3A3A3E] outline-none focus:border-[#728DA7]" />
          <span>To</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
            className="px-2 py-1.5 rounded-lg border border-[#E2E8F0] bg-white text-xs text-[#3A3A3E] outline-none focus:border-[#728DA7]" />
          {(dateFrom || dateTo) && (
            <button onClick={() => { setDateFrom(""); setDateTo(""); }}
              className="ml-1 text-[#728DA7] hover:text-[#4A7A94] text-xs underline">Clear</button>
          )}
        </div>
        <span className="text-xs text-[#8888A0]">{total} total audit events</span>
      </div>

      <div className="bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr className="bg-[#F8F8FC] border-b border-[#E2E8F0]">
                {["Action", "Target", "Details", "IP", "Time"].map((h) => (
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
              {!loading && logs.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-16 text-center">
                    <Shield className="w-8 h-8 text-[#C8C8D8] mx-auto mb-3" />
                    <p className="text-[#8888A0] text-sm">No audit events found</p>
                  </td>
                </tr>
              )}
              {!loading && logs.map((log) => {
                const cfg = ACTION_ICONS[log.action] || { icon: Settings, color: "text-gray-600", bg: "bg-gray-100" };
                const Icon = cfg.icon;
                return (
                  <tr key={log.id} className="hover:bg-[#F8F8FC] transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-7 h-7 rounded-lg ${cfg.bg} flex items-center justify-center`}>
                          <Icon className={`w-3.5 h-3.5 ${cfg.color}`} />
                        </div>
                        <span className="text-xs font-medium text-[#0A0A0A]">
                          {ACTION_LABELS[log.action] || log.action}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="text-xs text-[#3A3A3E]">
                        {log.targetType && <span className="text-[#8888A0]">{log.targetType}: </span>}
                        <span className="font-mono">{log.targetId ? log.targetId.slice(0, 12) + "…" : "—"}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 max-w-[200px]">
                      <span className="text-xs text-[#8888A0] truncate block">
                        {log.details ? JSON.stringify(log.details).slice(0, 60) : "—"}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-[#8888A0] font-mono">{log.adminIp || "—"}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1 text-xs text-[#8888A0]">
                        <Clock className="w-3 h-3" />
                        {fmtTime(log.createdAt)}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
