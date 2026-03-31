"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import {
  Search, CheckCircle, XCircle, Trash2, ExternalLink, RefreshCw,
  ToggleLeft, ToggleRight, ArrowUpDown, ChevronDown, Globe, Smartphone,
  MousePointerClick, Users, Download, HeartPulse, Loader2,
} from "lucide-react";
import { apiFetch, apiFetchBlob, downloadBlob, fmtDate, fmtNum } from "../utils";

interface PerformanceLink {
  id: string;
  slug: string;
  destination_url: string;
  title: string | null;
  enabled: boolean;
  created_at: string;
  expires_at: string | null;
  click_limit: number | null;
  owner_name: string;
  owner_email: string;
  owner_plan: string;
  workspace_name: string;
  total_clicks: number;
  unique_clicks: number;
  last_click_at: string | null;
  clicks_7d: number;
  top_country: string | null;
  top_device: string | null;
}

type FilterStatus = "all" | "active" | "disabled";
type SortKey = "clicks" | "created" | "last_click" | "asc";

function PlanBadge({ plan }: { plan: string }) {
  const cfg = plan === "business"
    ? "bg-purple-50 text-purple-700 border-purple-200"
    : plan === "pro"
    ? "bg-blue-50 text-blue-700 border-blue-200"
    : "bg-gray-100 text-gray-500 border-gray-200";
  return (
    <span className={`inline-block px-1.5 py-0.5 rounded-full text-[9px] font-bold border uppercase ${cfg}`}>
      {plan}
    </span>
  );
}

export default function LinksTab() {
  const [links, setLinks] = useState<PerformanceLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterStatus>("all");
  const [sort, setSort] = useState<SortKey>("clicks");
  const [actionId, setActionId] = useState<string | null>(null);
  const [sortOpen, setSortOpen] = useState(false);
  const prevSearchRef = useRef(search);
  const [healthChecking, setHealthChecking] = useState(false);
  const [healthResults, setHealthResults] = useState<{ slug: string; url: string; status: number; ok: boolean; error?: string }[] | null>(null);

  const doLoad = useCallback(async (q: string, f: FilterStatus, s: SortKey) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ sort: s });
      if (q) params.set("search", q);
      if (f !== "all") params.set("status", f);
      const data = await apiFetch(`/admin/links/performance?${params}`);
      setLinks(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const searchChanged = prevSearchRef.current !== search;
    prevSearchRef.current = search;
    const delay = searchChanged ? 300 : 0;
    const t = setTimeout(() => doLoad(search, filter, sort), delay);
    return () => clearTimeout(t);
  }, [search, filter, sort, doLoad]);

  async function toggle(id: string) {
    setActionId(id);
    try {
      const { enabled } = await apiFetch(`/admin/links/${id}/toggle`, { method: "PATCH" });
      setLinks((l) => l.map((x) => x.id === id ? { ...x, enabled } : x));
    } catch { alert("Failed to toggle link."); }
    finally { setActionId(null); }
  }

  async function del(id: string, slug: string) {
    if (!confirm(`Delete link "snipr.sh/${slug}"? This cannot be undone.`)) return;
    setActionId(id);
    try {
      await apiFetch(`/admin/links/${id}`, { method: "DELETE" });
      setLinks((l) => l.filter((x) => x.id !== id));
    } catch { alert("Failed to delete link."); }
    finally { setActionId(null); }
  }

  async function exportLinks() {
    try {
      const blob = await apiFetchBlob("/admin/export/links");
      downloadBlob(blob, "snipr-links.csv");
    } catch { alert("Export failed."); }
  }

  async function runHealthCheck() {
    setHealthChecking(true);
    try {
      const data = await apiFetch("/admin/links/health-check", { method: "POST" });
      setHealthResults(Array.isArray(data) ? data : data.results || []);
    } catch { alert("Health check failed."); }
    finally { setHealthChecking(false); }
  }

  const sortLabel: Record<SortKey, string> = {
    clicks: "Most Clicks", created: "Newest First",
    last_click: "Last Clicked", asc: "Fewest Clicks",
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8888A0]" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search slug, URL or owner…"
            className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-[#E4E4EC] bg-white text-sm text-[#0A0A0A] outline-none focus:border-[#728DA7] focus:ring-2 focus:ring-[#728DA7]/15 transition-all" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 bg-white border border-[#E4E4EC] rounded-xl p-1">
            {(["all", "active", "disabled"] as FilterStatus[]).map((f) => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${filter === f ? "bg-[#E8EEF4] text-[#4A7A94]" : "text-[#8888A0] hover:text-[#3A3A3E]"}`}>
                {f}
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
              <div className="absolute right-0 top-full mt-1 w-40 bg-white border border-[#E4E4EC] rounded-xl shadow-xl z-20 overflow-hidden">
                {(Object.entries(sortLabel) as [SortKey, string][]).map(([k, v]) => (
                  <button key={k} onClick={() => { setSort(k); setSortOpen(false); }}
                    className={`w-full text-left px-3 py-2.5 text-xs transition-colors ${sort === k ? "bg-[#EEF3F7] text-[#4A7A94] font-medium" : "text-[#3A3A3E] hover:bg-[#F8F8FC]"}`}>
                    {v}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button onClick={runHealthCheck} disabled={healthChecking} title="Health check"
            className="p-2 rounded-xl border border-[#E4E4EC] bg-white hover:bg-[#F4F4F6] transition-all disabled:opacity-40">
            {healthChecking ? <Loader2 className="w-3.5 h-3.5 text-[#8888A0] animate-spin" /> : <HeartPulse className="w-3.5 h-3.5 text-[#8888A0]" />}
          </button>
          <button onClick={exportLinks} title="Export CSV"
            className="p-2 rounded-xl border border-[#E4E4EC] bg-white hover:bg-[#F4F4F6] transition-all">
            <Download className="w-3.5 h-3.5 text-[#8888A0]" />
          </button>
          <button onClick={() => doLoad(search, filter, sort)}
            className="p-2 rounded-xl border border-[#E4E4EC] bg-white hover:bg-[#F4F4F6] transition-all">
            <RefreshCw className="w-3.5 h-3.5 text-[#8888A0]" />
          </button>
        </div>
      </div>

      {healthResults && (
        <div className="bg-white rounded-2xl border border-[#E4E4EC] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HeartPulse className="w-4 h-4 text-[#728DA7]" />
              <h3 className="text-sm font-semibold text-[#0A0A0A]">Health Check Results</h3>
              <span className="text-[10px] text-[#8888A0]">
                {healthResults.filter(r => r.ok).length}/{healthResults.length} healthy
              </span>
            </div>
            <button onClick={() => setHealthResults(null)} className="text-xs text-[#8888A0] hover:text-[#3A3A3E]">Dismiss</button>
          </div>
          {healthResults.filter(r => !r.ok).length > 0 ? (
            <div className="divide-y divide-[#F4F4F6] max-h-48 overflow-y-auto rounded-xl border border-red-100">
              {healthResults.filter(r => !r.ok).map((r, i) => (
                <div key={i} className="px-3 py-2 flex items-center justify-between text-xs bg-red-50/50">
                  <div>
                    <span className="font-semibold text-[#0A0A0A]">/{r.slug}</span>
                    <span className="text-[#8888A0] ml-2 truncate">{r.url.substring(0, 40)}</span>
                  </div>
                  <span className="text-red-600 font-semibold">{r.error || `HTTP ${r.status}`}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-xs text-green-600 font-medium flex items-center gap-1.5">
              <CheckCircle className="w-3.5 h-3.5" /> All links are healthy!
            </div>
          )}
        </div>
      )}

      <div className="text-xs text-[#8888A0]">{links.length} link{links.length !== 1 ? "s" : ""}</div>

      <div className="bg-white rounded-2xl border border-[#E4E4EC] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[1000px]">
            <thead>
              <tr className="bg-[#F8F8FC] border-b border-[#E4E4EC]">
                {["Short Link", "Destination", "Owner", "Clicks", "Unique", "7d", "Last Click", "Country / Device", "Status", ""].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-[#8888A0] uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F4F4F6]">
              {loading && [...Array(5)].map((_, i) => (
                <tr key={i}>{[...Array(10)].map((_, j) => (
                  <td key={j} className="px-4 py-4"><div className="h-4 bg-[#F4F4F6] rounded animate-pulse" /></td>
                ))}</tr>
              ))}
              {!loading && links.length === 0 && (
                <tr><td colSpan={10} className="px-4 py-12 text-center text-[#8888A0]">No links found</td></tr>
              )}
              {!loading && links.map((l) => (
                <tr key={l.id} className="hover:bg-[#F8F8FC] transition-colors group">
                  <td className="px-4 py-3.5">
                    <div className="font-mono text-[#0A0A0A] font-medium text-xs">snipr.sh/{l.slug}</div>
                    {l.title && <div className="text-xs text-[#8888A0] mt-0.5 truncate max-w-[130px]">{l.title}</div>}
                  </td>
                  <td className="px-4 py-3.5 max-w-[160px]">
                    <a href={l.destination_url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 text-[#728DA7] hover:underline text-xs">
                      <span className="truncate max-w-[120px]">{l.destination_url}</span>
                      <ExternalLink className="w-3 h-3 shrink-0" />
                    </a>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="text-xs text-[#3A3A3E] truncate max-w-[110px]">{l.owner_email}</div>
                    <div className="mt-0.5"><PlanBadge plan={l.owner_plan} /></div>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-1">
                      <MousePointerClick className="w-3 h-3 text-[#8888A0]" />
                      <span className="text-xs font-semibold text-[#0A0A0A] tabular-nums">
                        {fmtNum(Number(l.total_clicks))}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-1 text-xs text-[#8888A0]">
                      <Users className="w-3 h-3" />
                      {fmtNum(Number(l.unique_clicks))}
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={`text-xs font-medium ${Number(l.clicks_7d) > 0 ? "text-green-600" : "text-[#8888A0]"}`}>
                      {fmtNum(Number(l.clicks_7d))}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-xs text-[#8888A0] whitespace-nowrap">
                    {l.last_click_at ? fmtDate(l.last_click_at) : <span className="text-[#C0C0CC]">Never</span>}
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="space-y-1">
                      {l.top_country && (
                        <div className="flex items-center gap-1 text-[10px] text-[#8888A0]">
                          <Globe className="w-3 h-3" />{l.top_country}
                        </div>
                      )}
                      {l.top_device && (
                        <div className="flex items-center gap-1 text-[10px] text-[#8888A0]">
                          <Smartphone className="w-3 h-3" />{l.top_device}
                        </div>
                      )}
                      {!l.top_country && !l.top_device && (
                        <span className="text-[10px] text-[#C0C0CC]">—</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      l.enabled ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"
                    }`}>
                      {l.enabled ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                      {l.enabled ? "Active" : "Disabled"}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => toggle(l.id)} disabled={actionId === l.id}
                        title={l.enabled ? "Disable" : "Enable"}
                        className={`p-1.5 rounded-lg transition-all disabled:opacity-40 ${
                          l.enabled ? "hover:bg-amber-50 text-[#8888A0] hover:text-amber-600" : "hover:bg-green-50 text-[#8888A0] hover:text-green-600"
                        }`}>
                        {l.enabled ? <ToggleRight className="w-3.5 h-3.5" /> : <ToggleLeft className="w-3.5 h-3.5" />}
                      </button>
                      <button onClick={() => del(l.id, l.slug)} disabled={actionId === l.id}
                        title="Delete"
                        className="p-1.5 rounded-lg hover:bg-red-50 text-[#8888A0] hover:text-red-500 transition-all disabled:opacity-40">
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
    </div>
  );
}
