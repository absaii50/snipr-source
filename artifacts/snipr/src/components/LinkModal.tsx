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
  useGetDomains,
  type Link,
  type Domain
} from "@workspace/api-client-react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

async function fetchDefaultDomain({ signal }: { signal: AbortSignal }): Promise<{ id: string; domain: string } | null> {
  try { const r = await fetch("/api/domains/default", { credentials: "include", signal }); return r.ok ? r.json() : null; }
  catch { return null; }
}
import { Settings2, ChevronDown, ChevronUp, Link as LinkIcon, ShieldAlert, Sparkles, Loader2, EyeOff, ShieldOff, Smartphone, Globe, Lock, Target, FolderOpen, Tag, Copy, CheckCircle2, ExternalLink, QrCode, Download, X } from "lucide-react";

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
  domainId: z.string().min(1, { message: "Please select a custom domain" }),
  tagIds: z.array(z.string()).default([]),
  isCloaked: z.boolean().default(false),
  hideReferrer: z.boolean().default(false),
  iosDeepLink: z.string().optional().nullable(),
  androidDeepLink: z.string().optional().nullable(),
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
  const [createdLink, setCreatedLink] = useState<{ shortUrl: string; id: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [qrSvg, setQrSvg] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);

  const { data: folders } = useGetFolders();
  const { data: tags } = useGetTags();
  const { data: allDomains } = useGetDomains();
  const verifiedDomains: Domain[] = allDomains?.filter((d) => d.verified) ?? [];
  const { data: defaultDomain } = useQuery({ queryKey: ["default-domain"], queryFn: fetchDefaultDomain, staleTime: 10 * 60 * 1000 });
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
      domainId: "",
      tagIds: [],
      isCloaked: false,
      hideReferrer: false,
      iosDeepLink: "",
      androidDeepLink: "",
    }
  });

  useEffect(() => {
    if (isOpen) {
      setShowAdvanced(false);
      setShowSuggestions(false);
      setCreatedLink(null);
      setCopied(false);
      setQrSvg(null);
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
          domainId: link.domainId || "",
          tagIds: linkTags?.map(t => t.id) || [],
          isCloaked: link.isCloaked ?? false,
          hideReferrer: (link as any).hideReferrer ?? false,
          iosDeepLink: (link as any).iosDeepLink || "",
          androidDeepLink: (link as any).androidDeepLink || "",
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
          domainId: defaultDomain?.id ?? "",
          tagIds: [],
          isCloaked: false,
          hideReferrer: false,
          iosDeepLink: "",
          androidDeepLink: "",
        });
      }
    }
  }, [isOpen, link, form, linkTags, defaultDomain]);

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
      domainId: values.domainId,
      isCloaked: values.isCloaked,
      hideReferrer: values.hideReferrer,
      iosDeepLink: values.iosDeepLink || null,
      androidDeepLink: values.androidDeepLink || null,
    };

    try {
      if (isEdit && link) {
        await updateMutation.mutateAsync({ id: link.id, data: { ...basePayload, enabled: values.enabled } });
        await setTagsMutation.mutateAsync({ id: link.id, data: { tagIds: values.tagIds } });
        toast({ title: "Link updated successfully!" });
        queryClient.invalidateQueries({ queryKey: getGetLinksQueryKey() });
        onClose();
      } else {
        const newLink = await createMutation.mutateAsync({ data: basePayload });
        if (values.tagIds.length > 0) {
          await setTagsMutation.mutateAsync({ id: newLink.id, data: { tagIds: values.tagIds } });
        }
        queryClient.invalidateQueries({ queryKey: getGetLinksQueryKey() });
        // Build the short URL
        const dom = verifiedDomains.find(d => d.id === values.domainId);
        const shortUrl = dom ? `https://${dom.domain}/${newLink.slug}` : `${window.location.origin}/r/${newLink.slug}`;
        setCreatedLink({ shortUrl, id: newLink.id });
      }
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
  const watchDomainId = form.watch("domainId");
  const selectedDomain = verifiedDomains.find((d) => d.id === watchDomainId);
  const slugPrefix = selectedDomain ? `${selectedDomain.domain}/` : "";

  const handleCopyLink = () => {
    if (!createdLink) return;
    navigator.clipboard.writeText(createdLink.shortUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleShowQr = async () => {
    if (!createdLink || qrSvg) return;
    setQrLoading(true);
    try {
      const r = await fetch(`/api/links/${createdLink.id}/qr`, { credentials: "include" });
      if (r.ok) {
        const data = await r.json();
        setQrSvg(data.svg);
      }
    } catch {}
    setQrLoading(false);
  };

  const handleDownloadQr = () => {
    if (!qrSvg || !createdLink) return;
    // Convert SVG to downloadable PNG via canvas
    const svgBlob = new Blob([qrSvg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 512; canvas.height = 512;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, 512, 512);
        ctx.drawImage(img, 0, 0, 512, 512);
        canvas.toBlob(blob => {
          if (!blob) return;
          const a = document.createElement("a");
          a.href = URL.createObjectURL(blob);
          a.download = `qr-${createdLink.shortUrl.split("/").pop()}.png`;
          a.click();
          URL.revokeObjectURL(a.href);
        }, "image/png");
      }
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[620px] p-0 overflow-hidden border-0 shadow-2xl max-h-[90vh] flex flex-col" style={{ borderRadius: 24, background: "rgba(17,24,39,0.95)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 25px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06)" }}>

        {/* SUCCESS SCREEN */}
        {createdLink ? (
          <div className="relative">
            {/* Top gradient bar */}
            <div className="absolute top-0 left-0 right-0 h-[4px]" style={{ background: "linear-gradient(90deg, #34D399, #6EE7B7, #A7F3D0, #34D399)" }} />

            <div className="px-7 pt-8 pb-7 text-center">
              {/* Success icon */}
              <div className="w-16 h-16 rounded-full mx-auto mb-5 flex items-center justify-center" style={{ background: "linear-gradient(135deg, #34D399, #10B981)", boxShadow: "0 8px 24px rgba(52,211,153,0.3)" }}>
                <CheckCircle2 className="w-8 h-8 text-white" />
              </div>

              <h2 className="text-[22px] font-extrabold text-[#F1F5F9] tracking-[-0.02em] font-[family-name:var(--font-space-grotesk)]">
                Link Created!
              </h2>
              <p className="text-[13px] text-[#64748B] mt-1.5 font-medium">Your short link is ready to share</p>

              {/* Short URL display */}
              <div className="mt-6 flex items-center gap-2 p-1.5 mx-auto max-w-md" style={{ borderRadius: 14, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
                <div className="flex-1 px-4 py-2.5 text-left min-w-0">
                  <p className="text-[15px] font-bold text-[#F1F5F9] truncate font-[family-name:var(--font-space-grotesk)] tracking-[-0.01em]">
                    {createdLink.shortUrl.replace(/^https?:\/\//, "")}
                  </p>
                </div>
                <button
                  onClick={handleCopyLink}
                  className="shrink-0 px-4 py-2.5 text-[13px] font-bold text-white transition-all duration-200 active:scale-[0.95]"
                  style={{
                    borderRadius: 10,
                    background: copied ? "linear-gradient(135deg, #34D399, #10B981)" : "linear-gradient(135deg, #818CF8, #6366F1)",
                    boxShadow: copied ? "0 3px 12px rgba(52,211,153,0.3)" : "0 3px 12px rgba(129,140,248,0.3)",
                  }}
                >
                  <span className="flex items-center gap-1.5">
                    {copied ? <><CheckCircle2 className="w-4 h-4" /> Copied!</> : <><Copy className="w-4 h-4" /> Copy</>}
                  </span>
                </button>
              </div>

              {/* Action buttons */}
              <div className="mt-5 flex items-center justify-center gap-3">
                {/* Open in new tab */}
                <a
                  href={createdLink.shortUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2.5 text-[13px] font-semibold transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.97]"
                  style={{ borderRadius: 12, background: "rgba(129,140,248,0.1)", color: "#818CF8", border: "1px solid rgba(129,140,248,0.2)" }}
                >
                  <ExternalLink className="w-4 h-4" /> Open Link
                </a>

                {/* QR Code */}
                <button
                  onClick={handleShowQr}
                  disabled={qrLoading}
                  className="flex items-center gap-2 px-4 py-2.5 text-[13px] font-semibold transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.97] disabled:opacity-50"
                  style={{ borderRadius: 12, background: "rgba(52,211,153,0.1)", color: "#34D399", border: "1px solid rgba(52,211,153,0.2)" }}
                >
                  {qrLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <QrCode className="w-4 h-4" />} QR Code
                </button>
              </div>

              {/* QR Code display */}
              {qrSvg && (
                <div className="mt-6 animate-in fade-in slide-in-from-bottom-3 duration-300">
                  <div className="inline-block p-5 bg-white mx-auto" style={{ borderRadius: 16, border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 2px 12px rgba(0,0,0,0.3)" }}>
                    <div
                      className="w-[180px] h-[180px] mx-auto"
                      dangerouslySetInnerHTML={{ __html: qrSvg }}
                    />
                    <button
                      onClick={handleDownloadQr}
                      className="mt-3 flex items-center gap-1.5 mx-auto px-3.5 py-2 text-[12px] font-semibold transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.97]"
                      style={{ borderRadius: 10, background: "rgba(255,255,255,0.05)", color: "#94A3B8", border: "1px solid rgba(255,255,255,0.1)" }}
                    >
                      <Download className="w-3.5 h-3.5" /> Download PNG
                    </button>
                  </div>
                </div>
              )}

              {/* Bottom actions */}
              <div className="mt-7 flex items-center justify-center gap-3">
                <button
                  onClick={() => { setCreatedLink(null); setCopied(false); setQrSvg(null); }}
                  className="px-5 py-2.5 text-[13px] font-semibold transition-all duration-200 active:scale-[0.97]"
                  style={{ borderRadius: 12, background: "rgba(129,140,248,0.1)", color: "#818CF8", border: "1px solid rgba(129,140,248,0.15)" }}
                >
                  Create Another
                </button>
                <button
                  onClick={onClose}
                  className="px-5 py-2.5 text-[13px] font-semibold text-[#64748B] hover:text-[#E2E8F0] transition-colors"
                  style={{ borderRadius: 12 }}
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        ) : (
        /* FORM SCREEN */
        <>
        {/* Header */}
        <div className="relative px-7 pt-7 pb-5">
          {/* Accent bar */}
          <div className="absolute top-0 left-0 right-0 h-[4px]" style={{ background: "linear-gradient(90deg, #818CF8, #6366F1, #818CF8, #A78BFA)" }} />

          <DialogHeader>
            <div className="flex items-center gap-3.5 mb-1.5">
              <div className="w-11 h-11 rounded-[14px] flex items-center justify-center" style={{ background: "linear-gradient(135deg, #818CF8, #6366F1)", boxShadow: "0 4px 14px rgba(129,140,248,0.3)" }}>
                <LinkIcon className="w-5 h-5 text-white" />
              </div>
              <div>
                <DialogTitle className="text-[22px] font-extrabold text-[#F1F5F9] tracking-[-0.02em] font-[family-name:var(--font-space-grotesk)]">
                  {isEdit ? "Edit Short Link" : "Create Short Link"}
                </DialogTitle>
                <DialogDescription className="text-[13px] text-[#64748B] mt-0.5 font-medium">
                  {isEdit ? "Update your short link settings." : "Turn a long URL into a trackable short link."}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        {/* Form Body */}
        <div className="px-7 pb-2 flex-1 overflow-y-auto custom-scrollbar" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <form id="link-form" onSubmit={form.handleSubmit(onSubmit)} className="py-5 space-y-5">

            {/* Destination URL */}
            <div className="space-y-2">
              <Label htmlFor="destinationUrl" className="text-[12px] font-bold text-[#94A3B8] tracking-[0.03em] uppercase">
                Destination URL <span className="text-[#F87171]">*</span>
              </Label>
              <Input
                id="destinationUrl"
                placeholder="https://example.com/very/long/url"
                {...form.register("destinationUrl")}
                className="h-11 text-[14px] font-medium text-[#E2E8F0] placeholder:text-[#64748B] focus:border-[#818CF8] focus:ring-2 focus:ring-[#818CF8]/15 transition-all"
                style={{ borderRadius: 12, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
              />
              {form.formState.errors.destinationUrl && (
                <p className="text-[12px] text-[#F87171] font-semibold">{form.formState.errors.destinationUrl.message}</p>
              )}
            </div>

            {/* Domain + Slug row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Domain Selector */}
              <div className="space-y-2">
                <Label className="text-[12px] font-bold text-[#94A3B8] tracking-[0.03em] uppercase flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-[#818CF8]" /> Domain <span className="text-[#F87171]">*</span>
                </Label>
                {verifiedDomains.length === 0 ? (
                  <div className="flex items-center gap-2.5 p-3 text-[12px]" style={{ borderRadius: 12, background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.2)", color: "#FBBF24" }}>
                    <ShieldAlert className="w-4 h-4 shrink-0 text-[#FBBF24]" />
                    <span>
                      No verified domain.{" "}
                      <button type="button" className="underline font-bold" onClick={() => { onClose(); router.push("/domains"); }}>
                        Add one
                      </button>
                    </span>
                  </div>
                ) : (
                  <>
                    <Select
                      value={watchDomainId || ""}
                      onValueChange={(val) => form.setValue("domainId", val, { shouldValidate: true })}
                    >
                      <SelectTrigger className="h-11 text-[14px] font-medium text-[#E2E8F0] focus:border-[#818CF8] focus:ring-2 focus:ring-[#818CF8]/15" style={{ borderRadius: 12, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
                        <SelectValue placeholder="Select domain" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        {verifiedDomains.map((d) => (
                          <SelectItem key={d.id} value={d.id} className="text-[13px] font-medium">{d.domain}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {form.formState.errors.domainId && (
                      <p className="text-[12px] text-[#F87171] font-semibold">{form.formState.errors.domainId.message}</p>
                    )}
                  </>
                )}
              </div>

              {/* Custom Slug */}
              <div className="space-y-2">
                <Label htmlFor="slug" className="text-[12px] font-bold text-[#94A3B8] tracking-[0.03em] uppercase">Custom Slug</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    {slugPrefix && (
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-[#64748B] font-medium select-none pointer-events-none">{slugPrefix}</span>
                    )}
                    <Input
                      id="slug"
                      placeholder="my-campaign"
                      {...form.register("slug")}
                      className="h-11 text-[14px] font-medium text-[#E2E8F0] placeholder:text-[#64748B] focus:border-[#818CF8] focus:ring-2 focus:ring-[#818CF8]/15 transition-all"
                      style={{ borderRadius: 12, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", paddingLeft: slugPrefix ? `${Math.min(slugPrefix.length * 7.2 + 12, 150)}px` : undefined }}
                    />
                  </div>
                  {watchUrl && (
                    <Popover open={showSuggestions} onOpenChange={setShowSuggestions}>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          onClick={handleSuggest}
                          disabled={suggestMutation.isPending}
                          className="w-11 h-11 shrink-0 flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-50"
                          style={{ borderRadius: 12, background: "rgba(129,140,248,0.1)", border: "1px solid rgba(129,140,248,0.2)", color: "#818CF8" }}
                          title="AI slug suggestions"
                        >
                          {suggestMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent align="end" className="w-[260px] p-3 shadow-xl" style={{ borderRadius: 16, background: "rgba(17,24,39,0.95)", border: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(20px)" }}>
                        <div className="text-[11px] font-bold text-[#64748B] tracking-[0.05em] uppercase mb-2.5 px-1">AI Suggestions</div>
                        <div className="flex flex-wrap gap-1.5">
                          {slugSuggestions.map(s => (
                            <button
                              key={s}
                              type="button"
                              onClick={() => { form.setValue("slug", s); setShowSuggestions(false); }}
                              className="px-3 py-1.5 text-[12px] font-semibold rounded-lg transition-all duration-150 hover:scale-[1.03] active:scale-[0.97]"
                              style={{ background: "rgba(129,140,248,0.1)", color: "#818CF8", border: "1px solid rgba(129,140,248,0.15)" }}
                              onMouseEnter={e => { (e.currentTarget).style.background = "#818CF8"; (e.currentTarget).style.color = "#fff"; }}
                              onMouseLeave={e => { (e.currentTarget).style.background = "rgba(129,140,248,0.1)"; (e.currentTarget).style.color = "#818CF8"; }}
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
            </div>

            {/* Title + Expiry row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="title" className="text-[12px] font-bold text-[#94A3B8] tracking-[0.03em] uppercase">Title <span className="text-[#64748B] font-normal normal-case tracking-normal">(optional)</span></Label>
                <Input
                  id="title"
                  placeholder="Summer Sale Promo"
                  {...form.register("title")}
                  className="h-11 text-[14px] font-medium text-[#E2E8F0] placeholder:text-[#64748B] focus:border-[#818CF8] focus:ring-2 focus:ring-[#818CF8]/15 transition-all"
                  style={{ borderRadius: 12, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="expiresAt" className="text-[12px] font-bold text-[#94A3B8] tracking-[0.03em] uppercase">Expiry <span className="text-[#64748B] font-normal normal-case tracking-normal">(optional)</span></Label>
                <Input
                  id="expiresAt"
                  type="datetime-local"
                  {...form.register("expiresAt")}
                  className="h-11 text-[14px] font-medium text-[#E2E8F0] focus:border-[#818CF8] focus:ring-2 focus:ring-[#818CF8]/15 transition-all"
                  style={{ borderRadius: 12, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
                />
              </div>
            </div>

            {/* Link Status (edit only) */}
            {isEdit && (
              <div className="flex items-center justify-between p-4" style={{ borderRadius: 14, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div>
                  <p className="text-[13px] font-bold text-[#F1F5F9]">Link Status</p>
                  <p className="text-[11px] text-[#64748B] mt-0.5">Enable or disable this redirect.</p>
                </div>
                <Switch
                  checked={form.watch("enabled")}
                  onCheckedChange={(checked) => form.setValue("enabled", checked)}
                />
              </div>
            )}

            {/* Advanced Settings */}
            <div>
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="group flex items-center gap-2 py-2"
              >
                <div className="w-7 h-7 rounded-[8px] flex items-center justify-center transition-all duration-200 group-hover:scale-105" style={{ background: showAdvanced ? "#818CF8" : "rgba(129,140,248,0.1)", border: showAdvanced ? "none" : "1px solid rgba(129,140,248,0.15)" }}>
                  <Settings2 className="w-3.5 h-3.5" style={{ color: showAdvanced ? "#fff" : "#818CF8" }} />
                </div>
                <span className="text-[13px] font-bold" style={{ color: "#818CF8" }}>Advanced Settings</span>
                {showAdvanced ? <ChevronUp className="w-4 h-4 text-[#818CF8]" /> : <ChevronDown className="w-4 h-4 text-[#818CF8]" />}
              </button>

              {showAdvanced && (
                <div className="mt-3 p-5 space-y-4 animate-in slide-in-from-top-2 fade-in duration-200" style={{ borderRadius: 16, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>

                  {/* Folder + Click Limit */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-[11px] font-bold text-[#64748B] tracking-[0.04em] uppercase flex items-center gap-1.5">
                        <FolderOpen className="w-3 h-3 text-[#FB923C]" /> Folder
                      </Label>
                      <Select
                        value={form.watch("folderId") || "none"}
                        onValueChange={(val) => form.setValue("folderId", val === "none" ? null : val)}
                      >
                        <SelectTrigger className="h-10 text-[13px] font-medium text-[#E2E8F0]" style={{ borderRadius: 10, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
                          <SelectValue placeholder="No folder" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          <SelectItem value="none">No Folder</SelectItem>
                          {folders?.map(f => (
                            <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="clickLimit" className="text-[11px] font-bold text-[#64748B] tracking-[0.04em] uppercase flex items-center gap-1.5">
                        <Target className="w-3 h-3 text-[#F87171]" /> Click Limit
                      </Label>
                      <Input
                        id="clickLimit"
                        type="number"
                        placeholder="e.g. 1000"
                        {...form.register("clickLimit")}
                        className="h-10 text-[13px] font-medium text-[#E2E8F0] placeholder:text-[#64748B]"
                        style={{ borderRadius: 10, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
                      />
                    </div>
                  </div>

                  {/* Fallback URL */}
                  <div className="space-y-2">
                    <Label htmlFor="fallbackUrl" className="text-[11px] font-bold text-[#64748B] tracking-[0.04em] uppercase">Fallback URL</Label>
                    <Input
                      id="fallbackUrl"
                      placeholder="https://example.com/expired"
                      {...form.register("fallbackUrl")}
                      className="h-10 text-[13px] font-medium text-[#E2E8F0] placeholder:text-[#64748B]"
                      style={{ borderRadius: 10, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
                    />
                    <p className="text-[11px] text-[#64748B]">Redirect here if link expires, is disabled, or hits click limit.</p>
                  </div>

                  {/* Password */}
                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-[11px] font-bold text-[#64748B] tracking-[0.04em] uppercase flex items-center gap-1.5">
                      <Lock className="w-3 h-3 text-[#FB923C]" /> Password Protection
                    </Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder={isEdit && link?.hasPassword ? "Leave blank to keep current" : "Set a password..."}
                      {...form.register("password")}
                      className="h-10 text-[13px] font-medium text-[#E2E8F0] placeholder:text-[#64748B]"
                      style={{ borderRadius: 10, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
                    />
                  </div>

                  {/* Toggle switches */}
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between p-3.5" style={{ borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                      <div>
                        <p className="text-[12px] font-bold text-[#F1F5F9] flex items-center gap-1.5">
                          <EyeOff className="w-3.5 h-3.5 text-[#A78BFA]" /> Cloak URL
                        </p>
                        <p className="text-[11px] text-[#64748B] mt-0.5">Visitors see your short link in the address bar.</p>
                      </div>
                      <Switch
                        checked={form.watch("isCloaked")}
                        onCheckedChange={(checked) => form.setValue("isCloaked", checked)}
                      />
                    </div>

                    <div className="flex items-center justify-between p-3.5" style={{ borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                      <div>
                        <p className="text-[12px] font-bold text-[#F1F5F9] flex items-center gap-1.5">
                          <ShieldOff className="w-3.5 h-3.5 text-[#F87171]" /> Hide Referrer
                        </p>
                        <p className="text-[11px] text-[#64748B] mt-0.5">Destination site won&apos;t see where the click came from.</p>
                      </div>
                      <Switch
                        checked={form.watch("hideReferrer")}
                        onCheckedChange={(checked) => form.setValue("hideReferrer", checked)}
                      />
                    </div>
                  </div>

                  {/* Mobile Deep Links */}
                  <div className="p-3.5 space-y-3" style={{ borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <p className="text-[12px] font-bold text-[#F1F5F9] flex items-center gap-1.5">
                      <Smartphone className="w-3.5 h-3.5 text-[#60A5FA]" /> Mobile Deep Links
                    </p>
                    <p className="text-[11px] text-[#64748B] -mt-1">Open native apps on mobile. Falls back to destination if app not installed.</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label htmlFor="iosDeepLink" className="text-[10px] font-semibold text-[#64748B] uppercase">iOS</Label>
                        <Input
                          id="iosDeepLink"
                          placeholder="myapp://path"
                          {...form.register("iosDeepLink")}
                          className="h-9 text-[12px] font-medium text-[#E2E8F0] placeholder:text-[#64748B]"
                          style={{ borderRadius: 8, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="androidDeepLink" className="text-[10px] font-semibold text-[#64748B] uppercase">Android</Label>
                        <Input
                          id="androidDeepLink"
                          placeholder="myapp://path"
                          {...form.register("androidDeepLink")}
                          className="h-9 text-[12px] font-medium text-[#E2E8F0] placeholder:text-[#64748B]"
                          style={{ borderRadius: 8, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Tags */}
                  {tags && tags.length > 0 && (
                    <div className="space-y-2.5">
                      <Label className="text-[11px] font-bold text-[#64748B] tracking-[0.04em] uppercase flex items-center gap-1.5">
                        <Tag className="w-3 h-3 text-[#2DD4BF]" /> Tags
                      </Label>
                      <div className="flex flex-wrap gap-2">
                        {tags.map(tag => {
                          const isSelected = form.watch("tagIds").includes(tag.id);
                          return (
                            <button
                              key={tag.id}
                              type="button"
                              onClick={() => {
                                const current = form.watch("tagIds");
                                if (isSelected) form.setValue("tagIds", current.filter(id => id !== tag.id));
                                else form.setValue("tagIds", [...current, tag.id]);
                              }}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold transition-all duration-150"
                              style={{
                                borderRadius: 8,
                                background: isSelected ? `${tag.color}15` : "rgba(255,255,255,0.03)",
                                border: `1.5px solid ${isSelected ? tag.color : "rgba(255,255,255,0.1)"}`,
                                color: isSelected ? tag.color : "#94A3B8",
                              }}
                            >
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: tag.color }} />
                              {tag.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Smart Routing (edit only) */}
            {isEdit && link && (
              <button
                type="button"
                onClick={() => router.push(`/links/${link.id}/rules`)}
                className="w-full flex items-center justify-between p-4 group transition-all duration-200 hover:-translate-y-0.5"
                style={{ borderRadius: 14, background: "rgba(129,140,248,0.06)", border: "1px solid rgba(129,140,248,0.15)" }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-[10px] flex items-center justify-center" style={{ background: "linear-gradient(135deg, #818CF8, #A78BFA)", boxShadow: "0 3px 10px rgba(129,140,248,0.25)" }}>
                    <Target className="w-4 h-4 text-white" />
                  </div>
                  <div className="text-left">
                    <p className="text-[13px] font-bold text-[#F1F5F9]">Smart Routing Rules</p>
                    <p className="text-[11px] text-[#64748B]">Geo-targeting, device routing, A/B testing</p>
                  </div>
                </div>
                <span className="text-[#818CF8] text-[13px] font-semibold group-hover:translate-x-0.5 transition-transform">&rarr;</span>
              </button>
            )}
          </form>
        </div>

        {/* Footer */}
        <div className="px-7 py-5 flex items-center justify-end gap-3 shrink-0" style={{ borderTop: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}>
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="px-5 py-2.5 text-[13px] font-semibold text-[#64748B] hover:text-[#E2E8F0] transition-colors disabled:opacity-50"
            style={{ borderRadius: 12 }}
          >
            Cancel
          </button>
          <button
            form="link-form"
            type="submit"
            disabled={isPending || verifiedDomains.length === 0}
            className="px-6 py-2.5 text-[13px] font-bold text-white transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.97] disabled:opacity-50 disabled:hover:translate-y-0"
            style={{
              borderRadius: 12,
              background: "linear-gradient(135deg, #818CF8, #6366F1)",
              boxShadow: "0 4px 14px rgba(129,140,248,0.35), 0 1px 3px rgba(0,0,0,0.2)",
            }}
          >
            {isPending ? (
              <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Saving...</span>
            ) : isEdit ? "Save Changes" : "Create Link"}
          </button>
        </div>

        </>
        )}

      </DialogContent>
    </Dialog>
  );
}
