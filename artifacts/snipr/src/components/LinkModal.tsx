"use client";
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { 
  useCreateLink, 
  useUpdateLink, 
  getGetLinksQueryKey,
  useGetFolders,
  useGetTags,
  useGetLinkTags,
  getGetLinkTagsQueryKey,
  useSetLinkTags,
  useSuggestSlugs,
  type Link
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Settings2, ChevronDown, ChevronUp, Link as LinkIcon, ShieldAlert, Sparkles, Loader2 } from "lucide-react";

const formSchema = z.object({
  destinationUrl: z.string().url({ message: "Must be a valid URL" }),
  slug: z.string().optional(),
  title: z.string().optional(),
  expiresAt: z.string().optional(),
  enabled: z.boolean().default(true),
  password: z.string().optional(),
  clickLimit: z.preprocess((val) => {
    if (val === "" || val === null || val === undefined) return null;
    const num = Number(val);
    return isNaN(num) ? null : num;
  }, z.number().nullable().optional()),
  fallbackUrl: z.union([z.literal(""), z.string().url()]).optional().nullable(),
  folderId: z.string().optional().nullable(),
  tagIds: z.array(z.string()).default([]),
});

type FormValues = z.infer<typeof formSchema>;

interface LinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  link?: Link | null;
  initialSlug?: string;
}

export function LinkModal({ isOpen, onClose, link, initialSlug }: LinkModalProps) {
  const isEdit = !!link;
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const router = useRouter();
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [slugSuggestions, setSlugSuggestions] = useState<string[]>([]);

  const { data: folders } = useGetFolders();
  const { data: tags } = useGetTags();
  const { data: linkTags } = useGetLinkTags(link?.id || "", {
    query: {
      queryKey: getGetLinkTagsQueryKey(link?.id || ""),
      enabled: !!link?.id && isOpen,
    },
  });
  
  const setTagsMutation = useSetLinkTags();
  const suggestMutation = useSuggestSlugs();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      destinationUrl: "",
      slug: "",
      title: "",
      expiresAt: "",
      enabled: true,
      password: "",
      clickLimit: null,
      fallbackUrl: "",
      folderId: "",
      tagIds: [],
    }
  });

  useEffect(() => {
    if (isOpen) {
      setShowAdvanced(false);
      setShowSuggestions(false);
      if (link) {
        form.reset({
          destinationUrl: link.destinationUrl,
          slug: link.slug,
          title: link.title || "",
          expiresAt: link.expiresAt ? new Date(link.expiresAt).toISOString().slice(0, 16) : "",
          enabled: link.enabled,
          password: "",
          clickLimit: link.clickLimit || null,
          fallbackUrl: link.fallbackUrl || "",
          folderId: link.folderId || "",
          tagIds: linkTags?.map(t => t.id) || [],
        });
      } else {
        form.reset({
          destinationUrl: "",
          slug: initialSlug ?? "",
          title: "",
          expiresAt: "",
          enabled: true,
          password: "",
          clickLimit: null,
          fallbackUrl: "",
          folderId: "",
          tagIds: [],
        });
      }
    }
  }, [isOpen, link, form, linkTags]);

  const createMutation = useCreateLink();
  const updateMutation = useUpdateLink();

  const onSubmit = async (values: FormValues) => {
    const basePayload = {
      destinationUrl: values.destinationUrl,
      slug: values.slug || null,
      title: values.title || null,
      expiresAt: values.expiresAt ? new Date(values.expiresAt).toISOString() : null,
      password: values.password || null,
      clickLimit: values.clickLimit,
      fallbackUrl: values.fallbackUrl || null,
      folderId: values.folderId || null,
    };

    try {
      if (isEdit && link) {
        await updateMutation.mutateAsync({ id: link.id, data: { ...basePayload, enabled: values.enabled } });
        await setTagsMutation.mutateAsync({ id: link.id, data: { tagIds: values.tagIds } });
        toast({ title: "Link updated successfully!" });
      } else {
        const newLink = await createMutation.mutateAsync({ data: basePayload });
        if (values.tagIds.length > 0) {
          await setTagsMutation.mutateAsync({ id: newLink.id, data: { tagIds: values.tagIds } });
        }
        toast({ title: "Link created successfully!" });
      }
      queryClient.invalidateQueries({ queryKey: getGetLinksQueryKey() });
      onClose();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "An unexpected error occurred";
      toast({ title: isEdit ? "Failed to update link" : "Failed to create link", description: message, variant: "destructive" });
    }
  };

  const handleSuggest = async () => {
    const url = form.getValues("destinationUrl");
    if (!url) return;
    try {
      const res = await suggestMutation.mutateAsync({ data: { url, title: form.getValues("title") } });
      setSlugSuggestions(res.suggestions);
      setShowSuggestions(true);
    } catch (e) {
      toast({ title: "Failed to generate suggestions", variant: "destructive" });
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending || setTagsMutation.isPending;
  const watchUrl = form.watch("destinationUrl");

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden rounded-3xl border-border/50 shadow-2xl max-h-[90vh] flex flex-col">
        <div className="p-8 bg-card flex-1 overflow-y-auto custom-scrollbar">
          <DialogHeader className="mb-6">
            <DialogTitle className="text-3xl font-display flex items-center gap-3">
              <div className="p-2.5 bg-primary/10 text-primary rounded-xl">
                <LinkIcon className="w-6 h-6" />
              </div>
              {isEdit ? "Edit Short Link" : "Create Short Link"}
            </DialogTitle>
            <DialogDescription className="text-base mt-2">
              {isEdit ? "Update your short link settings." : "Turn a long URL into a trackable short link."}
            </DialogDescription>
          </DialogHeader>

          <form id="link-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="destinationUrl" className="text-foreground font-semibold">Destination URL *</Label>
              <Input
                id="destinationUrl"
                placeholder="https://example.com/very/long/url"
                {...form.register("destinationUrl")}
                className="bg-background border-border shadow-sm focus:ring-primary/30 focus:border-primary transition-all rounded-xl h-12 text-base"
              />
              {form.formState.errors.destinationUrl && (
                <p className="text-sm text-destructive font-medium">{form.formState.errors.destinationUrl.message}</p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-end">
              <div className="space-y-2">
                <Label htmlFor="slug" className="text-foreground font-semibold">Custom Slug</Label>
                <div className="flex gap-2 relative">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 font-medium">/r/</span>
                    <Input
                      id="slug"
                      placeholder="my-campaign"
                      {...form.register("slug")}
                      className="bg-background border-border shadow-sm focus:ring-primary/30 transition-all rounded-xl h-12 pl-9"
                    />
                  </div>
                  
                  {watchUrl && (
                    <Popover open={showSuggestions} onOpenChange={setShowSuggestions}>
                      <PopoverTrigger asChild>
                        <Button 
                          type="button" 
                          variant="outline" 
                          onClick={handleSuggest}
                          disabled={suggestMutation.isPending}
                          className="h-12 w-12 rounded-xl shrink-0 border-[#E5E7EB] text-[#728DA7] hover:bg-[#728DA7]/10 hover:text-[#728DA7]"
                        >
                          {suggestMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent align="end" className="w-[280px] p-3 rounded-2xl shadow-xl">
                        <div className="text-sm font-semibold mb-3 text-muted-foreground px-1">AI Suggestions</div>
                        <div className="flex flex-wrap gap-2">
                          {slugSuggestions.map(s => (
                            <button
                              key={s}
                              type="button"
                              onClick={() => { form.setValue("slug", s); setShowSuggestions(false); }}
                              className="px-3 py-1.5 bg-secondary hover:bg-primary hover:text-primary-foreground text-secondary-foreground text-sm font-medium rounded-lg transition-colors"
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="title" className="text-foreground font-semibold">Title (optional)</Label>
                <Input
                  id="title"
                  placeholder="Summer Sale Promo"
                  {...form.register("title")}
                  className="bg-background border-border shadow-sm focus:ring-primary/30 transition-all rounded-xl h-12"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="expiresAt" className="text-foreground font-semibold">Expiration Date (optional)</Label>
              <Input
                id="expiresAt"
                type="datetime-local"
                {...form.register("expiresAt")}
                className="bg-background border-border shadow-sm focus:ring-primary/30 transition-all rounded-xl h-12"
              />
            </div>

            {isEdit && (
              <div className="flex items-center justify-between p-5 border border-[#E5E7EB] rounded-xl bg-[#F8F9FB]">
                <div className="space-y-1">
                  <Label className="text-foreground font-semibold text-base">Link Status</Label>
                  <p className="text-sm text-muted-foreground">Enable or disable this redirect.</p>
                </div>
                <Switch
                  checked={form.watch("enabled")}
                  onCheckedChange={(checked) => form.setValue("enabled", checked)}
                  className="scale-125"
                />
              </div>
            )}

            {/* Advanced Settings Toggle */}
            <div className="pt-2">
              <button 
                type="button" 
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-2 text-sm font-semibold text-primary hover:text-primary/80 transition-colors"
              >
                <Settings2 className="w-4 h-4" />
                Advanced Settings
                {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {showAdvanced && (
                <div className="mt-5 p-5 rounded-xl border border-primary/20 bg-primary/5 space-y-5 animate-in slide-in-from-top-2 fade-in duration-200">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <Label htmlFor="folderId" className="text-foreground font-semibold text-sm">Folder</Label>
                      <Select 
                        value={form.watch("folderId") || "none"} 
                        onValueChange={(val) => form.setValue("folderId", val === "none" ? null : val)}
                      >
                        <SelectTrigger className="rounded-xl h-11 bg-background">
                          <SelectValue placeholder="Select a folder" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No Folder</SelectItem>
                          {folders?.map(f => (
                            <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="clickLimit" className="text-foreground font-semibold text-sm">Click Limit</Label>
                      <Input
                        id="clickLimit"
                        type="number"
                        placeholder="e.g. 1000"
                        {...form.register("clickLimit")}
                        className="bg-background border-border rounded-xl h-11"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="fallbackUrl" className="text-foreground font-semibold text-sm">Fallback URL</Label>
                    <Input
                      id="fallbackUrl"
                      placeholder="https://example.com/expired"
                      {...form.register("fallbackUrl")}
                      className="bg-background border-border rounded-xl h-11"
                    />
                    <p className="text-xs text-muted-foreground">Redirect here if link expires, is disabled, or hits click limit.</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-foreground font-semibold text-sm flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 text-amber-500" /> Password Protection
                    </Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder={isEdit && link?.hasPassword ? "•••••••• (Leave blank to keep)" : "Enter a password..."}
                      {...form.register("password")}
                      className="bg-background border-border rounded-xl h-11"
                    />
                  </div>

                  <div className="space-y-3 pt-2">
                    <Label className="text-foreground font-semibold text-sm">Tags</Label>
                    <div className="flex flex-wrap gap-2">
                      {tags?.length === 0 && <span className="text-sm text-muted-foreground italic">No tags created yet.</span>}
                      {tags?.map(tag => (
                        <label key={tag.id} className="flex items-center gap-2 cursor-pointer bg-background border border-border px-3 py-1.5 rounded-lg hover:border-primary/50 transition-colors">
                          <Checkbox 
                            checked={form.watch("tagIds").includes(tag.id)} 
                            onCheckedChange={(checked) => {
                              const current = form.watch("tagIds");
                              if (checked) form.setValue("tagIds", [...current, tag.id]);
                              else form.setValue("tagIds", current.filter(id => id !== tag.id));
                            }} 
                          />
                          <div className="flex items-center gap-1.5 text-sm font-medium">
                            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: tag.color }} />
                            {tag.name}
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {isEdit && link && (
              <div className="pt-2 pb-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  className="w-full rounded-xl h-12 border-primary/20 text-primary hover:bg-primary/5 hover:text-primary transition-colors font-semibold"
                  onClick={() => router.push(`/links/${link.id}/rules`)}
                >
                  Configure Smart Routing Rules →
                </Button>
                <p className="text-xs text-center text-muted-foreground mt-2">Set up geo-targeting, device routing, or A/B testing.</p>
              </div>
            )}
          </form>
        </div>
        
        <DialogFooter className="p-6 bg-muted/20 border-t border-border mt-auto shrink-0">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isPending} className="rounded-xl h-12 px-6">
            Cancel
          </Button>
          <Button form="link-form" type="submit" disabled={isPending} className="rounded-xl h-12 px-8 shadow-xl shadow-primary/25 font-bold text-base hover:-translate-y-0.5 transition-all">
            {isPending ? "Saving..." : isEdit ? "Save Changes" : "Create Link"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
