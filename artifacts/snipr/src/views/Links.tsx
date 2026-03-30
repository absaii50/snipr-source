"use client";
import { useState, useMemo, useCallback, useEffect } from "react";
import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { useGetLinks, useDeleteLink, useUpdateLink, useGetFolders, useGetTags, useGetDomains, getGetLinksQueryKey } from "@workspace/api-client-react";
import { LinkModal } from "@/components/LinkModal";
import { QrModal } from "@/components/QrModal";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import type { Link } from "@workspace/api-client-react";
import {
  Plus, Edit2, Trash2, QrCode, ExternalLink, LinkIcon,
  Search, Copy, Check, ToggleLeft, ToggleRight, Loader2,
  TrendingUp, MousePointerClick, ChevronDown, Globe, Layers,
  CheckSquare, Square, XCircle, FolderInput,
} from "lucide-react";

type FilterType = "all" | "active" | "disabled";
type SortType = "newest" | "oldest" | "name" | "clicks";

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

function Sparkline({ data }: { data: number[] }) {
  const max = Math.max(...data, 1);
  const w = 56, h = 24;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - (v / max) * h;
    return `${x},${y}`;
  });
  const hasData = data.some((v) => v > 0);
  if (!hasData) {
    return (
      <svg width={w} height={h} className="opacity-30">
        <polyline points={pts.join(" ")} fill="none" stroke="#CCCCDA" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg width={w} height={h}>
      <defs>
        <linearGradient id="spkGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#728DA7" stopOpacity={0.3} />
          <stop offset="100%" stopColor="#728DA7" stopOpacity={0} />
        </linearGradient>
      </defs>
      <polygon
        points={`0,${h} ${pts.join(" ")} ${w},${h}`}
        fill="url(#spkGrad)"
      />
      <polyline points={pts.join(" ")} fill="none" stroke="#728DA7" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

const COUNTRY_FLAGS: Record<string, string> = {
  US: "🇺🇸", GB: "🇬🇧", DE: "🇩🇪", FR: "🇫🇷", CA: "🇨🇦", AU: "🇦🇺", IN: "🇮🇳", BR: "🇧🇷",
  JP: "🇯🇵", KR: "🇰🇷", CN: "🇨🇳", MX: "🇲🇽", IT: "🇮🇹", ES: "🇪🇸", NL: "🇳🇱", RU: "🇷🇺",
  PL: "🇵🇱", SE: "🇸🇪", NO: "🇳🇴", DK: "🇩🇰", FI: "🇫🇮", TR: "🇹🇷", ID: "🇮🇩", TH: "🇹🇭",
  SG: "🇸🇬", ZA: "🇿🇦", NG: "🇳🇬", EG: "🇪🇬", AR: "🇦🇷", CL: "🇨🇱", CO: "🇨🇴", PT: "🇵🇹",
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

  useEffect(() => {
    setBaseUrl(window.location.origin);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const slug = params.get("slug");
    if (slug) {
      setPrefilledSlug(slug);
      setEditingLink(null);
      setIsModalOpen(true);
      const url = new URL(window.location.href);
      url.searchParams.delete("slug");
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

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
    if (sortBy === "newest") result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    if (sortBy === "oldest") result.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    if (sortBy === "name") result.sort((a, b) => a.slug.localeCompare(b.slug));
    if (sortBy === "clicks") result.sort((a, b) => (clickCounts[b.id] ?? 0) - (clickCounts[a.id] ?? 0));
    return result;
  }, [links, search, filter, sortBy, clickCounts]);

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

  return (
    <ProtectedLayout>
      <div className="px-7 py-7 max-w-[1200px] mx-auto w-full space-y-5">

        {/* ── Header ───────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.2em] uppercase text-[#728DA7] mb-1">Manage</p>
            <h1 className="text-[22px] font-bold tracking-tight text-[#0A0A0A]">Links</h1>
            <p className="text-[13px] text-[#9090A0] mt-0.5">Shorten, track, and manage all your URLs.</p>
          </div>
          <button
            onClick={handleCreate}
            className="inline-flex items-center gap-2 bg-[#0A0A0A] hover:bg-[#1A1A2E] active:scale-[0.97] text-white text-[13px] font-semibold px-4 py-2.5 rounded-xl transition-all shadow-sm shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            New Link
          </button>
        </div>

        {/* ── KPI strip ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-3.5">
          {[
            { icon: <LinkIcon className="w-4 h-4 text-[#728DA7]" />, bg: "#EEF3F7", label: "Total Links", value: isLoading ? null : totalLinks },
            { icon: <TrendingUp className="w-4 h-4 text-[#2E9A72]" />, bg: "#E8F7F1", label: "Active", value: isLoading ? null : activeLinks },
            { icon: <MousePointerClick className="w-4 h-4 text-[#728DA7]" />, bg: "#EEF3F7", label: "All-Time Clicks", value: totalClicks },
          ].map((s, i) => (
            <div key={i} className="bg-white border border-[#EBEBF0] rounded-2xl p-4 flex items-center gap-3 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: s.bg }}>
                {s.icon}
              </div>
              <div>
                <p className="text-[11px] text-[#A0A0AE] font-semibold tracking-wide">{s.label}</p>
                <p className="text-[20px] font-bold text-[#0A0A0A] leading-tight tabular-nums">
                  {s.value === null ? <span className="inline-block w-8 h-5 bg-[#F2F2F6] animate-pulse rounded" /> : s.value.toLocaleString()}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Bulk action bar ─────────────────────────────────────────── */}
        {selectedIds.size > 0 && (
          <div className="sticky top-4 z-20 bg-[#0A0A0A] text-white rounded-2xl px-5 py-3 flex items-center gap-4 shadow-lg animate-in slide-in-from-top-2 fade-in duration-200 flex-wrap">
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

        {/* ── Table card ────────────────────────────────────────────── */}
        <div className="bg-white border border-[#EBEBF0] rounded-2xl overflow-hidden shadow-[0_1px_4px_rgba(0,0,0,0.04)]">

          {/* Toolbar */}
          <div className="px-4 py-3 border-b border-[#F2F2F6] flex flex-col sm:flex-row gap-2.5 items-start sm:items-center bg-white">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#CCCCDA] pointer-events-none" />
              <input
                type="text"
                placeholder="Search slug, title, or URL…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8.5 pr-4 py-2 text-[13px] bg-[#F6F6F9] border border-transparent rounded-xl outline-none focus:border-[#728DA7] focus:bg-white focus:ring-2 focus:ring-[#728DA7]/10 transition-all placeholder:text-[#C0C0CC]"
                style={{ paddingLeft: "2.25rem" }}
              />
            </div>

            <div className="flex gap-0.5 bg-[#F2F2F6] rounded-xl p-1 shrink-0">
              {(["all", "active", "disabled"] as FilterType[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 text-[12px] font-semibold rounded-lg transition-all capitalize ${
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
                className="pl-3 pr-8 py-2 text-[12px] font-medium bg-[#F2F2F6] border border-transparent rounded-xl outline-none cursor-pointer appearance-none text-[#3A3A3E] hover:bg-[#EAEAF0] transition-colors"
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="name">Name A–Z</option>
                <option value="clicks">Most clicks</option>
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-[#B0B0BA] pointer-events-none" />
            </div>
          </div>

          {/* Table body */}
          {isLoading ? (
            <div className="h-52 flex items-center justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-[#728DA7]/30" />
            </div>
          ) : filteredLinks.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center gap-4 text-center px-6">
              <div className="w-14 h-14 rounded-2xl bg-[#F2F2F6] flex items-center justify-center">
                <LinkIcon className="w-6 h-6 text-[#CCCCDA]" />
              </div>
              <div>
                <p className="text-[14px] font-semibold text-[#0A0A0A]">
                  {search ? "No links match your search" : "No links yet"}
                </p>
                <p className="text-[12px] text-[#9090A0] mt-1">
                  {search ? "Try a different keyword or clear the search." : "Create your first short link to get started."}
                </p>
              </div>
              {!search && (
                <button
                  onClick={handleCreate}
                  className="inline-flex items-center gap-2 bg-[#0A0A0A] hover:bg-[#1A1A2E] text-white text-[12px] font-semibold px-4 py-2 rounded-xl transition-all active:scale-[0.97]"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Create first link
                </button>
              )}
            </div>
          ) : (
            <div>
              {/* Table header */}
              <div className="hidden md:grid grid-cols-[28px_1fr_1fr_56px_80px_90px_90px_168px] gap-2 px-5 py-2.5 bg-[#FAFAFA] border-b border-[#F2F2F6] items-center">
                <button
                  onClick={toggleSelectAll}
                  className="text-[#B0B0BA] hover:text-[#728DA7] transition-colors"
                  title="Select all"
                >
                  {selectedIds.size === filteredLinks.length && filteredLinks.length > 0
                    ? <CheckSquare className="w-4 h-4 text-[#728DA7]" />
                    : <Square className="w-4 h-4" />}
                </button>
                {["Short Link", "Destination", "7d", "Clicks", "Status", "Created", "Actions"].map((h) => (
                  <span key={h} className="text-[11px] font-semibold text-[#B0B0BA] uppercase tracking-wider last:text-right">
                    {h}
                  </span>
                ))}
              </div>

              {/* Rows */}
              <div className="divide-y divide-[#F5F5F8]">
                {filteredLinks.map((link) => {
                  const shortUrl = getShortUrl(link);
                  const clicks = clickCounts[link.id] ?? 0;
                  const isCopied = copiedId === link.id;
                  const isToggling = togglingId === link.id;
                  const isDuplicating = duplicatingId === link.id;
                  const isSelected = selectedIds.has(link.id);
                  const domain = getDomain(link.destinationUrl);
                  const spData = sparklines[link.id];
                  const sparkline = spData?.sparkline ?? [0, 0, 0, 0, 0, 0, 0];
                  const topCountry = spData?.topCountry ?? null;
                  const countryFlag = topCountry ? (COUNTRY_FLAGS[topCountry] ?? topCountry) : null;

                  return (
                    <div
                      key={link.id}
                      className={`grid grid-cols-1 md:grid-cols-[28px_1fr_1fr_56px_80px_90px_90px_168px] gap-2 px-5 py-3.5 hover:bg-[#FAFAFA] transition-colors group items-center ${isSelected ? "bg-[#F4F8FF]" : ""}`}
                    >
                      {/* Checkbox */}
                      <button
                        onClick={() => toggleSelect(link.id)}
                        className="hidden md:flex text-[#C0C0CC] hover:text-[#728DA7] transition-colors"
                      >
                        {isSelected
                          ? <CheckSquare className="w-4 h-4 text-[#728DA7]" />
                          : <Square className="w-4 h-4" />}
                      </button>

                      {/* Short link */}
                      <div className="flex flex-col min-w-0">
                        <span className="text-[13px] font-semibold text-[#2D6A8A] truncate">
                          /{link.slug}
                        </span>
                        {link.title && (
                          <span className="text-[11px] text-[#B0B0BA] truncate mt-0.5">{link.title}</span>
                        )}
                      </div>

                      {/* Destination */}
                      <div className="min-w-0 hidden md:flex items-center gap-1.5">
                        <img
                          src={`https://www.google.com/s2/favicons?domain=${domain}&sz=16`}
                          alt=""
                          className="w-3.5 h-3.5 rounded shrink-0 opacity-70"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                        />
                        <span className="text-[12px] text-[#9090A0] truncate" title={link.destinationUrl}>
                          {link.destinationUrl}
                        </span>
                      </div>

                      {/* 7d Sparkline + country */}
                      <div className="hidden md:flex flex-col items-center gap-0.5">
                        <Sparkline data={sparkline} />
                        {countryFlag && (
                          <span className="text-[10px]" title={topCountry ?? ""}>{countryFlag}</span>
                        )}
                      </div>

                      {/* Clicks */}
                      <div className="hidden md:flex items-center justify-end">
                        <span className="text-[13px] font-semibold text-[#0A0A0A] tabular-nums">{clicks.toLocaleString()}</span>
                      </div>

                      {/* Status toggle */}
                      <div className="hidden md:flex items-center">
                        <button
                          onClick={() => handleToggle(link)}
                          disabled={isToggling}
                          className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1.5 rounded-full transition-all ${
                            link.enabled
                              ? "bg-[#E8F7F1] text-[#2E9A72] hover:bg-[#D4F0E4]"
                              : "bg-[#F2F2F6] text-[#9090A0] hover:bg-[#EAEAF0]"
                          } disabled:opacity-50`}
                          title={link.enabled ? "Click to disable" : "Click to enable"}
                        >
                          {isToggling ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : link.enabled ? (
                            <ToggleRight className="w-3.5 h-3.5" />
                          ) : (
                            <ToggleLeft className="w-3.5 h-3.5" />
                          )}
                          {link.enabled ? "Live" : "Off"}
                        </button>
                      </div>

                      {/* Created */}
                      <div className="hidden md:block">
                        <span className="text-[12px] text-[#B0B0BA]">
                          {format(new Date(link.createdAt), "MMM d, yyyy")}
                        </span>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center justify-end gap-0.5">
                        <ActionBtn onClick={() => handleCopy(link)} title="Copy link" active={isCopied} variant="copy">
                          {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        </ActionBtn>
                        <a
                          href={shortUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-8 h-8 flex items-center justify-center rounded-xl text-[#C0C0CC] hover:text-[#728DA7] hover:bg-[#EEF3F7] transition-all"
                          title="Open link"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                        <ActionBtn onClick={() => setQrLink(link)} title="QR Code">
                          <QrCode className="w-3.5 h-3.5" />
                        </ActionBtn>
                        <ActionBtn onClick={() => handleDuplicate(link)} title="Duplicate link" disabled={isDuplicating}>
                          {isDuplicating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Layers className="w-3.5 h-3.5" />}
                        </ActionBtn>
                        <ActionBtn onClick={() => handleEdit(link)} title="Edit">
                          <Edit2 className="w-3.5 h-3.5" />
                        </ActionBtn>
                        <ActionBtn onClick={() => handleDelete(link.id)} title="Delete" variant="danger">
                          <Trash2 className="w-3.5 h-3.5" />
                        </ActionBtn>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Footer count */}
              <div className="px-5 py-3 border-t border-[#F2F2F6] bg-[#FAFAFA] flex items-center justify-between">
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

function ActionBtn({
  children, onClick, title, variant, active, disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  title?: string;
  variant?: "default" | "danger" | "copy";
  active?: boolean;
  disabled?: boolean;
}) {
  const base = "w-8 h-8 flex items-center justify-center rounded-xl transition-all shrink-0 disabled:opacity-50 disabled:cursor-not-allowed";
  const styles = {
    default: "text-[#C0C0CC] hover:text-[#728DA7] hover:bg-[#EEF3F7]",
    danger: "text-[#C0C0CC] hover:text-[#E05050] hover:bg-[#FFF0F0]",
    copy: active
      ? "text-[#2E9A72] bg-[#E8F7F1]"
      : "text-[#C0C0CC] hover:text-[#728DA7] hover:bg-[#EEF3F7]",
  };
  return (
    <button onClick={onClick} title={title} disabled={disabled} className={`${base} ${styles[variant ?? "default"]}`}>
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
