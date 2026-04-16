"use client";
import { useState, useMemo } from "react";
import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { useGetPixels, useCreatePixel, useUpdatePixel, useDeletePixel, getGetPixelsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Zap, Plus, Trash2, Edit2, Loader2, Code, Copy, Check,
  Search, Info, ExternalLink, CircleDot, Calendar,
} from "lucide-react";
import type { Pixel } from "@workspace/api-client-react";

const PLATFORM_CONFIG: Record<string, {
  label: string;
  color: string;
  barColor: string;
  dotColor: string;
  icon: string;
  idLabel: string;
  idPlaceholder: string;
  helpText: string;
  helpUrl: string;
}> = {
  meta: {
    label: "Meta Pixel",
    color: "#3B82F6",
    barColor: "#3B82F6",
    dotColor: "bg-blue-500",
    icon: "f",
    idLabel: "Meta Pixel ID",
    idPlaceholder: "e.g. 1234567890",
    helpText: "Find your Pixel ID in Meta Events Manager",
    helpUrl: "https://business.facebook.com/events_manager2",
  },
  google_ads: {
    label: "Google Ads",
    color: "#EF4444",
    barColor: "#EF4444",
    dotColor: "bg-red-500",
    icon: "G",
    idLabel: "Conversion ID",
    idPlaceholder: "e.g. AW-123456789",
    helpText: "Find this in Google Ads under Tools > Conversions",
    helpUrl: "https://ads.google.com/",
  },
  linkedin: {
    label: "LinkedIn",
    color: "#0EA5E9",
    barColor: "#0EA5E9",
    dotColor: "bg-sky-500",
    icon: "in",
    idLabel: "LinkedIn Partner ID",
    idPlaceholder: "e.g. 3456789",
    helpText: "Find in LinkedIn Campaign Manager > Account Assets > Insight Tag",
    helpUrl: "https://www.linkedin.com/campaignmanager/",
  },
  tiktok: {
    label: "TikTok",
    color: "#EC4899",
    barColor: "#EC4899",
    dotColor: "bg-pink-500",
    icon: "T",
    idLabel: "TikTok Pixel ID",
    idPlaceholder: "e.g. CXXXXXXXXXXXXXXXX",
    helpText: "Find in TikTok Ads Manager > Events",
    helpUrl: "https://ads.tiktok.com/",
  },
  custom: {
    label: "Custom Script",
    color: "#A78BFA",
    barColor: "#A78BFA",
    dotColor: "bg-violet-500",
    icon: "</>",
    idLabel: "",
    idPlaceholder: "",
    helpText: "Paste any HTML or JavaScript tracking snippet",
    helpUrl: "",
  },
};

const glassCard = {
  background: "rgba(17,24,39,0.65)",
  backdropFilter: "blur(16px)",
  WebkitBackdropFilter: "blur(16px)",
  border: "1px solid rgba(255,255,255,0.06)",
  boxShadow: "0 1px 2px rgba(0,0,0,0.3), 0 8px 32px rgba(0,0,0,0.3)",
  borderRadius: "20px",
} as const;

const glassCardHover = {
  ...glassCard,
  boxShadow: "0 2px 4px rgba(0,0,0,0.4), 0 12px 40px rgba(0,0,0,0.4)",
} as const;

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function Pixels() {
  const { data: pixels, isLoading, error: pixelsError } = useGetPixels();
  const createMutation = useCreatePixel();
  const updateMutation = useUpdatePixel();
  const deleteMutation = useDeletePixel();

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editingPixel, setEditingPixel] = useState<Pixel | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Pixel | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [type, setType] = useState<string>("meta");
  const [pixelId, setPixelId] = useState("");
  const [customScript, setCustomScript] = useState("");

  const filteredPixels = useMemo(() => {
    if (!pixels) return [];
    if (!searchQuery.trim()) return pixels;
    const q = searchQuery.toLowerCase();
    return pixels.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (PLATFORM_CONFIG[p.type]?.label || "").toLowerCase().includes(q) ||
        (p.pixelId || "").toLowerCase().includes(q)
    );
  }, [pixels, searchQuery]);

  const handleOpenSheet = (pixel?: Pixel) => {
    if (pixel) {
      setEditingPixel(pixel);
      setName(pixel.name);
      setType(pixel.type);
      setPixelId(pixel.pixelId || "");
      setCustomScript(pixel.customScript || "");
    } else {
      setEditingPixel(null);
      setName("");
      setType("meta");
      setPixelId("");
      setCustomScript("");
    }
    setIsSheetOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    if (type !== "custom" && !pixelId.trim()) {
      toast({ title: "Pixel ID is required", variant: "destructive" });
      return;
    }
    if (type === "custom" && !customScript.trim()) {
      toast({ title: "Custom script is required", variant: "destructive" });
      return;
    }

    const payload: any = { name, type, pixelId, customScript };

    try {
      if (editingPixel) {
        await updateMutation.mutateAsync({ id: editingPixel.id, data: payload });
        toast({ title: "Pixel updated successfully" });
      } else {
        await createMutation.mutateAsync({ data: payload });
        toast({ title: "Pixel created successfully" });
      }
      queryClient.invalidateQueries({ queryKey: getGetPixelsQueryKey() });
      setIsSheetOpen(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      toast({ title: "Error saving pixel", description: message, variant: "destructive" });
    }
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteMutation.mutate(
      { id: deleteTarget.id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetPixelsQueryKey() });
          toast({ title: "Pixel deleted successfully" });
          setDeleteTarget(null);
        },
        onError: (err: unknown) => {
          const message = err instanceof Error ? err.message : "Something went wrong";
          toast({ title: "Failed to delete pixel", description: message, variant: "destructive" });
        },
      }
    );
  };

  const handleCopy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      toast({ title: "Copied to clipboard" });
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast({ title: "Failed to copy", description: "Clipboard access denied", variant: "destructive" });
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const cfg = PLATFORM_CONFIG[type] || PLATFORM_CONFIG.custom;

  return (
    <ProtectedLayout>
      <div className="p-6 sm:p-8 max-w-5xl mx-auto w-full">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-[14px] flex items-center justify-center"
                style={{ background: "linear-gradient(135deg, #818CF8, #A78BFA)" }}
              >
                <Zap className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="font-[family-name:var(--font-space-grotesk)] text-[22px] font-extrabold tracking-tight" style={{ color: "#F1F5F9" }}>
                    Pixels
                  </h1>
                  {pixels && pixels.length > 0 && (
                    <span
                      className="text-xs font-bold px-2.5 py-1 rounded-full"
                      style={{ background: "rgba(129,140,248,0.12)", color: "#A5B4FC" }}
                    >
                      {pixels.length}
                    </span>
                  )}
                </div>
                <p className="mt-0.5" style={{ color: "#94A3B8", fontSize: "14px" }}>
                  Add retargeting pixels to fire tracking scripts on every short link click.
                </p>
              </div>
            </div>
          </div>
          <Button
            onClick={() => handleOpenSheet()}
            className="rounded-[14px] h-11 px-6 border-0 text-white hover:-translate-y-0.5 transition-all"
            style={{
              background: "linear-gradient(135deg, #818CF8, #A78BFA)",
              boxShadow: "0 4px 16px rgba(129,140,248,0.3), 0 1px 2px rgba(129,140,248,0.2)",
            }}
          >
            <Plus className="w-5 h-5 mr-2" /> Add Pixel
          </Button>
        </div>

        {pixels && pixels.length > 0 && (
          <div className="mb-6 flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#94A3B8" }} />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search pixels..."
                className="pl-10 rounded-[14px] h-10"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "#E2E8F0",
                }}
              />
            </div>
            <div
              className="flex items-center gap-2 text-xs px-3 py-2 rounded-[14px]"
              style={{
                background: "rgba(59,130,246,0.08)",
                backdropFilter: "blur(24px)",
                WebkitBackdropFilter: "blur(24px)",
                border: "1px solid rgba(59,130,246,0.15)",
                color: "#64748B",
              }}
            >
              <Info className="w-3.5 h-3.5 shrink-0" style={{ color: "#3B82F6" }} />
              <span>Pixels fire on <strong style={{ color: "#E2E8F0" }}>all links</strong> in your workspace</span>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="py-20 flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin" style={{ color: "rgba(129,140,248,0.5)" }} />
          </div>
        ) : pixelsError ? (
          <div
            className="py-20 flex flex-col items-center justify-center text-center"
            style={{
              ...glassCard,
              border: "1px solid rgba(248,113,113,0.2)",
            }}
          >
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
              style={{ background: "rgba(248,113,113,0.1)" }}
            >
              <Zap className="w-8 h-8" style={{ color: "#F87171" }} />
            </div>
            <h3 className="font-[family-name:var(--font-space-grotesk)] text-xl font-bold mb-2" style={{ color: "#F1F5F9" }}>
              Failed to load pixels
            </h3>
            <p className="max-w-md mb-6" style={{ color: "#64748B" }}>
              Something went wrong while fetching your pixels. Please try again.
            </p>
            <Button
              onClick={() => queryClient.invalidateQueries({ queryKey: getGetPixelsQueryKey() })}
              variant="outline"
              className="rounded-[14px] h-10 px-6"
              style={{ border: "1px solid rgba(255,255,255,0.1)", color: "#E2E8F0", background: "rgba(255,255,255,0.06)" }}
            >
              Retry
            </Button>
          </div>
        ) : !pixels || pixels.length === 0 ? (
          <div
            className="py-20 flex flex-col items-center justify-center text-center"
            style={glassCard}
          >
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
              style={{ background: "linear-gradient(135deg, rgba(129,140,248,0.12), rgba(167,139,250,0.12))" }}
            >
              <Zap className="w-8 h-8" style={{ color: "#818CF8" }} />
            </div>
            <h3 className="font-[family-name:var(--font-space-grotesk)] text-xl font-bold mb-2" style={{ color: "#F1F5F9" }}>
              No retargeting pixels yet
            </h3>
            <p className="max-w-md mb-2" style={{ color: "#64748B" }}>
              Automatically fire tracking scripts (Meta, Google Ads, TikTok, LinkedIn) on every short link click.
            </p>
            <p className="text-sm max-w-md mb-6" style={{ color: "#94A3B8" }}>
              Pixels load before the redirect, so you capture every visitor for your ad audiences.
            </p>
            <Button
              onClick={() => handleOpenSheet()}
              className="rounded-[14px] h-11 px-6 border-0 text-white"
              style={{
                background: "linear-gradient(135deg, #818CF8, #A78BFA)",
                boxShadow: "0 4px 16px rgba(129,140,248,0.3), 0 1px 2px rgba(129,140,248,0.2)",
              }}
            >
              <Plus className="w-4 h-4 mr-2" /> Add Your First Pixel
            </Button>
          </div>
        ) : filteredPixels.length === 0 ? (
          <div
            className="py-16 flex flex-col items-center justify-center text-center"
            style={glassCard}
          >
            <Search className="w-8 h-8 mb-3" style={{ color: "#94A3B8" }} />
            <p className="font-medium" style={{ color: "#64748B" }}>No pixels match &quot;{searchQuery}&quot;</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredPixels.map((pixel) => {
              const pc = PLATFORM_CONFIG[pixel.type] || PLATFORM_CONFIG.custom;
              const isHovered = hoveredCardId === pixel.id;
              return (
                <Card
                  key={pixel.id}
                  className="flex flex-col h-full relative overflow-hidden group border-0 transition-all duration-200"
                  style={{
                    ...(isHovered ? glassCardHover : glassCard),
                    borderTop: `3px solid ${pc.barColor}`,
                    transform: isHovered ? "translateY(-4px)" : "translateY(0)",
                  }}
                  onMouseEnter={() => setHoveredCardId(pixel.id)}
                  onMouseLeave={() => setHoveredCardId(null)}
                >
                  <div className="p-5 pt-5 flex flex-col flex-1">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-[14px] flex items-center justify-center text-sm font-bold"
                          style={{
                            background: `rgba(${pc.color === "#3B82F6" ? "59,130,246" : pc.color === "#EF4444" ? "239,68,68" : pc.color === "#0EA5E9" ? "14,165,233" : pc.color === "#EC4899" ? "236,72,153" : "167,139,250"},0.15)`,
                            color: pc.color,
                          }}
                        >
                          {pc.icon}
                        </div>
                        <div>
                          <h3 className="font-[family-name:var(--font-space-grotesk)] text-base font-bold truncate max-w-[160px]" style={{ color: "#F1F5F9" }}>
                            {pixel.name}
                          </h3>
                          <span className="text-xs" style={{ color: "#64748B" }}>{pc.label}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-lg hover:bg-[rgba(129,140,248,0.12)] hover:text-[#818CF8]"
                          style={{ color: "#94A3B8" }}
                          onClick={() => handleOpenSheet(pixel)}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-lg hover:bg-[rgba(248,113,113,0.1)] hover:text-[#F87171]"
                          style={{ color: "#94A3B8" }}
                          onClick={() => setDeleteTarget(pixel)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>

                    <div className="mt-auto pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                      {pixel.type === "custom" ? (
                        <div className="flex items-center gap-2 text-xs" style={{ color: "#94A3B8" }}>
                          <Code className="w-3.5 h-3.5" />
                          <span>Custom script attached</span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-xs font-mono truncate max-w-[160px]" style={{ color: "#94A3B8" }}>
                            <span>ID: {pixel.pixelId}</span>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 rounded-lg shrink-0 hover:bg-[rgba(129,140,248,0.12)] hover:text-[#818CF8]"
                            style={{ color: "#94A3B8" }}
                            onClick={() => handleCopy(pixel.pixelId || "", pixel.id)}
                          >
                            {copiedId === pixel.id ? (
                              <Check className="w-3.5 h-3.5 text-[#34D399]" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </Button>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 mt-2" style={{ fontSize: "11px", color: "rgba(148,163,184,0.7)" }}>
                        <Calendar className="w-3 h-3" />
                        <span>Added {formatDate(pixel.createdAt as string)}</span>
                        <span className="mx-1">&middot;</span>
                        <CircleDot className="w-3 h-3 text-emerald-500" />
                        <span
                          className="font-medium"
                          style={{
                            background: "rgba(52,211,153,0.1)",
                            color: "#34D399",
                            padding: "1px 6px",
                            borderRadius: "6px",
                            fontSize: "11px",
                          }}
                        >
                          Active
                        </span>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent
          className="sm:max-w-md p-0 flex flex-col border-0"
          style={{
            background: "rgba(17,24,39,0.95)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            boxShadow: "0 8px 40px rgba(0,0,0,0.4), -1px 0 0 rgba(255,255,255,0.06)",
          }}
        >
          <div
            className="p-6"
            style={{
              borderBottom: "1px solid rgba(255,255,255,0.06)",
              background: "rgba(255,255,255,0.03)",
            }}
          >
            <SheetHeader>
              <SheetTitle className="font-[family-name:var(--font-space-grotesk)] text-2xl flex items-center gap-2" style={{ color: "#F1F5F9" }}>
                <div
                  className="w-8 h-8 rounded-[10px] flex items-center justify-center"
                  style={{ background: "linear-gradient(135deg, #818CF8, #A78BFA)" }}
                >
                  <Zap className="w-4 h-4 text-white" />
                </div>
                {editingPixel ? "Edit Pixel" : "Add Retargeting Pixel"}
              </SheetTitle>
              <SheetDescription style={{ color: "#64748B" }}>
                Pixels fire before the redirect, capturing every click for your ad audiences.
              </SheetDescription>
            </SheetHeader>
          </div>

          <div className="p-6 space-y-5 flex-1 overflow-y-auto">
            <div className="space-y-2">
              <Label htmlFor="name" className="font-semibold text-sm" style={{ color: "#E2E8F0" }}>
                Pixel Name
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Main Website Retargeting"
                className="rounded-[14px] h-11"
                style={{
                  border: "1px solid rgba(255,255,255,0.1)",
                  background: "rgba(255,255,255,0.05)",
                  color: "#E2E8F0",
                }}
              />
              <p className="text-xs" style={{ color: "#94A3B8" }}>A friendly name to identify this pixel.</p>
            </div>

            <div className="space-y-2">
              <Label className="font-semibold text-sm" style={{ color: "#E2E8F0" }}>Platform</Label>
              <Select value={type} onValueChange={setType} disabled={!!editingPixel}>
                <SelectTrigger
                  className="rounded-[14px] h-11"
                  style={{
                    border: "1px solid rgba(255,255,255,0.1)",
                    background: "rgba(255,255,255,0.05)",
                    color: "#E2E8F0",
                  }}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="meta">
                    <span className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded text-[10px] font-bold flex items-center justify-center" style={{ background: "rgba(59,130,246,0.15)", color: "#3B82F6" }}>f</span>
                      Meta (Facebook / Instagram)
                    </span>
                  </SelectItem>
                  <SelectItem value="google_ads">
                    <span className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded text-[10px] font-bold flex items-center justify-center" style={{ background: "rgba(239,68,68,0.15)", color: "#EF4444" }}>G</span>
                      Google Ads
                    </span>
                  </SelectItem>
                  <SelectItem value="linkedin">
                    <span className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded text-[10px] font-bold flex items-center justify-center" style={{ background: "rgba(14,165,233,0.15)", color: "#0EA5E9" }}>in</span>
                      LinkedIn
                    </span>
                  </SelectItem>
                  <SelectItem value="tiktok">
                    <span className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded text-[10px] font-bold flex items-center justify-center" style={{ background: "rgba(236,72,153,0.15)", color: "#EC4899" }}>T</span>
                      TikTok
                    </span>
                  </SelectItem>
                  <SelectItem value="custom">
                    <span className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded text-[10px] font-bold flex items-center justify-center" style={{ background: "rgba(167,139,250,0.15)", color: "#A78BFA" }}>&lt;/&gt;</span>
                      Custom HTML/JS Script
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
              {editingPixel && (
                <p className="text-xs" style={{ color: "#94A3B8" }}>Platform cannot be changed after creation.</p>
              )}
            </div>

            {type !== "custom" && (
              <div className="space-y-2 animate-in fade-in slide-in-from-bottom-2">
                <Label htmlFor="pixelId" className="font-semibold text-sm" style={{ color: "#E2E8F0" }}>
                  {cfg.idLabel}
                </Label>
                <Input
                  id="pixelId"
                  value={pixelId}
                  onChange={(e) => setPixelId(e.target.value)}
                  placeholder={cfg.idPlaceholder}
                  className="rounded-[14px] h-11 font-mono"
                  style={{
                    border: "1px solid rgba(255,255,255,0.1)",
                    background: "rgba(255,255,255,0.05)",
                    color: "#E2E8F0",
                  }}
                />
                <div className="flex items-center gap-1.5">
                  <p className="text-xs" style={{ color: "#94A3B8" }}>{cfg.helpText}</p>
                  {cfg.helpUrl && (
                    <a
                      href={cfg.helpUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs inline-flex items-center gap-0.5"
                      style={{ color: "#818CF8" }}
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            )}

            {type === "custom" && (
              <div className="space-y-2 animate-in fade-in slide-in-from-bottom-2">
                <Label htmlFor="customScript" className="font-semibold text-sm" style={{ color: "#E2E8F0" }}>
                  Custom HTML / Script
                </Label>
                <Textarea
                  id="customScript"
                  value={customScript}
                  onChange={(e) => setCustomScript(e.target.value)}
                  placeholder={"<script>\n  // Your tracking code here\n</script>"}
                  className="rounded-[14px] min-h-[180px] font-mono text-sm resize-none"
                  style={{
                    border: "1px solid rgba(255,255,255,0.1)",
                    background: "rgba(255,255,255,0.05)",
                    color: "#E2E8F0",
                  }}
                />
                <p className="text-xs" style={{ color: "#94A3B8" }}>
                  Paste any HTML or JavaScript. It will be injected into the redirect page before the user lands on the destination.
                </p>
              </div>
            )}

            <div
              className="rounded-[14px] p-3 text-xs"
              style={{
                background: "rgba(251,191,36,0.08)",
                border: "1px solid rgba(251,191,36,0.15)",
                color: "#FB923C",
              }}
            >
              <strong>How it works:</strong> When someone clicks any of your short links, this pixel fires on an
              intermediate page before they are redirected to the destination URL.
            </div>
          </div>

          <SheetFooter
            className="p-6"
            style={{
              borderTop: "1px solid rgba(255,255,255,0.06)",
              background: "rgba(255,255,255,0.03)",
            }}
          >
            <Button
              variant="ghost"
              onClick={() => setIsSheetOpen(false)}
              className="rounded-[14px] h-11 px-6"
              style={{ color: "#64748B" }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="rounded-[14px] h-11 px-8 border-0 text-white"
              style={{
                background: "linear-gradient(135deg, #818CF8, #A78BFA)",
                boxShadow: "0 4px 16px rgba(129,140,248,0.3), 0 1px 2px rgba(129,140,248,0.2)",
              }}
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...
                </>
              ) : editingPixel ? (
                "Update Pixel"
              ) : (
                "Create Pixel"
              )}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent
          className="sm:max-w-md border-0"
          style={{
            background: "rgba(17,24,39,0.95)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            boxShadow: "0 8px 40px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.3)",
            borderRadius: "20px",
          }}
        >
          <DialogHeader>
            <DialogTitle className="font-[family-name:var(--font-space-grotesk)] text-xl" style={{ color: "#F1F5F9" }}>
              Delete Pixel
            </DialogTitle>
            <DialogDescription className="pt-2" style={{ color: "#64748B" }}>
              Are you sure you want to delete{" "}
              <strong style={{ color: "#F1F5F9" }}>{deleteTarget?.name}</strong>? This will immediately
              stop the pixel from firing on all your links. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              variant="ghost"
              onClick={() => setDeleteTarget(null)}
              className="rounded-[14px] h-10"
              style={{ color: "#64748B" }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="rounded-[14px] h-10"
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" /> Delete Pixel
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ProtectedLayout>
  );
}
