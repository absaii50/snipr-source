"use client";
import { useState, useRef, useCallback, useEffect } from "react";
import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { useGetAiInsights, useGenerateWeeklySummary, getGetAiInsightsQueryKey, type AiInsight } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Sparkles, BrainCircuit, Loader2, ArrowRight, RefreshCw,
  ChevronRight, Lightbulb, MessageSquare, Zap, TrendingUp,
  Smartphone, Globe, Clock, Tag, Copy, Check, AlertCircle,
  ShieldAlert, AlertTriangle, Info, BadgeCheck, ClipboardList,
} from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

const QUICK_QUESTIONS = [
  "Which links performed best this week?",
  "Which country sends the most traffic?",
  "Which links need improvement?",
  "What actions should I take to grow clicks?",
  "Why might traffic have dropped recently?",
  "Which device type performs best?",
];

const SNIPR_DOMAIN = "snipr.sh";

type AuditFinding = { type: string; slug: string; message: string };
type SmartSuggestion = { title: string; body: string; icon: string };

function SuggestionIcon({ icon }: { icon: string }) {
  const map: Record<string, React.ReactNode> = {
    trend: <TrendingUp className="w-4 h-4" />,
    mobile: <Smartphone className="w-4 h-4" />,
    country: <Globe className="w-4 h-4" />,
    time: <Clock className="w-4 h-4" />,
    tag: <Tag className="w-4 h-4" />,
  };
  return <>{map[icon] ?? <Sparkles className="w-4 h-4" />}</>;
}

function AuditFindingIcon({ type }: { type: string }) {
  if (type === "expired") return <AlertCircle className="w-4 h-4 text-[#E05050]" />;
  if (type === "zero_click") return <AlertTriangle className="w-4 h-4 text-[#E07B30]" />;
  if (type === "no_title") return <Info className="w-4 h-4 text-[#728DA7]" />;
  if (type === "improvement") return <ShieldAlert className="w-4 h-4 text-[#7C5CC4]" />;
  return <BadgeCheck className="w-4 h-4 text-[#2E9A72]" />;
}

function AuditFindingBg(type: string) {
  if (type === "expired") return "bg-[#FFF0F0] border-[#FFD5D5]";
  if (type === "zero_click") return "bg-[#FEF8F0] border-[#FDDCB6]";
  if (type === "no_title") return "bg-[#F0F6FF] border-[#C8DEFF]";
  if (type === "improvement") return "bg-[#F5F0FE] border-[#DDD2F5]";
  return "bg-[#F0FAF5] border-[#B4E8CE]";
}

function renderFormattedText(text: string) {
  const lines = text.split("\n");
  return lines.map((line, lineIdx) => {
    const parts = line.split(/(\*\*[^*]+\*\*)/g);
    const rendered = parts.map((part, partIdx) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return (
          <strong key={partIdx} className="font-bold text-[#0A0A0A]">
            {part.slice(2, -2)}
          </strong>
        );
      }
      return <span key={partIdx}>{part}</span>;
    });
    return (
      <span key={lineIdx}>
        {lineIdx > 0 && <br />}
        {rendered}
      </span>
    );
  });
}

export default function AiInsights() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [question, setQuestion] = useState("");
  const [slugUrl, setSlugUrl] = useState("");
  const [slugTitle, setSlugTitle] = useState("");
  const [slugSuggestions, setSlugSuggestions] = useState<string[]>([]);
  const [isLoadingSlug, setIsLoadingSlug] = useState(false);
  const [slugError, setSlugError] = useState<string | null>(null);
  const [streamingAnswer, setStreamingAnswer] = useState<string>("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentQ, setCurrentQ] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"ask" | "summary" | "slugs" | "suggestions" | "audit">("ask");

  const [smartSuggestions, setSmartSuggestions] = useState<SmartSuggestion[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [suggestionsLoaded, setSuggestionsLoaded] = useState(false);

  const [auditFindings, setAuditFindings] = useState<AuditFinding[]>([]);
  const [auditTotal, setAuditTotal] = useState<number>(0);
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditDone, setAuditDone] = useState(false);

  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

  const { data: insights, isLoading } = useGetAiInsights({ limit: 20 });
  const summaryMutation = useGenerateWeeklySummary();

  const qaHistory = insights?.filter(i => i.type === "qa_response") || [];
  const latestSummary = insights?.find(i => i.type === "weekly_summary");

  const abortRef = useRef<AbortController | null>(null);

  const handleAsk = useCallback(async (q?: string) => {
    const finalQuestion = (q ?? question).trim();
    if (!finalQuestion || isStreaming) return;
    setCurrentQ(finalQuestion);
    setStreamingAnswer("");
    setIsStreaming(true);
    if (q) setQuestion(q);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/ai/ask/stream", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: finalQuestion }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        setStreamingAnswer("Unable to get a response. Please try again.");
        setIsStreaming(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let answer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const payload = JSON.parse(line.slice(6));
              if (payload.token) {
                answer += payload.token;
                setStreamingAnswer(answer);
              }
              if (payload.done) {
                queryClient.invalidateQueries({ queryKey: getGetAiInsightsQueryKey() });
              }
            } catch { /* skip */ }
          }
        }
      }
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") {
        setStreamingAnswer("Connection error. Please try again.");
      }
    } finally {
      setIsStreaming(false);
      setQuestion("");
    }
  }, [question, isStreaming, queryClient]);

  const handleGenerateSummary = async () => {
    try {
      await summaryMutation.mutateAsync();
      queryClient.invalidateQueries({ queryKey: getGetAiInsightsQueryKey() });
    } catch (e) {
      console.error(e);
    }
  };

  const handleLoadSuggestions = useCallback(async () => {
    if (isLoadingSuggestions) return;
    setIsLoadingSuggestions(true);
    try {
      const res = await fetch("/api/ai/smart-suggestions", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setSmartSuggestions(Array.isArray(data.suggestions) ? data.suggestions : []);
      setSuggestionsLoaded(true);
    } catch {
      toast({ title: "Failed to load suggestions", variant: "destructive" });
    } finally {
      setIsLoadingSuggestions(false);
    }
  }, [isLoadingSuggestions, toast]);

  useEffect(() => {
    if (activeTab === "suggestions" && !suggestionsLoaded && !isLoadingSuggestions) {
      handleLoadSuggestions();
    }
  }, [activeTab, suggestionsLoaded, isLoadingSuggestions, handleLoadSuggestions]);

  const handleAudit = async () => {
    setIsAuditing(true);
    setAuditDone(false);
    setAuditFindings([]);
    try {
      const res = await fetch("/api/ai/audit", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setAuditFindings(Array.isArray(data.findings) ? data.findings : []);
      setAuditTotal(data.totalLinks ?? 0);
      setAuditDone(true);
    } catch {
      toast({ title: "Audit failed", variant: "destructive" });
    } finally {
      setIsAuditing(false);
    }
  };

  const handleSlugSuggest = async () => {
    if (!slugUrl.trim() && !slugTitle.trim()) return;
    setIsLoadingSlug(true);
    setSlugSuggestions([]);
    setSlugError(null);
    try {
      const res = await fetch("/api/ai/slug-suggest", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: slugUrl, title: slugTitle }),
      });
      if (!res.ok) {
        setSlugError("Failed to generate suggestions. Please try again.");
        return;
      }
      const data = await res.json();
      const results: string[] = Array.isArray(data.suggestions) ? data.suggestions : [];
      if (results.length === 0) {
        setSlugError("No suggestions returned. Try a different URL or title.");
      } else {
        setSlugSuggestions(results);
      }
    } catch (e) {
      setSlugError("Something went wrong. Please try again.");
    } finally {
      setIsLoadingSlug(false);
    }
  };

  const handleCopySlug = (slug: string) => {
    const fullUrl = `https://${SNIPR_DOMAIN}/${slug}`;
    navigator.clipboard.writeText(fullUrl).then(() => {
      setCopiedSlug(slug);
      toast({ title: "Copied!", description: fullUrl });
      setTimeout(() => setCopiedSlug(null), 2000);
    });
  };

  const handleUseSlug = (slug: string) => {
    window.location.href = `/links?slug=${encodeURIComponent(slug)}`;
  };

  const tabs = [
    { key: "ask", label: "Ask AI", icon: <MessageSquare className="w-3.5 h-3.5" /> },
    { key: "suggestions", label: "Smart Suggestions", icon: <Zap className="w-3.5 h-3.5" /> },
    { key: "audit", label: "Link Audit", icon: <ClipboardList className="w-3.5 h-3.5" /> },
    { key: "summary", label: "Weekly Summary", icon: <Sparkles className="w-3.5 h-3.5" /> },
    { key: "slugs", label: "Slug Ideas", icon: <Lightbulb className="w-3.5 h-3.5" /> },
  ] as const;

  return (
    <ProtectedLayout>
      <div className="p-6 lg:p-8 max-w-6xl mx-auto w-full space-y-6">

        {/* Header */}
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[#F0EBF9] flex items-center justify-center shrink-0">
            <BrainCircuit className="w-6 h-6 text-[#7C5CC4]" />
          </div>
          <div>
            <p className="text-[10px] font-bold tracking-[0.22em] uppercase text-[#7C5CC4] mb-1">Intelligence</p>
            <h1 className="text-[26px] font-display font-black tracking-tight text-[#0A0A0A] leading-none">AI Insights</h1>
            <p className="text-[13px] text-[#8888A0] mt-1">Your personal analytics assistant powered by real data.</p>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 bg-[#F4F4F6] p-1 rounded-2xl flex-wrap">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-4 py-2 text-[12px] font-semibold rounded-xl transition-all ${
                activeTab === tab.key
                  ? "bg-white text-[#0A0A0A] shadow-sm"
                  : "text-[#8888A0] hover:text-[#0A0A0A]"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* ASK AI TAB */}
        {activeTab === "ask" && (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 items-start">
            <div className="space-y-5">
              {/* Ask box */}
              <div className="bg-white border border-[#E4E4EC] rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-[#F0F0F6] bg-[#FAFAFE] flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#7C5CC4]" />
                  <h2 className="text-[14px] font-semibold text-[#0A0A0A]">Ask your analytics</h2>
                </div>
                <div className="p-5 space-y-4">
                  <textarea
                    placeholder="e.g. Which campaign drove the most clicks this week?"
                    className="w-full min-h-[100px] px-4 py-3 text-[13px] bg-[#FAFAFE] border border-[#E4E4EC] rounded-xl outline-none focus:border-[#7C5CC4] focus:ring-2 focus:ring-[#7C5CC4]/10 transition-all placeholder:text-[#CCCCDA] resize-none"
                    value={question}
                    onChange={e => setQuestion(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAsk(); } }}
                    disabled={isStreaming}
                  />
                  <button
                    onClick={() => handleAsk()}
                    disabled={isStreaming || !question.trim()}
                    className="w-full inline-flex items-center justify-center gap-2 bg-[#7C5CC4] hover:bg-[#6A4BB0] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed text-white text-[13px] font-semibold px-4 py-3 rounded-xl transition-all"
                  >
                    {isStreaming
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> Thinking…</>
                      : <><Sparkles className="w-4 h-4" /> Ask AI</>
                    }
                  </button>
                </div>

                {/* Streaming answer */}
                {(isStreaming || streamingAnswer) && (
                  <div className="mx-5 mb-5 p-4 bg-[#F5F1FC] border border-[#E0D8F5] rounded-xl">
                    {currentQ && (
                      <p className="text-[11px] font-bold text-[#7C5CC4] uppercase tracking-wider mb-2">Q: {currentQ}</p>
                    )}
                    <div className="text-[13px] text-[#3A3A3E] leading-[1.75]">
                      {renderFormattedText(streamingAnswer)}
                      {isStreaming && <span className="inline-block w-1.5 h-3.5 bg-[#7C5CC4] ml-0.5 align-middle animate-pulse rounded-sm" />}
                    </div>
                    {!isStreaming && (
                      <p className="mt-3 text-[11px] text-[#8888A0]">Based on your last 30 days of data</p>
                    )}
                  </div>
                )}
              </div>

              {/* Q&A History */}
              {qaHistory.length > 0 && (
                <div className="bg-white border border-[#E4E4EC] rounded-2xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-[#F0F0F6] bg-[#FAFAFE]">
                    <h3 className="text-[14px] font-semibold text-[#0A0A0A]">Recent Questions</h3>
                  </div>
                  <div className="divide-y divide-[#F0F0F6]">
                    {qaHistory.slice(0, 6).map(item => {
                      const meta = (item as AiInsight & { metadata?: { question?: string } | null }).metadata;
                      const q = meta?.question || "Unknown question";
                      return (
                        <div key={item.id} className="px-5 py-4 hover:bg-[#FAFAFE] transition-colors">
                          <p className="text-[12px] font-semibold text-[#0A0A0A] mb-1.5">"{q}"</p>
                          <div className="text-[12px] text-[#3A3A3E] leading-[1.7] flex gap-2 items-start">
                            <ArrowRight className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#7C5CC4]" />
                            <div>{renderFormattedText(item.content)}</div>
                          </div>
                          <p className="text-[11px] text-[#AAAAB4] mt-2">
                            {format(new Date(item.createdAt), "MMM d, h:mm a")}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Quick questions sidebar */}
            <div className="bg-white border border-[#E4E4EC] rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-[#F0F0F6] bg-[#FAFAFE] flex items-center gap-2">
                <Zap className="w-4 h-4 text-[#E07B30]" />
                <h3 className="text-[14px] font-semibold text-[#0A0A0A]">Quick Questions</h3>
              </div>
              <div className="p-3 space-y-1">
                {QUICK_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    onClick={() => { setActiveTab("ask"); handleAsk(q); }}
                    disabled={isStreaming}
                    className="w-full text-left flex items-center gap-2.5 px-3.5 py-3 rounded-xl text-[12.5px] text-[#3A3A3E] hover:bg-[#F4F4F6] hover:text-[#0A0A0A] transition-colors group disabled:opacity-50"
                  >
                    <span className="flex-1">{q}</span>
                    <ChevronRight className="w-3.5 h-3.5 text-[#CCCCDA] group-hover:text-[#7C5CC4] transition-colors shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* SMART SUGGESTIONS TAB */}
        {activeTab === "suggestions" && (
          <div className="space-y-5">
            <div className="bg-white border border-[#E4E4EC] rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-[#F0F0F6] bg-[#FAFAFE] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-[#E07B30]" />
                  <h2 className="text-[14px] font-semibold text-[#0A0A0A]">Smart Suggestions</h2>
                  <span className="text-[11px] text-[#AAAAB4] ml-1">Based on your last 30 days</span>
                </div>
                <button
                  onClick={handleLoadSuggestions}
                  disabled={isLoadingSuggestions}
                  className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#E07B30] hover:text-[#C96A20] border border-[#FDDCB6] hover:border-[#E07B30] bg-[#FEF3E8] hover:bg-[#FEECD6] px-3.5 py-2 rounded-xl transition-all disabled:opacity-50 active:scale-95"
                >
                  {isLoadingSuggestions
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <RefreshCw className="w-3.5 h-3.5" />}
                  {suggestionsLoaded ? "Refresh" : "Generate"}
                </button>
              </div>

              <div className="p-6 min-h-[300px]">
                {isLoadingSuggestions ? (
                  <div className="h-full flex flex-col items-center justify-center gap-4 py-12">
                    <div className="relative">
                      <div className="w-12 h-12 rounded-2xl bg-[#FEF3E8] flex items-center justify-center">
                        <Zap className="w-6 h-6 text-[#E07B30]" />
                      </div>
                      <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-[#E07B30] rounded-full animate-ping opacity-60" />
                    </div>
                    <div className="text-center">
                      <p className="text-[13px] font-semibold text-[#0A0A0A]">Analysing your data…</p>
                      <p className="text-[12px] text-[#8888A0] mt-1">Generating personalised suggestions.</p>
                    </div>
                  </div>
                ) : smartSuggestions.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {smartSuggestions.map((s, i) => (
                      <div key={i} className="bg-[#FAFAFE] border border-[#EBEBF8] rounded-2xl p-5 space-y-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-xl bg-[#F0EBF9] flex items-center justify-center text-[#7C5CC4] shrink-0">
                            <SuggestionIcon icon={s.icon} />
                          </div>
                          <p className="text-[13px] font-semibold text-[#0A0A0A] leading-tight">{s.title}</p>
                        </div>
                        <p className="text-[12.5px] text-[#3A3A3E] leading-relaxed">{s.body}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center gap-4 py-12 text-center max-w-xs mx-auto">
                    <div className="w-14 h-14 rounded-2xl bg-[#FEF3E8] flex items-center justify-center">
                      <Zap className="w-7 h-7 text-[#E07B30]/50" />
                    </div>
                    <div>
                      <p className="text-[14px] font-semibold text-[#0A0A0A] mb-1">No suggestions yet</p>
                      <p className="text-[12px] text-[#8888A0]">
                        Click "Generate" and AI will analyse your real link performance to produce 3–5 actionable insights.
                      </p>
                    </div>
                    <button
                      onClick={handleLoadSuggestions}
                      className="inline-flex items-center gap-2 bg-[#E07B30] hover:bg-[#C96A20] text-white text-[13px] font-semibold px-5 py-2.5 rounded-xl transition-all active:scale-95"
                    >
                      <Zap className="w-4 h-4" />
                      Generate suggestions
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* LINK AUDIT TAB */}
        {activeTab === "audit" && (
          <div className="space-y-5">
            <div className="bg-white border border-[#E4E4EC] rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-[#F0F0F6] bg-[#FAFAFE] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ClipboardList className="w-4 h-4 text-[#728DA7]" />
                  <h2 className="text-[14px] font-semibold text-[#0A0A0A]">AI Link Audit</h2>
                  {auditDone && (
                    <span className="text-[11px] text-[#AAAAB4] ml-1">
                      · {auditTotal} links reviewed, {auditFindings.length} findings
                    </span>
                  )}
                </div>
                <button
                  onClick={handleAudit}
                  disabled={isAuditing}
                  className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#728DA7] hover:text-[#4A7A94] border border-[#EBEBF0] hover:border-[#728DA7] bg-[#EEF3F7] hover:bg-[#E2EDF4] px-3.5 py-2 rounded-xl transition-all disabled:opacity-50 active:scale-95"
                >
                  {isAuditing
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <ClipboardList className="w-3.5 h-3.5" />}
                  {auditDone ? "Re-audit" : "Audit my links"}
                </button>
              </div>

              <div className="p-6 min-h-[350px]">
                {isAuditing ? (
                  <div className="h-full flex flex-col items-center justify-center gap-4 py-16">
                    <div className="relative">
                      <div className="w-14 h-14 rounded-2xl bg-[#EEF3F7] flex items-center justify-center">
                        <ClipboardList className="w-7 h-7 text-[#728DA7]" />
                      </div>
                      <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#728DA7] rounded-full animate-ping opacity-60" />
                    </div>
                    <div className="text-center">
                      <p className="text-[14px] font-semibold text-[#0A0A0A]">Auditing your links…</p>
                      <p className="text-[12px] text-[#8888A0] mt-1">AI is reviewing all your links for issues and opportunities.</p>
                    </div>
                  </div>
                ) : auditFindings.length > 0 ? (
                  <div className="space-y-3">
                    {auditFindings.map((f, i) => (
                      <div key={i} className={`flex items-start gap-3 p-4 rounded-xl border ${AuditFindingBg(f.type)}`}>
                        <div className="shrink-0 mt-0.5">
                          <AuditFindingIcon type={f.type} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-bold text-[#0A0A0A] mb-0.5">
                            <span className="font-mono bg-white/60 px-1.5 py-0.5 rounded text-[11px] mr-1.5">/{f.slug}</span>
                            {f.type === "expired" ? "Expired" : f.type === "zero_click" ? "No Clicks" : f.type === "no_title" ? "Missing Title" : f.type === "improvement" ? "Improvement" : "Good"}
                          </p>
                          <p className="text-[12.5px] text-[#3A3A3E] leading-relaxed">{f.message}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center gap-4 py-16 text-center max-w-sm mx-auto">
                    <div className="w-16 h-16 rounded-2xl bg-[#EEF3F7] flex items-center justify-center">
                      <ClipboardList className="w-8 h-8 text-[#728DA7]/50" />
                    </div>
                    <div>
                      <p className="text-[15px] font-semibold text-[#0A0A0A] mb-1">Ready to audit</p>
                      <p className="text-[13px] text-[#8888A0]">
                        Click "Audit my links" to have AI review all your links for expired URLs, zero-click links, missing titles, and improvement opportunities.
                      </p>
                    </div>
                    <button
                      onClick={handleAudit}
                      className="inline-flex items-center gap-2 bg-[#728DA7] hover:bg-[#5C7A96] text-white text-[13px] font-semibold px-5 py-2.5 rounded-xl transition-all active:scale-95"
                    >
                      <ClipboardList className="w-4 h-4" />
                      Audit my links
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* WEEKLY SUMMARY TAB */}
        {activeTab === "summary" && (
          <div className="bg-white border border-[#E4E4EC] rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[#F0F0F6] bg-[#FAFAFE] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#7C5CC4]" />
                <h2 className="text-[14px] font-semibold text-[#0A0A0A]">Weekly Performance Summary</h2>
                {latestSummary && (
                  <span className="text-[11px] text-[#AAAAB4] ml-1">
                    · Generated {format(new Date(latestSummary.createdAt), "MMM d 'at' h:mm a")}
                  </span>
                )}
              </div>
              <button
                onClick={handleGenerateSummary}
                disabled={summaryMutation.isPending}
                className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#7C5CC4] hover:text-[#6A4BB0] border border-[#E0D8F5] hover:border-[#7C5CC4] bg-[#F5F1FC] hover:bg-[#EDE6FA] px-3.5 py-2 rounded-xl transition-all disabled:opacity-50 active:scale-95"
              >
                {summaryMutation.isPending
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <RefreshCw className="w-3.5 h-3.5" />}
                {summaryMutation.isPending ? "Generating…" : "Regenerate"}
              </button>
            </div>

            <div className="p-8 min-h-[400px]">
              {summaryMutation.isPending ? (
                <div className="h-full flex flex-col items-center justify-center gap-4 py-16">
                  <div className="relative">
                    <div className="w-14 h-14 rounded-2xl bg-[#F0EBF9] flex items-center justify-center">
                      <Sparkles className="w-7 h-7 text-[#7C5CC4]" />
                    </div>
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#7C5CC4] rounded-full animate-ping opacity-60" />
                  </div>
                  <div className="text-center">
                    <p className="text-[14px] font-semibold text-[#0A0A0A]">Analysing your data…</p>
                    <p className="text-[12px] text-[#8888A0] mt-1">Generating your weekly intelligence report.</p>
                  </div>
                </div>
              ) : isLoading && !latestSummary ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-6 h-6 animate-spin text-[#7C5CC4]/40" />
                </div>
              ) : latestSummary ? (
                <div className="max-w-none">
                  <div className="text-[14px] text-[#3A3A3E] leading-[1.75]">
                    {renderFormattedText(latestSummary.content)}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-center gap-4 py-16 max-w-sm mx-auto">
                  <div className="w-16 h-16 rounded-2xl bg-[#F0EBF9] flex items-center justify-center">
                    <BrainCircuit className="w-8 h-8 text-[#7C5CC4]/60" />
                  </div>
                  <div>
                    <p className="text-[15px] font-semibold text-[#0A0A0A] mb-1">No summary yet</p>
                    <p className="text-[13px] text-[#8888A0]">
                      Click "Regenerate" to get an AI-powered weekly report based on your real analytics data.
                    </p>
                  </div>
                  <button
                    onClick={handleGenerateSummary}
                    className="inline-flex items-center gap-2 bg-[#7C5CC4] hover:bg-[#6A4BB0] text-white text-[13px] font-semibold px-5 py-2.5 rounded-xl transition-all active:scale-95"
                  >
                    <Sparkles className="w-4 h-4" />
                    Generate first summary
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* SLUG IDEAS TAB */}
        {activeTab === "slugs" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            <div className="bg-white border border-[#E4E4EC] rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-[#F0F0F6] bg-[#FAFAFE] flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-[#E07B30]" />
                <h2 className="text-[14px] font-semibold text-[#0A0A0A]">AI Slug Generator</h2>
              </div>
              <div className="p-5 space-y-4">
                <p className="text-[12px] text-[#8888A0]">
                  Enter a URL or title and get 5 smart, memorable slug suggestions powered by AI.
                </p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-[12px] font-semibold text-[#3A3A3E] mb-1.5">Destination URL</label>
                    <input
                      type="url"
                      placeholder="https://example.com/blog/my-article"
                      value={slugUrl}
                      onChange={e => setSlugUrl(e.target.value)}
                      className="w-full px-4 py-2.5 text-[13px] bg-[#FAFAFE] border border-[#E4E4EC] rounded-xl outline-none focus:border-[#E07B30] focus:ring-2 focus:ring-[#E07B30]/10 transition-all placeholder:text-[#CCCCDA]"
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-semibold text-[#3A3A3E] mb-1.5">Link Title (optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. Summer Campaign 2025"
                      value={slugTitle}
                      onChange={e => setSlugTitle(e.target.value)}
                      className="w-full px-4 py-2.5 text-[13px] bg-[#FAFAFE] border border-[#E4E4EC] rounded-xl outline-none focus:border-[#E07B30] focus:ring-2 focus:ring-[#E07B30]/10 transition-all placeholder:text-[#CCCCDA]"
                    />
                  </div>
                  <button
                    onClick={handleSlugSuggest}
                    disabled={isLoadingSlug || (!slugUrl.trim() && !slugTitle.trim())}
                    className="w-full inline-flex items-center justify-center gap-2 bg-[#E07B30] hover:bg-[#C96A20] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed text-white text-[13px] font-semibold px-4 py-3 rounded-xl transition-all"
                  >
                    {isLoadingSlug
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</>
                      : <><Lightbulb className="w-4 h-4" /> Suggest Slugs</>
                    }
                  </button>
                </div>
              </div>
            </div>

            {/* Results with full URL preview */}
            <div className="bg-white border border-[#E4E4EC] rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-[#F0F0F6] bg-[#FAFAFE] flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#E07B30]" />
                <h3 className="text-[14px] font-semibold text-[#0A0A0A]">Suggested Slugs</h3>
              </div>
              <div className="p-5">
                {isLoadingSlug ? (
                  <div className="py-12 flex flex-col items-center justify-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#FEF3E8] flex items-center justify-center">
                      <Loader2 className="w-5 h-5 animate-spin text-[#E07B30]" />
                    </div>
                    <p className="text-[12px] text-[#8888A0]">Generating slug ideas…</p>
                  </div>
                ) : slugError ? (
                  <div className="py-8 flex flex-col items-center justify-center gap-3 text-center">
                    <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
                      <Lightbulb className="w-5 h-5 text-red-400" />
                    </div>
                    <p className="text-[13px] text-[#3A3A3E]">{slugError}</p>
                  </div>
                ) : slugSuggestions.length > 0 ? (
                  <div className="space-y-2">
                    {slugSuggestions.map((slug, i) => {
                      const fullUrl = `https://${SNIPR_DOMAIN}/${slug}`;
                      const isCopied = copiedSlug === slug;
                      return (
                        <div
                          key={i}
                          className="flex flex-col gap-2 px-4 py-3.5 bg-[#FAFAFE] border border-[#F0F0F6] hover:border-[#E07B30]/30 hover:bg-[#FEF8F3] rounded-xl transition-all"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-[11px] font-bold text-[#CCCCDA] shrink-0">#{i + 1}</span>
                              <span className="font-mono text-[13px] font-semibold text-[#0A0A0A] truncate">{slug}</span>
                            </div>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11.5px] text-[#728DA7] font-medium truncate">
                              {fullUrl}
                            </span>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() => handleCopySlug(slug)}
                                className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg transition-all ${
                                  isCopied
                                    ? "bg-[#E8F7F1] text-[#2E9A72]"
                                    : "bg-[#F2F2F6] text-[#728DA7] hover:bg-[#EEF3F7]"
                                }`}
                                title="Copy full URL"
                              >
                                {isCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                Copy
                              </button>
                              <button
                                onClick={() => handleUseSlug(slug)}
                                className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg bg-[#0A0A0A] hover:bg-[#1A1A2E] text-white transition-all"
                                title="Create a link with this slug"
                              >
                                Use
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <p className="text-[11px] text-[#AAAAB4] text-center pt-1">Click "Copy" to copy the full URL or "Use" to create a link</p>
                  </div>
                ) : (
                  <div className="py-12 flex flex-col items-center justify-center gap-3 text-center">
                    <div className="w-12 h-12 rounded-2xl bg-[#FEF3E8] flex items-center justify-center">
                      <Lightbulb className="w-6 h-6 text-[#E07B30]/50" />
                    </div>
                    <p className="text-[13px] font-semibold text-[#0A0A0A]">No suggestions yet</p>
                    <p className="text-[12px] text-[#8888A0]">Enter a URL or title and click "Suggest Slugs" to generate ideas.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

      </div>
    </ProtectedLayout>
  );
}
