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
    color: "text-blue-600 bg-blue-50 border-blue-200",
    barColor: "bg-blue-500",
    dotColor: "bg-blue-500",
    icon: "f",
    idLabel: "Meta Pixel ID",
    idPlaceholder: "e.g. 1234567890",
    helpText: "Find your Pixel ID in Meta Events Manager",
    helpUrl: "https://business.facebook.com/events_manager2",
  },
  google_ads: {
    label: "Google Ads",
    color: "text-red-600 bg-red-50 border-red-200",
    barColor: "bg-red-500",
    dotColor: "bg-red-500",
    icon: "G",
    idLabel: "Conversion ID",
    idPlaceholder: "e.g. AW-123456789",
    helpText: "Find this in Google Ads under Tools > Conversions",
    helpUrl: "https://ads.google.com/",
  },
  linkedin: {
    label: "LinkedIn",
    color: "text-sky-600 bg-sky-50 border-sky-200",
    barColor: "bg-sky-500",
    dotColor: "bg-sky-500",
    icon: "in",
    idLabel: "LinkedIn Partner ID",
    idPlaceholder: "e.g. 3456789",
    helpText: "Find in LinkedIn Campaign Manager > Account Assets > Insight Tag",
    helpUrl: "https://www.linkedin.com/campaignmanager/",
  },
  tiktok: {
    label: "TikTok",
    color: "text-pink-600 bg-pink-50 border-pink-200",
    barColor: "bg-pink-500",
    dotColor: "bg-pink-500",
    icon: "T",
    idLabel: "TikTok Pixel ID",
    idPlaceholder: "e.g. CXXXXXXXXXXXXXXXX",
    helpText: "Find in TikTok Ads Manager > Events",
    helpUrl: "https://ads.tiktok.com/",
  },
  custom: {
    label: "Custom Script",
    color: "text-violet-600 bg-violet-50 border-violet-200",
    barColor: "bg-violet-500",
    dotColor: "bg-violet-500",
    icon: "</>",
    idLabel: "",
    idPlaceholder: "",
    helpText: "Paste any HTML or JavaScript tracking snippet",
    helpUrl: "",
  },
};

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

    const payload: Record<string, string> = { name, type, pixelId, customScript };

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
              <h1 className="text-3xl font-display font-extrabold tracking-tight">Pixels</h1>
              {pixels && pixels.length > 0 && (
                <span className="text-xs font-bold bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full">
                  {pixels.length}
                </span>
              )}
            </div>
            <p className="text-muted-foreground mt-1">
              Add retargeting pixels to fire tracking scripts on every short link click.
            </p>
          </div>
          <Button
            onClick={() => handleOpenSheet()}
            className="rounded-xl h-11 px-6 shadow-lg shadow-primary/20 hover:-translate-y-0.5 transition-all"
          >
            <Plus className="w-5 h-5 mr-2" /> Add Pixel
          </Button>
        </div>

        {pixels && pixels.length > 0 && (
          <div className="mb-6 flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search pixels..."
                className="pl-10 rounded-xl h-10 bg-white"
              />
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-blue-50 border border-blue-100 px-3 py-2 rounded-xl">
              <Info className="w-3.5 h-3.5 text-blue-500 shrink-0" />
              <span>Pixels fire on <strong>all links</strong> in your workspace</span>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="py-20 flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary/50" />
          </div>
        ) : pixelsError ? (
          <div className="py-20 flex flex-col items-center justify-center text-center bg-white rounded-2xl border border-red-200 shadow-sm">
            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mb-5">
              <Zap className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold font-display mb-2">Failed to load pixels</h3>
            <p className="text-muted-foreground max-w-md mb-6">
              Something went wrong while fetching your pixels. Please try again.
            </p>
            <Button
              onClick={() => queryClient.invalidateQueries({ queryKey: getGetPixelsQueryKey() })}
              variant="outline"
              className="rounded-xl h-10 px-6"
            >
              Retry
            </Button>
          </div>
        ) : !pixels || pixels.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center text-center bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="w-16 h-16 bg-indigo-50 text-indigo-500 rounded-2xl flex items-center justify-center mb-5">
              <Zap className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold font-display mb-2">No retargeting pixels yet</h3>
            <p className="text-muted-foreground max-w-md mb-2">
              Automatically fire tracking scripts (Meta, Google Ads, TikTok, LinkedIn) on every short link click.
            </p>
            <p className="text-sm text-muted-foreground max-w-md mb-6">
              Pixels load before the redirect, so you capture every visitor for your ad audiences.
            </p>
            <Button
              onClick={() => handleOpenSheet()}
              className="rounded-xl h-11 px-6 shadow-lg shadow-primary/20"
            >
              <Plus className="w-4 h-4 mr-2" /> Add Your First Pixel
            </Button>
          </div>
        ) : filteredPixels.length === 0 ? (
          <div className="py-16 flex flex-col items-center justify-center text-center bg-white rounded-2xl border border-slate-200">
            <Search className="w-8 h-8 text-muted-foreground mb-3" />
            <p className="text-muted-foreground font-medium">No pixels match "{searchQuery}"</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredPixels.map((pixel) => {
              const pc = PLATFORM_CONFIG[pixel.type] || PLATFORM_CONFIG.custom;
              return (
                <Card
                  key={pixel.id}
                  className="rounded-2xl border-slate-200 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col h-full relative overflow-hidden group"
                >
                  <div className={`absolute top-0 left-0 w-full h-1 ${pc.barColor}`} />

                  <div className="p-5 pt-6 flex flex-col flex-1">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold ${pc.color}`}
                        >
                          {pc.icon}
                        </div>
                        <div>
                          <h3 className="text-base font-bold font-display truncate max-w-[160px]">
                            {pixel.name}
                          </h3>
                          <span className="text-xs text-muted-foreground">{pc.label}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-slate-700 rounded-lg"
                          onClick={() => handleOpenSheet(pixel)}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-red-500 rounded-lg"
                          onClick={() => setDeleteTarget(pixel)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>

                    <div className="mt-auto pt-3 border-t border-slate-100">
                      {pixel.type === "custom" ? (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Code className="w-3.5 h-3.5" />
                          <span>Custom script attached</span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground truncate max-w-[160px]">
                            <span>ID: {pixel.pixelId}</span>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-slate-700 rounded-lg shrink-0"
                            onClick={() => handleCopy(pixel.pixelId || "", pixel.id)}
                          >
                            {copiedId === pixel.id ? (
                              <Check className="w-3.5 h-3.5 text-green-500" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </Button>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/60 mt-2">
                        <Calendar className="w-3 h-3" />
                        <span>Added {formatDate(pixel.createdAt as string)}</span>
                        <span className="mx-1">·</span>
                        <CircleDot className="w-3 h-3 text-emerald-500" />
                        <span className="text-emerald-600 font-medium">Active</span>
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
        <SheetContent className="sm:max-w-md border-l border-border shadow-2xl p-0 flex flex-col">
          <div className="p-6 border-b border-slate-200 bg-slate-50/50">
            <SheetHeader>
              <SheetTitle className="text-2xl font-display flex items-center gap-2">
                <Zap className="w-5 h-5 text-indigo-500" />
                {editingPixel ? "Edit Pixel" : "Add Retargeting Pixel"}
              </SheetTitle>
              <SheetDescription>
                Pixels fire before the redirect, capturing every click for your ad audiences.
              </SheetDescription>
            </SheetHeader>
          </div>

          <div className="p-6 space-y-5 flex-1 overflow-y-auto">
            <div className="space-y-2">
              <Label htmlFor="name" className="font-semibold text-sm">
                Pixel Name
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Main Website Retargeting"
                className="rounded-xl h-11"
              />
              <p className="text-xs text-muted-foreground">A friendly name to identify this pixel.</p>
            </div>

            <div className="space-y-2">
              <Label className="font-semibold text-sm">Platform</Label>
              <Select value={type} onValueChange={setType} disabled={!!editingPixel}>
                <SelectTrigger className="rounded-xl h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="meta">
                    <span className="flex items-center gap-2">
                      <span className="w-5 h-5 bg-blue-50 text-blue-600 rounded text-[10px] font-bold flex items-center justify-center">f</span>
                      Meta (Facebook / Instagram)
                    </span>
                  </SelectItem>
                  <SelectItem value="google_ads">
                    <span className="flex items-center gap-2">
                      <span className="w-5 h-5 bg-red-50 text-red-600 rounded text-[10px] font-bold flex items-center justify-center">G</span>
                      Google Ads
                    </span>
                  </SelectItem>
                  <SelectItem value="linkedin">
                    <span className="flex items-center gap-2">
                      <span className="w-5 h-5 bg-sky-50 text-sky-600 rounded text-[10px] font-bold flex items-center justify-center">in</span>
                      LinkedIn
                    </span>
                  </SelectItem>
                  <SelectItem value="tiktok">
                    <span className="flex items-center gap-2">
                      <span className="w-5 h-5 bg-pink-50 text-pink-600 rounded text-[10px] font-bold flex items-center justify-center">T</span>
                      TikTok
                    </span>
                  </SelectItem>
                  <SelectItem value="custom">
                    <span className="flex items-center gap-2">
                      <span className="w-5 h-5 bg-violet-50 text-violet-600 rounded text-[10px] font-bold flex items-center justify-center">&lt;/&gt;</span>
                      Custom HTML/JS Script
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
              {editingPixel && (
                <p className="text-xs text-muted-foreground">Platform cannot be changed after creation.</p>
              )}
            </div>

            {type !== "custom" && (
              <div className="space-y-2 animate-in fade-in slide-in-from-bottom-2">
                <Label htmlFor="pixelId" className="font-semibold text-sm">
                  {cfg.idLabel}
                </Label>
                <Input
                  id="pixelId"
                  value={pixelId}
                  onChange={(e) => setPixelId(e.target.value)}
                  placeholder={cfg.idPlaceholder}
                  className="rounded-xl h-11 font-mono"
                />
                <div className="flex items-center gap-1.5">
                  <p className="text-xs text-muted-foreground">{cfg.helpText}</p>
                  {cfg.helpUrl && (
                    <a
                      href={cfg.helpUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-indigo-500 hover:text-indigo-600 inline-flex items-center gap-0.5"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            )}

            {type === "custom" && (
              <div className="space-y-2 animate-in fade-in slide-in-from-bottom-2">
                <Label htmlFor="customScript" className="font-semibold text-sm">
                  Custom HTML / Script
                </Label>
                <Textarea
                  id="customScript"
                  value={customScript}
                  onChange={(e) => setCustomScript(e.target.value)}
                  placeholder={"<script>\n  // Your tracking code here\n</script>"}
                  className="rounded-xl min-h-[180px] font-mono text-sm resize-none"
                />
                <p className="text-xs text-muted-foreground">
                  Paste any HTML or JavaScript. It will be injected into the redirect page before the user lands on the destination.
                </p>
              </div>
            )}

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
              <strong>How it works:</strong> When someone clicks any of your short links, this pixel fires on an
              intermediate page before they are redirected to the destination URL.
            </div>
          </div>

          <SheetFooter className="p-6 border-t border-slate-200 bg-white">
            <Button
              variant="ghost"
              onClick={() => setIsSheetOpen(false)}
              className="rounded-xl h-11 px-6"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="rounded-xl h-11 px-8 shadow-lg shadow-primary/20"
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-display">Delete Pixel</DialogTitle>
            <DialogDescription className="pt-2">
              Are you sure you want to delete{" "}
              <strong className="text-foreground">{deleteTarget?.name}</strong>? This will immediately
              stop the pixel from firing on all your links. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              variant="ghost"
              onClick={() => setDeleteTarget(null)}
              className="rounded-xl h-10"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="rounded-xl h-10"
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
