"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import {
  BookOpen, Search, ChevronRight, ChevronLeft, Info,
  Lightbulb, AlertTriangle, AlertOctagon, Copy, Check,
} from "lucide-react";
import { SECTIONS, ALL_ARTICLES, type Article, type Block } from "./guide/content";

/* ────────────────────────────────────────────────────────────────────── */
/* Inline content renderer                                                */
/* ────────────────────────────────────────────────────────────────────── */

const CALLOUT_TONE: Record<string, { bg: string; ring: string; text: string; icon: React.ElementType }> = {
  info:   { bg: "bg-[#1E293B]/40",  ring: "ring-[#3B82F6]/30", text: "text-[#93C5FD]", icon: Info },
  tip:    { bg: "bg-[#064E3B]/40",  ring: "ring-[#10B981]/30", text: "text-[#6EE7B7]", icon: Lightbulb },
  warn:   { bg: "bg-[#451A03]/40",  ring: "ring-[#F59E0B]/30", text: "text-[#FCD34D]", icon: AlertTriangle },
  danger: { bg: "bg-[#450A0A]/40",  ring: "ring-[#EF4444]/30", text: "text-[#FCA5A5]", icon: AlertOctagon },
};

function CodeBlock({ text, lang }: { text: string; lang?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative my-4 rounded-xl overflow-hidden border border-[#27272A] bg-[#0A0A0B]">
      {lang && (
        <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider font-mono text-[#71717A] border-b border-[#27272A] bg-[#18181B]">{lang}</div>
      )}
      <pre className="p-4 text-[12px] leading-relaxed text-[#E4E4E7] overflow-x-auto font-mono"><code>{text}</code></pre>
      <button
        onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
        className="absolute top-2 right-2 px-2 py-1 rounded-md bg-[#27272A] border border-[#3F3F46] text-[10px] font-medium text-[#A1A1AA] hover:text-[#FAFAFA] hover:bg-[#3F3F46] inline-flex items-center gap-1"
      >
        {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

function RichBody({ blocks }: { blocks: Block[] }) {
  return (
    <div className="max-w-[720px]">
      {blocks.map((b, i) => {
        switch (b.kind) {
          case "p":
            return <p key={i} className="text-[15px] leading-relaxed text-[#D4D4D8] my-3">{b.text}</p>;
          case "h2":
            return <h2 key={i} className="text-[20px] font-bold text-[#FAFAFA] mt-8 mb-3 font-[family-name:var(--font-space-grotesk)]">{b.text}</h2>;
          case "h3":
            return <h3 key={i} className="text-[15px] font-semibold text-[#FAFAFA] mt-5 mb-2">{b.text}</h3>;
          case "ul":
            return (
              <ul key={i} className="my-3 space-y-1.5 text-[14px] text-[#D4D4D8] list-disc list-outside ml-5">
                {b.items.map((it, j) => <li key={j} className="leading-relaxed">{it}</li>)}
              </ul>
            );
          case "ol":
            return (
              <ol key={i} className="my-3 space-y-1.5 text-[14px] text-[#D4D4D8] list-decimal list-outside ml-5">
                {b.items.map((it, j) => <li key={j} className="leading-relaxed">{it}</li>)}
              </ol>
            );
          case "code":
            return <CodeBlock key={i} text={b.text} lang={b.lang} />;
          case "callout": {
            const tone = CALLOUT_TONE[b.tone];
            const Icon = tone.icon;
            return (
              <div key={i} className={`my-5 p-4 rounded-xl ring-1 ${tone.bg} ${tone.ring}`}>
                <div className="flex items-start gap-3">
                  <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${tone.text}`} />
                  <div className="flex-1 min-w-0">
                    {b.title && <p className={`text-[13px] font-semibold ${tone.text} mb-1`}>{b.title}</p>}
                    <p className="text-[13px] leading-relaxed text-[#D4D4D8]">{b.text}</p>
                  </div>
                </div>
              </div>
            );
          }
          case "kv":
            return (
              <div key={i} className="my-4 rounded-xl border border-[#27272A] bg-[#18181B] overflow-hidden">
                {b.pairs.map((p, j) => (
                  <div key={j} className={`grid grid-cols-[140px,1fr] gap-3 px-4 py-2.5 ${j < b.pairs.length - 1 ? "border-b border-[#27272A]" : ""}`}>
                    <div className="text-[12px] font-semibold text-[#A1A1AA]">{p.key}</div>
                    <div className="text-[13px] text-[#E4E4E7] font-mono break-all">{p.value}</div>
                  </div>
                ))}
              </div>
            );
          case "image":
            return (
              <figure key={i} className="my-5 rounded-2xl overflow-hidden border border-[#27272A] bg-[#0F0F12]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={b.src}
                  alt={b.alt ?? b.caption}
                  className="w-full block"
                  onError={(e) => {
                    // Graceful fallback while screenshots aren't filled in yet
                    const img = e.currentTarget;
                    const placeholder = img.nextElementSibling as HTMLDivElement | null;
                    img.style.display = "none";
                    if (placeholder) placeholder.style.display = "flex";
                  }}
                />
                <div className="aspect-[16/9] hidden items-center justify-center text-center px-6 py-4 text-[#52525B] bg-gradient-to-br from-[#1A1A1F] to-[#0F0F12]">
                  <div>
                    <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-[11px] uppercase tracking-wide font-semibold text-[#71717A] mb-1">Screenshot pending</p>
                    <p className="text-[12px] text-[#A1A1AA] max-w-md mx-auto">{b.caption}</p>
                    <p className="text-[10px] font-mono text-[#3F3F46] mt-3">{b.src}</p>
                  </div>
                </div>
                <figcaption className="px-4 py-2.5 text-[12px] text-[#71717A] leading-relaxed border-t border-[#27272A]">{b.caption}</figcaption>
              </figure>
            );
        }
      })}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────── */
/* Main Guide view                                                         */
/* ────────────────────────────────────────────────────────────────────── */

export default function Guide() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const articleId = searchParams.get("a") ?? SECTIONS[0].articles[0].id;
  const [query, setQuery] = useState("");
  const contentRef = useRef<HTMLDivElement | null>(null);

  // Resolve the current article + neighbors for prev/next nav.
  const flat = useMemo(() => ALL_ARTICLES, []);
  const currentIdx = Math.max(0, flat.findIndex((a) => a.id === articleId));
  const current = flat[currentIdx] ?? flat[0];
  const prev = currentIdx > 0 ? flat[currentIdx - 1] : null;
  const next = currentIdx < flat.length - 1 ? flat[currentIdx + 1] : null;

  // Reset scroll + search on article change.
  useEffect(() => { contentRef.current?.scrollTo({ top: 0 }); }, [articleId]);

  // Client-side search — match against title + blurb + body text.
  const matches = useMemo(() => {
    if (!query.trim()) return [] as Array<Article & { sectionTitle: string }>;
    const q = query.toLowerCase();
    return flat.filter((a) => {
      if (a.title.toLowerCase().includes(q) || a.blurb.toLowerCase().includes(q)) return true;
      for (const b of a.blocks) {
        if ("text" in b && (b as any).text?.toLowerCase().includes(q)) return true;
        if ("items" in b && (b.items as string[]).some((s) => s.toLowerCase().includes(q))) return true;
      }
      return false;
    }).slice(0, 8);
  }, [query, flat]);

  function go(id: string) {
    setQuery("");
    router.push(`${pathname}?a=${id}`);
  }

  return (
    <ProtectedLayout>
      <div className="flex h-full min-h-0">
        {/* ── Left rail: TOC ─────────────────────────────────────────── */}
        <aside className="hidden md:flex w-[260px] shrink-0 border-r border-[#1A1A1F] bg-[#0A0A0B] flex-col">
          <div className="px-5 py-5 border-b border-[#1A1A1F]">
            <div className="flex items-center gap-2 mb-1">
              <BookOpen className="w-4 h-4 text-[#8B5CF6]" />
              <h1 className="text-[15px] font-bold text-[#FAFAFA]">Guide</h1>
            </div>
            <p className="text-[11px] text-[#71717A]">Everything you need to use Snipr.</p>
          </div>

          {/* Search */}
          <div className="px-3 py-3 border-b border-[#1A1A1F]">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#52525B]" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search…"
                className="w-full pl-8 pr-2.5 py-1.5 rounded-md bg-[#18181B] border border-[#27272A] text-[12px] text-[#FAFAFA] placeholder:text-[#52525B] focus:outline-none focus:border-[#8B5CF6]/50 transition-colors"
              />
            </div>
            {matches.length > 0 && (
              <div className="mt-2 space-y-0.5 max-h-60 overflow-y-auto">
                {matches.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => go(m.id)}
                    className="w-full text-left px-2 py-1.5 rounded-md hover:bg-[#18181B] text-[11px] text-[#D4D4D8]"
                  >
                    <span className="text-[#71717A]">{m.sectionTitle} ›</span> {m.title}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* TOC */}
          {matches.length === 0 && (
            <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-5">
              {SECTIONS.map((s) => (
                <div key={s.id}>
                  <p className="px-2 mb-1.5 text-[10px] uppercase tracking-wider font-semibold text-[#52525B]">{s.title}</p>
                  <div className="space-y-0.5">
                    {s.articles.map((a) => {
                      const active = a.id === current.id;
                      return (
                        <button
                          key={a.id}
                          onClick={() => go(a.id)}
                          className={`w-full text-left px-2 py-1.5 rounded-md text-[12.5px] leading-snug transition-colors ${
                            active
                              ? "bg-[#8B5CF6]/15 text-[#FAFAFA] font-semibold ring-1 ring-[#8B5CF6]/30"
                              : "text-[#A1A1AA] hover:bg-[#18181B] hover:text-[#FAFAFA]"
                          }`}
                        >
                          {a.title}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>
          )}
        </aside>

        {/* ── Main content ──────────────────────────────────────────── */}
        <main ref={contentRef} className="flex-1 overflow-y-auto">
          <div className="max-w-[820px] mx-auto px-6 py-10">
            {/* Breadcrumb */}
            <div className="text-[12px] text-[#71717A] mb-2">
              {SECTIONS.find((s) => s.articles.some((a) => a.id === current.id))?.title} <span className="mx-1.5">›</span> {current.title}
            </div>

            <h1 className="text-[34px] font-bold text-[#FAFAFA] font-[family-name:var(--font-space-grotesk)] tracking-tight leading-tight">{current.title}</h1>
            <p className="text-[16px] text-[#A1A1AA] mt-2 mb-8">{current.blurb}</p>

            <RichBody blocks={current.blocks} />

            {/* prev/next */}
            <div className="mt-12 pt-6 border-t border-[#1A1A1F] grid grid-cols-2 gap-4">
              {prev ? (
                <button
                  onClick={() => go(prev.id)}
                  className="text-left p-4 rounded-xl border border-[#27272A] hover:border-[#3F3F46] bg-[#0F0F12] hover:bg-[#18181B] transition-all group"
                >
                  <div className="flex items-center gap-1.5 text-[11px] text-[#71717A] mb-1"><ChevronLeft className="w-3 h-3" /> Previous</div>
                  <p className="text-[14px] font-semibold text-[#FAFAFA] group-hover:text-[#A78BFA]">{prev.title}</p>
                </button>
              ) : <div />}
              {next ? (
                <button
                  onClick={() => go(next.id)}
                  className="text-right p-4 rounded-xl border border-[#27272A] hover:border-[#3F3F46] bg-[#0F0F12] hover:bg-[#18181B] transition-all group ml-auto w-full"
                >
                  <div className="flex items-center justify-end gap-1.5 text-[11px] text-[#71717A] mb-1">Next <ChevronRight className="w-3 h-3" /></div>
                  <p className="text-[14px] font-semibold text-[#FAFAFA] group-hover:text-[#A78BFA]">{next.title}</p>
                </button>
              ) : <div />}
            </div>
          </div>
        </main>
      </div>
    </ProtectedLayout>
  );
}
