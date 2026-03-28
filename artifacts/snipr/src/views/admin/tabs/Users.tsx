"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import {
  Search, UserX, UserCheck, Trash2, RefreshCw,
  ArrowUpDown, BarChart3, Link2, TrendingUp,
  ChevronDown, MousePointerClick, Eye, Crown,
} from "lucide-react";
import { apiFetch, fmtDate, fmtNum } from "../utils";
import UserProfile from "./UserProfile";

interface PerformanceUser {
  id: string;
  name: string;
  email: string;
  plan: string;
  suspended_at: string | null;
  created_at: string;
  workspace_name: string | null;
  workspace_slug: string | null;
  total_links: number;
  total_clicks: number;
  avg_clicks: number;
  active_links: number;
  disabled_links: number;
  last_click_at: string | null;
  clicks_7d: number;
}

type SortKey = "clicks" | "links" | "avg" | "name";
type PlanFilter = "all" | "free" | "pro" | "business";
type StatusFilter = "all" | "active" | "suspended";

function PlanBadge({ plan }: { plan: string }) {
  const cfg = plan === "business"
    ? "bg-purple-50 text-purple-700 border-purple-200"
    : plan === "pro"
    ? "bg-blue-50 text-blue-700 border-blue-200"
    : "bg-gray-100 text-gray-500 border-gray-200";
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold border ${cfg} capitalize`}>
      {plan}
    </span>
  );
}

function StatusBadge({ suspended }: { suspended: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
      suspended ? "bg-red-50 text-red-600" : "bg-green-50 text-green-700"
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${suspended ? "bg-red-400" : "bg-green-500"}`} />
      {suspended ? "Suspended" : "Active"}
    </span>
  );
}

function MiniBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-semibold text-[#0A0A0A] tabular-nums w-12 text-right">{fmtNum(value)}</span>
      <div className="w-20 h-1.5 bg-[#F0F0F5] rounded-full overflow-hidden">
        <div className="h-full bg-[#728DA7] rounded-full" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

const PLAN_OPTIONS = ["free", "pro", "business"] as const;

export default function UsersTab() {
  const [users, setUsers] = useState<PerformanceUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [plan, setPlan] = useState<PlanFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<SortKey>("clicks");
  const [actionId, setActionId] = useState<string | null>(null);
  const [profileUserId, setProfileUserId] = useState<string | null>(null);
  const [sortOpen, setSortOpen] = useState(false);
  const [planPopoverId, setPlanPopoverId] = useState<string | null>(null);
  const planPopoverRef = useRef<HTMLDivElement>(null);
  const prevSearchRef = useRef(search);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (planPopoverRef.current && !planPopoverRef.current.contains(e.target as Node)) {
        setPlanPopoverId(null);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const doLoad = useCallback(async (q: string, p: PlanFilter, s: SortKey) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ sort: s });
      if (q) params.set("search", q);
      if (p !== "all") params.set("plan", p);
      const data = await apiFetch(`/admin/users/performance?${params}`);
      setUsers(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const searchChanged = prevSearchRef.current !== search;
    prevSearchRef.current = search;
    const delay = searchChanged ? 300 : 0;
    const t = setTimeout(() => doLoad(search, plan, sort), delay);
    return () => clearTimeout(t);
  }, [search, plan, sort, doLoad]);

  async function suspend(id: string) {
    setActionId(id);
    try {
      await apiFetch(`/admin/users/${id}/suspend`, { method: "PATCH" });
      setUsers((u) => u.map((x) => x.id === id ? { ...x, suspended_at: new Date().toISOString() } : x));
    } catch { alert("Failed to suspend user."); }
    finally { setActionId(null); }
  }

  async function activate(id: string) {
    setActionId(id);
    try {
      await apiFetch(`/admin/users/${id}/activate`, { method: "PATCH" });
      setUsers((u) => u.map((x) => x.id === id ? { ...x, suspended_at: null } : x));
    } catch { alert("Failed to activate user."); }
    finally { setActionId(null); }
  }

  async function del(id: string, name: string) {
    if (!confirm(`Delete user "${name}"? This cannot be undone.`)) return;
    setActionId(id);
    try {
      await apiFetch(`/admin/users/${id}`, { method: "DELETE" });
      setUsers((u) => u.filter((x) => x.id !== id));
    } catch { alert("Failed to delete user."); }
    finally { setActionId(null); }
  }

  async function quickChangePlan(id: string, newPlan: string) {
    setActionId(id);
    try {
      await apiFetch(`/admin/users/${id}/plan`, { method: "PATCH", body: JSON.stringify({ plan: newPlan }) });
      setUsers((u) => u.map((x) => x.id === id ? { ...x, plan: newPlan } : x));
    } catch { alert("Failed to change plan."); }
    finally { setActionId(null); setPlanPopoverId(null); }
  }

  const filtered = users.filter((u) =>
    status === "suspended" ? !!u.suspended_at :
    status === "active" ? !u.suspended_at : true
  );

  const maxClicks = Math.max(...filtered.map((u) => Number(u.total_clicks)), 1);
  const sortLabel: Record<SortKey, string> = {
    clicks: "Total Clicks", links: "Total Links",
    avg: "Avg Clicks/Link", name: "Name A–Z",
  };

  return (
    <div className="space-y-4">
      {profileUserId && (
        <UserProfile userId={profileUserId} onClose={() => setProfileUserId(null)} />
      )}

      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8888A0]" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email…"
            className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-[#E4E4EC] bg-white text-sm text-[#0A0A0A] outline-none focus:border-[#728DA7] focus:ring-2 focus:ring-[#728DA7]/15 transition-all" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 bg-white border border-[#E4E4EC] rounded-xl p-1">
            {(["all", "free", "pro", "business"] as PlanFilter[]).map((p) => (
              <button key={p} onClick={() => setPlan(p)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${plan === p ? "bg-[#E8EEF4] text-[#4A7A94]" : "text-[#8888A0] hover:text-[#3A3A3E]"}`}>
                {p}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 bg-white border border-[#E4E4EC] rounded-xl p-1">
            {(["all", "active", "suspended"] as StatusFilter[]).map((s) => (
              <button key={s} onClick={() => setStatus(s)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${status === s ? "bg-[#E8EEF4] text-[#4A7A94]" : "text-[#8888A0] hover:text-[#3A3A3E]"}`}>
                {s}
              </button>
            ))}
          </div>
          <div className="relative">
            <button onClick={() => setSortOpen((v) => !v)}
              className="flex items-center gap-1.5 px-3 py-2 bg-white border border-[#E4E4EC] rounded-xl text-xs text-[#3A3A3E] hover:bg-[#F4F4F6] transition-all">
              <ArrowUpDown className="w-3 h-3 text-[#8888A0]" />
              {sortLabel[sort]}
              <ChevronDown className="w-3 h-3 text-[#8888A0]" />
            </button>
            {sortOpen && (
              <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-[#E4E4EC] rounded-xl shadow-xl z-20 overflow-hidden">
                {(Object.entries(sortLabel) as [SortKey, string][]).map(([k, v]) => (
                  <button key={k} onClick={() => { setSort(k); setSortOpen(false); }}
                    className={`w-full text-left px-3 py-2.5 text-xs transition-colors ${sort === k ? "bg-[#EEF3F7] text-[#4A7A94] font-medium" : "text-[#3A3A3E] hover:bg-[#F8F8FC]"}`}>
                    {v}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button onClick={() => doLoad(search, plan, sort)}
            className="p-2 rounded-xl border border-[#E4E4EC] bg-white hover:bg-[#F4F4F6] transition-all">
            <RefreshCw className={`w-3.5 h-3.5 text-[#8888A0] ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      <div className="text-xs text-[#8888A0]">{filtered.length} user{filtered.length !== 1 ? "s" : ""}</div>

      <div className="bg-white rounded-2xl border border-[#E4E4EC] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead>
              <tr className="bg-[#F8F8FC] border-b border-[#E4E4EC]">
                {["User", "Plan", "Links", "Total Clicks", "Avg/Link", "7d Clicks", "Last Active", "Status", ""].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-[#8888A0] uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F4F4F6]">
              {loading && [...Array(5)].map((_, i) => (
                <tr key={i}>{[...Array(9)].map((_, j) => (
                  <td key={j} className="px-4 py-4"><div className="h-4 bg-[#F4F4F6] rounded animate-pulse" /></td>
                ))}</tr>
              ))}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-12 text-center text-[#8888A0]">No users found</td></tr>
              )}
              {!loading && filtered.map((u, idx) => (
                <tr key={u.id} className="hover:bg-[#F8F8FC] transition-colors group">
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="relative w-8 h-8 rounded-full bg-[#E8EEF4] flex items-center justify-center text-[#728DA7] text-xs font-bold shrink-0">
                        {u.name.charAt(0).toUpperCase()}
                        {idx === 0 && sort === "clicks" && (
                          <div className="absolute -top-1 -right-1 w-4 h-4 bg-amber-400 rounded-full flex items-center justify-center">
                            <TrendingUp className="w-2.5 h-2.5 text-white" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-[#0A0A0A] truncate max-w-[140px]">{u.name}</div>
                        <div className="text-xs text-[#8888A0] truncate max-w-[140px]">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5"><PlanBadge plan={u.plan} /></td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-1.5">
                      <Link2 className="w-3 h-3 text-[#8888A0]" />
                      <span className="text-sm font-semibold text-[#0A0A0A]">{fmtNum(Number(u.total_links))}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5"><MiniBar value={Number(u.total_clicks)} max={maxClicks} /></td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-1.5 text-xs text-[#3A3A3E]">
                      <BarChart3 className="w-3 h-3 text-[#8888A0]" />
                      <span className="font-medium">{Number(u.avg_clicks).toFixed(1)}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={`text-xs font-semibold ${Number(u.clicks_7d) > 0 ? "text-green-600" : "text-[#8888A0]"}`}>
                      {fmtNum(Number(u.clicks_7d))}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-xs text-[#8888A0] whitespace-nowrap">
                    {u.last_click_at ? fmtDate(u.last_click_at) : <span className="text-[#C0C0CC]">Never</span>}
                  </td>
                  <td className="px-4 py-3.5"><StatusBadge suspended={!!u.suspended_at} /></td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => setProfileUserId(u.id)} title="View analytics"
                        className="p-1.5 rounded-lg hover:bg-[#EEF3F7] text-[#8888A0] hover:text-[#728DA7] transition-all">
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      {/* Plan change popover */}
                      <div className="relative">
                        <button
                          onClick={() => setPlanPopoverId(planPopoverId === u.id ? null : u.id)}
                          disabled={actionId === u.id}
                          title="Change plan"
                          className="p-1.5 rounded-lg hover:bg-purple-50 text-[#8888A0] hover:text-purple-600 transition-all disabled:opacity-40"
                        >
                          <Crown className="w-3.5 h-3.5" />
                        </button>
                        {planPopoverId === u.id && (
                          <div ref={planPopoverRef} className="absolute right-0 top-8 z-50 bg-white border border-[#E4E4EC] rounded-xl shadow-xl p-2 w-32 flex flex-col gap-1">
                            <div className="text-[10px] text-[#8888A0] font-semibold px-1 pb-1 border-b border-[#F0F0F5]">Change Plan</div>
                            {PLAN_OPTIONS.map((p) => (
                              <button
                                key={p}
                                disabled={u.plan === p || actionId === u.id}
                                onClick={() => quickChangePlan(u.id, p)}
                                className={`w-full text-left px-2 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${
                                  u.plan === p
                                    ? "bg-[#EEF3F7] text-[#728DA7] cursor-default"
                                    : "hover:bg-[#F8F8FC] text-[#3A3A3E] hover:text-[#0A0A0A]"
                                }`}
                              >
                                {u.plan === p ? `✓ ${p}` : p}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      {u.suspended_at ? (
                        <button onClick={() => activate(u.id)} disabled={actionId === u.id}
                          title="Activate" className="p-1.5 rounded-lg hover:bg-green-50 text-[#8888A0] hover:text-green-600 transition-all disabled:opacity-40">
                          <UserCheck className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <button onClick={() => suspend(u.id)} disabled={actionId === u.id}
                          title="Suspend" className="p-1.5 rounded-lg hover:bg-amber-50 text-[#8888A0] hover:text-amber-600 transition-all disabled:opacity-40">
                          <UserX className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button onClick={() => del(u.id, u.name)} disabled={actionId === u.id}
                        title="Delete" className="p-1.5 rounded-lg hover:bg-red-50 text-[#8888A0] hover:text-red-500 transition-all disabled:opacity-40">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {!loading && filtered.length > 0 && (() => {
        const sortedByClicks = [...filtered].sort((a, b) => Number(b.total_clicks) - Number(a.total_clicks));
        const best = sortedByClicks[0];
        const highAvg = [...filtered].sort((a, b) => Number(b.avg_clicks) - Number(a.avg_clicks))[0];
        const inactive = filtered.filter((u) => !u.last_click_at).length;
        return (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {best && (
              <div className="rounded-2xl border border-[#E4E4EC] p-4 bg-green-50">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="w-4 h-4 text-green-600" />
                  <span className="text-xs font-semibold text-[#8888A0] uppercase tracking-wide">Top by Clicks</span>
                </div>
                <div className="text-sm font-bold text-[#0A0A0A] truncate">{best.name}</div>
                <div className="text-xs text-[#8888A0] mt-0.5">{fmtNum(Number(best.total_clicks))} total clicks</div>
              </div>
            )}
            {highAvg && (
              <div className="rounded-2xl border border-[#E4E4EC] p-4 bg-[#EEF3F7]">
                <div className="flex items-center gap-2 mb-1">
                  <BarChart3 className="w-4 h-4 text-[#728DA7]" />
                  <span className="text-xs font-semibold text-[#8888A0] uppercase tracking-wide">Best Avg / Link</span>
                </div>
                <div className="text-sm font-bold text-[#0A0A0A] truncate">{highAvg.name}</div>
                <div className="text-xs text-[#8888A0] mt-0.5">{Number(highAvg.avg_clicks).toFixed(1)} avg clicks per link</div>
              </div>
            )}
            <div className="rounded-2xl border border-[#E4E4EC] p-4 bg-[#F4F4F6]">
              <div className="flex items-center gap-2 mb-1">
                <MousePointerClick className="w-4 h-4 text-[#8888A0]" />
                <span className="text-xs font-semibold text-[#8888A0] uppercase tracking-wide">Never Clicked</span>
              </div>
              <div className="text-sm font-bold text-[#0A0A0A]">{inactive} user{inactive !== 1 ? "s" : ""}</div>
              <div className="text-xs text-[#8888A0] mt-0.5">No link activity recorded</div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
