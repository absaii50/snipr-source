"use client";
import { useState, useMemo, useCallback, useEffect } from "react";
import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { useGetLinks, useDeleteLink, useUpdateLink, useGetFolders, useGetTags, useGetDomains, getGetLinksQueryKey } from "@workspace/api-client-react";
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
  BarChart3, Filter,
} from "lucide-react";

type FilterType = "all" | "active" | "disabled";
type SortType = "newest" | "oldest" | "name" | "clicks";
type ViewMode = "list" | "grid";

async function fetchLinkClicks({ signal }: { signal: AbortSignal }): Promise<Record<string, number>> {
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

function Sparkline({ data, color = "#728DA7" }: { data: number[]; color?: string }) {
  const max = Math.max(...data, 1);
  const w = 64, h = 28;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - (v / max) * h;
    return `${x},${y}`;
  });
  const hasData = data.some((v) => v > 0);
  if (!hasData) {
    return (
      <svg width={w} height={h} className="opacity-20">
        <polyline points={pts.join(" ")} fill="none" stroke="#CCCCDA" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      </svg>
    );
  }
  const gradId = `spk-${color.replace('#', '')}`;
  return (
    <svg width={w} height={h}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.25} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <polygon
        points={`0,${h} ${pts.join(" ")} ${w},${h}`}
        fill={`url(#${gradId})`}
      />
      <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

const COUNTRY_FLAGS: Record<string, string> = {
  US: "🇺🇸", GB: "🇬🇧", DE: "🇩🇪", FR: "🇫🇷", CA: "🇨🇦", AU: "🇦🇺", IN: "🇮🇳", BR: "🇧🇷",
  JP: "🇯🇵", KR: "🇰🇷", CN: "🇨🇳", MX: "🇲🇽", IT: "🇮🇹", ES: "🇪🇸", NL: "🇳🇱", RU: "🇷🇺",
  PL: "🇵🇱", SE: "🇸🇪", NO: "🇳🇴", DK: "🇩🇰", FI: "🇫🇮", TR: "🇹🇷", ID: "🇮🇩", TH: "🇹🇭",
  SG: "🇸🇬", ZA: "🇿🇦", NG: "🇳🇬", EG: "🇪🇬", AR: "🇦🇷", CL: "🇨🇱", CO: "🇨🇴", PT: "🇵🇹",
  PK: "🇵🇰", BD: "🇧🇩", VN: "🇻🇳", PH: "🇵🇭", MY: "🇲🇾", AE: "🇦🇪", SA: "🇸🇦", IE: "🇮🇪",
  CH: "🇨🇭", AT: "🇦🇹", BE: "🇧🇪", NZ: "🇳🇿", IL: "🇮🇱", KE: "🇰🇪", GH: "🇬🇭", TZ: "🇹🇿",
};

export default function Links() {
  const ST5 = 5 * 60 * 1000;
  const { data: links, isLoading } = useGetLinks(undefined, { query: { staleTime: ST5 } });
  const { data: folders = [] } = useGetFolders({ query: { staleTime: ST5 } });
  const { data: tags = [] } = useGetTags({ query: { staleTime: ST5 } });
  const { data: clickCounts = {} } = useQuery({
    queryKey: ["links-clicks"],
    queryFn: fetchLinkClicks,
    staleTime: 60_000,
  });
  const { data: sparklines = {} } = useQuery({
    queryKey: ["links-sparklines"],
    queryFn: fetchSparklines,
    staleTime: 60_000,
  });

  const { data: allDomains } = useGetDomains({ query: { staleTime: ST5 } });
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

  useEffect(() => {
    setBaseUrl(window.location.origin);
  }, []);

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
      result = result.filter(
        (l) =>
          l.slug.toLowerCase().includes(q) ||
          (l.title ?? "").toLowerCase().includes(q) ||
          l.destinationUrl.toLowerCase().includes(q)
      );
    }
    if (filter === "active") result = result.filter((l) => l.enabled);
    if (filter === "disabled") result = result.filter((l) => !l.enabled);
    if (folderFilter) result = result.filter((l) => (l as any).folderId === folderFilter);
    if (tagFilter) result = result.filter((l) => ((l as any).tags ?? []).some((t: any) => t.id === tagFilter));
    if (sortBy === "newest") result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    if (sortBy === "oldest") result.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    if (sortBy === "name") result.sort((a, b) => a.slug.localeCompare(b.slug));
    if (sortBy === "clicks") result.sort((a, b) => (clickCounts[b.id] ?? 0) - (clickCounts[a.id] ?? 0));
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
    return Math.max(...links.map((l) => clickCounts[l.id] ?? 0), 1);
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
      const res = await fetch(`/api/links/${link.id}/duplicate`, {
        method: "POST",
        credentials: "include",
      });
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
      const res = await fetch("/api/links/bulk", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed");
      queryClient.invalidateQueries({ queryKey: getGetLinksQueryKey() });
      queryClient.invalidateQueries({ queryKey: ["links-clicks"] });
      queryClient.invalidateQueries({ queryKey: ["links-sparklines"] });
      setSelectedIds(new Set());
      const actionLabels: Record<string, string> = {
        enable: "enabled", disable: "disabled", delete: "deleted",
        move: "moved", tag: "tagged",
      };
      toast({ title: `${count} links ${actionLabels[action] ?? action}` });
    } catch {
      toast({ title: "Bulk action failed", variant: "destructive" });
    } finally {
      setIsBulkLoading(false);
    }
  };

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredLinks.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredLinks.map((l) => l.id)));
    }
  };

  const totalLinks = links?.length ?? 0;
  const activeLinks = links?.filter((l) => l.enabled).length ?? 0;
  const totalClicks = Object.values(clickCounts).reduce((a, b) => a + b, 0);
  const hasActiveFilters = folderFilter || tagFilter || search || filter !== "all";

  return (
    <ProtectedLayout>
      <div className="px-4 sm:px-7 py-6 sm:py-7 max-w-[1200px] mx-auto w-full space-y-5 pt-14 lg:pt-6">

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-up">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#EEF3F7] to-[#E0EAF2] flex items-center justify-center shrink-0">
              <LinkIcon className="w-6 h-6 text-[#728DA7]" />
            </div>
            <div>
              <p className="text-[10px] font-bold tracking-[0.22em] uppercase text-[#728DA7] mb-1">Manage</p>
              <h1 className="text-[26px] font-display font-black tracking-tight text-[#0A0A0A] leading-none">Links</h1>
              <p className="text-[13px] text-[#8888A0] mt-1">Shorten, track, and manage all your URLs</p>
            </div>
          </div>
          <button
            onClick={handleCreate}
            className="inline-flex items-center gap-2 text-white text-[13px] font-semibold px-5 py-2.5 rounded-xl transition-all shrink-0 sf-btn-primary"
          >
            <Plus className="w-4 h-4" />
            New Link
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3 [&>*:nth-child(1)]:animate-fade-up [&>*:nth-child(2)]:[animation-delay:60ms] [&>*:nth-child(2)]:animate-fade-up [&>*:nth-child(3)]:[animation-delay:120ms] [&>*:nth-child(3)]:animate-fade-up">
          {[
            { icon: <LinkIcon className="w-4 h-4 text-[#728DA7]" />, bg: "bg-gradient-to-br from-[#EEF3F7] to-[#E0EAF2]", label: "Total Links", value: isLoading ? null : totalLinks, accent: "#728DA7" },
            { icon: <TrendingUp className="w-4 h-4 text-[#2E9A72]" />, bg: "bg-gradient-to-br from-[#E8F7F1] to-[#D4F0E4]", label: "Active", value: isLoading ? null : activeLinks, accent: "#2E9A72" },
            { icon: <MousePointerClick className="w-4 h-4 text-[#7C5CC4]" />, bg: "bg-gradient-to-br from-[#F0EBF9] to-[#E4DBF4]", label: "All-Time Clicks", value: totalClicks, accent: "#7C5CC4" },
          ].map((s, i) => (
            <div key={i} className="bg-white border border-[#EBEBF0] rounded-2xl p-3 sm:p-4 flex items-center gap-3 shadow-[0_1px_3px_rgba(0,0,0,0.04)] sf-card-hover">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${s.bg}`}>
                {s.icon}
              </div>
              <div className="min-w-0">
                <p className="text-[10px] sm:text-[11px] text-[#A0A0AE] font-semibold tracking-wide truncate">{s.label}</p>
                <p className="text-[18px] sm:text-[22px] font-bold text-[#0A0A0A] leading-tight tabular-nums">
                  {s.value === null ? <span className="inline-block w-8 h-5 bg-[#F2F2F6] animate-pulse rounded" /> : s.value.toLocaleString()}
                </p>
              </div>
            </div>
          ))}
        </div>

        {selectedIds.size > 0 && (
          <div className="sticky top-4 z-20 bg-[#0A0A0A] text-white rounded-2xl px-4 sm:px-5 py-3 flex items-center gap-3 sm:gap-4 shadow-lg animate-in slide-in-from-top-2 fade-in duration-200 flex-wrap">
            <span className="text-[13px] font-semibold shrink-0">{selectedIds.size} selected</span>
            <div className="flex-1 flex items-center gap-2 flex-wrap">
              <BulkBtn onClick={() => handleBulkAction("enable")} disabled={isBulkLoading} color="green">
                <ToggleRight className="w-3.5 h-3.5" /> Enable
              </BulkBtn>
              <BulkBtn onClick={() => handleBulkAction("disable")} disabled={isBulkLoading} color="gray">
                <ToggleLeft className="w-3.5 h-3.5" /> Disable
              </BulkBtn>
              {folders.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <select
                    value={moveFolderId}
                    onChange={(e) => setMoveFolderId(e.target.value)}
                    className="text-[12px] bg-white/10 border border-white/20 rounded-lg px-2 py-1.5 text-white outline-none cursor-pointer appearance-none"
                  >
                    <option value="">No folder</option>
                    {folders.map((f) => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                  <BulkBtn onClick={() => handleBulkAction("move")} disabled={isBulkLoading} color="gray">
                    <FolderInput className="w-3.5 h-3.5" /> Move
                  </BulkBtn>
                </div>
              )}
              {tags.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <select
                    value={bulkTagId}
                    onChange={(e) => setBulkTagId(e.target.value)}
                    className="text-[12px] bg-white/10 border border-white/20 rounded-lg px-2 py-1.5 text-white outline-none cursor-pointer appearance-none"
                  >
                    <option value="">Select tag</option>
                    {tags.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                  <BulkBtn onClick={() => handleBulkAction("tag")} disabled={isBulkLoading || !bulkTagId} color="gray">
                    <Globe className="w-3.5 h-3.5" /> Tag
                  </BulkBtn>
                </div>
              )}
              <BulkBtn onClick={() => handleBulkAction("delete")} disabled={isBulkLoading} color="red">
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </BulkBtn>
            </div>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="p-1.5 rounded-lg hover:bg-white/10 transition-colors shrink-0"
              title="Clear selection"
            >
              <XCircle className="w-4 h-4 text-white/60" />
            </button>
          </div>
        )}

        <div className="bg-white border border-[#EBEBF0] rounded-2xl overflow-hidden shadow-[0_1px_4px_rgba(0,0,0,0.04)]">

          <div className="px-4 sm:px-5 py-3.5 border-b border-[#F0F0F6] bg-[#FAFAFE]">
            <div className="flex flex-col sm:flex-row gap-2.5 items-start sm:items-center">
              <div className="relative flex-1 min-w-0 w-full sm:w-auto">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#C0C0CC] pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search by slug, title, or URL…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 text-[13px] bg-white border border-[#E4E4EC] rounded-xl outline-none focus:border-[#728DA7] focus:ring-2 focus:ring-[#728DA7]/10 transition-all placeholder:text-[#C0C0CC]"
                />
                {search && (
                  <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#C0C0CC] hover:text-[#0A0A0A] transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="flex gap-0.5 bg-[#F0F0F6] rounded-xl p-1 flex-1 sm:flex-initial">
                  {(["all", "active", "disabled"] as FilterType[]).map((f) => (
                    <button
                      key={f}
                      onClick={() => setFilter(f)}
                      className={`px-3 py-1.5 text-[12px] font-semibold rounded-lg transition-all capitalize flex-1 sm:flex-initial ${
                        filter === f ? "bg-white text-[#0A0A0A] shadow-sm" : "text-[#9090A0] hover:text-[#0A0A0A]"
                      }`}
                    >
                      {f === "all" ? `All (${totalLinks})` : f === "active" ? `Active (${activeLinks})` : `Off (${totalLinks - activeLinks})`}
                    </button>
                  ))}
                </div>

                <div className="relative shrink-0">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortType)}
                    className="pl-3 pr-7 py-2 text-[12px] font-medium bg-[#F0F0F6] border border-transparent rounded-xl outline-none cursor-pointer appearance-none text-[#3A3A3E] hover:bg-[#E6E6EE] transition-colors"
                  >
                    <option value="newest">Newest</option>
                    <option value="oldest">Oldest</option>
                    <option value="name">A–Z</option>
                    <option value="clicks">Clicks</option>
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[#B0B0BA] pointer-events-none" />
                </div>

                <div className="hidden sm:flex gap-0.5 bg-[#F0F0F6] rounded-xl p-1 shrink-0">
                  <button
                    onClick={() => setViewMode("list")}
                    className={`p-1.5 rounded-lg transition-all ${viewMode === "list" ? "bg-white text-[#0A0A0A] shadow-sm" : "text-[#B0B0BA] hover:text-[#0A0A0A]"}`}
                    title="List view"
                  >
                    <LayoutList className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setViewMode("grid")}
                    className={`p-1.5 rounded-lg transition-all ${viewMode === "grid" ? "bg-white text-[#0A0A0A] shadow-sm" : "text-[#B0B0BA] hover:text-[#0A0A0A]"}`}
                    title="Grid view"
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {((folders as any[]).length > 0 || (tags as any[]).length > 0) && (
              <div className="flex flex-wrap gap-2 items-center mt-2.5 pt-2.5 border-t border-[#F0F0F6]">
                <Filter className="w-3.5 h-3.5 text-[#C0C0CC] shrink-0" />
                {(folders as any[]).length > 0 && (
                  <div className="relative shrink-0">
                    <FolderOpen className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#728DA7] pointer-events-none" />
                    <select
                      value={folderFilter}
                      onChange={(e) => setFolderFilter(e.target.value)}
                      className="pl-8 pr-7 py-1.5 text-[12px] font-medium bg-white border border-[#E4E4EC] rounded-xl outline-none cursor-pointer appearance-none text-[#3A3A3E] hover:border-[#728DA7] transition-colors"
                    >
                      <option value="">All folders</option>
                      {(folders as any[]).map((f) => (
                        <option key={f.id} value={f.id}>{f.name}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[#B0B0BA] pointer-events-none" />
                  </div>
                )}
                {(tags as any[]).length > 0 && (
                  <div className="relative shrink-0">
                    <Tag className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#728DA7] pointer-events-none" />
                    <select
                      value={tagFilter}
                      onChange={(e) => setTagFilter(e.target.value)}
                      className="pl-8 pr-7 py-1.5 text-[12px] font-medium bg-white border border-[#E4E4EC] rounded-xl outline-none cursor-pointer appearance-none text-[#3A3A3E] hover:border-[#728DA7] transition-colors"
                    >
                      <option value="">All tags</option>
                      {(tags as any[]).map((t) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[#B0B0BA] pointer-events-none" />
                  </div>
                )}
                {hasActiveFilters && (
                  <button
                    onClick={() => { setFolderFilter(""); setTagFilter(""); setSearch(""); setFilter("all"); }}
                    className="flex items-center gap-1 text-[11px] font-semibold text-[#9090A0] hover:text-[#E05050] transition-colors ml-1"
                  >
                    <X className="w-3 h-3" /> Clear all
                  </button>
                )}
              </div>
            )}
          </div>

          {isLoading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#F2F2F6] flex items-center justify-center">
                <Loader2 className="w-5 h-5 animate-spin text-[#728DA7]" />
              </div>
              <p className="text-[13px] text-[#9090A0]">Loading links…</p>
            </div>
          ) : filteredLinks.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center gap-4 text-center px-6">
              <div className="w-16 h-16 rounded-2xl bg-[#F2F2F6] flex items-center justify-center">
                <LinkIcon className="w-7 h-7 text-[#CCCCDA]" />
              </div>
              <div>
                <p className="text-[15px] font-semibold text-[#0A0A0A]">
                  {search ? "No links match your search" : "No links yet"}
                </p>
                <p className="text-[13px] text-[#9090A0] mt-1 max-w-[300px]">
                  {search ? "Try a different keyword or clear the search." : "Create your first short link to start tracking clicks and conversions."}
                </p>
              </div>
              {!search && (
                <button
                  onClick={handleCreate}
                  className="inline-flex items-center gap-2 bg-[#0A0A0A] hover:bg-[#1A1A2E] text-white text-[13px] font-semibold px-5 py-2.5 rounded-xl transition-all active:scale-[0.97]"
                >
                  <Plus className="w-4 h-4" />
                  Create your first link
                </button>
              )}
            </div>
          ) : viewMode === "grid" ? (
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredLinks.map((link) => (
                <LinkGridCard
                  key={link.id}
                  link={link}
                  clicks={clickCounts[link.id] ?? 0}
                  maxClicks={maxClicks}
                  sparkline={sparklines[link.id]?.sparkline ?? [0, 0, 0, 0, 0, 0, 0]}
                  topCountry={sparklines[link.id]?.topCountry ?? null}
                  shortUrl={getShortUrl(link)}
                  isCopied={copiedId === link.id}
                  isSelected={selectedIds.has(link.id)}
                  folderMap={folderMap}
                  onCopy={() => handleCopy(link)}
                  onEdit={() => handleEdit(link)}
                  onDelete={() => handleDelete(link.id)}
                  onToggle={() => handleToggle(link)}
                  onQr={() => setQrLink(link)}
                  onDuplicate={() => handleDuplicate(link)}
                  onSelect={() => toggleSelect(link.id)}
                  isToggling={togglingId === link.id}
                  isDuplicating={duplicatingId === link.id}
                />
              ))}
            </div>
          ) : (
            <div>
              <div className="hidden md:grid grid-cols-[32px_1fr_1fr_72px_80px_80px_90px_140px] gap-2 px-5 py-2.5 bg-[#FAFAFE] border-b border-[#F0F0F6] items-center">
                <button
                  onClick={toggleSelectAll}
                  className="text-[#B0B0BA] hover:text-[#728DA7] transition-colors"
                  title="Select all"
                >
                  {selectedIds.size === filteredLinks.length && filteredLinks.length > 0
                    ? <CheckSquare className="w-4 h-4 text-[#728DA7]" />
                    : <Square className="w-4 h-4" />}
                </button>
                {["Link", "Destination", "7 day", "Clicks", "Status", "Created", ""].map((h) => (
                  <span key={h} className="text-[10px] font-bold text-[#B0B0BA] uppercase tracking-wider last:text-right">
                    {h}
                  </span>
                ))}
              </div>

              <div className="divide-y divide-[#F5F5F8]">
                {filteredLinks.map((link) => (
                  <LinkListRow
                    key={link.id}
                    link={link}
                    clicks={clickCounts[link.id] ?? 0}
                    maxClicks={maxClicks}
                    sparkline={sparklines[link.id]?.sparkline ?? [0, 0, 0, 0, 0, 0, 0]}
                    topCountry={sparklines[link.id]?.topCountry ?? null}
                    shortUrl={getShortUrl(link)}
                    isCopied={copiedId === link.id}
                    isSelected={selectedIds.has(link.id)}
                    folderMap={folderMap}
                    onCopy={() => handleCopy(link)}
                    onEdit={() => handleEdit(link)}
                    onDelete={() => handleDelete(link.id)}
                    onToggle={() => handleToggle(link)}
                    onQr={() => setQrLink(link)}
                    onDuplicate={() => handleDuplicate(link)}
                    onSelect={() => toggleSelect(link.id)}
                    isToggling={togglingId === link.id}
                    isDuplicating={duplicatingId === link.id}
                    openMenuId={openMenuId}
                    setOpenMenuId={setOpenMenuId}
                  />
                ))}
              </div>

              <div className="px-5 py-3 border-t border-[#F0F0F6] bg-[#FAFAFE] flex items-center justify-between">
                <p className="text-[11px] text-[#B0B0BA]">
                  Showing <span className="font-semibold text-[#0A0A0A]">{filteredLinks.length}</span> of{" "}
                  <span className="font-semibold text-[#0A0A0A]">{totalLinks}</span> links
                </p>
                {selectedIds.size > 0 && (
                  <p className="text-[11px] font-semibold text-[#728DA7]">{selectedIds.size} selected</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <LinkModal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setPrefilledSlug(undefined); }}
        link={editingLink}
        initialSlug={editingLink ? undefined : prefilledSlug}
      />
      <QrModal link={qrLink} onClose={() => setQrLink(null)} domainMap={domainMap} />
    </ProtectedLayout>
  );
}

function LinkListRow({
  link, clicks, maxClicks, sparkline, topCountry, shortUrl, isCopied, isSelected, folderMap,
  onCopy, onEdit, onDelete, onToggle, onQr, onDuplicate, onSelect, isToggling, isDuplicating,
  openMenuId, setOpenMenuId,
}: {
  link: Link; clicks: number; maxClicks: number; sparkline: number[]; topCountry: string | null;
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
  const clickPercent = maxClicks > 0 ? (clicks / maxClicks) * 100 : 0;

  return (
    <div className={`group transition-colors ${isSelected ? "bg-[#F4F8FF]" : "hover:bg-[#FAFAFE]"}`}>
      <div className="hidden md:grid grid-cols-[32px_1fr_1fr_72px_80px_80px_90px_140px] gap-2 px-5 py-3.5 items-center">
        <button onClick={onSelect} className="text-[#C0C0CC] hover:text-[#728DA7] transition-colors">
          {isSelected ? <CheckSquare className="w-4 h-4 text-[#728DA7]" /> : <Square className="w-4 h-4" />}
        </button>

        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-[#F2F2F6] flex items-center justify-center shrink-0 overflow-hidden">
            <img
              src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`}
              alt=""
              className="w-5 h-5 rounded"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; (e.target as HTMLImageElement).parentElement!.innerHTML = '<svg class="w-4 h-4 text-[#C0C0CC]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>'; }}
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="text-[13px] font-semibold text-[#0A0A0A] truncate">/{link.slug}</span>
              {!link.enabled && (
                <span className="shrink-0 text-[9px] font-bold uppercase tracking-wider text-[#E05050] bg-[#FFF0F0] px-1.5 py-0.5 rounded">off</span>
              )}
            </div>
            {link.title && <span className="text-[11px] text-[#9090A0] truncate block">{link.title}</span>}
            {(folder || linkTags.length > 0) && (
              <div className="flex flex-wrap gap-1 mt-1">
                {folder && (
                  <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-md" style={{ backgroundColor: `${folder.color}15`, color: folder.color }}>
                    <FolderOpen className="w-2.5 h-2.5" />{folder.name}
                  </span>
                )}
                {linkTags.map((t) => (
                  <span key={t.id} className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-md" style={{ backgroundColor: `${t.color}15`, color: t.color }}>
                    <Tag className="w-2.5 h-2.5" />{t.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="min-w-0 flex items-center gap-2">
          <span className="text-[12px] text-[#9090A0] truncate" title={link.destinationUrl}>
            {link.destinationUrl}
          </span>
        </div>

        <div className="flex flex-col items-center gap-0.5">
          <Sparkline data={sparkline} color={clicks > 0 ? "#728DA7" : "#CCCCDA"} />
          {countryFlag && <span className="text-[10px]" title={topCountry ?? ""}>{countryFlag}</span>}
        </div>

        <div className="flex flex-col items-end gap-0.5">
          <span className="text-[13px] font-bold text-[#0A0A0A] tabular-nums">{clicks.toLocaleString()}</span>
          <div className="w-full h-1 bg-[#F2F2F6] rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${clickPercent}%`, backgroundColor: clickPercent > 60 ? "#2E9A72" : clickPercent > 20 ? "#728DA7" : "#C0C0CC" }} />
          </div>
        </div>

        <div>
          <button
            onClick={onToggle}
            disabled={isToggling}
            className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-full transition-all ${
              link.enabled
                ? "bg-[#E8F7F1] text-[#2E9A72] hover:bg-[#D4F0E4]"
                : "bg-[#F2F2F6] text-[#9090A0] hover:bg-[#EAEAF0]"
            } disabled:opacity-50`}
          >
            {isToggling ? <Loader2 className="w-3 h-3 animate-spin" /> : link.enabled ? <ToggleRight className="w-3.5 h-3.5" /> : <ToggleLeft className="w-3.5 h-3.5" />}
            {link.enabled ? "Live" : "Off"}
          </button>
        </div>

        <div className="text-[11px] text-[#B0B0BA]" title={format(new Date(link.createdAt), "MMM d, yyyy h:mm a")}>
          {formatDistanceToNow(new Date(link.createdAt), { addSuffix: true })}
        </div>

        <div className="flex items-center justify-end gap-0.5">
          <button
            onClick={onCopy}
            className={`w-8 h-8 flex items-center justify-center rounded-xl transition-all shrink-0 ${isCopied ? "text-[#2E9A72] bg-[#E8F7F1]" : "text-[#C0C0CC] hover:text-[#728DA7] hover:bg-[#EEF3F7]"}`}
            title="Copy short URL"
          >
            {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
          <a
            href={shortUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-8 h-8 flex items-center justify-center rounded-xl text-[#C0C0CC] hover:text-[#728DA7] hover:bg-[#EEF3F7] transition-all"
            title="Open link"
          >
            <ArrowUpRight className="w-3.5 h-3.5" />
          </a>
          <div className="relative">
            <button
              onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === link.id ? null : link.id); }}
              className="w-8 h-8 flex items-center justify-center rounded-xl text-[#C0C0CC] hover:text-[#728DA7] hover:bg-[#EEF3F7] transition-all"
              title="More actions"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
            {openMenuId === link.id && (
              <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-[#E4E4EC] rounded-xl shadow-lg z-30 py-1 animate-in fade-in slide-in-from-top-1 duration-150">
                <MenuBtn onClick={() => { onQr(); setOpenMenuId(null); }} icon={<QrCode className="w-3.5 h-3.5" />}>QR Code</MenuBtn>
                <MenuBtn onClick={() => { onDuplicate(); setOpenMenuId(null); }} icon={isDuplicating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Layers className="w-3.5 h-3.5" />}>Duplicate</MenuBtn>
                <MenuBtn onClick={() => { onEdit(); setOpenMenuId(null); }} icon={<Edit2 className="w-3.5 h-3.5" />}>Edit</MenuBtn>
                <MenuBtn onClick={() => { window.open(`/analytics/${link.id}`, "_self"); setOpenMenuId(null); }} icon={<BarChart3 className="w-3.5 h-3.5" />}>Analytics</MenuBtn>
                <div className="border-t border-[#F0F0F6] my-1" />
                <MenuBtn onClick={() => { onDelete(); setOpenMenuId(null); }} icon={<Trash2 className="w-3.5 h-3.5" />} danger>Delete</MenuBtn>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="md:hidden px-4 py-3.5">
        <div className="flex items-start gap-3">
          <button onClick={onSelect} className="mt-0.5 text-[#C0C0CC] hover:text-[#728DA7] transition-colors shrink-0">
            {isSelected ? <CheckSquare className="w-4 h-4 text-[#728DA7]" /> : <Square className="w-4 h-4" />}
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-[#F2F2F6] flex items-center justify-center shrink-0 overflow-hidden">
                  <img
                    src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`}
                    alt=""
                    className="w-4 h-4 rounded"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                </div>
                <span className="text-[14px] font-semibold text-[#0A0A0A] truncate">/{link.slug}</span>
                {!link.enabled && (
                  <span className="shrink-0 text-[9px] font-bold uppercase tracking-wider text-[#E05050] bg-[#FFF0F0] px-1.5 py-0.5 rounded">off</span>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={onCopy} className={`w-7 h-7 flex items-center justify-center rounded-lg transition-all ${isCopied ? "text-[#2E9A72] bg-[#E8F7F1]" : "text-[#C0C0CC] hover:text-[#728DA7]"}`}>
                  {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
                <button onClick={onEdit} className="w-7 h-7 flex items-center justify-center rounded-lg text-[#C0C0CC] hover:text-[#728DA7]">
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            {link.title && <p className="text-[11px] text-[#9090A0] truncate mt-0.5">{link.title}</p>}
            <p className="text-[11px] text-[#C0C0CC] truncate mt-1">{link.destinationUrl}</p>
            <div className="flex items-center gap-3 mt-2">
              <span className="text-[12px] font-semibold text-[#0A0A0A] tabular-nums">{clicks.toLocaleString()} clicks</span>
              {countryFlag && <span className="text-[11px]">{countryFlag}</span>}
              <span className="text-[11px] text-[#B0B0BA]">{formatDistanceToNow(new Date(link.createdAt), { addSuffix: true })}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LinkGridCard({
  link, clicks, maxClicks, sparkline, topCountry, shortUrl, isCopied, isSelected, folderMap,
  onCopy, onEdit, onDelete, onToggle, onQr, onDuplicate, onSelect, isToggling, isDuplicating,
}: {
  link: Link; clicks: number; maxClicks: number; sparkline: number[]; topCountry: string | null;
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

  return (
    <div className={`relative bg-[#FAFAFE] border rounded-2xl p-4 transition-all duration-200 hover:shadow-[0_4px_20px_rgba(0,0,0,0.08)] hover:border-[#C8D0E0] hover:-translate-y-0.5 group ${isSelected ? "border-[#728DA7] bg-[#F4F8FF] shadow-sm" : "border-[#EBEBF0]"}`}>
      <button onClick={onSelect} className="absolute top-3 right-3 text-[#C0C0CC] hover:text-[#728DA7] transition-colors opacity-0 group-hover:opacity-100">
        {isSelected ? <CheckSquare className="w-4 h-4 text-[#728DA7]" /> : <Square className="w-4 h-4" />}
      </button>

      <div className="flex items-center gap-2.5 mb-3">
        <div className="w-9 h-9 rounded-xl bg-[#F2F2F6] flex items-center justify-center shrink-0 overflow-hidden">
          <img
            src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`}
            alt=""
            className="w-5 h-5 rounded"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[14px] font-bold text-[#0A0A0A] truncate">/{link.slug}</span>
          </div>
          {link.title && <span className="text-[11px] text-[#9090A0] truncate block">{link.title}</span>}
        </div>
      </div>

      <p className="text-[11px] text-[#B0B0BA] truncate mb-3" title={link.destinationUrl}>{link.destinationUrl}</p>

      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-[18px] font-bold text-[#0A0A0A] tabular-nums">{clicks.toLocaleString()}</span>
          <span className="text-[11px] text-[#B0B0BA]">clicks</span>
          {countryFlag && <span className="text-[12px] ml-1">{countryFlag}</span>}
        </div>
        <Sparkline data={sparkline} color={clicks > 0 ? "#728DA7" : "#CCCCDA"} />
      </div>

      <div className="w-full h-1 bg-[#F0F0F6] rounded-full overflow-hidden mb-3">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${clickPercent}%`, backgroundColor: clickPercent > 60 ? "#2E9A72" : clickPercent > 20 ? "#728DA7" : "#C0C0CC" }} />
      </div>

      {(folder || linkTags.length > 0) && (
        <div className="flex flex-wrap gap-1 mb-3">
          {folder && (
            <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-md" style={{ backgroundColor: `${folder.color}15`, color: folder.color }}>
              <FolderOpen className="w-2.5 h-2.5" />{folder.name}
            </span>
          )}
          {linkTags.map((t) => (
            <span key={t.id} className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-md" style={{ backgroundColor: `${t.color}15`, color: t.color }}>
              <Tag className="w-2.5 h-2.5" />{t.name}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between pt-3 border-t border-[#F0F0F6]">
        <div className="flex items-center gap-1.5">
          <button onClick={onToggle} disabled={isToggling} className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full transition-all ${link.enabled ? "bg-[#E8F7F1] text-[#2E9A72]" : "bg-[#F2F2F6] text-[#9090A0]"} disabled:opacity-50`}>
            {isToggling ? <Loader2 className="w-3 h-3 animate-spin" /> : link.enabled ? <ToggleRight className="w-3 h-3" /> : <ToggleLeft className="w-3 h-3" />}
            {link.enabled ? "Live" : "Off"}
          </button>
          <span className="text-[10px] text-[#C0C0CC]">{formatDistanceToNow(new Date(link.createdAt), { addSuffix: true })}</span>
        </div>
        <div className="flex items-center gap-0.5">
          <button onClick={onCopy} className={`w-7 h-7 flex items-center justify-center rounded-lg transition-all ${isCopied ? "text-[#2E9A72] bg-[#E8F7F1]" : "text-[#C0C0CC] hover:text-[#728DA7] hover:bg-[#EEF3F7]"}`} title="Copy">
            {isCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          </button>
          <button onClick={onQr} className="w-7 h-7 flex items-center justify-center rounded-lg text-[#C0C0CC] hover:text-[#728DA7] hover:bg-[#EEF3F7] transition-all" title="QR Code">
            <QrCode className="w-3 h-3" />
          </button>
          <button onClick={onEdit} className="w-7 h-7 flex items-center justify-center rounded-lg text-[#C0C0CC] hover:text-[#728DA7] hover:bg-[#EEF3F7] transition-all" title="Edit">
            <Edit2 className="w-3 h-3" />
          </button>
          <button onClick={onDelete} className="w-7 h-7 flex items-center justify-center rounded-lg text-[#C0C0CC] hover:text-[#E05050] hover:bg-[#FFF0F0] transition-all" title="Delete">
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}

function MenuBtn({ children, onClick, icon, danger }: { children: React.ReactNode; onClick: () => void; icon: React.ReactNode; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-[12px] font-medium transition-colors ${
        danger ? "text-[#E05050] hover:bg-[#FFF0F0]" : "text-[#3A3A3E] hover:bg-[#F6F6F9]"
      }`}
    >
      <span className={danger ? "text-[#E05050]" : "text-[#B0B0BA]"}>{icon}</span>
      {children}
    </button>
  );
}

function BulkBtn({
  children, onClick, disabled, color,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled: boolean;
  color: "green" | "gray" | "red";
}) {
  const colorMap = {
    green: "bg-white/10 hover:bg-[#2E9A72] text-white",
    gray: "bg-white/10 hover:bg-white/20 text-white",
    red: "bg-white/10 hover:bg-[#E05050] text-white",
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-lg transition-all disabled:opacity-50 ${colorMap[color]}`}
    >
      {children}
    </button>
  );
}
