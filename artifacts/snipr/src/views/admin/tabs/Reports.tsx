"use client";
import { useEffect, useState } from "react";
import { Search, RefreshCw, MousePointer, Globe, Monitor, Link2, AlertCircle } from "lucide-react";
import { apiFetch, fmtTime } from "../utils";

interface ActivityEvent {
  id: string; slug: string; linkId: string;
  timestamp: string; country: string | null; device: string | null;
  browser: string | null; referrer: string | null;
}

export default function ReportsTab() {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch("/admin/activity");
      setEvents(data);
    } catch (e: any) {
      setError(e?.error ?? "Failed to load activity feed");
    } finally {
      setLoading(false);
    }
  }

  async function refresh() {
    setRefreshing(true);
    try {
      const data = await apiFetch("/admin/activity");
      setEvents(data);
      setError(null);
    } catch (e: any) {
      setError(e?.error ?? "Failed to refresh");
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => { load(); }, []);

  const filtered = events.filter((e) =>
    !search ||
    e.slug.toLowerCase().includes(search.toLowerCase()) ||
    (e.country ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (e.device ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (e.browser ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8888A0]" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by slug, country, browser…"
            className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-[#E4E4EC] bg-white text-sm outline-none focus:border-[#728DA7] focus:ring-2 focus:ring-[#728DA7]/15 transition-all" />
        </div>
        <button onClick={refresh} disabled={refreshing || loading}
          className="p-2 rounded-xl border border-[#E4E4EC] bg-white hover:bg-[#F4F4F6] transition-all disabled:opacity-50">
          <RefreshCw className={`w-3.5 h-3.5 text-[#8888A0] ${refreshing ? "animate-spin" : ""}`} />
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
          <button onClick={load} className="ml-auto text-xs underline hover:no-underline">Retry</button>
        </div>
      )}

      {!error && (
        <div className="flex items-center justify-between">
          <div className="text-xs text-[#8888A0]">{filtered.length} recent click event{filtered.length !== 1 ? "s" : ""}</div>
          <div className="flex items-center gap-1.5 text-xs text-[#728DA7] bg-[#EEF3F7] px-2.5 py-1 rounded-full">
            <div className="w-1.5 h-1.5 rounded-full bg-[#728DA7] animate-pulse" />
            Live feed
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-[#E4E4EC] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="bg-[#F8F8FC] border-b border-[#E4E4EC]">
                {["Event", "Link", "Country", "Device / Browser", "Referrer", "Time"].map((h) => (
                  <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-[#8888A0] uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F4F4F6]">
              {loading && [...Array(8)].map((_, i) => (
                <tr key={i}>{[...Array(6)].map((_, j) => (
                  <td key={j} className="px-5 py-4"><div className="h-4 bg-[#F4F4F6] rounded animate-pulse" /></td>
                ))}</tr>
              ))}
              {!loading && !error && filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-16 text-center">
                    <MousePointer className="w-8 h-8 text-[#C8C8D8] mx-auto mb-3" />
                    <p className="text-[#8888A0] text-sm">No activity events found</p>
                  </td>
                </tr>
              )}
              {!loading && !error && filtered.map((e) => (
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
  );
}
