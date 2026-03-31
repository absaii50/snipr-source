"use client";
import { useState, type FormEvent } from "react";
import { PublicNavbar } from "@/components/layout/PublicNavbar";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import {
  Link2, BarChart3, ArrowLeftRight, Sparkles, Check,
  Globe, Smartphone, QrCode, TrendingUp, Shield, Zap,
  ArrowRight, Star, Users, Lock, RefreshCcw, Tag,
  ChevronDown, ChevronUp, X, MapPin, Monitor, Layers,
  DollarSign, Clock, MousePointerClick, Eye,
  Share2, MessageSquare, BookOpen, Radio,
} from "lucide-react";

// ─── Static mock data ─────────────────────────────────────────────────────────

const mockLinks = [
  { slug: "launch-q2", dest: "notion.so/roadmap", clicks: 4821, trend: "+18%", tag: "campaign" },
  { slug: "product-hunt", dest: "producthunt.com/posts/snipr", clicks: 3102, trend: "+34%", tag: "social" },
  { slug: "email-spring", dest: "landing.snipr.sh/spring", clicks: 1987, trend: "+9%", tag: "email" },
];

const chartBars = [30,55,40,70,60,85,75,90,65,80,95,88,72,60,78,92,84,70,95,88,100,82,75,68,90,85,78,92,88,95];

const topCountries = [
  { flag: "🇺🇸", name: "United States", pct: 62 },
  { flag: "🇬🇧", name: "United Kingdom", pct: 14 },
  { flag: "🇩🇪", name: "Germany", pct: 9 },
  { flag: "🇫🇷", name: "France", pct: 7 },
  { flag: "🇨🇦", name: "Canada", pct: 5 },
];

const deviceSplit = [
  { label: "Mobile", pct: 54, color: "bg-[#728DA7]" },
  { label: "Desktop", pct: 36, color: "bg-[#877971]" },
  { label: "Tablet", pct: 10, color: "bg-[#4A4A52]" },
];

const routingRules = [
  { condition: "Country = US", destination: "snipr.sh/us-page", icon: Globe },
  { condition: "Device = Mobile", destination: "snipr.sh/mobile", icon: Smartphone },
  { condition: "A/B split 70/30", destination: "variant-a / variant-b", icon: Layers },
  { condition: "Default fallback", destination: "snipr.sh/main", icon: ArrowRight },
];

const twitterTestimonials = [
  {
    name: "Sarah M.",       handle: "@sarahm_growth",    bg: "#7B9EA6",
    text: "Snipr completely changed how we track campaign performance. We went from guessing to knowing exactly which links drove conversions.",
    tag: "#linkIntelligence",  rotate: "-1.4deg",
  },
  {
    name: "Alex Chen",      handle: "@alexchen_dev",     bg: "#8BA888",
    text: "The AI insights surfaced patterns we never would have caught manually. It's like having an analyst embedded in every link we share.",
    tag: "#aiPowered",         rotate: "1deg",
  },
  {
    name: "Priya R.",       handle: "@priyar_mktg",      bg: "#C4884A",
    text: "We shortened links before. Now we actually understand them. The difference between before and after Snipr is night and day.",
    tag: "#sniprEffect",       rotate: "-0.5deg",
  },
  {
    name: "Marcus T.",      handle: "@marcust_perf",     bg: "#9C7AB8",
    text: "Smart routing by device and location alone is worth it. Our link-in-bio now generates more qualified leads than our homepage.",
    tag: "#smartRouting",      rotate: "1.8deg",
  },
  {
    name: "Jordan Lee",     handle: "@jordanlee_cx",     bg: "#6A9E78",
    text: "The weekly AI digest saves me hours every Monday. I read it over coffee and know exactly what to tweak before the week begins.",
    tag: "#weeklyDigest",      rotate: "0.8deg",
  },
  {
    name: "Nadia K.",       handle: "@nadiak_brand",     bg: "#C47860",
    text: "Custom branded short links used to require three separate tools. Snipr replaces all of them in one elegant, fast platform.",
    tag: "#brandedLinks",      rotate: "-1.2deg",
  },
  {
    name: "Tom Okafor",     handle: "@tomokafor_ops",    bg: "#728DA7",
    text: "Bulk import saved us an entire afternoon. We migrated hundreds of links and had full analytics running by end of day.",
    tag: "#bulkImport",        rotate: "-1.8deg",
  },
  {
    name: "Chloe B.",       handle: "@chloeb_content",   bg: "#B87B9C",
    text: "QR codes, UTM tracking, retargeting pixels — all from a single link. Our campaigns finally feel as professional as our brand.",
    tag: "#everythingInOne",   rotate: "0.6deg",
  },
];

const comparisonFeatures = [
  { feature: "Custom branded slugs", snipr: true, bitly: "paid", tiny: false },
  { feature: "Real-time analytics", snipr: true, bitly: true, tiny: false },
  { feature: "Smart routing (geo/device/A-B)", snipr: true, bitly: false, tiny: false },
  { feature: "AI insights & summaries", snipr: true, bitly: false, tiny: false },
  { feature: "Custom domains", snipr: true, bitly: "paid", tiny: false },
  { feature: "Password protection", snipr: true, bitly: false, tiny: false },
  { feature: "Conversion tracking", snipr: true, bitly: false, tiny: false },
  { feature: "Team collaboration", snipr: true, bitly: "paid", tiny: false },
  { feature: "QR code generation", snipr: true, bitly: true, tiny: true },
  { feature: "Link expiration", snipr: true, bitly: "paid", tiny: false },
];

const useCases = [
  {
    icon: TrendingUp, label: "Growth Marketers",
    heading: "Run smarter campaigns with data you can act on",
    body: "Track every link across paid, organic, email, and social. Know exactly which channel drives results — and route traffic to the highest-performing variant automatically.",
    points: ["UTM-ready branded links", "Channel attribution", "A/B traffic splitting", "Conversion revenue tracking"],
  },
  {
    icon: Eye, label: "Content Creators",
    heading: "Turn your audience into measurable outcomes",
    body: "Share links that look great and tell the full story of your reach. See where your audience comes from, what they click, and which content performs best over time.",
    points: ["Branded link profiles", "Click & geography data", "QR codes for offline content", "Weekly AI performance digest"],
  },
  {
    icon: Users, label: "SaaS & Startup Teams",
    heading: "Manage links across your entire team at scale",
    body: "Onboard your team with roles and permissions, organize links by project, tag, or campaign, and access everything through our API or native integrations.",
    points: ["Team roles & permissions", "Tags and folder organization", "API access", "Custom domain per product"],
  },
];

const faqs = [
  { q: "Is Snipr really free to start?", a: "Yes. The Free plan is unlimited in time and includes up to 50 short links per month, basic click analytics, and QR code generation — no credit card needed." },
  { q: "Can I use my own custom domain?", a: "Yes. Pro and Business plans support custom domains. Just point your domain's DNS to Snipr and all your links will redirect from your branded domain." },
  { q: "How does smart routing work?", a: "Smart routing lets you create conditional rules for each link. Based on the visitor's country, device, time of day, or an A/B split, Snipr redirects them to the most relevant destination." },
  { q: "Is my link data private?", a: "Absolutely. Your link data is only visible to you and your team. We never sell data or use it for advertising. All data is stored securely with encryption at rest." },
  { q: "What does the AI do exactly?", a: "The AI reads your real analytics data and surfaces weekly performance summaries, flags unusual patterns, and answers plain-English questions like 'Which campaign had the best CTR last week?'" },
  { q: "Can I invite my team?", a: "Yes. Business plan users can invite unlimited team members, assign roles (owner, admin, member, viewer), and collaborate on links, campaigns, and reports." },
];

// ─── Cell helper for comparison table ─────────────────────────────────────────

function CompCell({ val }: { val: boolean | string }) {
  if (val === true) return (
    <div className="w-6 h-6 rounded-full bg-[#EBF5FF] border border-[#C8E4F6] flex items-center justify-center mx-auto">
      <Check className="w-3.5 h-3.5 text-[#728DA7]" />
    </div>
  );
  if (val === false) return (
    <div className="w-6 h-6 rounded-full bg-[#FFF0F0] border border-[#FECACA] flex items-center justify-center mx-auto">
      <X className="w-3.5 h-3.5 text-[#E57373]" />
    </div>
  );
  return <span className="text-[11px] font-semibold text-[#888] bg-[#F0F0F0] px-2.5 py-1 rounded-full">{val}</span>;
}

// ─── FAQ row (dark, used in dark sections) ───────────────────────────────────

function FaqRow({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-[#4A4A52] last:border-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-start justify-between py-5 text-left gap-4"
      >
        <span className={`text-[15px] font-semibold leading-snug transition-colors ${open ? "text-[#728DA7]" : "text-[#EFEFF0]"}`}>{q}</span>
        <span className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${open ? "border-[#728DA7] text-[#728DA7]" : "border-[#4A4A52] text-[#5A5C60]"}`}>
          {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </span>
      </button>
      {open && (
        <p className="pb-6 text-[14px] text-[#5A5C60] leading-[1.75] -mt-1">{a}</p>
      )}
    </div>
  );
}

// ─── FAQ row (light theme) ────────────────────────────────────────────────────

function LightFaqRow({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-white border border-[#E8E8E8] rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 text-left gap-4"
      >
        <span className="text-[13.5px] font-semibold text-[#1A1A1A] leading-snug">{q}</span>
        <span className={`flex-shrink-0 w-6 h-6 rounded-full border flex items-center justify-center transition-colors ${
          open ? "border-[#728DA7] bg-[#728DA7]/10 text-[#728DA7]" : "border-[#E0E0E0] text-[#BBBBBB]"
        }`}>
          {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </span>
      </button>
      {open && (
        <p className="px-5 pb-4 text-[13px] text-[#777] leading-[1.75] -mt-1 border-t border-[#F0F0F0] pt-3">{a}</p>
      )}
    </div>
  );
}

// ─── Testimonial card ─────────────────────────────────────────────────────────

function TweetCard({ t }: { t: typeof twitterTestimonials[0] }) {
  return (
    <div
      className="bg-white rounded-2xl p-5 flex flex-col gap-3 border border-[#F0F0F0] shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.07)] hover:shadow-[0_6px_32px_rgba(0,0,0,0.12)] transition-all duration-300 cursor-default"
      style={{ transform: `rotate(${t.rotate})` }}
    >
      {/* Header: avatar + name + verified */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0" style={{ background: t.bg }}>
            <img
              src={`https://i.pravatar.cc/80?u=${encodeURIComponent(t.name)}`}
              alt={t.name}
              className="w-full h-full object-cover"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
            />
          </div>
          <div>
            <p className="text-[13px] font-semibold text-[#111] leading-snug">{t.name}</p>
            <p className="text-[11.5px] text-[#BBBBBB] leading-snug">{t.handle}</p>
          </div>
        </div>
        <div className="w-[22px] h-[22px] rounded-full bg-[#EBF5FF] border border-[#C8E4F6] flex items-center justify-center flex-shrink-0">
          <svg viewBox="0 0 12 12" width="9" height="9" fill="none">
            <path d="M2 6.5 L4.5 9 L10 3" stroke="#3A94D4" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </div>
      {/* Body */}
      <p className="text-[13.5px] text-[#333] leading-[1.7]">{t.text}</p>
      {/* Tag */}
      <span className="text-[11.5px] font-semibold text-[#728DA7]">{t.tag}</span>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Home() {
  const [urlInput, setUrlInput] = useState("");
  const router = useRouter();

  const handleShorten = (e: FormEvent) => {
    e.preventDefault();
    if (urlInput.trim()) {
      router.push(`/signup?url=${encodeURIComponent(urlInput.trim())}`);
    } else {
      router.push("/signup");
    }
  };

  return (
    <div className="min-h-screen bg-[#080708] flex flex-col font-sans antialiased">
      <PublicNavbar />

      <main className="flex-1">

        {/* ══ 1. HERO ═══════════════════════════════════════════════════════════ */}
        <section className="bg-[#EBEBEB] pt-20 pb-0 overflow-hidden">
          {/* ── Text block ── */}
          <div className="container mx-auto px-6 max-w-5xl text-center pb-12">

            {/* Badge pill — announcement style */}
            <div className="inline-flex items-center gap-0 mb-8">
              <div className="inline-flex items-center bg-white border border-[#DEE6EF] rounded-full pl-1 pr-4 py-1 shadow-[0_1px_14px_rgba(114,141,167,0.14),0_0_0_1px_rgba(114,141,167,0.05)]">
                <span className="inline-flex items-center gap-1.5 bg-[#728DA7] text-white text-[9px] font-bold tracking-[0.05em] px-2.5 py-1.5 rounded-full mr-3 flex-shrink-0">
                  <span className="w-1 h-1 rounded-full bg-white/75 animate-pulse" />
                  NEW
                </span>
                <span className="text-[12.5px] font-medium text-[#444]">AI-powered link intelligence is live</span>
                <ArrowRight className="w-3.5 h-3.5 text-[#C0C0C0] ml-2.5 flex-shrink-0" />
              </div>
            </div>

            {/* Heading */}
            <h1 className="font-display font-black text-[36px] sm:text-[50px] md:text-[62px] lg:text-[72px] tracking-[-0.03em] text-[#0A0A0A] leading-[1.05] mb-7">
              Turn Long URLs into<br />
              <span className="relative inline-block">
                <span className="relative">
                  Short Links
                  <svg viewBox="0 0 220 12" className="absolute -bottom-1 left-0 w-full" preserveAspectRatio="none" aria-hidden="true">
                    <path d="M4 8 C40 3, 90 10, 140 5 C170 2, 200 8, 216 6" stroke="#728DA7" strokeWidth="3.5" fill="none" strokeLinecap="round"/>
                  </svg>
                </span>{" "}
                That Convert.
              </span>
            </h1>

            {/* Subtitle */}
            <p className="text-[16px] sm:text-[17px] text-[#666] leading-[1.75] max-w-[440px] mx-auto mb-10">
              Shorten, track &amp; route links with deep analytics — built for teams that move fast.
            </p>

            {/* URL input row */}
            <form onSubmit={handleShorten} className="flex items-stretch max-w-2xl mx-auto bg-white border border-[#CACACA] rounded-2xl overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.08)] mb-9 h-[58px]">
              {/* Chain link icon */}
              <div className="flex items-center justify-center w-[56px] flex-shrink-0 border-r border-[#E2E2E2]">
                <Link2 className="w-[18px] h-[18px] text-[#B0B0B0]" />
              </div>
              <input
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://www.example.com/long-url"
                className="flex-1 h-full px-4 text-[14px] text-[#222] placeholder:text-[#B8B8B8] outline-none bg-transparent"
                suppressHydrationWarning
              />
              <button
                type="submit"
                className="flex-shrink-0 h-full px-6 bg-[#111111] hover:bg-[#2a2a2a] active:bg-[#000] text-white text-[13.5px] font-bold tracking-[0.01em] transition-colors whitespace-nowrap"
              >
                Shorten for Free&nbsp;<span className="opacity-60 font-normal">→</span>
              </button>
            </form>

            {/* Social proof */}
            <div className="flex items-center justify-center gap-2.5">
              {/* Overlapping avatars */}
              <div className="flex items-center -space-x-2.5">
                {[47, 15, 32, 68].map((id) => (
                  <img
                    key={id}
                    src={`https://i.pravatar.cc/64?img=${id}`}
                    alt="Snipr user"
                    className="w-8 h-8 rounded-full border-[2.5px] border-[#EBEBEB] object-cover"
                  />
                ))}
              </div>
              <div className="flex items-center gap-1.5">
                <div className="flex gap-0.5">
                  {[0,1,2,3,4].map(i => (
                    <svg key={i} width="12" height="12" viewBox="0 0 12 12" fill="#F5A623">
                      <path d="M6 1l1.3 2.7 3 .4-2.2 2.1.5 3L6 7.8 3.4 9.2l.5-3L1.7 4.1l3-.4z"/>
                    </svg>
                  ))}
                </div>
                <span className="text-[13px] text-[#555] font-medium">1K+ people already using it.</span>
              </div>
              {/* Curly arrow */}
              <svg width="34" height="24" viewBox="0 0 34 24" fill="none" className="text-[#999]">
                <path d="M3 16 C5 8, 14 3, 24 9" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round"/>
                <path d="M21 6 L25 9 L22 13" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </div>

          {/* ── Link Hub illustration ── */}
          <div className="container mx-auto px-4 max-w-5xl">
            <svg
              viewBox="0 0 960 520"
              xmlns="http://www.w3.org/2000/svg"
              className="w-full"
              style={{ maxHeight: "420px" }}
            >
              <defs>
                <pattern id="hero-grid" x="0" y="0" width="28" height="28" patternUnits="userSpaceOnUse">
                  <circle cx="14" cy="14" r="1" fill="#B0B0AC" opacity="0.22"/>
                </pattern>
                <linearGradient id="linkGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#3E6078"/>
                  <stop offset="100%" stopColor="#728DA7"/>
                </linearGradient>
                <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#728DA7" stopOpacity="0.22"/>
                  <stop offset="100%" stopColor="#728DA7" stopOpacity="0"/>
                </linearGradient>
                <filter id="cardShadow" x="-12%" y="-12%" width="124%" height="148%">
                  <feDropShadow dx="0" dy="5" stdDeviation="12" floodColor="#000000" floodOpacity="0.06"/>
                </filter>
              </defs>

              {/* Background dot grid */}
              <rect width="960" height="520" fill="url(#hero-grid)"/>

              {/* ══ CONNECTOR LINES ══ */}
              {/* TL */}
              <line x1="316" y1="226" x2="228" y2="165" stroke="#C8D6E2" strokeWidth="1.5" strokeDasharray="5,4" strokeLinecap="round"/>
              {/* TC — straight up from pill top */}
              <line x1="480" y1="214" x2="480" y2="128" stroke="#C8D6E2" strokeWidth="1.5" strokeDasharray="5,4" strokeLinecap="round"/>
              {/* TR */}
              <line x1="644" y1="222" x2="730" y2="158" stroke="#C8D6E2" strokeWidth="1.5" strokeDasharray="5,4" strokeLinecap="round"/>
              {/* BL */}
              <line x1="316" y1="262" x2="192" y2="352" stroke="#C8D6E2" strokeWidth="1.5" strokeDasharray="5,4" strokeLinecap="round"/>
              {/* BC — straight down from pill bottom */}
              <line x1="480" y1="276" x2="480" y2="340" stroke="#C8D6E2" strokeWidth="1.5" strokeDasharray="5,4" strokeLinecap="round"/>
              {/* BR */}
              <line x1="644" y1="260" x2="728" y2="350" stroke="#C8D6E2" strokeWidth="1.5" strokeDasharray="5,4" strokeLinecap="round"/>

              {/* Endpoint dots */}
              <circle cx="228" cy="165" r="3.5" fill="#C8D6E2"/>
              <circle cx="480" cy="128" r="3.5" fill="#C8D6E2"/>
              <circle cx="730" cy="158" r="3.5" fill="#C8D6E2"/>
              <circle cx="192" cy="352" r="3.5" fill="#C8D6E2"/>
              <circle cx="480" cy="340" r="3.5" fill="#C8D6E2"/>
              <circle cx="728" cy="350" r="3.5" fill="#C8D6E2"/>

              {/* ══ CARD 1: TOP-LEFT — TOTAL CLICKS (with area chart) ══ */}
              <rect x="36" y="44" width="198" height="126" rx="16" fill="white" stroke="#EAEAE8" strokeWidth="1" filter="url(#cardShadow)"/>
              <text x="54" y="68" fontFamily="sans-serif" fontSize="8" fontWeight="700" fill="#BBBBBB" letterSpacing="0.6">TOTAL CLICKS</text>
              <text x="54" y="96" fontFamily="sans-serif" fontSize="29" fontWeight="800" fill="#0A0A0A">4.8K</text>
              <text x="114" y="96" fontFamily="sans-serif" fontSize="11" fontWeight="700" fill="#3B9A6A">↑ 12%</text>
              <text x="155" y="96" fontFamily="sans-serif" fontSize="8" fill="#CCCCCC">vs last wk</text>
              <line x1="54" y1="106" x2="216" y2="106" stroke="#F2F2F0" strokeWidth="1"/>
              {/* Filled area sparkline */}
              <path d="M56,153 L74,147 L92,150 L110,139 L128,145 L146,130 L164,135 L164,160 L56,160 Z" fill="url(#areaFill)"/>
              <polyline points="56,153 74,147 92,150 110,139 128,145 146,130 164,135"
                fill="none" stroke="#728DA7" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="164" cy="135" r="3.5" fill="#728DA7"/>
              <circle cx="164" cy="135" r="7" fill="#728DA7" opacity="0.14"/>

              {/* ══ CARD 2: TOP-CENTER — CLICK SOURCES ══ */}
              <rect x="350" y="10" width="260" height="120" rx="16" fill="white" stroke="#EAEAE8" strokeWidth="1" filter="url(#cardShadow)"/>
              <text x="368" y="34" fontFamily="sans-serif" fontSize="8" fontWeight="700" fill="#BBBBBB" letterSpacing="0.6">CLICK SOURCES</text>
              {/* Direct */}
              <circle cx="374" cy="55" r="4.5" fill="#728DA7"/>
              <text x="385" y="59" fontFamily="sans-serif" fontSize="9.5" fontWeight="600" fill="#444">Direct</text>
              <rect x="434" y="49" width="134" height="13" rx="6.5" fill="#F0F0EE"/>
              <rect x="434" y="49" width="56" height="13" rx="6.5" fill="#728DA7"/>
              <text x="574" y="59" fontFamily="sans-serif" fontSize="9" fontWeight="700" fill="#728DA7">42%</text>
              {/* Social */}
              <circle cx="374" cy="79" r="4.5" fill="#6D4AC4"/>
              <text x="385" y="83" fontFamily="sans-serif" fontSize="9.5" fontWeight="600" fill="#444">Social</text>
              <rect x="434" y="73" width="134" height="13" rx="6.5" fill="#F0F0EE"/>
              <rect x="434" y="73" width="47" height="13" rx="6.5" fill="#6D4AC4"/>
              <text x="574" y="83" fontFamily="sans-serif" fontSize="9" fontWeight="700" fill="#6D4AC4">35%</text>
              {/* Email */}
              <circle cx="374" cy="103" r="4.5" fill="#B45309"/>
              <text x="385" y="107" fontFamily="sans-serif" fontSize="9.5" fontWeight="600" fill="#444">Email</text>
              <rect x="434" y="97" width="134" height="13" rx="6.5" fill="#F0F0EE"/>
              <rect x="434" y="97" width="31" height="13" rx="6.5" fill="#B45309"/>
              <text x="574" y="107" fontFamily="sans-serif" fontSize="9" fontWeight="700" fill="#B45309">23%</text>
              <text x="368" y="124" fontFamily="sans-serif" fontSize="8" fill="#CCCCCC">from 4,812 total sessions this month</text>

              {/* ══ CARD 3: TOP-RIGHT — WORLDWIDE REACH ══ */}
              <rect x="720" y="36" width="220" height="128" rx="16" fill="white" stroke="#EAEAE8" strokeWidth="1" filter="url(#cardShadow)"/>
              <text x="738" y="60" fontFamily="sans-serif" fontSize="8" fontWeight="700" fill="#BBBBBB" letterSpacing="0.6">WORLDWIDE REACH</text>
              {/* Dot-map grid */}
              {([
                [740,78],[752,74],[764,78],[776,76],[788,80],[800,74],[812,78],[824,76],[836,80],[848,76],[860,80],[872,76],[884,78],[896,74],[908,78],
                [740,92],[752,88],[764,92],[776,88],[788,94],[800,88],[812,92],[824,88],[836,94],[848,88],[860,94],[872,90],[884,94],[896,88],[908,92],
                [740,106],[752,102],[764,106],[776,102],[788,108],[800,102],[812,108],[824,104],[836,108],[848,104],[860,108],[872,104],[884,108],[896,102],[908,106],
                [740,120],[752,116],[764,120],[776,116],[788,122],[800,116],[812,120],[824,116],[836,122],[848,118],[860,122],[872,118],[884,122],[896,116],[908,120],
              ] as const).map(([cx, cy], i) => (
                <circle key={i} cx={cx} cy={cy} r={1.5} fill="#E4EDF4"/>
              ))}
              {/* Active country highlights */}
              {([
                { cx: 764, cy: 78, r: 5,   clr: "#728DA7" },
                { cx: 836, cy: 92, r: 5.5, clr: "#728DA7" },
                { cx: 800, cy: 108, r: 4,  clr: "#3B9A6A" },
                { cx: 872, cy: 76, r: 4.5, clr: "#728DA7" },
                { cx: 752, cy: 116, r: 4,  clr: "#B45309" },
                { cx: 896, cy: 106, r: 4.5, clr: "#3B9A6A" },
              ] as const).map((d, i) => (
                <g key={i}>
                  <circle cx={d.cx} cy={d.cy} r={d.r + 3} fill={d.clr} opacity="0.12"/>
                  <circle cx={d.cx} cy={d.cy} r={d.r} fill={d.clr} opacity="0.8"/>
                </g>
              ))}
              <text x="738" y="154" fontFamily="sans-serif" fontSize="14" fontWeight="800" fill="#0A0A0A">38 countries</text>
              <text x="824" y="154" fontFamily="sans-serif" fontSize="10" fill="#AAAAAA">· 6 continents</text>

              {/* ══ CENTRAL LINK BADGE ══ */}
              {/* Outer glow ring */}
              <rect x="300" y="200" width="360" height="80" rx="40" fill="#728DA7" opacity="0.08"/>
              {/* Drop shadow */}
              <rect x="316" y="228" width="328" height="60" rx="30" fill="rgba(0,0,0,0.10)"/>
              {/* Main pill */}
              <rect x="310" y="214" width="340" height="62" rx="31" fill="url(#linkGrad)"/>
              {/* Specular highlight */}
              <rect x="312" y="216" width="336" height="30" rx="30" fill="rgba(255,255,255,0.09)"/>
              {/* Chain icon */}
              <rect x="334" y="230" width="22" height="13" rx="6.5" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2.2"/>
              <rect x="346" y="230" width="22" height="13" rx="6.5" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2.2"/>
              {/* URL */}
              <text x="382" y="251" fontFamily="monospace" fontSize="19" fontWeight="700" fill="white" letterSpacing="-0.3">snipr.sh/launch</text>
              {/* Copy icon */}
              <rect x="612" y="232" width="17" height="17" rx="4" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5"/>
              <rect x="616" y="228" width="15" height="15" rx="3.5" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5"/>

              {/* ── Secondary pills (between pill and BC card) ── */}
              <rect x="362" y="288" width="100" height="28" rx="14" fill="white" stroke="#DDE4EA" strokeWidth="1" filter="url(#cardShadow)"/>
              <circle cx="381" cy="302" r="4" fill="#28C840"/>
              <text x="391" y="306" fontFamily="sans-serif" fontSize="9.5" fontWeight="600" fill="#444">248 links</text>

              <rect x="474" y="288" width="104" height="28" rx="14" fill="white" stroke="#DDE4EA" strokeWidth="1" filter="url(#cardShadow)"/>
              <text x="489" y="306" fontFamily="sans-serif" fontSize="9.5" fontWeight="600" fill="#3B9A6A">↑ 10M clicks</text>

              {/* ══ CARD 4: BOTTOM-LEFT — QR CODE ══ */}
              <rect x="30" y="336" width="152" height="166" rx="16" fill="white" stroke="#EAEAE8" strokeWidth="1" filter="url(#cardShadow)"/>
              <text x="48" y="358" fontFamily="sans-serif" fontSize="8" fontWeight="700" fill="#BBBBBB" letterSpacing="0.6">QR CODE</text>
              {/* TL corner mark */}
              <rect x="48" y="366" width="24" height="24" rx="4.5" fill="#0A0A0A"/>
              <rect x="51" y="369" width="18" height="18" rx="3" fill="white"/>
              <rect x="54" y="372" width="12" height="12" rx="1.5" fill="#0A0A0A"/>
              {/* TR corner mark */}
              <rect x="100" y="366" width="24" height="24" rx="4.5" fill="#0A0A0A"/>
              <rect x="103" y="369" width="18" height="18" rx="3" fill="white"/>
              <rect x="106" y="372" width="12" height="12" rx="1.5" fill="#0A0A0A"/>
              {/* BL corner mark */}
              <rect x="48" y="416" width="24" height="24" rx="4.5" fill="#0A0A0A"/>
              <rect x="51" y="419" width="18" height="18" rx="3" fill="white"/>
              <rect x="54" y="422" width="12" height="12" rx="1.5" fill="#0A0A0A"/>
              {/* QR data modules */}
              {([
                [76,368],[84,368],[76,376],[84,380],[92,368],[92,378],
                [76,388],[84,388],[92,383],[76,396],[90,396],[97,390],
                [76,404],[84,400],[92,404],[98,399],[106,368],[106,378],
                [106,388],[113,364],[113,374],[113,385],[119,370],[119,380],
                [119,391],[106,416],[113,410],[113,420],[119,406],[119,417],
                [76,418],[86,422],[97,414],[97,422],
              ] as const).map(([x, y], i) => (
                <rect key={i} x={x} y={y} width="6" height="6" rx="1.5" fill="#0A0A0A" opacity={0.5 + (i % 5) * 0.1}/>
              ))}
              {/* Snipr "S" center mark */}
              <rect x="90" y="393" width="18" height="18" rx="5" fill="#728DA7"/>
              <text x="95" y="406" fontFamily="sans-serif" fontSize="10" fontWeight="800" fill="white">S</text>
              <line x1="48" y1="450" x2="162" y2="450" stroke="#F5F5F5" strokeWidth="1"/>
              <text x="48" y="466" fontFamily="sans-serif" fontSize="10.5" fontWeight="700" fill="#0A0A0A">Auto-generated</text>
              <text x="48" y="481" fontFamily="sans-serif" fontSize="9" fill="#AAAAAA">PNG · SVG · PDF</text>

              {/* ══ CARD 5: BOTTOM-CENTER — LIVE ACTIVITY FEED ══ */}
              <rect x="198" y="340" width="462" height="158" rx="16" fill="white" stroke="#EAEAE8" strokeWidth="1" filter="url(#cardShadow)"/>
              {/* Header */}
              <circle cx="220" cy="360" r="5" fill="#28C840"/>
              <circle cx="220" cy="360" r="10" fill="#28C840" opacity="0.12"/>
              <text x="234" y="364" fontFamily="sans-serif" fontSize="8" fontWeight="700" fill="#BBBBBB" letterSpacing="0.6">LIVE ACTIVITY</text>
              <text x="548" y="364" fontFamily="sans-serif" fontSize="8" fill="#E0E0E0">updated now</text>
              <line x1="214" y1="374" x2="644" y2="374" stroke="#F5F5F3" strokeWidth="1"/>
              {/* Activity rows */}
              {([
                { clr: "#728DA7", init: "AM", name: "Alex M.",  link: "snipr.sh/promo",  loc: "New York · US",  time: "2s" },
                { clr: "#3B9A6A", init: "SK", name: "Sarah K.", link: "snipr.sh/launch", loc: "London · UK",     time: "8s" },
                { clr: "#6D4AC4", init: "YT", name: "Yuki T.",  link: "snipr.sh/docs",   loc: "Tokyo · JP",     time: "15s" },
                { clr: "#B45309", init: "CR", name: "Chris R.", link: "snipr.sh/app",    loc: "Toronto · CA",   time: "22s" },
              ] as const).map((row, i) => (
                <g key={i}>
                  {i > 0 && <line x1="214" y1={376 + i * 34} x2="644" y2={376 + i * 34} stroke="#F8F8F6" strokeWidth="1"/>}
                  {/* Avatar */}
                  <circle cx="226" cy={392 + i * 34} r="11" fill={row.clr} opacity="0.12"/>
                  <circle cx="226" cy={392 + i * 34} r="11" fill="none" stroke={row.clr} strokeWidth="1.5" opacity="0.6"/>
                  <text x={row.init.length === 2 ? 220 : 223} y={396 + i * 34}
                    fontFamily="sans-serif" fontSize="7.5" fontWeight="700" fill={row.clr}>{row.init}</text>
                  {/* Name */}
                  <text x="244" y={396 + i * 34} fontFamily="sans-serif" fontSize="9.5" fontWeight="600" fill="#333">{row.name}</text>
                  {/* Link pill */}
                  <rect x="306" y={385 + i * 34} width="110" height="16" rx="8" fill="#F0F4F8"/>
                  <text x="313" y={396 + i * 34} fontFamily="monospace" fontSize="7.5" fill="#728DA7" fontWeight="600">{row.link}</text>
                  {/* Location */}
                  <text x="426" y={396 + i * 34} fontFamily="sans-serif" fontSize="9" fill="#C8C8C8">{row.loc}</text>
                  {/* Time badge */}
                  <rect x="596" y={385 + i * 34} width="38" height="16" rx="8" fill="#F5F5F3"/>
                  <text x="603" y={396 + i * 34} fontFamily="sans-serif" fontSize="8.5" fill="#AAAAAA">{row.time}</text>
                </g>
              ))}

              {/* ══ CARD 6: BOTTOM-RIGHT — DEVICE BREAKDOWN ══ */}
              <rect x="676" y="336" width="222" height="158" rx="16" fill="white" stroke="#EAEAE8" strokeWidth="1" filter="url(#cardShadow)"/>
              <text x="694" y="360" fontFamily="sans-serif" fontSize="8" fontWeight="700" fill="#BBBBBB" letterSpacing="0.6">DEVICE BREAKDOWN</text>
              {/* Mobile */}
              <text x="694" y="386" fontFamily="sans-serif" fontSize="10" fontWeight="600" fill="#555">Mobile</text>
              <rect x="744" y="374" width="132" height="15" rx="7.5" fill="#F0F0EE"/>
              <rect x="744" y="374" width="90" height="15" rx="7.5" fill="#728DA7"/>
              <text x="838" y="386" fontFamily="sans-serif" fontSize="9.5" fontWeight="700" fill="#728DA7">68%</text>
              {/* Desktop */}
              <text x="694" y="416" fontFamily="sans-serif" fontSize="10" fontWeight="600" fill="#555">Desktop</text>
              <rect x="744" y="404" width="132" height="15" rx="7.5" fill="#F0F0EE"/>
              <rect x="744" y="404" width="42" height="15" rx="7.5" fill="#B0CBE0"/>
              <text x="790" y="416" fontFamily="sans-serif" fontSize="9.5" fontWeight="700" fill="#728DA7">32%</text>
              {/* Tablet */}
              <text x="694" y="446" fontFamily="sans-serif" fontSize="10" fontWeight="600" fill="#555">Tablet</text>
              <rect x="744" y="434" width="132" height="15" rx="7.5" fill="#F0F0EE"/>
              <rect x="744" y="434" width="9" height="15" rx="5" fill="#D4DFE8"/>
              <text x="757" y="446" fontFamily="sans-serif" fontSize="9" fill="#CCCCCC">~0%</text>
              <line x1="694" y1="458" x2="876" y2="458" stroke="#F2F2F0" strokeWidth="1"/>
              <text x="694" y="477" fontFamily="sans-serif" fontSize="9" fill="#C0C0C0">4,812 sessions · Jan 2024</text>

              {/* ══ Ambient glow dots ══ */}
              <circle cx="480" cy="160" r="6" fill="#728DA7" opacity="0.09"/>
              <circle cx="504" cy="146" r="4" fill="#728DA7" opacity="0.06"/>
              <circle cx="456" cy="148" r="5" fill="#728DA7" opacity="0.07"/>
              <circle cx="480" cy="386" r="6" fill="#728DA7" opacity="0.09"/>
              <circle cx="506" cy="400" r="4" fill="#728DA7" opacity="0.06"/>
              <circle cx="454" cy="402" r="5" fill="#728DA7" opacity="0.07"/>
            </svg>
          </div>
        </section>


        {/* ══ 2. WHY CHOOSE US ══════════════════════════════════════════════════ */}
        <section className="bg-white py-24 overflow-hidden">
          <div className="container mx-auto px-6 max-w-3xl text-center">

            {/* Sparkle icon */}
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none" className="mx-auto mb-4 text-[#1A1A1A]">
              <path d="M14 2 L15.5 12 L26 14 L15.5 16 L14 26 L12.5 16 L2 14 L12.5 12 Z" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinejoin="round"/>
            </svg>

            {/* Eyebrow */}
            <p className="text-[10px] font-bold tracking-[0.28em] uppercase text-[#888] mb-7">
              Why Choose Us
            </p>

            {/* Body paragraph */}
            <p className="font-display text-[16px] sm:text-[18px] text-[#2A2A2A] leading-[1.72] max-w-[560px] mx-auto mb-14">
              We're not just another URL shortener. Our platform is built with a focus on{" "}
              <em className="not-italic font-semibold text-[#0A0A0A]">reliability, user experience,</em> and detailed analytics. Join thousands of users who trust us to simplify and amplify their digital presence.
            </p>

            {/* Stats row */}
            <div className="flex items-stretch justify-center divide-x divide-[#E0E0E0] mb-14">
              {[
                { value: "18K+", label: "Total Users", figures: 2 },
                { value: "1M+",  label: "Links Created", figures: 3 },
                { value: "10M+", label: "Redirected Links", figures: 4 },
              ].map(({ value, label, figures }) => (
                <div key={label} className="flex-1 px-8 flex flex-col items-center gap-3">
                  {/* Mini stick figures row */}
                  <div className="flex items-end justify-center gap-2 h-10">
                    {Array.from({ length: figures }).map((_, i) => (
                      <svg key={i} width="14" height="38" viewBox="0 0 14 38" fill="none" className="text-[#BBBBBB]">
                        <circle cx="7" cy="5" r="4.5" stroke="currentColor" strokeWidth="1.5"/>
                        <line x1="7" y1="9.5" x2="7" y2="24" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                        <line x1="7" y1="15" x2="2" y2="20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                        <line x1="7" y1="15" x2="12" y2="20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                        <line x1="7" y1="24" x2="3" y2="34" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                        <line x1="7" y1="24" x2="11" y2="34" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                      </svg>
                    ))}
                  </div>
                  {/* Divider line under figures */}
                  <div className="w-full h-px bg-[#E8E8E8]" />
                  {/* Number */}
                  <span
                    className="font-display font-black text-[36px] sm:text-[44px] leading-none tracking-[-0.04em]"
                    style={{ color: "transparent", WebkitTextStroke: "2px #C8C8C8", paintOrder: "stroke fill" }}
                  >
                    {value}
                  </span>
                  {/* Label */}
                  <span className="text-[10px] font-semibold tracking-[0.18em] uppercase text-[#AAAAAA]">{label}</span>
                </div>
              ))}
            </div>

            {/* Globe illustration */}
            <svg viewBox="0 0 320 220" width="260" height="180" className="mx-auto" fill="none" xmlns="http://www.w3.org/2000/svg">
              {/* Globe body */}
              <ellipse cx="160" cy="120" rx="72" ry="72" stroke="#1A1A1A" strokeWidth="2"/>
              {/* Latitude lines */}
              <path d="M88 120 Q160 100, 232 120" stroke="#1A1A1A" strokeWidth="1.2" strokeLinecap="round"/>
              <path d="M93 95 Q160 78, 227 95" stroke="#1A1A1A" strokeWidth="1.2" strokeLinecap="round"/>
              <path d="M93 145 Q160 162, 227 145" stroke="#1A1A1A" strokeWidth="1.2" strokeLinecap="round"/>
              <path d="M104 170 Q160 182, 216 170" stroke="#1A1A1A" strokeWidth="1.2" strokeLinecap="round"/>
              <path d="M105 72 Q160 60, 215 72" stroke="#1A1A1A" strokeWidth="1.2" strokeLinecap="round"/>
              {/* Vertical center meridian */}
              <path d="M160 48 Q178 84, 178 120 Q178 156, 160 192" stroke="#1A1A1A" strokeWidth="1.2" strokeLinecap="round"/>
              <path d="M160 48 Q142 84, 142 120 Q142 156, 160 192" stroke="#1A1A1A" strokeWidth="1.2" strokeLinecap="round"/>

              {/* Paper plane — top left orbiting */}
              <g transform="translate(62, 54) rotate(-30)">
                <polygon points="0,0 22,9 0,18" fill="none" stroke="#1A1A1A" strokeWidth="1.8" strokeLinejoin="round"/>
                <line x1="0" y1="9" x2="16" y2="9" stroke="#1A1A1A" strokeWidth="1.4" strokeLinecap="round"/>
              </g>
              {/* Arrow from plane toward globe */}
              <path d="M82 68 C100 70, 112 76, 118 86" stroke="#1A1A1A" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeDasharray="4,3"/>
              <polygon points="116,82 121,89 112,91" fill="#1A1A1A"/>

              {/* Paper plane — bottom right */}
              <g transform="translate(226, 156) rotate(20)">
                <polygon points="0,0 22,9 0,18" fill="none" stroke="#1A1A1A" strokeWidth="1.8" strokeLinejoin="round"/>
                <line x1="0" y1="9" x2="16" y2="9" stroke="#1A1A1A" strokeWidth="1.4" strokeLinecap="round"/>
              </g>
              <path d="M206 152 C215 150, 222 152, 226 156" stroke="#1A1A1A" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeDasharray="4,3"/>

              {/* Stick figure top-right of globe */}
              <circle cx="222" cy="64" r="7" fill="none" stroke="#1A1A1A" strokeWidth="1.6"/>
              <line x1="222" y1="71" x2="222" y2="90" stroke="#1A1A1A" strokeWidth="1.6" strokeLinecap="round"/>
              <line x1="222" y1="78" x2="215" y2="84" stroke="#1A1A1A" strokeWidth="1.6" strokeLinecap="round"/>
              <line x1="222" y1="78" x2="229" y2="84" stroke="#1A1A1A" strokeWidth="1.6" strokeLinecap="round"/>
              <line x1="222" y1="90" x2="217" y2="100" stroke="#1A1A1A" strokeWidth="1.6" strokeLinecap="round"/>
              <line x1="222" y1="90" x2="227" y2="100" stroke="#1A1A1A" strokeWidth="1.6" strokeLinecap="round"/>
              {/* Flag held by figure */}
              <line x1="229" y1="78" x2="236" y2="60" stroke="#1A1A1A" strokeWidth="1.4" strokeLinecap="round"/>
              <polygon points="236,60 248,64 236,68" fill="#1A1A1A"/>

              {/* Stick figure bottom-left */}
              <circle cx="98" cy="162" r="7" fill="none" stroke="#1A1A1A" strokeWidth="1.6"/>
              <line x1="98" y1="169" x2="98" y2="186" stroke="#1A1A1A" strokeWidth="1.6" strokeLinecap="round"/>
              <line x1="98" y1="175" x2="91" y2="181" stroke="#1A1A1A" strokeWidth="1.6" strokeLinecap="round"/>
              <line x1="98" y1="175" x2="105" y2="181" stroke="#1A1A1A" strokeWidth="1.6" strokeLinecap="round"/>
              <line x1="98" y1="186" x2="93" y2="196" stroke="#1A1A1A" strokeWidth="1.6" strokeLinecap="round"/>
              <line x1="98" y1="186" x2="103" y2="196" stroke="#1A1A1A" strokeWidth="1.6" strokeLinecap="round"/>
            </svg>

          </div>
        </section>

        {/* ══ 3. PLATFORM ══════════════════════════════════════════════════════ */}
        <section id="features" className="bg-white py-24 overflow-hidden border-t border-[#EBEBEB]"
          style={{ background: "radial-gradient(ellipse 80% 50% at 50% -10%, #EEF4F9 0%, white 60%)" }}>
          <div className="container mx-auto px-6 max-w-6xl">

            {/* ── Two-panel: feature list left + product mockup right ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 lg:gap-24 items-start">

              {/* ── LEFT: Header + icon feature list ── */}
              <div>
                {/* Eyebrow */}
                <div className="flex items-center gap-2 mb-4">
                  <span className="w-4 h-px bg-[#CCCCCC]"/>
                  <p className="platform-eyebrow text-[10px] font-bold tracking-[0.22em] uppercase">OUR PLATFORM</p>
                  <span className="w-4 h-px bg-[#CCCCCC]"/>
                </div>

                <h2 className="font-display font-black text-[28px] md:text-[38px] tracking-[-0.035em] text-[#0A0A0A] leading-[1.04] mb-4">
                  One tool.<br />
                  <span className="relative inline-block">
                    Everything links need.
                    <svg className="absolute -bottom-1 left-0 w-full" viewBox="0 0 320 8" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
                      <path d="M2 6 C60 2, 130 6, 200 4 C250 2, 290 6, 318 4" stroke="#728DA7" strokeWidth="2.5" strokeLinecap="round" fill="none" opacity="0.5"/>
                    </svg>
                  </span>
                </h2>
                <p className="text-[14px] text-[#888] leading-[1.65] mb-10 max-w-[340px]">
                  Replace a stack of disconnected tools with one unified platform built for scale.
                </p>

                {/* Feature list — icon tiles + spring-bounce CSS */}
                <div className="space-y-1">
                  {([
                    {
                      icon: <Link2 className="w-[17px] h-[17px]" strokeWidth={2}/>,
                      bg: "#EEF3F7", color: "#4A7C9B",
                      title: "URL Shortening",
                      desc: "Any URL → a clean short link instantly. Bulk import supported.",
                      tags: ["Instant","Bulk"],
                    },
                    {
                      icon: <BarChart3 className="w-[17px] h-[17px]" strokeWidth={2}/>,
                      bg: "#EDF7F3", color: "#2E7D5E",
                      title: "Link Analytics",
                      desc: "Real-time clicks, geo, device, browser & UTM — auto-tracked on every link.",
                      tags: ["Live","UTM","Geo"],
                    },
                    {
                      icon: <ArrowLeftRight className="w-[17px] h-[17px]" strokeWidth={2}/>,
                      bg: "#F1EEFB", color: "#6D4AC4",
                      title: "Smart Routing",
                      desc: "Route visitors by location, device, A/B split, or schedule. No code.",
                      tags: ["Geo","A/B"],
                    },
                    {
                      icon: <QrCode className="w-[17px] h-[17px]" strokeWidth={2}/>,
                      bg: "#FEF4E4", color: "#B45309",
                      title: "Custom Links & QR",
                      desc: "Branded aliases & auto-generated QR codes in SVG and PNG.",
                      tags: ["Branded","QR"],
                    },
                    {
                      icon: <Tag className="w-[17px] h-[17px]" strokeWidth={2}/>,
                      bg: "#FEE9F5", color: "#BE185D",
                      title: "Tags & Folders",
                      desc: "Organize hundreds of links across campaigns with smart filters.",
                      tags: ["Organize"],
                    },
                    {
                      icon: <Globe className="w-[17px] h-[17px]" strokeWidth={2}/>,
                      bg: "#EEF2FF", color: "#3730A3",
                      title: "Custom Domains",
                      desc: "Your own domain. Full DNS & SSL handling — zero developer effort.",
                      tags: ["SSL","DNS"],
                    },
                  ] as const).map(f => (
                    <div key={f.title} className="pf-row flex items-center gap-4 py-3.5">
                      {/* Icon tile */}
                      <div
                        className="pf-icon w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: f.bg, color: f.color }}
                      >
                        {f.icon}
                      </div>
                      {/* Text */}
                      <div className="flex-1 min-w-0">
                        <p className="text-[13.5px] font-semibold text-[#111] mb-0.5 leading-tight">{f.title}</p>
                        <p className="text-[11.5px] text-[#999] leading-snug">{f.desc}</p>
                      </div>
                      {/* Tags */}
                      <div className="flex gap-1 flex-shrink-0">
                        {f.tags.map(t => (
                          <span key={t} className="text-[9.5px] font-semibold text-[#B0B0B0] border border-[#EBEBEB] rounded-full px-2 py-0.5 whitespace-nowrap">{t}</span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* CTA */}
                <div className="flex items-center gap-3 mt-10 pt-6 border-t border-[#F0F0F0]">
                  <a href="/register" className="bg-[#0A0A0A] hover:bg-[#2A2A2A] text-white text-[13px] font-bold px-7 py-2.5 rounded-xl transition-colors inline-flex items-center gap-2">
                    Get Started
                    <span className="opacity-50 font-normal">· free</span>
                  </a>
                  <a href="/pricing" className="text-[13px] font-semibold text-[#666] hover:text-[#111] transition-colors inline-flex items-center gap-1">
                    See pricing <ArrowRight className="w-3.5 h-3.5"/>
                  </a>
                </div>
              </div>

              {/* ── RIGHT: Product mockup ── */}
              <div className="lg:sticky lg:top-24">
                {/* Floating badge above mockup */}
                <div className="flex items-center justify-end mb-3 pr-1">
                  <div className="inline-flex items-center gap-1.5 bg-[#EDF7F3] border border-[#BDE8D4] rounded-full px-3 py-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#2E7D5E] animate-pulse"/>
                    <span className="text-[10px] font-semibold text-[#2E7D5E]">Live analytics · updated now</span>
                  </div>
                </div>
                <div className="platform-mockup bg-[#F7F7F5] rounded-2xl p-3 border border-[#E8E8E8]"
                  style={{ boxShadow: "0 2px 4px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06)" }}>
                  <svg viewBox="0 0 480 420" className="w-full rounded-xl" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ maxHeight: "380px" }}>
                    {/* App shell */}
                    <rect width="480" height="420" rx="12" fill="white"/>

                    {/* Top bar */}
                    <rect width="480" height="44" fill="#FAFAFA" rx="12"/>
                    <rect width="480" height="44" y="32" fill="#FAFAFA"/>
                    <line x1="0" y1="44" x2="480" y2="44" stroke="#EBEBEB" strokeWidth="1"/>
                    <circle cx="18" cy="22" r="5" fill="#EDEDED"/>
                    <circle cx="34" cy="22" r="5" fill="#EDEDED"/>
                    <circle cx="50" cy="22" r="5" fill="#EDEDED"/>
                    <rect x="130" y="14" width="220" height="16" rx="8" fill="#F0F0EE"/>
                    <text x="178" y="26" fontFamily="monospace" fontSize="9" fill="#BBBBBB">snipr.sh/dashboard</text>

                    {/* Sidebar */}
                    <rect x="0" y="44" width="100" height="376" fill="#FAFAFA"/>
                    <line x1="100" y1="44" x2="100" y2="420" stroke="#EBEBEB" strokeWidth="1"/>
                    {/* Sidebar logo */}
                    <rect x="12" y="56" width="20" height="20" rx="5" fill="#0A0A0A"/>
                    <text x="17" y="71" fontFamily="sans-serif" fontSize="10" fontWeight="800" fill="white">S</text>
                    <text x="38" y="71" fontFamily="sans-serif" fontSize="10" fontWeight="700" fill="#1A1A1A">snipr</text>
                    {/* Sidebar items */}
                    {[
                      { y: 100, label: "Links",     active: true  },
                      { y: 124, label: "Analytics", active: false },
                      { y: 148, label: "QR Codes",  active: false },
                      { y: 172, label: "Routing",   active: false },
                      { y: 196, label: "Domains",   active: false },
                    ].map(item => (
                      <g key={item.y}>
                        {item.active && <rect x="6" y={item.y - 4} width="88" height="18" rx="6" fill="#0A0A0A"/>}
                        <text x="18" y={item.y + 9} fontFamily="sans-serif" fontSize="10"
                          fill={item.active ? "white" : "#AAAAAA"} fontWeight={item.active ? "600" : "400"}>
                          {item.label}
                        </text>
                      </g>
                    ))}

                    {/* Main area */}
                    {/* Page title row */}
                    <text x="116" y="70" fontFamily="sans-serif" fontSize="14" fontWeight="700" fill="#0A0A0A">My Links</text>
                    <rect x="360" y="56" width="104" height="24" rx="8" fill="#0A0A0A"/>
                    <text x="373" y="73" fontFamily="sans-serif" fontSize="10" fontWeight="600" fill="white">+ Create Link</text>

                    {/* Stat cards row */}
                    {[
                      { x: 116, label: "Total Links", val: "248" },
                      { x: 224, label: "Total Clicks", val: "48.2K" },
                      { x: 332, label: "This Month",   val: "6.1K" },
                    ].map(c => (
                      <g key={c.x}>
                        <rect x={c.x} y="90" width="96" height="52" rx="8" fill="#F7F7F5" stroke="#EBEBEB" strokeWidth="1"/>
                        <text x={c.x + 10} y="108" fontFamily="sans-serif" fontSize="8" fill="#AAAAAA">{c.label}</text>
                        <text x={c.x + 10} y="128" fontFamily="sans-serif" fontSize="16" fontWeight="800" fill="#0A0A0A">{c.val}</text>
                      </g>
                    ))}

                    {/* Table header */}
                    <rect x="112" y="154" width="356" height="22" fill="#F7F7F5"/>
                    {["SHORT LINK","DESTINATION","CLICKS","CREATED"].map((h,i) => (
                      <text key={h} x={[118,224,354,408][i]} y="168" fontFamily="sans-serif" fontSize="8" fontWeight="600" fill="#BBBBBB" letterSpacing="0.5">{h}</text>
                    ))}

                    {/* Table rows */}
                    {[
                      { sl:"snipr.sh/promo", dest:"landing-page.co/promo-2024", clicks:"1,842", date:"Jan 12" },
                      { sl:"snipr.sh/docs",  dest:"notion.so/workspace/docs",    clicks:"924",   date:"Jan 10" },
                      { sl:"snipr.sh/app",   dest:"app.example.com/download",    clicks:"3,210", date:"Jan 8"  },
                      { sl:"snipr.sh/sale",  dest:"shop.brand.com/winter-sale",  clicks:"672",   date:"Jan 5"  },
                      { sl:"snipr.sh/demo",  dest:"calendly.com/team/demo-call", clicks:"289",   date:"Jan 3"  },
                    ].map((row, i) => (
                      <g key={i}>
                        <line x1="112" y1={178 + i*36} x2="468" y2={178 + i*36} stroke="#F0F0F0" strokeWidth="1"/>
                        <rect x="118" y={180 + i*36} width="80" height="14" rx="7" fill={i === 0 ? "#728DA7" : "#F0F0EE"}/>
                        <text x="124" y={191 + i*36} fontFamily="monospace" fontSize="7.5" fill={i === 0 ? "white" : "#728DA7"} fontWeight="600">{row.sl}</text>
                        <text x="224" y={191 + i*36} fontFamily="monospace" fontSize="7.5" fill="#CCCCCC">{row.dest.substring(0,22)}...</text>
                        <text x="354" y={191 + i*36} fontFamily="sans-serif" fontSize="9" fontWeight="600" fill="#555">{row.clicks}</text>
                        <text x="408" y={191 + i*36} fontFamily="sans-serif" fontSize="8.5" fill="#AAAAAA">{row.date}</text>
                      </g>
                    ))}

                    {/* Analytics mini widget */}
                    <rect x="112" y="362" width="356" height="46" rx="8" fill="#F7F7F5" stroke="#EBEBEB" strokeWidth="1"/>
                    <text x="124" y="381" fontFamily="sans-serif" fontSize="9" fontWeight="600" fill="#999">TOTAL CLICKS · 7 DAYS</text>
                    {[22,34,28,46,38,54,48].map((h,i) => (
                      <rect key={i} x={280 + i*22} y={406-h} width="14" height={h} rx="3"
                        fill={i === 6 ? "#728DA7" : "#E0E8EE"} opacity={i === 6 ? 1 : 0.8}/>
                    ))}
                    <text x="124" y="399" fontFamily="sans-serif" fontSize="16" fontWeight="800" fill="#0A0A0A">6,129</text>
                    <text x="172" y="399" fontFamily="sans-serif" fontSize="10" fontWeight="600" fill="#3B9A6A">↑ 12%</text>
                  </svg>
                </div>
              </div>
            </div>

          </div>
        </section>


        {/* ══ 4. DEEP-DIVE: ANALYTICS ══════════════════════════════════════════ */}
        <section className="py-24 bg-[#EBEBEB] border-t border-[#E0E0E0] overflow-hidden">
          <div className="container mx-auto px-6 max-w-6xl">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
              {/* Left — copy */}
              <div>
                <div className="flex items-center gap-2.5 mb-5">
                  <div className="w-7 h-7 rounded-lg bg-[#EBF5FF] border border-[#C8E4F6] flex items-center justify-center flex-shrink-0">
                    <BarChart3 className="w-3.5 h-3.5 text-[#728DA7]" strokeWidth={2.2} />
                  </div>
                  <p className="text-[10px] font-bold tracking-[0.28em] uppercase text-[#888]">Analytics</p>
                </div>
                <h2 className="font-display text-[28px] md:text-[38px] font-black text-[#0A0A0A] tracking-[-0.035em] leading-[1.04] mb-5">
                  Know exactly where every click comes from.
                </h2>
                <p className="text-[15px] text-[#555] leading-[1.8] mb-8">
                  Snipr captures rich click data the moment someone hits your link — country, city, device, browser, referrer, and campaign parameters — all visible in one clean dashboard.
                </p>
                <ul className="space-y-3.5">
                  {[
                    "Geographic breakdown down to city level",
                    "Device, OS, and browser analytics",
                    "Referrer and UTM campaign tracking",
                    "Click trends over days, weeks, and months",
                  ].map((text) => (
                    <li key={text} className="flex items-start gap-3">
                      <div className="w-5 h-5 rounded-full bg-[#EBF5FF] border border-[#C8E4F6] flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Check className="w-3 h-3 text-[#728DA7]" />
                      </div>
                      <span className="text-[14px] text-[#444]">{text}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Right — analytics card */}
              <div className="bg-white rounded-2xl border border-[#E8E8E8] shadow-[0_2px_4px_rgba(0,0,0,0.04),0_12px_40px_rgba(0,0,0,0.07)] overflow-hidden">
                <div className="px-5 py-4 border-b border-[#F0F0F0] flex items-center justify-between">
                  <span className="text-[13px] font-bold text-[#0A0A0A]">Link Analytics · snipr.sh/launch</span>
                  <span className="text-[11px] bg-[#EBF5FF] text-[#728DA7] border border-[#C8E4F6] px-2.5 py-1 rounded-full font-semibold">Active</span>
                </div>
                <div className="p-5">
                  <div className="grid grid-cols-3 gap-3 mb-5">
                    {[
                      { l: "Total Clicks", v: "4,821", accent: true },
                      { l: "Unique", v: "3,104", accent: false },
                      { l: "CTR", v: "5.2%", accent: false },
                    ].map((s) => (
                      <div key={s.l} className="bg-[#F7F7F7] rounded-xl p-3 text-center border border-[#EBEBEB]">
                        <div className={`text-[18px] font-black leading-none mb-1 ${s.accent ? "text-[#728DA7]" : "text-[#0A0A0A]"}`}>{s.v}</div>
                        <div className="text-[11px] text-[#999]">{s.l}</div>
                      </div>
                    ))}
                  </div>
                  {/* Mini bar chart */}
                  <div className="mb-4">
                    <div className="flex items-end gap-1.5 h-16 mb-2">
                      {[28, 42, 35, 58, 44, 72, 65].map((h, i) => (
                        <div key={i} className="flex-1 rounded-t-sm" style={{ height: `${h}%`, background: i === 5 ? "#728DA7" : "#E8EFF4" }} />
                      ))}
                    </div>
                    <div className="flex justify-between text-[10px] text-[#BBBBBB]">
                      <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span className="text-[#728DA7] font-semibold">Sat</span><span>Sun</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold text-[#888] mb-3">Top countries</div>
                    <div className="space-y-2">
                      {topCountries.map((c) => (
                        <div key={c.name} className="flex items-center gap-3">
                          <span className="text-base leading-none">{c.flag}</span>
                          <span className="text-[12px] text-[#666] w-28 flex-shrink-0">{c.name}</span>
                          <div className="flex-1 h-1.5 bg-[#EBEBEB] rounded-full overflow-hidden">
                            <div className="h-full bg-[#728DA7] rounded-full transition-all" style={{ width: `${c.pct}%` }} />
                          </div>
                          <span className="text-[12px] text-[#999] w-8 text-right">{c.pct}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ══ 5. DEEP-DIVE: SMART ROUTING ══════════════════════════════════════ */}
        <section className="py-24 bg-white border-t border-[#EBEBEB] overflow-hidden">
          <div className="container mx-auto px-6 max-w-6xl">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">

              {/* Left — routing card */}
              <div className="order-2 lg:order-1">
                <div className="bg-white rounded-2xl border border-[#E8E8E8] shadow-[0_2px_4px_rgba(0,0,0,0.04),0_12px_40px_rgba(0,0,0,0.07)] overflow-hidden">
                  <div className="px-5 py-4 border-b border-[#F0F0F0] flex items-center justify-between">
                    <span className="text-[13px] font-bold text-[#0A0A0A]">Routing Rules · snipr.sh/campaign</span>
                    <span className="text-[11px] font-semibold text-[#728DA7] bg-[#EBF5FF] border border-[#C8E4F6] px-2.5 py-1 rounded-full">4 rules active</span>
                  </div>
                  <div className="p-5 space-y-2.5">
                    {routingRules.map((rule, i) => (
                      <div key={i} className="flex items-center gap-3 bg-[#F7F7F7] border border-[#EBEBEB] rounded-xl p-3.5 hover:border-[#D0DCE8] transition-colors">
                        <div className="w-8 h-8 rounded-lg bg-[#EBF5FF] border border-[#C8E4F6] flex items-center justify-center flex-shrink-0">
                          <rule.icon className="w-4 h-4 text-[#728DA7]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[12px] font-semibold text-[#111]">{rule.condition}</div>
                          <div className="text-[11.5px] text-[#999] truncate">→ {rule.destination}</div>
                        </div>
                        <div className="w-2 h-2 rounded-full bg-[#728DA7] flex-shrink-0" />
                      </div>
                    ))}
                    <div className="pt-1">
                      <div className="text-[11px] text-[#BBBBBB] text-center">Rules evaluate top → bottom · Last rule is default fallback</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right — copy */}
              <div className="order-1 lg:order-2">
                <div className="flex items-center gap-2.5 mb-5">
                  <div className="w-7 h-7 rounded-lg bg-[#F1EEFB] border border-[#D8D0F5] flex items-center justify-center flex-shrink-0">
                    <ArrowLeftRight className="w-3.5 h-3.5 text-[#6D4AC4]" strokeWidth={2.2} />
                  </div>
                  <p className="text-[10px] font-bold tracking-[0.28em] uppercase text-[#888]">Smart Routing</p>
                </div>
                <h2 className="font-display text-[28px] md:text-[38px] font-black text-[#0A0A0A] tracking-[-0.035em] leading-[1.04] mb-5">
                  One link, infinite destinations.
                </h2>
                <p className="text-[15px] text-[#555] leading-[1.8] mb-8">
                  Stop sending every visitor to the same page. Snipr's routing engine evaluates rules in real time and sends each person to the most relevant destination based on who they are.
                </p>
                <ul className="space-y-3.5">
                  {[
                    "Geo targeting — country and region rules",
                    "Device routing — mobile, desktop, tablet",
                    "A/B split testing with custom traffic weights",
                    "Rotator mode — cycle through destinations evenly",
                  ].map((text) => (
                    <li key={text} className="flex items-start gap-3">
                      <div className="w-5 h-5 rounded-full bg-[#EBF5FF] border border-[#C8E4F6] flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Check className="w-3 h-3 text-[#728DA7]" />
                      </div>
                      <span className="text-[14px] text-[#444]">{text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ══ 6. DEEP-DIVE: AI INSIGHTS ════════════════════════════════════════ */}
        <section className="py-24 bg-[#EBEBEB] border-t border-[#E0E0E0] overflow-hidden">
          <div className="container mx-auto px-6 max-w-6xl">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
              {/* Left — copy */}
              <div>
                <div className="flex items-center gap-2.5 mb-5">
                  <div className="w-7 h-7 rounded-lg bg-[#FEF4E4] border border-[#F5D9A0] flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-3.5 h-3.5 text-[#B45309]" strokeWidth={2.2} />
                  </div>
                  <p className="text-[10px] font-bold tracking-[0.28em] uppercase text-[#888]">AI Insights</p>
                </div>
                <h2 className="font-display text-[28px] md:text-[38px] font-black text-[#0A0A0A] tracking-[-0.035em] leading-[1.04] mb-5">
                  Ask questions.<br />Get real answers.
                </h2>
                <p className="text-[15px] text-[#555] leading-[1.8] mb-8">
                  Snipr reads your real analytics and surfaces weekly summaries, detects patterns you'd miss, and answers specific questions about your data in plain English.
                </p>
                <ul className="space-y-3.5">
                  {[
                    "Weekly performance summaries — no setup needed",
                    "Anomaly detection on unusual click spikes or drops",
                    "Ask what your best link was this month",
                    "Slug suggestions based on your destination URL",
                  ].map((text) => (
                    <li key={text} className="flex items-start gap-3">
                      <div className="w-5 h-5 rounded-full bg-[#EBF5FF] border border-[#C8E4F6] flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Check className="w-3 h-3 text-[#728DA7]" />
                      </div>
                      <span className="text-[14px] text-[#444]">{text}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Right — chat card */}
              <div className="bg-white rounded-2xl border border-[#E8E8E8] shadow-[0_2px_4px_rgba(0,0,0,0.04),0_12px_40px_rgba(0,0,0,0.07)] overflow-hidden">
                <div className="px-5 py-4 border-b border-[#F0F0F0] flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-[#EBF5FF] border border-[#C8E4F6] flex items-center justify-center">
                    <Sparkles className="w-3.5 h-3.5 text-[#728DA7]" />
                  </div>
                  <span className="text-[13px] font-bold text-[#0A0A0A]">AI Insights Assistant</span>
                  <span className="ml-auto text-[10px] font-semibold text-[#728DA7] bg-[#EBF5FF] border border-[#C8E4F6] px-2 py-0.5 rounded-full">Live</span>
                </div>
                <div className="p-5 space-y-4">
                  {/* AI summary */}
                  <div className="bg-[#F0F7FF] border border-[#D0E8F8] rounded-xl p-4">
                    <div className="text-[11px] font-semibold text-[#728DA7] mb-2 flex items-center gap-1.5">
                      <Sparkles className="w-3 h-3" /> Weekly Summary — Week 12
                    </div>
                    <p className="text-[12px] text-[#444] leading-relaxed">
                      Your links received <strong className="text-[#0A0A0A]">12,481 clicks</strong> this week (+23% vs last week). Top performer: <strong className="text-[#0A0A0A]">snipr.sh/launch-q2</strong> with 4,821 clicks. US traffic grew 31%. Mobile visitors converted at 2× the desktop rate.
                    </p>
                  </div>
                  {/* User question */}
                  <div className="flex justify-end">
                    <div className="bg-[#728DA7] text-white rounded-xl rounded-br-sm px-4 py-3 max-w-[80%]">
                      <p className="text-[12px]">Which link had the best CTR last month?</p>
                    </div>
                  </div>
                  {/* AI response */}
                  <div className="bg-[#F7F7F7] border border-[#EBEBEB] rounded-xl rounded-bl-sm px-4 py-3 max-w-[88%]">
                    <p className="text-[12px] text-[#444] leading-relaxed">
                      <strong className="text-[#0A0A0A]">snipr.sh/product-hunt</strong> had the highest CTR at <strong className="text-[#0A0A0A]">8.4%</strong> — well above your 3.1% average. It was shared in a Reddit post that drove 1,200 clicks in 24 hours.
                    </p>
                  </div>
                  {/* Input bar */}
                  <div className="flex items-center gap-2 bg-[#F7F7F7] border border-[#E8E8E8] rounded-xl px-4 py-3">
                    <span className="text-[12px] text-[#BBBBBB] flex-1">Ask about your link data...</span>
                    <div className="w-6 h-6 bg-[#728DA7] rounded-lg flex items-center justify-center">
                      <ArrowRight className="w-3 h-3 text-white" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ══ 7. HOW IT WORKS ══════════════════════════════════════════════════ */}
        <section className="py-24 bg-white border-t border-[#EBEBEB] overflow-hidden">
          <div className="container mx-auto px-6 max-w-5xl">
            <div className="text-center mb-20">
              <p className="text-[10px] font-bold tracking-[0.28em] uppercase text-[#888] mb-5">How it works</p>
              <h2 className="font-display text-[28px] md:text-[40px] font-black text-[#0A0A0A] tracking-[-0.035em] leading-[1.04]">
                Up and running in minutes.
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-x-8 gap-y-12">
              {([
                { n: "01", name: "Create",   icon: Link2,      iconBg: "#EBF5FF", iconColor: "#4A7C9B", desc: "Paste your URL, set a custom slug, add tags, and configure expiry or click limits." },
                { n: "02", name: "Share",    icon: Share2,     iconBg: "#EDF7F3", iconColor: "#2E7D5E", desc: "Deploy your branded link across ads, email, social, SMS, or as a QR code." },
                { n: "03", name: "Track",    icon: BarChart3,  iconBg: "#F1EEFB", iconColor: "#6D4AC4", desc: "Watch real-time click data, geographic breakdowns, and device splits in your dashboard." },
                { n: "04", name: "Optimise", icon: TrendingUp, iconBg: "#FEF4E4", iconColor: "#B45309", desc: "Review weekly summaries, adjust routing rules, and A/B test based on real data." },
              ] as const).map((item) => (
                <div key={item.n} className="flex flex-col items-start md:items-center text-left md:text-center">
                  <span className="font-display text-[56px] font-black leading-none tracking-tighter mb-3 select-none" style={{ color: "rgba(114,141,167,0.13)" }}>{item.n}</span>
                  <div
                    className="w-11 h-11 rounded-2xl flex items-center justify-center mb-4 shadow-[0_2px_8px_rgba(0,0,0,0.06)]"
                    style={{ background: item.iconBg }}
                  >
                    <item.icon className="w-5 h-5" style={{ color: item.iconColor }} strokeWidth={2.2} />
                  </div>
                  <h3 className="font-display text-[18px] font-black text-[#0A0A0A] mb-2.5">{item.name}</h3>
                  <p className="text-[13.5px] text-[#666] leading-[1.7]">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══ 8. USE CASES ══════════════════════════════════════════════════════ */}
        <section className="py-24 border-t border-[#EBEBEB] overflow-hidden"
          style={{ background: "radial-gradient(ellipse 90% 60% at 50% -5%, #EEF3F7 0%, #F7F7F5 55%, #F7F7F5 100%)" }}>
          <div className="container mx-auto px-6 max-w-6xl">

            {/* ── Header ── */}
            <div className="text-center max-w-2xl mx-auto mb-14">
              <div className="inline-flex items-center gap-2 mb-5">
                <span className="w-5 h-px bg-[#CCCCCC]" />
                <p className="text-[10px] font-bold tracking-[0.28em] uppercase text-[#888]">Use Cases</p>
                <span className="w-5 h-px bg-[#CCCCCC]" />
              </div>
              <h2 className="font-display text-[28px] md:text-[38px] font-black text-[#0A0A0A] tracking-[-0.035em] leading-[1.1] mb-4">
                Built for teams that do more<br className="hidden sm:block" /> than share links
              </h2>
              <p className="text-[15px] text-[#777] leading-[1.75] max-w-xl mx-auto">
                Whether you run campaigns, publish content, or manage growth across products — Snipr gives every team clearer data, better control, and smarter workflows.
              </p>
            </div>

            {/* ── Bento layout: 1 featured left + 2 stacked right ── */}
            <div className="grid grid-cols-1 lg:grid-cols-[55fr_45fr] gap-4">

              {/* ── Featured card: Growth Marketers (dark) ── */}
              <div className="bg-[#0C0C0C] rounded-3xl p-8 lg:p-10 flex flex-col relative overflow-hidden group min-h-[400px]">
                {/* Soft glow orbs */}
                <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full pointer-events-none" style={{ background: "radial-gradient(circle, rgba(114,141,167,0.18) 0%, transparent 70%)" }} />
                <div className="absolute -bottom-20 -left-20 w-56 h-56 rounded-full pointer-events-none" style={{ background: "radial-gradient(circle, rgba(114,141,167,0.10) 0%, transparent 70%)" }} />

                {/* Badge row */}
                <div className="flex items-center gap-2.5 mb-8">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform" style={{ background: "rgba(126,200,164,0.15)" }}>
                    <TrendingUp className="w-4.5 h-4.5 text-[#7EC8A4]" strokeWidth={2.2} />
                  </div>
                  <span className="text-[10px] font-bold tracking-[0.22em] uppercase text-[#7EC8A4]">Growth Marketers</span>
                </div>

                {/* Copy */}
                <h3 className="text-[20px] sm:text-[22px] font-black text-white leading-snug tracking-tight mb-4 max-w-[300px]">
                  Run smarter campaigns with measurable outcomes
                </h3>
                <p className="text-[13.5px] leading-[1.8] mb-9 max-w-sm" style={{ color: "rgba(255,255,255,0.48)" }}>
                  Track which channels drive performance, split traffic intelligently, and optimize every campaign with real analytics.
                </p>

                {/* Bullet pills grid */}
                <div className="grid grid-cols-2 gap-2 mt-auto">
                  {["UTM-ready branded links", "Channel attribution", "A/B traffic routing", "Conversion tracking"].map((pt) => (
                    <div key={pt} className="flex items-center gap-2 rounded-xl px-3 py-2.5" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}>
                      <Check className="w-3 h-3 flex-shrink-0 text-[#7EC8A4]" strokeWidth={2.5} />
                      <span className="text-[11.5px] leading-tight" style={{ color: "rgba(255,255,255,0.65)" }}>{pt}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Right stacked: 2 lighter cards ── */}
              <div className="flex flex-col gap-4">

                {/* Content Creators */}
                <div className="bg-white rounded-3xl p-7 flex flex-col border border-[#EBEBEB] hover:border-[#D8D0F5] hover:shadow-[0_8px_32px_rgba(109,74,196,0.07)] transition-all duration-300 group flex-1">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-9 h-9 rounded-xl bg-[#F1EEFB] flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                      <Eye className="w-4 h-4 text-[#6D4AC4]" strokeWidth={2.2} />
                    </div>
                    <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#6D4AC4]">Content Creators</span>
                  </div>
                  <h3 className="text-[16px] font-black text-[#0A0A0A] leading-snug tracking-tight mb-2.5">
                    Turn link clicks into audience insight
                  </h3>
                  <p className="text-[12.5px] text-[#777] leading-[1.7] mb-5">
                    Share cleaner links, understand what content performs, and see how your audience engages across channels.
                  </p>
                  <ul className="space-y-2 mt-auto">
                    {["Branded link profiles", "Click + geography data", "QR support for offline content", "Weekly AI summaries"].map((pt) => (
                      <li key={pt} className="flex items-center gap-2.5">
                        <div className="w-3.5 h-3.5 rounded-full bg-[#F1EEFB] flex items-center justify-center flex-shrink-0">
                          <Check className="w-2 h-2 text-[#6D4AC4]" strokeWidth={2.8} />
                        </div>
                        <span className="text-[12px] text-[#555]">{pt}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* SaaS & Startup Teams */}
                <div className="bg-white rounded-3xl p-7 flex flex-col border border-[#EBEBEB] hover:border-[#C8E4F6] hover:shadow-[0_8px_32px_rgba(74,124,155,0.07)] transition-all duration-300 group flex-1">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-9 h-9 rounded-xl bg-[#EBF5FF] flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                      <Users className="w-4 h-4 text-[#4A7C9B]" strokeWidth={2.2} />
                    </div>
                    <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#4A7C9B]">SaaS & Startup Teams</span>
                  </div>
                  <h3 className="text-[16px] font-black text-[#0A0A0A] leading-snug tracking-tight mb-2.5">
                    Manage links across products, teams, and campaigns
                  </h3>
                  <p className="text-[12.5px] text-[#777] leading-[1.7] mb-5">
                    Organize shared link workflows with domains, permissions, tags, and reporting built for scale.
                  </p>
                  <ul className="space-y-2 mt-auto">
                    {["Team roles and permissions", "Tags and folders", "API access", "Custom domains"].map((pt) => (
                      <li key={pt} className="flex items-center gap-2.5">
                        <div className="w-3.5 h-3.5 rounded-full bg-[#EBF5FF] flex items-center justify-center flex-shrink-0">
                          <Check className="w-2 h-2 text-[#4A7C9B]" strokeWidth={2.8} />
                        </div>
                        <span className="text-[12px] text-[#555]">{pt}</span>
                      </li>
                    ))}
                  </ul>
                </div>

              </div>
            </div>

            {/* ── Optional CTA ── */}
            <div className="flex justify-center mt-10">
              <a href="/register" className="inline-flex items-center gap-2 text-[13px] font-semibold text-[#555] hover:text-[#0A0A0A] border border-[#DCDCDC] hover:border-[#AAAAAA] bg-white rounded-full px-6 py-2.5 transition-all shadow-sm hover:shadow-md">
                Start free — no credit card needed
                <ArrowRight className="w-3.5 h-3.5" />
              </a>
            </div>

          </div>
        </section>

        {/* ══ 9. COMPARISON TABLE ═══════════════════════════════════════════════ */}
        <section className="py-24 bg-white border-t border-[#EBEBEB] overflow-hidden">
          <div className="container mx-auto px-6 max-w-4xl">
            <div className="text-center mb-16">
              <p className="text-[10px] font-bold tracking-[0.28em] uppercase text-[#888] mb-5">Compare</p>
              <h2 className="font-display text-[28px] md:text-[40px] font-black text-[#0A0A0A] tracking-[-0.035em] leading-[1.04]">Why teams choose Snipr</h2>
              <p className="mt-4 text-[15px] text-[#666] leading-[1.75]">We pack in features that other tools charge extra for — or don't offer at all.</p>
            </div>
            <div className="overflow-hidden rounded-2xl border border-[#E8E8E8] shadow-[0_2px_4px_rgba(0,0,0,0.04),0_12px_40px_rgba(0,0,0,0.06)]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#EBEBEB] bg-[#F7F7F7]">
                    <th className="text-left px-6 py-4 text-[#888] font-semibold text-[12px] w-1/2">Feature</th>
                    <th className="text-center px-4 py-4 font-extrabold w-1/6 bg-[#F0F7FF] border-x border-[#C8E4F6]">
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-[14px] text-[#728DA7]">Snipr</span>
                        <span className="text-[9px] bg-[#728DA7] text-white px-2 py-0.5 rounded-full font-bold tracking-wide">YOU'RE HERE</span>
                      </div>
                    </th>
                    <th className="text-center px-4 py-4 text-[#AAAAAA] font-semibold text-[13px] w-1/6">Bitly</th>
                    <th className="text-center px-4 py-4 text-[#AAAAAA] font-semibold text-[13px] w-1/6">TinyURL</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonFeatures.map((row, i) => (
                    <tr key={row.feature} className={`border-b border-[#F0F0F0] last:border-0 ${i % 2 === 0 ? "bg-white" : "bg-[#FAFAFA]"}`}>
                      <td className="px-6 py-3.5 text-[13px] text-[#444]">{row.feature}</td>
                      <td className="px-4 py-3.5 text-center bg-[#F5FAFF] border-x border-[#E4F0FA]"><CompCell val={row.snipr} /></td>
                      <td className="px-4 py-3.5 text-center"><CompCell val={row.bitly} /></td>
                      <td className="px-4 py-3.5 text-center"><CompCell val={row.tiny} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ══ 10. INTEGRATIONS ══════════════════════════════════════════════════ */}
        <section className="py-24 bg-[#EBEBEB] border-t border-[#E0E0E0] overflow-hidden">
          <div className="container mx-auto px-6 max-w-6xl">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-16 items-start">

              {/* Left — header */}
              <div className="lg:col-span-1">
                <p className="text-[10px] font-bold tracking-[0.28em] uppercase text-[#888] mb-5">Integrations</p>
                <h2 className="font-display text-[28px] md:text-[38px] font-black text-[#0A0A0A] tracking-[-0.035em] leading-[1.04] mb-5">
                  Works with<br />your stack.
                </h2>
                <p className="text-[15px] text-[#555] leading-[1.8] mb-8">
                  Connect Snipr to the tools you already use. Automate workflows and surface link data where your team works.
                </p>
                <div className="inline-flex items-center gap-2 text-[12px] font-semibold text-[#888] bg-white border border-[#E0E0E0] rounded-full px-4 py-2 shadow-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#728DA7]" />
                  REST API &amp; webhooks included
                </div>
              </div>

              {/* Right — integration cards */}
              <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {([
                  {
                    name: "Slack", bg: "#4A154B", desc: "Get click alerts and weekly reports in your channels.",
                    icon: (
                      <svg viewBox="0 0 24 24" className="w-[19px] h-[19px]" fill="white">
                        <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zm0 1.271a2.527 2.527 0 0 1 2.521 2.521 2.527 2.527 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zm10.123 2.521a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zm-1.268 0a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zm-2.523 10.123a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zm0-1.268a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/>
                      </svg>
                    ),
                  },
                  {
                    name: "Zapier", bg: "#FF4A00", desc: "Connect Snipr to 5,000+ apps without writing code.",
                    icon: (
                      <svg viewBox="0 0 24 24" className="w-[19px] h-[19px]" fill="white">
                        <path d="M24 11.25l-3.754 3.755h-5.937l4.442-3.755H24zM14.25 9V3.046L10.5 6.754 6.75 3.046V9L3 12.75l3.75 3.75V21l3.75-3.683L14.25 21v-4.5l3.75-3.75L14.25 9zM5.999 11.25H0V15h5.308L1.5 18.754h5.937l4.313-3.755V11.25L7.5 7.5H1.563L5.999 11.25z"/>
                      </svg>
                    ),
                  },
                  {
                    name: "Google Analytics", bg: "#E8710A", desc: "Pass UTM parameters to GA4 on every tracked click.",
                    icon: (
                      <svg viewBox="0 0 24 24" className="w-[19px] h-[19px]" fill="white">
                        <path d="M22.84 2.9988C22.84 1.3428 21.492 0 19.8405 0c-1.6561 0-3.0005 1.3428-3.0005 2.9988v18.0025C16.84 22.657 18.1844 24 19.8405 24c1.6515 0 2.9995-1.343 2.9995-2.9987V2.9988zM14.1584 9.0006c0-1.6561-1.3435-2.9989-2.9995-2.9989-1.656 0-2.9995 1.3428-2.9995 2.9989v11.9987C8.1594 22.657 9.503 24 11.1589 24c1.656 0 2.9995-1.343 2.9995-2.9987V9.0006zM5.16 17.9994C5.16 16.3434 3.817 15 2.16 15 .504 15-.0005 16.3434-.0005 17.9994v3.0019C-.0005 22.657 1.343 24 2.999 24c1.656 0 3.161-1.343 3.161-2.9987v-3.0019z"/>
                      </svg>
                    ),
                  },
                  {
                    name: "HubSpot", bg: "#FF7A59", desc: "Sync link click data with your CRM contacts.",
                    icon: (
                      <svg viewBox="0 0 24 24" className="w-[19px] h-[19px]" fill="white">
                        <path d="M22.052 10.016h-.001a3.304 3.304 0 0 0-1.942-1.026V6.51a1.74 1.74 0 0 0 1.008-1.566 1.74 1.74 0 0 0-1.74-1.74 1.74 1.74 0 0 0-1.74 1.74c0 .69.4 1.286.983 1.573v2.478a3.305 3.305 0 0 0-1.578.87l-6.79-5.285a2.6 2.6 0 0 0 .095-.66A2.621 2.621 0 0 0 7.727 1.3a2.621 2.621 0 0 0-2.62 2.62 2.621 2.621 0 0 0 2.62 2.62c.498 0 .96-.143 1.354-.385l6.677 5.196a3.302 3.302 0 0 0-.34 2.627l-2.116 1.492a2.452 2.452 0 0 0-1.605-.597 2.461 2.461 0 0 0-2.46 2.46 2.461 2.461 0 0 0 2.46 2.46 2.461 2.461 0 0 0 2.46-2.46c0-.1-.013-.198-.03-.294l2.059-1.451a3.31 3.31 0 0 0 4.57-.993 3.308 3.308 0 0 0-.704-4.579z"/>
                      </svg>
                    ),
                  },
                  {
                    name: "Notion", bg: "#111111", desc: "Embed live link analytics inside your workspace.",
                    icon: (
                      <svg viewBox="0 0 24 24" className="w-[19px] h-[19px]" fill="white">
                        <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.047.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952L12.21 19s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.14c-.093-.514.28-.887.747-.933zM1.936 1.035l13.31-.98c1.634-.14 2.055-.047 3.082.7l4.249 2.986c.7.513.934.653.934 1.213v16.378c0 1.026-.373 1.634-1.68 1.726l-15.458.934c-.98.047-1.448-.093-1.962-.747l-3.129-4.06c-.56-.747-.793-1.306-.793-1.96V2.667c0-.839.374-1.54 1.447-1.632z"/>
                      </svg>
                    ),
                  },
                  {
                    name: "Webhooks", bg: "#728DA7", desc: "Fire custom events to any endpoint on each click.",
                    icon: (
                      <svg viewBox="0 0 24 24" className="w-[19px] h-[19px]" fill="white">
                        <path d="M8.188 18.816c-.424.424-.636.63-.865.708a1.125 1.125 0 0 1-.736 0c-.229-.077-.44-.284-.864-.708L.436 14.128a1.5 1.5 0 0 1 0-2.121l4.5-4.5a1.5 1.5 0 0 1 2.121 0l.53.53-1.41 1.41-.53-.53-4.5 4.5 4.5 4.5.53-.53 1.41 1.41-.53.53.532-.531zm7.624 0 .53.53 4.5-4.5-4.5-4.5-.53.53-1.41-1.41.53-.53a1.5 1.5 0 0 1 2.121 0l4.5 4.5a1.5 1.5 0 0 1 0 2.121l-4.5 4.5c-.424.424-.635.63-.864.708a1.125 1.125 0 0 1-.736 0c-.229-.077-.441-.284-.865-.708l-.53-.53 1.41-1.41zM9.53 19.78l-1.06-1.06 6-6L15.53 13.78l-6 6z"/>
                      </svg>
                    ),
                  },
                ] as const).map((intg) => (
                  <div key={intg.name} className="flex items-start gap-4 p-5 rounded-xl bg-white border border-[#E8E8E8] hover:border-[#D0DCE8] hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)] transition-all cursor-default group">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-[0_2px_6px_rgba(0,0,0,0.12)] group-hover:scale-110 transition-transform"
                      style={{ background: intg.bg }}
                    >
                      {intg.icon}
                    </div>
                    <div>
                      <div className="text-[14px] font-semibold text-[#0A0A0A] mb-1">{intg.name}</div>
                      <div className="text-[12px] text-[#888] leading-[1.6]">{intg.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ══ 11. TESTIMONIALS ══════════════════════════════════════════════════ */}
        <section className="py-24 bg-[#FAFAFA] border-t border-[#EBEBEB] overflow-hidden">
          <div className="container mx-auto px-6 max-w-6xl">

            {/* ── Header ── */}
            <div className="text-center max-w-2xl mx-auto mb-16">
              <p className="text-[10px] font-bold tracking-[0.28em] uppercase text-[#888] mb-5">
                Testimonials
              </p>
              <h2 className="font-display font-black text-[28px] md:text-[40px] tracking-[-0.035em] text-[#0A0A0A] leading-[1.04] mb-6">
                Trusted by modern<br className="hidden md:block" /> teams worldwide
              </h2>
              <p className="text-[15px] text-[#666] leading-[1.8] italic max-w-lg mx-auto mb-3">
                "Snipr helped us turn simple short links into something measurable, scalable, and far more useful for growth."
              </p>
              <p className="text-[13px] font-semibold text-[#0A0A0A] tracking-tight">Sarah M., Growth Lead</p>
            </div>

            {/* ── Staggered 4-column wall — desktop ── */}
            <div className="hidden lg:grid grid-cols-4 gap-5">
              <div className="flex flex-col gap-5 pt-0">
                <TweetCard t={twitterTestimonials[0]} />
                <TweetCard t={twitterTestimonials[4]} />
              </div>
              <div className="flex flex-col gap-5 pt-10">
                <TweetCard t={twitterTestimonials[1]} />
                <TweetCard t={twitterTestimonials[5]} />
              </div>
              <div className="flex flex-col gap-5 pt-5">
                <TweetCard t={twitterTestimonials[2]} />
                <TweetCard t={twitterTestimonials[6]} />
              </div>
              <div className="flex flex-col gap-5 pt-14">
                <TweetCard t={twitterTestimonials[3]} />
                <TweetCard t={twitterTestimonials[7]} />
              </div>
            </div>

            {/* ── 2-col tablet / 1-col mobile fallback ── */}
            <div className="lg:hidden grid grid-cols-1 sm:grid-cols-2 gap-4">
              {twitterTestimonials.map((t) => (
                <TweetCard key={t.handle} t={t} />
              ))}
            </div>

            {/* ── Footer strip ── */}
            <div className="flex flex-col items-center gap-3 mt-20">
              <div className="flex items-center gap-4">
                <svg viewBox="0 0 48 18" width="44" height="16" fill="none">
                  <path d="M44 9 C38 5,30 3,22 5 C14 7,8 11,4 17" stroke="#D8D8D8" strokeWidth="1.4" strokeLinecap="round"/>
                  <path d="M38 5 C32 1,24 0,18 3" stroke="#D8D8D8" strokeWidth="1.2" strokeLinecap="round"/>
                  <path d="M42 12 C34 9,26 8,20 11" stroke="#D8D8D8" strokeWidth="1" strokeLinecap="round"/>
                </svg>
                <div className="text-center">
                  <p className="text-[9px] font-bold tracking-[0.32em] uppercase text-[#C0C0C0]">
                    Trusted by teams in 50+ countries
                  </p>
                </div>
                <svg viewBox="0 0 48 18" width="44" height="16" fill="none" style={{ transform: "scaleX(-1)" }}>
                  <path d="M44 9 C38 5,30 3,22 5 C14 7,8 11,4 17" stroke="#D8D8D8" strokeWidth="1.4" strokeLinecap="round"/>
                  <path d="M38 5 C32 1,24 0,18 3" stroke="#D8D8D8" strokeWidth="1.2" strokeLinecap="round"/>
                  <path d="M42 12 C34 9,26 8,20 11" stroke="#D8D8D8" strokeWidth="1" strokeLinecap="round"/>
                </svg>
              </div>
            </div>

          </div>
        </section>

        {/* ══ 12. FAQ ════════════════════════════════════════════════════════════ */}
        <section className="py-20 bg-[#EBEBEB]">
          <div className="container mx-auto px-6 max-w-5xl">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-16 items-start">

              {/* Left: header + accordion */}
              <div>
                {/* Decorative sparkle + label */}
                <div className="flex items-center gap-2 mb-3">
                  <svg viewBox="0 0 20 20" width="16" height="16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <line x1="10" y1="2" x2="10" y2="6" stroke="#AAAAAA" strokeWidth="1.5" strokeLinecap="round"/>
                    <line x1="10" y1="14" x2="10" y2="18" stroke="#AAAAAA" strokeWidth="1.5" strokeLinecap="round"/>
                    <line x1="2" y1="10" x2="6" y2="10" stroke="#AAAAAA" strokeWidth="1.5" strokeLinecap="round"/>
                    <line x1="14" y1="10" x2="18" y2="10" stroke="#AAAAAA" strokeWidth="1.5" strokeLinecap="round"/>
                    <line x1="4.5" y1="4.5" x2="7" y2="7" stroke="#AAAAAA" strokeWidth="1.5" strokeLinecap="round"/>
                    <line x1="13" y1="13" x2="15.5" y2="15.5" stroke="#AAAAAA" strokeWidth="1.5" strokeLinecap="round"/>
                    <line x1="15.5" y1="4.5" x2="13" y2="7" stroke="#AAAAAA" strokeWidth="1.5" strokeLinecap="round"/>
                    <line x1="7" y1="13" x2="4.5" y2="15.5" stroke="#AAAAAA" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  <p className="text-[10px] font-bold tracking-[0.28em] uppercase text-[#888]">FAQ</p>
                </div>

                <h2 className="font-display font-black text-[28px] md:text-[36px] tracking-[-0.035em] text-[#0A0A0A] leading-[1.04] mb-2">
                  Got Questions?
                </h2>
                <p className="text-[14px] text-[#888] leading-[1.65] mb-8">
                  We've Got Answers! Some frequently asked questions.
                </p>

                {/* Light accordion cards */}
                <div className="space-y-2 mb-6">
                  {faqs.slice(0, 4).map((faq) => (
                    <LightFaqRow key={faq.q} q={faq.q} a={faq.a} />
                  ))}
                </div>

                <p className="text-[12.5px] text-[#AAAAAA]">
                  Didn't find the answer you are looking for?{" "}
                  <a href="/contact" className="text-[#728DA7] font-semibold hover:underline">Contact our support</a>
                </p>
              </div>

              {/* Right: hand-drawn illustration */}
              <div className="flex items-center justify-center pt-8 lg:pt-16">
                <svg viewBox="0 0 260 300" className="w-full max-w-[240px]" fill="none" xmlns="http://www.w3.org/2000/svg">
                  {/* Big background question mark */}
                  <text x="130" y="155" fontFamily="Georgia, serif" fontSize="130" fontWeight="900" fill="#E0E0E0" textAnchor="middle" dominantBaseline="middle">?</text>
                  {/* Rays/sparks around ? */}
                  <line x1="195" y1="38" x2="207" y2="26" stroke="#C0C0C0" strokeWidth="1.8" strokeLinecap="round"/>
                  <line x1="218" y1="62" x2="234" y2="56" stroke="#C0C0C0" strokeWidth="1.8" strokeLinecap="round"/>
                  <line x1="222" y1="92" x2="240" y2="92" stroke="#C0C0C0" strokeWidth="1.8" strokeLinecap="round"/>
                  <line x1="168" y1="26" x2="162" y2="12" stroke="#C0C0C0" strokeWidth="1.8" strokeLinecap="round"/>
                  <line x1="145" y1="20" x2="145" y2="6" stroke="#C0C0C0" strokeWidth="1.8" strokeLinecap="round"/>
                  {/* ── Stick figure ── */}
                  {/* Spiky hair */}
                  <path d="M76 132 L70 114 L79 127 L80 116 L87 129" stroke="#1A1A1A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M94 122 L94 108 L101 122" stroke="#1A1A1A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M108 124 L113 110 L117 126" stroke="#1A1A1A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                  {/* Head */}
                  <circle cx="96" cy="148" r="24" stroke="#1A1A1A" strokeWidth="2.5" fill="white"/>
                  {/* Eyes — wide/surprised */}
                  <circle cx="88" cy="145" r="3.5" fill="#1A1A1A"/>
                  <circle cx="104" cy="145" r="3.5" fill="#1A1A1A"/>
                  {/* Raised eyebrows */}
                  <path d="M84 138 Q88 134 92 138" stroke="#1A1A1A" strokeWidth="1.8" strokeLinecap="round" fill="none"/>
                  <path d="M100 138 Q104 134 108 138" stroke="#1A1A1A" strokeWidth="1.8" strokeLinecap="round" fill="none"/>
                  {/* Mouth — open O */}
                  <ellipse cx="96" cy="156" rx="5" ry="4" stroke="#1A1A1A" strokeWidth="1.8" fill="none"/>
                  {/* Body */}
                  <line x1="96" y1="172" x2="96" y2="220" stroke="#1A1A1A" strokeWidth="2.5" strokeLinecap="round"/>
                  {/* Left arm — raised questioning */}
                  <line x1="96" y1="185" x2="66" y2="170" stroke="#1A1A1A" strokeWidth="2.5" strokeLinecap="round"/>
                  <line x1="66" y1="170" x2="56" y2="152" stroke="#1A1A1A" strokeWidth="2.5" strokeLinecap="round"/>
                  {/* Right arm — holding phone */}
                  <line x1="96" y1="185" x2="126" y2="175" stroke="#1A1A1A" strokeWidth="2.5" strokeLinecap="round"/>
                  {/* Phone */}
                  <rect x="128" y="163" width="30" height="44" rx="6" stroke="#1A1A1A" strokeWidth="2" fill="white"/>
                  <line x1="133" y1="174" x2="153" y2="174" stroke="#BBBBBB" strokeWidth="1.5"/>
                  <line x1="133" y1="181" x2="153" y2="181" stroke="#BBBBBB" strokeWidth="1.5"/>
                  <line x1="133" y1="188" x2="146" y2="188" stroke="#BBBBBB" strokeWidth="1.5"/>
                  <rect x="136" y="196" width="14" height="5" rx="2.5" fill="#E0E0E0"/>
                  {/* Legs */}
                  <line x1="96" y1="220" x2="76" y2="258" stroke="#1A1A1A" strokeWidth="2.5" strokeLinecap="round"/>
                  <line x1="96" y1="220" x2="116" y2="258" stroke="#1A1A1A" strokeWidth="2.5" strokeLinecap="round"/>
                  {/* Feet */}
                  <line x1="76" y1="258" x2="60" y2="262" stroke="#1A1A1A" strokeWidth="2.5" strokeLinecap="round"/>
                  <line x1="116" y1="258" x2="132" y2="262" stroke="#1A1A1A" strokeWidth="2.5" strokeLinecap="round"/>
                </svg>
              </div>

            </div>
          </div>
        </section>

        {/* ══ 13. FINAL CTA ══════════════════════════════════════════════════════ */}
        <section className="py-10 pb-20 bg-[#EBEBEB]">
          <div className="container mx-auto px-6 max-w-5xl">
            <div className="bg-[#111111] rounded-3xl overflow-hidden">
              <div className="grid grid-cols-1 lg:grid-cols-2 items-center min-h-[320px]">

                {/* Left — text */}
                <div className="px-10 py-14 lg:py-16">
                  <p className="text-[10px] font-bold tracking-[0.26em] uppercase text-[#666] mb-4">WHY WAITING</p>
                  <h2 className="font-display font-black text-[24px] sm:text-[30px] text-white tracking-[-0.025em] leading-[1.1] mb-4">
                    Ready to simplify<br/>Your Links, Amplify<br/>Your Reach
                  </h2>
                  <p className="text-[13.5px] text-[#777] leading-[1.65] mb-8 max-w-xs">
                    More than a link shortener. Sign Up Today and Start Shortening!
                  </p>
                  <a href="/register"
                    className="inline-flex items-center gap-2 bg-white hover:bg-[#F0F0F0] text-[#111] text-[13px] font-bold px-6 py-2.5 rounded-xl transition-colors">
                    Get Started · <em className="not-italic font-normal text-[#888]">Its free</em>
                  </a>
                </div>

                {/* Right — two-phone illustration */}
                <div className="flex items-center justify-center px-6 py-10 lg:py-0">
                  <svg viewBox="0 0 300 260" className="w-full max-w-[300px]" fill="none" xmlns="http://www.w3.org/2000/svg">
                    {/* ── Left phone (tilted -10deg) ── */}
                    <g transform="rotate(-10, 85, 130)">
                      <rect x="25" y="30" width="100" height="170" rx="16" fill="#222222" stroke="#EFEFF0" strokeWidth="2"/>
                      <rect x="35" y="50" width="80" height="130" rx="6" fill="#2E2E2E"/>
                      <rect x="55" y="35" width="28" height="7" rx="3.5" fill="#111111"/>
                      {/* Stick figure in screen */}
                      <circle cx="75" cy="88" r="16" stroke="#EFEFF0" strokeWidth="2" fill="#383838"/>
                      <circle cx="69" cy="85" r="2.5" fill="#EFEFF0"/>
                      <circle cx="81" cy="85" r="2.5" fill="#EFEFF0"/>
                      <path d="M68 95 Q75 100 82 95" stroke="#EFEFF0" strokeWidth="1.8" strokeLinecap="round" fill="none"/>
                      <line x1="75" y1="104" x2="75" y2="135" stroke="#EFEFF0" strokeWidth="2" strokeLinecap="round"/>
                      <line x1="75" y1="112" x2="58" y2="106" stroke="#EFEFF0" strokeWidth="2" strokeLinecap="round"/>
                      <line x1="75" y1="112" x2="92" y2="106" stroke="#EFEFF0" strokeWidth="2" strokeLinecap="round"/>
                      <line x1="75" y1="135" x2="63" y2="152" stroke="#EFEFF0" strokeWidth="2" strokeLinecap="round"/>
                      <line x1="75" y1="135" x2="87" y2="152" stroke="#EFEFF0" strokeWidth="2" strokeLinecap="round"/>
                      {/* Bottom bar */}
                      <rect x="58" y="174" width="34" height="5" rx="2.5" fill="#444"/>
                    </g>

                    {/* ── Right phone (tilted +10deg) ── */}
                    <g transform="rotate(10, 215, 130)">
                      <rect x="175" y="30" width="100" height="170" rx="16" fill="#222222" stroke="#EFEFF0" strokeWidth="2"/>
                      <rect x="185" y="50" width="80" height="130" rx="6" fill="#2E2E2E"/>
                      <rect x="205" y="35" width="28" height="7" rx="3.5" fill="#111111"/>
                      {/* Stick figure in screen */}
                      <circle cx="225" cy="88" r="16" stroke="#EFEFF0" strokeWidth="2" fill="#383838"/>
                      <circle cx="219" cy="85" r="2.5" fill="#EFEFF0"/>
                      <circle cx="231" cy="85" r="2.5" fill="#EFEFF0"/>
                      <path d="M218 95 Q225 100 232 95" stroke="#EFEFF0" strokeWidth="1.8" strokeLinecap="round" fill="none"/>
                      <line x1="225" y1="104" x2="225" y2="135" stroke="#EFEFF0" strokeWidth="2" strokeLinecap="round"/>
                      <line x1="225" y1="112" x2="208" y2="106" stroke="#EFEFF0" strokeWidth="2" strokeLinecap="round"/>
                      <line x1="225" y1="112" x2="242" y2="106" stroke="#EFEFF0" strokeWidth="2" strokeLinecap="round"/>
                      <line x1="225" y1="135" x2="213" y2="152" stroke="#EFEFF0" strokeWidth="2" strokeLinecap="round"/>
                      <line x1="225" y1="135" x2="237" y2="152" stroke="#EFEFF0" strokeWidth="2" strokeLinecap="round"/>
                      <rect x="208" y="174" width="34" height="5" rx="2.5" fill="#444"/>
                    </g>

                    {/* ── Paper airplane between phones ── */}
                    <g transform="translate(118, 95)">
                      <path d="M0 18 L48 0 L32 22 Z" stroke="#EFEFF0" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                      <line x1="0" y1="18" x2="32" y2="22" stroke="#EFEFF0" strokeWidth="2" strokeLinecap="round"/>
                      {/* Trail dots */}
                      <circle cx="-8" cy="20" r="2" fill="#EFEFF0" opacity="0.4"/>
                      <circle cx="-16" cy="22" r="1.5" fill="#EFEFF0" opacity="0.25"/>
                      <circle cx="-22" cy="24" r="1" fill="#EFEFF0" opacity="0.15"/>
                    </g>

                    {/* Decorative sparkle dots */}
                    <circle cx="150" cy="40" r="2.5" fill="#EFEFF0" opacity="0.3"/>
                    <circle cx="155" cy="220" r="2" fill="#EFEFF0" opacity="0.2"/>
                    <circle cx="140" cy="60" r="1.5" fill="#EFEFF0" opacity="0.2"/>
                  </svg>
                </div>

              </div>
            </div>
          </div>
        </section>

      </main>

      {/* ══ FOOTER ════════════════════════════════════════════════════════════════ */}
      <footer className="bg-[#080708] border-t border-[#111118]">

        {/* ── Newsletter strip ── */}
        <div className="border-b border-[#111118]">
          <div className="container max-w-6xl mx-auto px-6 py-14">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
              <div>
                <p className="text-[10px] font-bold tracking-[0.24em] uppercase text-[#728DA7] mb-2.5">Stay Updated</p>
                <h3 className="font-display font-black text-[24px] text-[#EFEFF0] tracking-tight leading-tight mb-1.5">
                  Product updates in your inbox.
                </h3>
                <p className="text-[13px] text-[#5A5C60]">No spam. New features and tips, once a month.</p>
              </div>
              <div className="flex gap-2 w-full md:w-auto">
                <input
                  type="email"
                  placeholder="you@company.com"
                  className="flex-1 md:w-60 bg-[#0E0E14] border border-[#1E1E28] text-[13px] text-[#EFEFF0] placeholder-[#2A2A36] px-4 py-2.5 rounded-lg focus:outline-none focus:border-[#728DA7] transition-colors"
                  suppressHydrationWarning
                />
                <button className="bg-[#728DA7] hover:bg-[#5a7a94] text-white text-[13px] font-semibold px-5 py-2.5 rounded-lg transition-colors whitespace-nowrap">
                  Subscribe
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Main columns ── */}
        <div className="container max-w-6xl mx-auto px-6 pt-16 pb-10">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-10 pb-14 border-b border-[#111118]">

            {/* Brand column — spans 2 */}
            <div className="col-span-2">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 bg-[#728DA7] rounded-lg flex items-center justify-center flex-shrink-0">
                  <Link2 className="w-4 h-4 text-white" />
                </div>
                <span className="font-display font-bold text-[18px] text-[#EFEFF0] tracking-tight">Snipr</span>
              </div>
              <p className="text-[13px] text-[#5A5C60] leading-[1.75] max-w-[218px] mb-6">
                Short links, deep analytics, and smart routing — built for modern growth teams.
              </p>

              {/* Trust badges */}
              <div className="flex flex-wrap gap-2">
                {["SOC 2 Type II", "GDPR Compliant", "99.9% Uptime"].map((badge) => (
                  <div key={badge} className="text-[10px] font-semibold text-[#5A5C60] border border-[#2E2E3A] rounded-md px-2 py-1 tracking-wide">
                    {badge}
                  </div>
                ))}
              </div>
            </div>

            {/* Link columns */}
            {([
              {
                heading: "Product",
                links: [
                  { label: "Features",   href: "/#features",  badge: null },
                  { label: "Pricing",    href: "/pricing",   badge: null },
                ],
              },
              {
                heading: "Company",
                links: [
                  { label: "Contact",   href: "/contact", badge: null },
                ],
              },
              {
                heading: "Legal",
                links: [
                  { label: "Privacy Policy",    href: "/privacy",  badge: null },
                  { label: "Terms of Service",  href: "/terms",    badge: null },
                  { label: "Cookie Settings",   href: "/cookies",  badge: null },
                  { label: "Security",          href: "/security", badge: null },
                ],
              },
            ] as const).map((col) => (
              <div key={col.heading}>
                <div className="text-[9.5px] font-bold text-[#4A4A58] uppercase tracking-[0.20em] mb-4">
                  {col.heading}
                </div>
                <div className="space-y-3.5">
                  {col.links.map((l) => (
                    <a
                      key={l.label}
                      href={l.href}
                      className="flex items-center gap-2 text-[13px] text-[#666] hover:text-[#CCCCCC] transition-colors leading-none"
                    >
                      {l.label}
                      {l.badge === "live" && (
                        <span className="w-1.5 h-1.5 rounded-full bg-[#3B9A6A] flex-shrink-0"/>
                      )}
                      {l.badge && l.badge !== "live" && (
                        <span className="text-[9px] font-bold text-[#728DA7] bg-[#728DA7]/10 border border-[#728DA7]/15 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                          {l.badge}
                        </span>
                      )}
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Bottom bar */}
          <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-5">
              <span className="text-[12px] text-[#5A5C60]">
                © 2026 Snipr, Inc. All rights reserved.
              </span>
              <div className="hidden sm:flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#3B9A6A] animate-pulse"/>
                <span className="text-[12px] text-[#5A5C60]">All systems operational</span>
              </div>
            </div>
            <div className="flex items-center gap-5">
              <span className="hidden md:block text-[11px] text-[#3A3A50]">Built for teams that move fast.</span>
              <button
                onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                className="text-[12px] text-[#5A5C60] hover:text-[#AAAAAA] transition-colors flex items-center gap-1"
              >
                ↑ Back to top
              </button>
            </div>
          </div>

        </div>
      </footer>
    </div>
  );
}
