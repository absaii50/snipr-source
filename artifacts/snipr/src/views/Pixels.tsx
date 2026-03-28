"use client";
import { useState } from "react";
import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { useGetPixels, useCreatePixel, useUpdatePixel, useDeletePixel, getGetPixelsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Zap, Plus, Trash2, Edit2, Loader2, Code } from "lucide-react";
import type { Pixel } from "@workspace/api-client-react";

const PLATFORM_COLORS: Record<string, string> = {
  meta: "text-blue-400 bg-blue-500/10 border-[#4A4A52]",
  google_ads: "text-red-400 bg-red-500/10 border-[#4A4A52]",
  linkedin: "text-sky-400 bg-sky-500/10 border-[#4A4A52]",
  tiktok: "text-pink-400 bg-pink-500/10 border-[#4A4A52]",
  custom: "text-violet-400 bg-violet-500/10 border-[#4A4A52]",
};

const PLATFORM_LABELS: Record<string, string> = {
  meta: "Meta Pixel",
  google_ads: "Google Ads",
  linkedin: "LinkedIn",
  tiktok: "TikTok",
  custom: "Custom Script",
};

export default function Pixels() {
  const { data: pixels, isLoading } = useGetPixels();
  const createMutation = useCreatePixel();
  const updateMutation = useUpdatePixel();
  const deleteMutation = useDeletePixel();
  
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editingPixel, setEditingPixel] = useState<Pixel | null>(null);
  
  // Form state
  const [name, setName] = useState("");
  const [type, setType] = useState<string>("meta");
  const [pixelId, setPixelId] = useState("");
  const [customScript, setCustomScript] = useState("");

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
        toast({ title: "Pixel updated" });
      } else {
        await createMutation.mutateAsync({ data: payload });
        toast({ title: "Pixel added successfully" });
      }
      queryClient.invalidateQueries({ queryKey: getGetPixelsQueryKey() });
      setIsSheetOpen(false);
    } catch (err: any) {
      toast({ title: "Error saving pixel", description: err.message, variant: "destructive" });
    }
  };

  const handleDelete = (id: string) => {
    if (!confirm("Are you sure you want to delete this pixel? It will immediately stop firing on all links.")) return;
    deleteMutation.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetPixelsQueryKey() });
        toast({ title: "Pixel deleted" });
      }
    });
  };

  return (
    <ProtectedLayout>
      <div className="p-8 max-w-5xl mx-auto w-full">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-display font-extrabold tracking-tight">Retargeting Pixels</h1>
            <p className="text-muted-foreground mt-1 text-lg">Automatically fire tracking scripts on your short links.</p>
          </div>
          <Button onClick={() => handleOpenSheet()} className="rounded-xl h-11 px-6 shadow-lg shadow-primary/20 hover:-translate-y-0.5 transition-all">
            <Plus className="w-5 h-5 mr-2" /> Add Pixel
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {isLoading ? (
            <div className="col-span-full py-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary/50" /></div>
          ) : !pixels || pixels.length === 0 ? (
            <div className="col-span-full py-24 flex flex-col items-center justify-center text-center bg-card rounded-3xl border border-border shadow-sm">
              <div className="w-20 h-20 bg-primary/5 text-primary rounded-full flex items-center justify-center mb-6">
                <Zap className="w-10 h-10" />
              </div>
              <h3 className="text-xl font-bold font-display mb-2">No pixels configured</h3>
              <p className="text-muted-foreground max-w-md mb-6">Build retargeting audiences across ad platforms by adding tracking pixels to your links.</p>
              <Button onClick={() => handleOpenSheet()} variant="outline" className="rounded-xl h-11 px-6">
                Add Your First Pixel
              </Button>
            </div>
          ) : (
            pixels.map((pixel) => (
              <Card key={pixel.id} className="p-6 rounded-2xl border-border shadow-sm hover:shadow-md transition-shadow flex flex-col h-full relative overflow-hidden group">
                <div className={`absolute top-0 left-0 w-full h-1.5 ${pixel.type === 'meta' ? 'bg-blue-500' : pixel.type === 'google_ads' ? 'bg-red-500' : pixel.type === 'tiktok' ? 'bg-pink-500' : pixel.type === 'linkedin' ? 'bg-sky-500' : 'bg-violet-500'}`} />
                
                <div className="flex items-start justify-between mb-4 mt-2">
                  <div className={`px-2.5 py-1 text-xs font-bold rounded-md border ${PLATFORM_COLORS[pixel.type] || PLATFORM_COLORS.custom}`}>
                    {PLATFORM_LABELS[pixel.type] || "Unknown"}
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-[#728DA7] rounded-lg" onClick={() => handleOpenSheet(pixel)}>
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive rounded-lg" onClick={() => handleDelete(pixel.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                
                <h3 className="text-xl font-bold font-display mb-1 truncate">{pixel.name}</h3>
                
                {pixel.type === 'custom' ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground font-mono mt-auto pt-4">
                    <Code className="w-4 h-4" /> Custom Script active
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground font-mono mt-auto pt-4 truncate">
                    ID: {pixel.pixelId}
                  </div>
                )}
              </Card>
            ))
          )}
        </div>
      </div>

      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="sm:max-w-md border-l border-border shadow-2xl p-0 flex flex-col">
          <div className="p-6 border-b border-border bg-muted/20">
            <SheetHeader>
              <SheetTitle className="text-2xl font-display flex items-center gap-2">
                <Zap className="w-5 h-5 text-primary" />
                {editingPixel ? "Edit Pixel" : "Add Retargeting Pixel"}
              </SheetTitle>
              <SheetDescription>
                Pixels fire before the redirect happens, ensuring you capture every click for your ad audiences.
              </SheetDescription>
            </SheetHeader>
          </div>

          <div className="p-6 space-y-6 flex-1 overflow-y-auto">
            <div className="space-y-2">
              <Label htmlFor="name" className="font-semibold">Pixel Name</Label>
              <Input 
                id="name" 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                placeholder="e.g. Main Website Meta Pixel"
                className="rounded-xl h-11"
              />
            </div>

            <div className="space-y-2">
              <Label className="font-semibold">Platform</Label>
              <Select value={type} onValueChange={setType} disabled={!!editingPixel}>
                <SelectTrigger className="rounded-xl h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="meta">Meta (Facebook/Instagram)</SelectItem>
                  <SelectItem value="google_ads">Google Ads</SelectItem>
                  <SelectItem value="linkedin">LinkedIn</SelectItem>
                  <SelectItem value="tiktok">TikTok</SelectItem>
                  <SelectItem value="custom">Custom HTML/JS Script</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {type !== "custom" && (
              <div className="space-y-2 animate-in fade-in slide-in-from-bottom-2">
                <Label htmlFor="pixelId" className="font-semibold">
                  {type === "meta" && "Meta Pixel ID"}
                  {type === "google_ads" && "Conversion ID (e.g. AW-123456)"}
                  {type === "linkedin" && "LinkedIn Partner ID"}
                  {type === "tiktok" && "TikTok Pixel ID"}
                </Label>
                <Input 
                  id="pixelId" 
                  value={pixelId} 
                  onChange={(e) => setPixelId(e.target.value)} 
                  placeholder="e.g. 1234567890"
                  className="rounded-xl h-11 font-mono"
                />
              </div>
            )}

            {type === "custom" && (
              <div className="space-y-2 animate-in fade-in slide-in-from-bottom-2">
                <Label htmlFor="customScript" className="font-semibold">Custom HTML/Script</Label>
                <Textarea 
                  id="customScript" 
                  value={customScript} 
                  onChange={(e) => setCustomScript(e.target.value)} 
                  placeholder="<script>...</script>"
                  className="rounded-xl min-h-[200px] font-mono text-sm resize-none"
                />
              </div>
            )}
          </div>

          <SheetFooter className="p-6 border-t border-border bg-card">
            <Button variant="ghost" onClick={() => setIsSheetOpen(false)} className="rounded-xl h-11 px-6">Cancel</Button>
            <Button onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending} className="rounded-xl h-11 px-8 shadow-lg shadow-primary/20">
              {createMutation.isPending || updateMutation.isPending ? "Saving..." : "Save Pixel"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </ProtectedLayout>
  );
}
