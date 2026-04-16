"use client";
import { useState, useMemo, useCallback, useEffect } from "react";
import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { useGetLinks, useDeleteLink, useUpdateLink, useGetFolders, useGetTags, useGetDomains, getGetLinksQueryKey, getGetFoldersQueryKey, getGetTagsQueryKey, getGetDomainsQueryKey } from "@workspace/api-client-react";
import { LinkModal } from "@/components/LinkModal";
import { QrModal } from "@/components/QrModal";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { format, formatDistanceToNow } from "date-fns";
import type { Link } from "@workspace/api-client-react";
import {
  Plus, Edit2, Trash2, QrCode, ExternalLink, LinkIcon,
  Search, Copy, Check, ToggleLeft, ToggleRight, Loader2,
  TrendingUp, MousePointerClick, ChevronDown, Globe, Layers,
  CheckSquare, Square, XCircle, FolderInput, FolderOpen, Tag, X,
  LayoutList, LayoutGrid, ArrowUpRight, MoreHorizontal,
  BarChart3, Filter, Activity, Zap, Sparkles, Link2,
} from "lucide-react";

type FilterType = "all" | "active" | "disabled";
type SortType = "newest" | "oldest" | "name" | "clicks";
type ViewMode = "list" | "grid";

async function fetchLinkClicks({ signal }: { signal: AbortSignal }): Promise<Record<string, { total: number; unique: number }>> {
  try {
    const res = await fetch("/api/links/clicks", { credentials: "include", signal });
    if (!res.ok) return {};
    return res.json();
  } catch (e) {
    if ((e as Error)?.name === "AbortError") return {};
    throw e;
  }
}

async function fetchSparklines({ signal }: { signal: AbortSignal }): Promise<Record<string, { sparkline: number[]; topCountry: string | null }>> {
  try {
    const res = await fetch("/api/links/sparklines", { credentials: "include", signal });
    if (!res.ok) return {};
    return res.json();
  } catch { return {}; }
}

function getDomain(url: string) {
  try { return new URL(url).hostname.replace("www.", ""); }
  catch { return url; }
}

function getShortDomain(shortUrl: string) {
  try { return new URL(shortUrl).hostname; }
  catch { return ""; }
}

function Sparkline({ data, color = "#8B5CF6" }: { data: number[]; color?: string }) {
  const max = Math.max(...data, 1);
  const w = 72, h = 28;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - (v / max) * (h - 4) - 2;
    return `${x},${y}`;
  });
  const hasData = data.some((v) => v > 0);
  if (!hasData) {
    return (
      <svg width={w} height={h} className="opacity-30">
        <line x1="0" y1={h / 2} x2={w} y2={h / 2} stroke="#3F3F46" strokeWidth={1} strokeDasharray="3 3" />
      </svg>
    );
  }
  const gradId = `spk-${color.replace('#', '')}`;
  return (
    <svg width={w} height={h}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.15} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <polygon points={`0,${h} ${pts.join(" ")} ${w},${h}`} fill={`url(#${gradId})`} />
      <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

const COUNTRY_FLAGS: Record<string, string> = {
  US: "\u{1F1FA}\u{1F1F8}", GB: "\u{1F1EC}\u{1F1E7}", DE: "\u{1F1E9}\u{1F1EA}", FR: "\u{1F1EB}\u{1F1F7}", CA: "\u{1F1E8}\u{1F1E6}", AU: "\u{1F1E6}\u{1F1FA}", IN: "\u{1F1EE}\u{1F1F3}", BR: "\u{1F1E7}\u{1F1F7}",
  JP: "\u{1F1EF}\u{1F1F5}", KR: "\u{1F1F0}\u{1F1F7}", CN: "\u{1F1E8}\u{1F1F3}", MX: "\u{1F1F2}\u{1F1FD}", IT: "\u{1F1EE}\u{1F1F9}", ES: "\u{1F1EA}\u{1F1F8}", NL: "\u{1F1F3}\u{1F1F1}", RU: "\u{1F1F7}\u{1F1FA}",
  PL: "\u{1F1F5}\u{1F1F1}", SE: "\u{1F1F8}\u{1F1EA}", NO: "\u{1F1F3}\u{1F1F4}", DK: "\u{1F1E9}\u{1F1F0}", FI: "\u{1F1EB}\u{1F1EE}", TR: "\u{1F1F9}\u{1F1F7}", ID: "\u{1F1EE}\u{1F1E9}", TH: "\u{1F1F9}\u{1F1ED}",
  SG: "\u{1F1F8}\u{1F1EC}", ZA: "\u{1F1FF}\u{1F1E6}", NG: "\u{1F1F3}\u{1F1EC}", EG: "\u{1F1EA}\u{1F1EC}", AR: "\u{1F1E6}\u{1F1F7}", CL: "\u{1F1E8}\u{1F1F1}", CO: "\u{1F1E8}\u{1F1F4}", PT: "\u{1F1F5}\u{1F1F9}",
  PK: "\u{1F1F5}\u{1F1F0}", BD: "\u{1F1E7}\u{1F1E9}", VN: "\u{1F1FB}\u{1F1F3}", PH: "\u{1F1F5}\u{1F1ED}", MY: "\u{1F1F2}\u{1F1FE}", AE: "\u{1F1E6}\u{1F1EA}", SA: "\u{1F1F8}\u{1F1E6}", IE: "\u{1F1EE}\u{1F1EA}",
  CH: "\u{1F1E8}\u{1F1ED}", AT: "\u{1F1E6}\u{1F1F9}", BE: "\u{1F1E7}\u{1F1EA}", NZ: "\u{1F1F3}\u{1F1FF}", IL: "\u{1F1EE}\u{1F1F1}", KE: "\u{1F1F0}\u{1F1EA}", GH: "\u{1F1EC}\u{1F1ED}", TZ: "\u{1F1F9}\u{1F1FF}",
};

const KPI_CONFIGS = [
  { label: "Total links", icon: Link2, accent: "#8B5CF6" },
  { label: "Active", icon: Zap, accent: "#10B981" },
  { label: "Total clicks", icon: MousePointerClick, accent: "#06B6D4" },
];

export default function Links() {
  const ST5 = 5 * 60 * 1000;
  const { data: links, isLoading } = useGetLinks(undefined, { query: { queryKey: getGetLinksQueryKey(), staleTime: ST5 } });
  const { data: folders = [] } = useGetFolders({ query: { queryKey: getGetFoldersQueryKey(), staleTime: ST5 } });
  const { data: tags = [] } = useGetTags({ query: { queryKey: getGetTagsQueryKey(), staleTime: ST5 } });
  const { data: clickCounts = {} } = useQuery({ queryKey: ["links-clicks"], queryFn: fetchLinkClicks, staleTime: 60_000 });
  const { data: sparklines = {} } = useQuery({ queryKey: ["links-sparklines"], queryFn: fetchSparklines, staleTime: 60_000 });
  const { data: allDomains } = useGetDomains({ query: { queryKey: getGetDomainsQueryKey(), staleTime: ST5 } });
  const domainMap = useMemo(() => {
    const map: Record<string, string> = {};
    allDomains?.forEach((d: any) => { if (d.id) map[d.id] = d.domain; });
    return map;
  }, [allDomains]);

  const deleteMutation = useDeleteLink();
  const updateMutation = useUpdateLink();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLink, setEditingLink] = useState<Link | null>(null);
  const [prefilledSlug, setPrefilledSlug] = useState<string | undefined>(undefined);
  const [qrLink, setQrLink] = useState<Link | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
  const [sortBy, setSortBy] = useState<SortType>("newest");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkLoading, setIsBulkLoading] = useState(false);
  const [moveFolderId, setMoveFolderId] = useState<string>("");
  const [bulkTagId, setBulkTagId] = useState<string>("");
  const [baseUrl, setBaseUrl] = useState("");
  const [folderFilter, setFolderFilter] = useState<string>("");
  const [tagFilter, setTagFilter] = useState<string>("");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  useEffect(() => { setBaseUrl(window.location.origin); }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const slug = params.get("slug");
    const folder = params.get("folder");
    if (folder) setFolderFilter(folder);
    if (slug) {
      setPrefilledSlug(slug);
      setEditingLink(null);
      setIsModalOpen(true);
      const url = new URL(window.location.href);
      url.searchParams.delete("slug");
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

  useEffect(() => {
    if (!openMenuId) return;
    const handler = () => setOpenMenuId(null);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [openMenuId]);

  const filteredLinks = useMemo(() => {
    if (!links) return [];
    let result = [...links];
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((l) => l.slug.toLowerCase().includes(q) || (l.title ?? "").toLowerCase().includes(q) || l.destinationUrl.toLowerCase().includes(q));
    }
    if (filter === "active") result = result.filter((l) => l.enabled);
    if (filter === "disabled") result = result.filter((l) => !l.enabled);
    if (folderFilter) result = result.filter((l) => (l as any).folderId === folderFilter);
    if (tagFilter) result = result.filter((l) => ((l as any).tags ?? []).some((t: any) => t.id === tagFilter));
    if (sortBy === "newest") result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    if (sortBy === "oldest") result.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    if (sortBy === "name") result.sort((a, b) => a.slug.localeCompare(b.slug));
    if (sortBy === "clicks") result.sort((a, b) => (clickCounts[b.id]?.total ?? 0) - (clickCounts[a.id]?.total ?? 0));
    return result;
  }, [links, search, filter, sortBy, clickCounts, folderFilter, tagFilter]);

  const folderMap = useMemo(() => {
    const map: Record<string, { name: string; color: string }> = {};
    (folders as any[]).forEach((f) => { map[f.id] = { name: f.name, color: f.color }; });
    return map;
  }, [folders]);

  const tagMap = useMemo(() => {
    const map: Record<string, { name: string; color: string }> = {};
    (tags as any[]).forEach((t) => { map[t.id] = { name: t.name, color: t.color }; });
    return map;
  }, [tags]);

  const maxClicks = useMemo(() => {
    if (!links) return 1;
    return Math.max(...links.map((l) => clickCounts[l.id]?.total ?? 0), 1);
  }, [links, clickCounts]);

  const handleCreate = () => { setEditingLink(null); setIsModalOpen(true); };
  const handleEdit = (link: Link) => { setEditingLink(link); setIsModalOpen(true); };

  const handleDelete = (id: string) => {
    if (!confirm("Delete this link? This cannot be undone.")) return;
    deleteMutation.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetLinksQueryKey() });
        queryClient.invalidateQueries({ queryKey: ["links-clicks"] });
        queryClient.invalidateQueries({ queryKey: ["links-sparklines"] });
        setSelectedIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
        toast({ title: "Link deleted" });
      },
      onError: () => toast({ title: "Failed to delete link", variant: "destructive" }),
    });
  };

  const handleToggle = async (link: Link) => {
    setTogglingId(link.id);
    try {
      await updateMutation.mutateAsync({ id: link.id, data: { enabled: !link.enabled } });
      queryClient.invalidateQueries({ queryKey: getGetLinksQueryKey() });
      toast({ title: link.enabled ? "Link disabled" : "Link enabled" });
    } catch {
      toast({ title: "Failed to update link", variant: "destructive" });
    } finally {
      setTogglingId(null);
    }
  };

  const getShortUrl = (link: Link) => {
    const domainName = (link as any).domainId ? domainMap[(link as any).domainId] : null;
    return domainName ? `https://${domainName}/${link.slug}` : `${baseUrl}/r/${link.slug}`;
  };

  const handleCopy = (link: Link) => {
    const url = getShortUrl(link);
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(link.id);
      toast({ title: "Copied!", description: url });
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const handleDuplicate = async (link: Link) => {
    setDuplicatingId(link.id);
    try {
      const res = await fetch(`/api/links/${link.id}/duplicate`, { method: "POST", credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      queryClient.invalidateQueries({ queryKey: getGetLinksQueryKey() });
      toast({ title: "Link duplicated" });
    } catch {
      toast({ title: "Failed to duplicate link", variant: "destructive" });
    } finally {
      setDuplicatingId(null);
    }
  };

  const handleBulkAction = async (action: "enable" | "disable" | "delete" | "move" | "tag") => {
    if (selectedIds.size === 0) return;
    if (action === "delete" && !confirm(`Delete ${selectedIds.size} links? This cannot be undone.`)) return;
    if (action === "tag" && !bulkTagId) {
      toast({ title: "Please select a tag first", variant: "destructive" });
      return;
    }
    setIsBulkLoading(true);
    const count = selectedIds.size;
    try {
      const body: Record<string, unknown> = { action, ids: Array.from(selectedIds) };
      if (action === "move") body.folderId = moveFolderId || null;
      if (action === "tag") body.tagIds = [bulkTagId];
      const res = await fetch("/api/links/bulk", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error("Failed");
      queryClient.invalidateQueries({ queryKey: getGetLinksQueryKey() });
      queryClient.invalidateQueries({ queryKey: ["links-clicks"] });
      queryClient.invalidateQueries({ queryKey: ["links-sparklines"] });
      setSelectedIds(new Set());
      const actionLabels: Record<string, string> = { enable: "enabled", disable: "disabled", delete: "deleted", move: "moved", tag: "tagged" };
      toast({ title: `${count} links ${actionLabels[action] ?? action}` });
    } catch {
      toast({ title: "Bulk action failed", variant: "destructive" });
    } finally {
      setIsBulkLoading(false);
    }
  };

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }, []);

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredLinks.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filteredLinks.map((l) => l.id)));
  };

  const totalLinks = links?.length ?? 0;
  const activeLinks = links?.filter((l) => l.enabled).length ?? 0;
  const totalClicks = Object.values(clickCounts).reduce((a, b) => a + (b?.total ?? 0), 0);
  const hasActiveFilters = folderFilter || tagFilter || search || filter !== "all";
  const kpiValues = [totalLinks, activeLinks, totalClicks];

  return (
    <ProtectedLayout>
      <div className="min-h-screen" style={{ background: "#09090B" }}>
        {/* Ambient glows */}
        <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
          <div className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full opacity-[0.04]" style={{ background: "radial-gradient(circle, #8B5CF6, transparent 70%)" }} />
          <div className="absolute top-1/3 -right-40 w-[500px] h-[500px] rounded-full opacity-[0.03]" style={{ background: "radial-gradient(circle, #06B6D4, transparent 70%)" }} />
        </div>

        <div className="relative z-10 px-4 sm:px-6 lg:px-8 py-6 sm:py-8 max-w-[1280px] mx-auto w-full pt-14 lg:pt-6">

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #8B5CF6, #06B6D4)" }}>
                  <Link2 className="w-4.5 h-4.5 text-white" strokeWidth={2.5} />
                </div>
                <h1 className="text-[26px] sm:text-[32px] font-[family-name:var(--font-space-grotesk)] font-bold tracking-[-0.025em] text-[#FAFAFA] leading-none">
                  Links
                </h1>
              </div>
              <p className="text-[13px] text-[#52525B] pl-12">Create, manage, and track all your shortened URLs</p>
            </div>
            <button
              onClick={handleCreate}
              className="inline-flex items-center gap-2 text-white text-[13px] font-semibold px-4 py-2 rounded-lg transition-all shrink-0 active:scale-[0.97]"
              style={{ background: "linear-gradient(135deg, #8B5CF6, #7C3AED)", boxShadow: "0 2px 12px rgba(139,92,246,0.25)" }}
            >
              <Plus className="w-4 h-4" strokeWidth={2.5} />
              Create link
            </button>
          </div>

          {/* KPI Row */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            {KPI_CONFIGS.map((cfg, i) => {
              const val = isLoading ? null : kpiValues[i];
              return (
                <div key={i} className="rounded-xl bg-[#18181B] border border-[#27272A] p-4 sm:p-5 group transition-all duration-200 hover:border-[#3F3F46]">
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="text-[11px] font-semibold text-[#52525B] uppercase tracking-[0.06em]">{cfg.label}</span>
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center transition-transform duration-200 group-hover:scale-110" style={{ background: `${cfg.accent}15`, border: `1px solid ${cfg.accent}20` }}>
                      <cfg.icon className="w-3.5 h-3.5" style={{ color: cfg.accent }} strokeWidth={2} />
                    </div>
                  </div>
                  <p className="text-[24px] sm:text-[32px] font-[family-name:var(--font-space-grotesk)] font-bold text-[#FAFAFA] leading-none tabular-nums tracking-[-0.02em]">
                    {val === null ? <span className="inline-block w-12 h-7 bg-[#27272A] animate-pulse rounded-md" /> : val.toLocaleString()}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Bulk Actions */}
          {selectedIds.size > 0 && (
            <div className="sticky top-4 z-20 rounded-xl px-4 py-3 flex items-center gap-3 mb-3 flex-wrap bg-[#1E1B4B] border border-[#312E81]" style={{ boxShadow: "0 4px 24px rgba(30,27,75,0.3)" }}>
              <span className="text-[13px] font-semibold text-white shrink-0 tabular-nums">{selectedIds.size} selected</span>
              <div className="h-4 w-px bg-white/15" />
              <div className="flex-1 flex items-center gap-2 flex-wrap">
                <BulkBtn onClick={() => handleBulkAction("enable")} disabled={isBulkLoading} color="green"><ToggleRight className="w-3.5 h-3.5" /> Enable</BulkBtn>
                <BulkBtn onClick={() => handleBulkAction("disable")} disabled={isBulkLoading} color="gray"><ToggleLeft className="w-3.5 h-3.5" /> Disable</BulkBtn>
                {folders.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <select value={moveFolderId} onChange={(e) => setMoveFolderId(e.target.value)} className="text-[12px] bg-white/10 border border-white/15 rounded-lg px-2 py-1.5 text-white outline-none cursor-pointer appearance-none">
                      <option value="">No folder</option>
                      {folders.map((f) => (<option key={f.id} value={f.id}>{f.name}</option>))}
                    </select>
                    <BulkBtn onClick={() => handleBulkAction("move")} disabled={isBulkLoading} color="gray"><FolderInput className="w-3.5 h-3.5" /> Move</BulkBtn>
                  </div>
                )}
                {tags.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <select value={bulkTagId} onChange={(e) => setBulkTagId(e.target.value)} className="text-[12px] bg-white/10 border border-white/15 rounded-lg px-2 py-1.5 text-white outline-none cursor-pointer appearance-none">
                      <option value="">Select tag</option>
                      {tags.map((t) => (<option key={t.id} value={t.id}>{t.name}</option>))}
                    </select>
                    <BulkBtn onClick={() => handleBulkAction("tag")} disabled={isBulkLoading || !bulkTagId} color="gray"><Globe className="w-3.5 h-3.5" /> Tag</BulkBtn>
                  </div>
                )}
                <BulkBtn onClick={() => handleBulkAction("delete")} disabled={isBulkLoading} color="red"><Trash2 className="w-3.5 h-3.5" /> Delete</BulkBtn>
              </div>
              <button onClick={() => setSelectedIds(new Set())} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors shrink-0" title="Clear selection"><X className="w-4 h-4 text-white/50" /></button>
            </div>
          )}

          {/* Toolbar */}
          <div className="rounded-t-xl px-4 py-3.5 bg-[#18181B] border border-[#27272A] border-b-0">
            <div className="flex flex-col sm:flex-row gap-2.5 items-start sm:items-center">
              <div className="relative flex-1 min-w-0 w-full sm:w-auto">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#52525B] pointer-events-none" />
                <input
                  type="text" placeholder="Search links..." value={search} onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-8 py-2.5 text-[13px] rounded-lg outline-none transition-all placeholder:text-[#3F3F46] text-[#E4E4E7] bg-[#09090B] border border-[#27272A] focus:border-[#8B5CF6]/40 focus:ring-2 focus:ring-[#8B5CF6]/10"
                />
                {search && (
                  <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#52525B] hover:text-[#A1A1AA] transition-colors"><X className="w-3.5 h-3.5" /></button>
                )}
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="flex gap-0.5 rounded-lg p-[3px] flex-1 sm:flex-initial bg-[#09090B] border border-[#27272A]">
                  {(["all", "active", "disabled"] as FilterType[]).map((f) => (
                    <button key={f} onClick={() => setFilter(f)}
                      className={`px-3 py-1.5 text-[12px] font-medium rounded-md transition-all capitalize flex-1 sm:flex-initial ${
                        filter === f ? "text-[#FAFAFA] bg-[#27272A]" : "text-[#52525B] hover:text-[#A1A1AA]"
                      }`}>
                      {f === "all" ? `All (${totalLinks})` : f === "active" ? `Active (${activeLinks})` : `Off (${totalLinks - activeLinks})`}
                    </button>
                  ))}
                </div>

                <div className="relative shrink-0">
                  <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortType)}
                    className="pl-3 pr-7 py-2 text-[12px] font-medium rounded-lg outline-none cursor-pointer appearance-none text-[#A1A1AA] bg-[#09090B] border border-[#27272A]">
                    <option value="newest">Newest</option>
                    <option value="oldest">Oldest</option>
                    <option value="name">A-Z</option>
                    <option value="clicks">Clicks</option>
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[#52525B] pointer-events-none" />
                </div>

                <div className="hidden sm:flex gap-0.5 rounded-lg p-[3px] shrink-0 bg-[#09090B] border border-[#27272A]">
                  <button onClick={() => setViewMode("list")} className={`p-1.5 rounded-md transition-all ${viewMode === "list" ? "bg-[#27272A] text-[#FAFAFA]" : "text-[#52525B] hover:text-[#A1A1AA]"}`} title="List view"><LayoutList className="w-3.5 h-3.5" /></button>
                  <button onClick={() => setViewMode("grid")} className={`p-1.5 rounded-md transition-all ${viewMode === "grid" ? "bg-[#27272A] text-[#FAFAFA]" : "text-[#52525B] hover:text-[#A1A1AA]"}`} title="Grid view"><LayoutGrid className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            </div>

            {((folders as any[]).length > 0 || (tags as any[]).length > 0) && (
              <div className="flex flex-wrap gap-2 items-center mt-2.5 pt-2.5 border-t border-[#27272A]">
                <Filter className="w-3.5 h-3.5 text-[#52525B] shrink-0" />
                {(folders as any[]).length > 0 && (
                  <div className="relative shrink-0">
                    <FolderOpen className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#52525B] pointer-events-none" />
                    <select value={folderFilter} onChange={(e) => setFolderFilter(e.target.value)}
                      className="pl-8 pr-7 py-1.5 text-[12px] font-medium rounded-lg outline-none cursor-pointer appearance-none text-[#A1A1AA] bg-[#09090B] border border-[#27272A] hover:border-[#3F3F46] transition-colors">
                      <option value="">All folders</option>
                      {(folders as any[]).map((f) => (<option key={f.id} value={f.id}>{f.name}</option>))}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[#52525B] pointer-events-none" />
                  </div>
                )}
                {(tags as any[]).length > 0 && (
                  <div className="relative shrink-0">
                    <Tag className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#52525B] pointer-events-none" />
                    <select value={tagFilter} onChange={(e) => setTagFilter(e.target.value)}
                      className="pl-8 pr-7 py-1.5 text-[12px] font-medium rounded-lg outline-none cursor-pointer appearance-none text-[#A1A1AA] bg-[#09090B] border border-[#27272A] hover:border-[#3F3F46] transition-colors">
                      <option value="">All tags</option>
                      {(tags as any[]).map((t) => (<option key={t.id} value={t.id}>{t.name}</option>))}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[#52525B] pointer-events-none" />
                  </div>
                )}
                {hasActiveFilters && (
                  <button onClick={() => { setFolderFilter(""); setTagFilter(""); setSearch(""); setFilter("all"); }} className="flex items-center gap-1 text-[11px] font-medium text-[#52525B] hover:text-[#FCA5A5] transition-colors ml-1">
                    <X className="w-3 h-3" /> Clear
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Content */}
          <div className="rounded-b-xl overflow-visible bg-[#18181B] border border-[#27272A] border-t-0" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }}>
            <div className="h-px bg-[#27272A]" />

            {isLoading ? (
              <div className="py-24 flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-5 h-5 animate-spin text-[#8B5CF6]" />
                <p className="text-[13px] text-[#52525B]">Loading links...</p>
              </div>
            ) : filteredLinks.length === 0 ? (
              <div className="py-24 flex flex-col items-center justify-center gap-4 text-center px-6">
                <div className="w-14 h-14 rounded-xl flex items-center justify-center bg-[#8B5CF6]/10 border border-[#8B5CF6]/15">
                  <LinkIcon className="w-6 h-6 text-[#8B5CF6]" />
                </div>
                <div>
                  <p className="text-[15px] font-bold text-[#FAFAFA]">{search ? "No links match your search" : "No links yet"}</p>
                  <p className="text-[13px] text-[#52525B] mt-1.5 max-w-[340px]">{search ? "Try a different keyword or clear your filters." : "Create your first shortened link to start tracking clicks."}</p>
                </div>
                {!search && (
                  <button onClick={handleCreate} className="inline-flex items-center gap-2 text-white text-[13px] font-semibold px-4 py-2 rounded-lg transition-all active:scale-[0.97]" style={{ background: "linear-gradient(135deg, #8B5CF6, #7C3AED)", boxShadow: "0 2px 10px rgba(139,92,246,0.2)" }}>
                    <Plus className="w-4 h-4" strokeWidth={2.5} /> Create your first link
                  </button>
                )}
              </div>
            ) : viewMode === "grid" ? (
              <div className="p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredLinks.map((link) => (
                  <LinkGridCard key={link.id} link={link} clicks={clickCounts[link.id]?.total ?? 0} uniqueClicks={clickCounts[link.id]?.unique ?? 0} maxClicks={maxClicks} sparkline={sparklines[link.id]?.sparkline ?? [0,0,0,0,0,0,0]} topCountry={sparklines[link.id]?.topCountry ?? null} shortUrl={getShortUrl(link)} isCopied={copiedId === link.id} isSelected={selectedIds.has(link.id)} folderMap={folderMap} onCopy={() => handleCopy(link)} onEdit={() => handleEdit(link)} onDelete={() => handleDelete(link.id)} onToggle={() => handleToggle(link)} onQr={() => setQrLink(link)} onDuplicate={() => handleDuplicate(link)} onSelect={() => toggleSelect(link.id)} isToggling={togglingId === link.id} isDuplicating={duplicatingId === link.id} />
                ))}
              </div>
            ) : (
              <div>
                <div className="divide-y divide-[#27272A]">
                  {filteredLinks.map((link) => (
                    <LinkListRow key={link.id} link={link} clicks={clickCounts[link.id]?.total ?? 0} uniqueClicks={clickCounts[link.id]?.unique ?? 0} maxClicks={maxClicks} sparkline={sparklines[link.id]?.sparkline ?? [0,0,0,0,0,0,0]} topCountry={sparklines[link.id]?.topCountry ?? null} shortUrl={getShortUrl(link)} isCopied={copiedId === link.id} isSelected={selectedIds.has(link.id)} folderMap={folderMap} onCopy={() => handleCopy(link)} onEdit={() => handleEdit(link)} onDelete={() => handleDelete(link.id)} onToggle={() => handleToggle(link)} onQr={() => setQrLink(link)} onDuplicate={() => handleDuplicate(link)} onSelect={() => toggleSelect(link.id)} isToggling={togglingId === link.id} isDuplicating={duplicatingId === link.id} openMenuId={openMenuId} setOpenMenuId={setOpenMenuId} />
                  ))}
                </div>
                <div className="px-5 py-3 flex items-center justify-between border-t border-[#27272A]">
                  <p className="text-[12px] text-[#52525B]">Showing <span className="font-medium text-[#A1A1AA]">{filteredLinks.length}</span> of <span className="font-medium text-[#A1A1AA]">{totalLinks}</span> links</p>
                  {selectedIds.size > 0 && <p className="text-[12px] font-semibold text-[#8B5CF6]">{selectedIds.size} selected</p>}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <LinkModal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setPrefilledSlug(undefined); }} link={editingLink} initialSlug={editingLink ? undefined : prefilledSlug} />
      <QrModal link={qrLink} onClose={() => setQrLink(null)} domainMap={domainMap} />
    </ProtectedLayout>
  );
}

/* ── LinkListRow ── */
function LinkListRow({
  link, clicks, uniqueClicks, maxClicks, sparkline, topCountry, shortUrl, isCopied, isSelected, folderMap,
  onCopy, onEdit, onDelete, onToggle, onQr, onDuplicate, onSelect, isToggling, isDuplicating,
  openMenuId, setOpenMenuId,
}: {
  link: Link; clicks: number; uniqueClicks: number; maxClicks: number; sparkline: number[]; topCountry: string | null;
  shortUrl: string; isCopied: boolean; isSelected: boolean;
  folderMap: Record<string, { name: string; color: string }>;
  onCopy: () => void; onEdit: () => void; onDelete: () => void; onToggle: () => void;
  onQr: () => void; onDuplicate: () => void; onSelect: () => void;
  isToggling: boolean; isDuplicating: boolean;
  openMenuId: string | null; setOpenMenuId: (id: string | null) => void;
}) {
  const domain = getDomain(link.destinationUrl);
  const countryFlag = topCountry ? (COUNTRY_FLAGS[topCountry] ?? topCountry) : null;
  const linkFolderId = (link as any).folderId;
  const linkTags: Array<{ id: string; name: string; color: string }> = (link as any).tags ?? [];
  const folder = linkFolderId ? folderMap[linkFolderId] : null;
  const shortDomain = getShortDomain(shortUrl);
  const displayShortUrl = shortDomain ? `${shortDomain}/${link.slug}` : `/r/${link.slug}`;

  return (
    <div className={`group transition-all duration-150 ${isSelected ? "bg-[#8B5CF6]/5" : "hover:bg-[#27272A]/30"}`}
      style={isSelected ? { boxShadow: "inset 3px 0 0 #8B5CF6" } : undefined}>
      <div className="flex items-center gap-4 px-5 py-3.5">
        <button onClick={onSelect} className="text-[#3F3F46] hover:text-[#8B5CF6] transition-colors shrink-0 hidden sm:block">
          {isSelected ? <CheckSquare className="w-4 h-4 text-[#8B5CF6]" /> : <Square className="w-4 h-4" />}
        </button>

        <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 overflow-hidden bg-[#27272A] border border-[#3F3F46]/30">
          <img src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`} alt="" className="w-4.5 h-4.5"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; (e.target as HTMLImageElement).parentElement!.innerHTML = '<svg class="w-4 h-4 text-[#52525B]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>'; }}
          />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <a href={shortUrl} target="_blank" rel="noopener noreferrer" className="text-[14px] font-semibold text-[#FAFAFA] hover:text-[#A78BFA] transition-colors truncate">{displayShortUrl}</a>
            <button onClick={(e) => { e.preventDefault(); onCopy(); }} className={`w-5 h-5 flex items-center justify-center rounded-md transition-all shrink-0 ${isCopied ? "text-[#4ADE80] bg-[#4ADE80]/10" : "text-[#3F3F46] hover:text-[#A78BFA] hover:bg-[#27272A]"}`} title="Copy short URL">
              {isCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            </button>
            {!link.enabled && <span className="shrink-0 text-[10px] font-bold text-[#FCA5A5] bg-[#FCA5A5]/10 px-1.5 py-0.5 rounded-md leading-none uppercase tracking-wider">off</span>}
          </div>
          <div className="flex items-center gap-1.5">
            <ArrowUpRight className="w-3 h-3 text-[#3F3F46] shrink-0" />
            <a href={link.destinationUrl} target="_blank" rel="noopener noreferrer" className="text-[12px] text-[#52525B] hover:text-[#71717A] truncate transition-colors max-w-[400px]" title={link.destinationUrl}>{link.destinationUrl}</a>
          </div>
          {(link.title || folder || linkTags.length > 0) && (
            <div className="flex items-center flex-wrap gap-1.5 mt-1.5">
              {link.title && <span className="text-[11px] text-[#52525B]">{link.title}</span>}
              {link.title && (folder || linkTags.length > 0) && <span className="text-[#27272A]">|</span>}
              {folder && <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-[#27272A] text-[#71717A]"><FolderOpen className="w-2.5 h-2.5" />{folder.name}</span>}
              {linkTags.map((t) => <span key={t.id} className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-md" style={{ backgroundColor: `${t.color}15`, color: t.color }}><Tag className="w-2.5 h-2.5" />{t.name}</span>)}
            </div>
          )}
        </div>

        <div className="hidden md:flex items-center gap-4 shrink-0">
          <div className="flex flex-col items-center gap-0.5">
            <Sparkline data={sparkline} color={clicks > 0 ? "#8B5CF6" : "#3F3F46"} />
            {countryFlag && <span className="text-[10px] leading-none" title={topCountry ?? ""}>{countryFlag}</span>}
          </div>
          <div className="text-right w-[80px]">
            <span className="text-[15px] font-bold text-[#FAFAFA] tabular-nums block font-[family-name:var(--font-space-grotesk)]">{clicks.toLocaleString()}</span>
            <span className="text-[10px] text-[#52525B] tabular-nums">{uniqueClicks.toLocaleString()} uniq</span>
          </div>
          <div className="text-[11px] text-[#52525B] w-[72px] text-right hidden lg:block" title={format(new Date(link.createdAt), "MMM d, yyyy h:mm a")}>{formatDistanceToNow(new Date(link.createdAt), { addSuffix: true })}</div>
          <div className="flex items-center gap-0.5 pl-2 border-l border-[#27272A]">
            <button onClick={() => window.open(`/analytics/${link.id}`, "_self")} className="w-8 h-8 flex items-center justify-center rounded-lg text-[#3F3F46] hover:text-[#A78BFA] hover:bg-[#27272A] transition-all" title="Analytics"><BarChart3 className="w-3.5 h-3.5" /></button>
            <button onClick={onQr} className="w-8 h-8 flex items-center justify-center rounded-lg text-[#3F3F46] hover:text-[#A78BFA] hover:bg-[#27272A] transition-all" title="QR Code"><QrCode className="w-3.5 h-3.5" /></button>
            <div className="relative">
              <button onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === link.id ? null : link.id); }} className="w-8 h-8 flex items-center justify-center rounded-lg text-[#3F3F46] hover:text-[#A1A1AA] hover:bg-[#27272A] transition-all" title="More"><MoreHorizontal className="w-4 h-4" /></button>
              {openMenuId === link.id && (
                <div className="absolute right-0 top-full mt-1 w-44 rounded-xl z-30 py-1 bg-[#18181B] border border-[#27272A]" style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.5)" }}>
                  <MenuBtn onClick={() => { onEdit(); setOpenMenuId(null); }} icon={<Edit2 className="w-3.5 h-3.5" />}>Edit</MenuBtn>
                  <MenuBtn onClick={() => { onToggle(); setOpenMenuId(null); }} icon={isToggling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : link.enabled ? <ToggleLeft className="w-3.5 h-3.5" /> : <ToggleRight className="w-3.5 h-3.5" />}>{link.enabled ? "Disable" : "Enable"}</MenuBtn>
                  <MenuBtn onClick={() => { onDuplicate(); setOpenMenuId(null); }} icon={isDuplicating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Layers className="w-3.5 h-3.5" />}>Duplicate</MenuBtn>
                  <div className="my-1 border-t border-[#27272A]" />
                  <MenuBtn onClick={() => { onDelete(); setOpenMenuId(null); }} icon={<Trash2 className="w-3.5 h-3.5" />} danger>Delete</MenuBtn>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex md:hidden items-center gap-1 shrink-0">
          <div className="text-right mr-2">
            <span className="text-[13px] font-bold text-[#FAFAFA] tabular-nums block">{clicks.toLocaleString()}</span>
            <span className="text-[10px] text-[#52525B]">clicks</span>
          </div>
          <button onClick={onCopy} className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all ${isCopied ? "text-[#4ADE80]" : "text-[#3F3F46]"}`}>
            {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
          <button onClick={onEdit} className="w-8 h-8 flex items-center justify-center rounded-lg text-[#3F3F46]"><MoreHorizontal className="w-4 h-4" /></button>
        </div>
      </div>
    </div>
  );
}

/* ── LinkGridCard ── */
function LinkGridCard({
  link, clicks, uniqueClicks, maxClicks, sparkline, topCountry, shortUrl, isCopied, isSelected, folderMap,
  onCopy, onEdit, onDelete, onToggle, onQr, onDuplicate, onSelect, isToggling, isDuplicating,
}: {
  link: Link; clicks: number; uniqueClicks: number; maxClicks: number; sparkline: number[]; topCountry: string | null;
  shortUrl: string; isCopied: boolean; isSelected: boolean;
  folderMap: Record<string, { name: string; color: string }>;
  onCopy: () => void; onEdit: () => void; onDelete: () => void; onToggle: () => void;
  onQr: () => void; onDuplicate: () => void; onSelect: () => void;
  isToggling: boolean; isDuplicating: boolean;
}) {
  const domain = getDomain(link.destinationUrl);
  const countryFlag = topCountry ? (COUNTRY_FLAGS[topCountry] ?? topCountry) : null;
  const linkFolderId = (link as any).folderId;
  const linkTags: Array<{ id: string; name: string; color: string }> = (link as any).tags ?? [];
  const folder = linkFolderId ? folderMap[linkFolderId] : null;
  const clickPercent = maxClicks > 0 ? (clicks / maxClicks) * 100 : 0;
  const shortDomain = getShortDomain(shortUrl);
  const displayShortUrl = shortDomain ? `${shortDomain}/${link.slug}` : `/r/${link.slug}`;

  return (
    <div className={`relative overflow-hidden rounded-xl p-4 transition-all duration-200 group ${isSelected ? "ring-1 ring-[#8B5CF6]/40" : ""}`}
      style={{ background: isSelected ? "rgba(139,92,246,0.05)" : "#18181B", border: isSelected ? "1px solid rgba(139,92,246,0.3)" : "1px solid #27272A" }}>
      <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: link.enabled ? "linear-gradient(90deg, #8B5CF6, #06B6D4)" : "#3F3F46" }} />

      <button onClick={onSelect} className="absolute top-3 right-3 text-[#3F3F46] hover:text-[#8B5CF6] transition-colors opacity-0 group-hover:opacity-100">
        {isSelected ? <CheckSquare className="w-4 h-4 text-[#8B5CF6]" /> : <Square className="w-4 h-4" />}
      </button>

      <div className="flex items-center gap-2.5 mb-2.5">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 overflow-hidden bg-[#27272A] border border-[#3F3F46]/30">
          <img src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`} alt="" className="w-4 h-4" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <a href={shortUrl} target="_blank" rel="noopener noreferrer" className="text-[13px] font-semibold text-[#FAFAFA] hover:text-[#A78BFA] truncate transition-colors">{displayShortUrl}</a>
            <button onClick={(e) => { e.preventDefault(); onCopy(); }} className={`w-4 h-4 flex items-center justify-center rounded shrink-0 transition-colors ${isCopied ? "text-[#4ADE80]" : "text-[#3F3F46] hover:text-[#A78BFA]"}`}>
              {isCopied ? <Check className="w-2.5 h-2.5" /> : <Copy className="w-2.5 h-2.5" />}
            </button>
          </div>
          {link.title && <span className="text-[11px] text-[#52525B] truncate block">{link.title}</span>}
        </div>
      </div>

      <div className="flex items-center gap-1 mb-3">
        <ArrowUpRight className="w-3 h-3 text-[#3F3F46] shrink-0" />
        <p className="text-[11px] text-[#52525B] truncate" title={link.destinationUrl}>{link.destinationUrl}</p>
      </div>

      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="flex items-baseline gap-1">
            <span className="text-[18px] font-[family-name:var(--font-space-grotesk)] font-bold text-[#FAFAFA] tabular-nums leading-none">{clicks.toLocaleString()}</span>
            <span className="text-[11px] text-[#52525B] font-medium">clicks</span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] text-[#3F3F46] tabular-nums">{uniqueClicks.toLocaleString()} unique</span>
            {countryFlag && <span className="text-[10px]">{countryFlag}</span>}
          </div>
        </div>
        <Sparkline data={sparkline} color={clicks > 0 ? "#8B5CF6" : "#3F3F46"} />
      </div>

      <div className="w-full h-1 rounded-full mb-3 overflow-hidden bg-[#27272A]">
        <div className="h-full rounded-full transition-all duration-700 ease-out" style={{ width: `${clickPercent}%`, background: clickPercent > 50 ? "linear-gradient(90deg, #8B5CF6, #06B6D4)" : clickPercent > 20 ? "linear-gradient(90deg, #8B5CF6, #A78BFA)" : "#3F3F46" }} />
      </div>

      {(folder || linkTags.length > 0) && (
        <div className="flex flex-wrap gap-1 mb-3">
          {folder && <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-[#27272A] text-[#71717A]"><FolderOpen className="w-2.5 h-2.5" />{folder.name}</span>}
          {linkTags.map((t) => <span key={t.id} className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-md" style={{ backgroundColor: `${t.color}15`, color: t.color }}><Tag className="w-2.5 h-2.5" />{t.name}</span>)}
        </div>
      )}

      <div className="flex items-center justify-between pt-3 border-t border-[#27272A]">
        <div className="flex items-center gap-2">
          <button onClick={onToggle} disabled={isToggling} className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-md transition-all ${link.enabled ? "text-[#4ADE80]" : "text-[#71717A]"} disabled:opacity-50`} style={{ background: link.enabled ? "rgba(74,222,128,0.08)" : "#27272A" }}>
            {isToggling ? <Loader2 className="w-3 h-3 animate-spin" /> : link.enabled ? <span className="w-1.5 h-1.5 rounded-full bg-[#4ADE80]" /> : <span className="w-1.5 h-1.5 rounded-full bg-[#3F3F46]" />}
            {link.enabled ? "Active" : "Off"}
          </button>
          <span className="text-[10px] text-[#3F3F46]">{formatDistanceToNow(new Date(link.createdAt), { addSuffix: true })}</span>
        </div>
        <div className="flex items-center gap-0.5">
          <button onClick={() => window.open(`/analytics/${link.id}`, "_self")} className="w-7 h-7 flex items-center justify-center rounded-md text-[#3F3F46] hover:text-[#A78BFA] hover:bg-[#27272A] transition-all" title="Analytics"><BarChart3 className="w-3 h-3" /></button>
          <button onClick={onQr} className="w-7 h-7 flex items-center justify-center rounded-md text-[#3F3F46] hover:text-[#A78BFA] hover:bg-[#27272A] transition-all" title="QR Code"><QrCode className="w-3 h-3" /></button>
          <button onClick={onEdit} className="w-7 h-7 flex items-center justify-center rounded-md text-[#3F3F46] hover:text-[#A78BFA] hover:bg-[#27272A] transition-all" title="Edit"><Edit2 className="w-3 h-3" /></button>
          <button onClick={onDelete} className="w-7 h-7 flex items-center justify-center rounded-md text-[#3F3F46] hover:text-[#FCA5A5] hover:bg-[#FCA5A5]/8 transition-all" title="Delete"><Trash2 className="w-3 h-3" /></button>
        </div>
      </div>
    </div>
  );
}

/* ── Utility components ── */
function MenuBtn({ children, onClick, icon, danger }: { children: React.ReactNode; onClick: () => void; icon: React.ReactNode; danger?: boolean }) {
  return (
    <button onClick={onClick} className={`w-full flex items-center gap-2.5 px-3 py-2 text-[12px] font-medium transition-colors ${danger ? "text-[#FCA5A5] hover:bg-[#FCA5A5]/8" : "text-[#A1A1AA] hover:bg-[#27272A]"}`}>
      <span className={danger ? "text-[#FCA5A5]" : "text-[#52525B]"}>{icon}</span>
      {children}
    </button>
  );
}

function BulkBtn({ children, onClick, disabled, color }: { children: React.ReactNode; onClick: () => void; disabled: boolean; color: "green" | "gray" | "red" }) {
  const colorMap = { green: "bg-white/10 hover:bg-[#16A34A] text-white", gray: "bg-white/10 hover:bg-white/20 text-white", red: "bg-white/10 hover:bg-[#EF4444] text-white" };
  return (
    <button onClick={onClick} disabled={disabled} className={`inline-flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-lg transition-all disabled:opacity-50 ${colorMap[color]}`}>
      {children}
    </button>
  );
}
