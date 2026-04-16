"use client";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import {
  Radio, Globe, Monitor, Smartphone, Tablet,
  RefreshCw, WifiOff, QrCode, Layers,
  MapPin, ChevronDown, ChevronUp, Clock, Zap,
  Signal, Eye, Navigation, Activity, ArrowUpRight,
  TrendingUp, MousePointerClick,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

/* ───────────────────── Types ───────────────────── */
interface ClickEvent {
  type: "click";
  linkId: string;
  slug: string;
  country: string | null;
  city: string | null;
  device: string | null;
  browser: string | null;
  os: string | null;
  referrer: string | null;
  isQr: boolean;
  timestamp: string;
  _id: string;
}

/* ───────────────────── Helpers ───────────────────── */
function DeviceIcon({ device, className }: { device: string | null; className?: string }) {
  const cls = className ?? "w-4 h-4";
  if (device === "mobile") return <Smartphone className={cls} />;
  if (device === "tablet") return <Tablet className={cls} />;
  return <Monitor className={cls} />;
}

function countryFlag(code: string | null) {
  if (!code || code.length !== 2) return <span className="text-[16px]">🌐</span>;
  return (
    <img
      src={`https://flagcdn.com/w20/${code.toLowerCase()}.png`}
      srcSet={`https://flagcdn.com/w40/${code.toLowerCase()}.png 2x`}
      width={20}
      height={15}
      alt={code}
      className="rounded-[2px] object-cover"
      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
    />
  );
}

function slugColor(slug: string): string {
  const colors = ["#8B5CF6", "#A78BFA", "#34D399", "#FB923C", "#F87171", "#38BDF8", "#A1A1AA"];
  let hash = 0;
  for (let i = 0; i < slug.length; i++) hash = slug.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function countryName(code: string | null): string {
  if (!code) return "Unknown";
  try { return new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code; } catch { return code; }
}

function browserIcon(browser: string | null) {
  const name = browser?.toLowerCase() ?? "";
  if (name.includes("chrome")) return "🌐";
  if (name.includes("firefox")) return "🦊";
  if (name.includes("safari")) return "🧭";
  if (name.includes("edge")) return "📐";
  if (name.includes("opera")) return "🔴";
  return "🌐";
}

function osIcon(os: string | null) {
  const name = os?.toLowerCase() ?? "";
  if (name.includes("windows")) return "🪟";
  if (name.includes("mac") || name.includes("ios")) return "🍎";
  if (name.includes("android")) return "🤖";
  if (name.includes("linux")) return "🐧";
  return "💻";
}

/* ───── Mini Sparkline (SVG) ───── */
function MiniSparkline({ data, color, height = 32 }: { data: number[]; color: string; height?: number }) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const w = 120;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${height - (v / max) * (height - 4)}`).join(" ");
  const fillPts = `0,${height} ${pts} ${w},${height}`;
  return (
    <svg width={w} height={height} className="shrink-0 opacity-80">
      <defs>
        <linearGradient id={`sg-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={fillPts} fill={`url(#sg-${color.replace("#", "")})`} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ───── Donut Ring ───── */
function DonutRing({ segments, size = 80 }: { segments: { value: number; color: string }[]; size?: number }) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  if (total === 0) return null;
  const r = (size - 8) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * r;
  let offset = 0;
  return (
    <svg width={size} height={size}>
      {segments.map((seg, i) => {
        const pct = seg.value / total;
        const dash = pct * circ;
        const gap = circ - dash;
        const el = (
          <circle
            key={i}
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke={seg.color}
            strokeWidth="6"
            strokeDasharray={`${dash} ${gap}`}
            strokeDashoffset={-offset}
            strokeLinecap="round"
            className="transition-all duration-700"
            style={{ transform: "rotate(-90deg)", transformOrigin: "center" }}
          />
        );
        offset += dash;
        return el;
      })}
    </svg>
  );
}

/* ────────────────── Dark-Theme Styles ────────────────── */
const darkBg = "#09090B";
const cardBg = "#18181B";
const cardBorder = "#27272A";
const cardStyle = {
  background: cardBg,
  border: `1px solid ${cardBorder}`,
  borderRadius: "12px",
} as const;

const cardHeaderStyle = {
  background: "rgba(255,255,255,0.02)",
  borderBottom: `1px solid ${cardBorder}`,
} as const;

/* ══════════════════════════ MAIN COMPONENT ══════════════════════════ */
export default function Live() {
  const [events, setEvents] = useState<ClickEvent[]>([]);
  const [status, setStatus] = useState<"connecting" | "connected" | "disconnected">("connecting");
  const [totalSession, setTotalSession] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const esRef = useRef<EventSource | null>(null);
  const eventsRef = useRef<ClickEvent[]>([]);
  const seenIds = useRef<Set<string>>(new Set());

  /* ── Seed from DB ── */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/analytics/events?limit=100", { credentials: "include" });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        const dbEvents: ClickEvent[] = (data.events ?? []).map((e: any) => {
          const _id = e.id ?? (Math.random().toString(36).slice(2) + Date.now().toString(36));
          seenIds.current.add(_id);
          return {
            type: "click" as const,
            linkId: e.link_id ?? e.linkId ?? "",
            slug: e.slug ?? "",
            country: e.country ?? null,
            city: e.city ?? null,
            device: e.device ?? null,
            browser: e.browser ?? null,
            os: e.os ?? null,
            referrer: e.referrer ?? null,
            isQr: e.is_qr ?? e.isQr ?? false,
            timestamp: e.timestamp ?? new Date().toISOString(),
            _id,
          };
        });
        if (cancelled || dbEvents.length === 0) return;
        eventsRef.current = dbEvents.slice(0, 200);
        setEvents([...eventsRef.current]);
        setTotalSession(dbEvents.length);
      } catch { /* SSE is primary */ }
    })();
    return () => { cancelled = true; };
  }, []);

  /* ── SSE ── */
  useEffect(() => {
    let retryTimeout: ReturnType<typeof setTimeout>;
    let retryCount = 0;
    let cancelled = false;
    function connect() {
      if (cancelled) return;
      setStatus("connecting");
      const es = new EventSource("/api/realtime/stream", { withCredentials: true });
      esRef.current = es;
      es.onopen = () => { retryCount = 0; setStatus("connected"); };
      es.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.type === "click") {
            const _id = Math.random().toString(36).slice(2) + Date.now().toString(36);
            if (data.linkId && seenIds.current.has(data.linkId + data.timestamp)) return;
            seenIds.current.add(data.linkId + data.timestamp);
            const event: ClickEvent = { ...data, _id };
            eventsRef.current = [event, ...eventsRef.current].slice(0, 200);
            setEvents([...eventsRef.current]);
            setTotalSession(t => t + 1);
          }
        } catch { }
      };
      es.onerror = () => {
        setStatus("disconnected");
        es.close();
        if (cancelled) return;
        if (retryTimeout) clearTimeout(retryTimeout);
        const delay = Math.min(2000 * Math.pow(2, retryCount), 30_000);
        retryCount++;
        retryTimeout = setTimeout(connect, delay);
      };
    }
    connect();
    return () => { cancelled = true; esRef.current?.close(); clearTimeout(retryTimeout); };
  }, []);

  /* ── Polling fallback ── */
  useEffect(() => {
    if (status === "connected") return;
    const poll = async () => {
      try {
        const res = await fetch("/api/analytics/events?limit=100", { credentials: "include" });
        if (!res.ok) return;
        const data = await res.json();
        const dbEvents: ClickEvent[] = (data.events ?? [])
          .filter((e: any) => {
            const key = (e.id ?? "") + (e.timestamp ?? "");
            if (seenIds.current.has(key)) return false;
            seenIds.current.add(key);
            return true;
          })
          .map((e: any) => ({
            type: "click" as const,
            linkId: e.link_id ?? e.linkId ?? "",
            slug: e.slug ?? "",
            country: e.country ?? null,
            city: e.city ?? null,
            device: e.device ?? null,
            browser: e.browser ?? null,
            os: e.os ?? null,
            referrer: e.referrer ?? null,
            isQr: e.is_qr ?? e.isQr ?? false,
            timestamp: e.timestamp ?? new Date().toISOString(),
            _id: e.id ?? (Math.random().toString(36).slice(2) + Date.now().toString(36)),
          }));
        if (dbEvents.length === 0) return;
        const merged = [...dbEvents, ...eventsRef.current].slice(0, 200);
        merged.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        eventsRef.current = merged;
        setEvents([...merged]);
        setTotalSession(merged.length);
      } catch { }
    };
    const iv = setInterval(poll, 15_000);
    poll();
    return () => clearInterval(iv);
  }, [status]);

  /* ── Tick: prune events > 5min, recalc ── */
  const [, setTick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => {
      const cutoff = Date.now() - 5 * 60 * 1000;
      const before = eventsRef.current.length;
      eventsRef.current = eventsRef.current.filter(e => new Date(e.timestamp).getTime() > cutoff);
      if (eventsRef.current.length !== before) setEvents([...eventsRef.current]);
      setTick(t => t + 1);
    }, 10_000);
    return () => clearInterval(iv);
  }, []);

  /* ── Derived data ── */
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
  const recentEvents = events.filter(e => new Date(e.timestamp) > fiveMinAgo);

  // Clicks-per-minute velocity
  const velocity = useMemo(() => {
    if (recentEvents.length < 2) return recentEvents.length;
    const oldest = new Date(recentEvents[recentEvents.length - 1].timestamp).getTime();
    const span = (Date.now() - oldest) / 60_000; // minutes
    return span > 0 ? Math.round(recentEvents.length / span) : recentEvents.length;
  }, [recentEvents]);

  // Sparkline data: clicks per 30-second bucket over last 5 min (10 buckets)
  const sparkData = useMemo(() => {
    const buckets = new Array(10).fill(0);
    const now = Date.now();
    recentEvents.forEach(e => {
      const age = now - new Date(e.timestamp).getTime();
      const idx = Math.min(9, Math.floor(age / 30_000));
      buckets[9 - idx]++;
    });
    return buckets;
  }, [recentEvents]);

  const deviceCounts = useMemo(() => {
    const counts = { mobile: 0, desktop: 0, tablet: 0 };
    recentEvents.forEach(e => {
      const d = e.device ?? "desktop";
      if (d === "mobile") counts.mobile++;
      else if (d === "tablet") counts.tablet++;
      else counts.desktop++;
    });
    return counts;
  }, [recentEvents]);
  const deviceTotal = deviceCounts.mobile + deviceCounts.desktop + deviceCounts.tablet;

  const browserCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    recentEvents.forEach(e => { const k = e.browser ?? "Unknown"; counts[k] = (counts[k] ?? 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [recentEvents]);

  const osCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    recentEvents.forEach(e => { const k = e.os ?? "Unknown"; counts[k] = (counts[k] ?? 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [recentEvents]);

  const slugCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    recentEvents.forEach(e => { counts[e.slug] = (counts[e.slug] ?? 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [recentEvents]);

  const countryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    recentEvents.forEach(e => { const k = e.country ?? "Unknown"; counts[k] = (counts[k] ?? 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [recentEvents]);

  const uniqueCountries = useMemo(() => {
    const set = new Set<string>();
    recentEvents.forEach(e => { if (e.country) set.add(e.country); });
    return set.size;
  }, [recentEvents]);

  const referrerCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    recentEvents.forEach(e => { const k = e.referrer || "Direct"; counts[k] = (counts[k] ?? 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [recentEvents]);

  const toggleExpand = useCallback((id: string) => { setExpandedId(prev => prev === id ? null : id); }, []);

  // Velocity color
  const velColor = velocity === 0 ? "#71717A" : velocity < 5 ? "#38BDF8" : velocity < 15 ? "#34D399" : velocity < 40 ? "#FB923C" : "#F87171";

  /* ── Time-decay opacity: events > 3min get dimmer ── */
  function eventOpacity(ts: string) {
    const age = (Date.now() - new Date(ts).getTime()) / 1000;
    if (age < 60) return 1;
    if (age < 180) return 0.85;
    return 0.6;
  }

  /* ═══════════════════ RENDER ═══════════════════ */
  return (
    <ProtectedLayout>
      {/* Dark overlay background */}
      <div style={{ background: darkBg, minHeight: "100vh" }} className="relative overflow-hidden">
        {/* Ambient glow blobs */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full opacity-[0.07]" style={{ background: "radial-gradient(circle, #8B5CF6, transparent 70%)" }} />
          <div className="absolute top-1/3 -right-40 w-[600px] h-[600px] rounded-full opacity-[0.05]" style={{ background: "radial-gradient(circle, #34D399, transparent 70%)" }} />
          <div className="absolute bottom-0 left-1/3 w-[400px] h-[400px] rounded-full opacity-[0.04]" style={{ background: "radial-gradient(circle, #FB923C, transparent 70%)" }} />
        </div>

        <div className="relative z-10 px-4 sm:px-6 lg:px-8 py-6 max-w-[1400px] mx-auto w-full space-y-5 pt-14 lg:pt-6">

          {/* ── Header ── */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 flex items-center justify-center shrink-0 relative rounded-xl" style={{ background: "linear-gradient(135deg, #8B5CF6, #7C3AED)" }}>
                <Radio className="w-6 h-6 text-white" />
                {status === "connected" && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10B981] opacity-50" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-[#10B981] border-2 border-[#09090B]" />
                  </span>
                )}
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <p className="text-[10px] font-bold tracking-[0.22em] uppercase text-[#71717A]">Real-Time</p>
                  <StatusBadge status={status} />
                </div>
                <h1 className="text-[28px] font-[family-name:var(--font-space-grotesk)] font-black tracking-tight text-[#FAFAFA] leading-none">Live Tracking</h1>
                <p className="text-[13px] text-[#71717A] mt-1">Monitor every click as it happens — last 5 minutes</p>
              </div>
            </div>
          </div>

          {/* ── KPI Row ── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {/* Active Now */}
            <KpiCard
              label="Active Now"
              value={recentEvents.length}
              sub="last 5 min"
              icon={<Zap className="w-4 h-4 text-white" />}
              gradient="linear-gradient(135deg, #34D399, #10B981)"
              glow="#10B981"
              sparkline={<MiniSparkline data={sparkData} color="#10B981" />}
              pulse={recentEvents.length > 0}
            />
            {/* Velocity */}
            <KpiCard
              label="Clicks/Min"
              value={velocity}
              sub={velocity === 0 ? "waiting" : velocity < 5 ? "low" : velocity < 15 ? "normal" : velocity < 40 ? "high" : "spike!"}
              icon={<TrendingUp className="w-4 h-4 text-white" />}
              gradient={`linear-gradient(135deg, ${velColor}, ${velColor}cc)`}
              glow={velColor}
            />
            {/* Session Total */}
            <KpiCard
              label="Session Total"
              value={totalSession}
              sub="since page load"
              icon={<Eye className="w-4 h-4 text-white" />}
              gradient="linear-gradient(135deg, #A78BFA, #8B5CF6)"
              glow="#A78BFA"
            />
            {/* Mobile */}
            <KpiCard
              label="Mobile"
              value={deviceCounts.mobile}
              sub={deviceTotal > 0 ? `${Math.round((deviceCounts.mobile / deviceTotal) * 100)}%` : "—"}
              icon={<Smartphone className="w-4 h-4 text-white" />}
              gradient="linear-gradient(135deg, #FB923C, #F59E0B)"
              glow="#FB923C"
            />
            {/* Countries */}
            <KpiCard
              label="Countries"
              value={uniqueCountries}
              sub={uniqueCountries === 1 ? "region" : "regions"}
              icon={<Globe className="w-4 h-4 text-white" />}
              gradient="linear-gradient(135deg, #38BDF8, #06B6D4)"
              glow="#06B6D4"
            />
          </div>

          {/* ── Main Grid ── */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

            {/* ── Activity Feed (left 7col) ── */}
            <div className="lg:col-span-7 overflow-hidden flex flex-col rounded-xl bg-[#18181B] border border-[#27272A]">
              <div className="px-5 py-3.5 flex items-center justify-between" style={cardHeaderStyle}>
                <h3 className="font-semibold text-[14px] text-[#FAFAFA] flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #8B5CF6, #7C3AED)" }}>
                    <Activity className="w-3.5 h-3.5 text-white" />
                  </div>
                  Live Activity Feed
                </h3>
                <span className="text-[11px] text-[#71717A] font-medium tabular-nums">
                  {recentEvents.length === 0 ? "Waiting for clicks..." : `${recentEvents.length} events · 5 min`}
                </span>
              </div>

              <div className="flex-1 overflow-y-auto max-h-[640px]" style={{ scrollbarWidth: "thin", scrollbarColor: "#27272A transparent" }}>
                {recentEvents.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-4 py-24 px-6 text-center">
                    <div className="relative">
                      <div className="w-16 h-16 rounded-xl flex items-center justify-center bg-[#8B5CF6]/10">
                        <Signal className="w-8 h-8 text-[#8B5CF6]" />
                      </div>
                      {status === "connected" && (
                        <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10B981] opacity-40" />
                          <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-[#10B981] border-2 border-[#18181B]" />
                        </span>
                      )}
                    </div>
                    <div>
                      <p className="text-[15px] font-semibold text-[#E4E4E7]">Listening for clicks</p>
                      <p className="text-[13px] text-[#71717A] mt-1 max-w-xs">
                        {status === "connected"
                          ? "No clicks in the last 5 minutes. Visit any of your short links to see live data."
                          : "Connecting to the live stream..."}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div>
                    {recentEvents.map((ev, idx) => {
                      const isExpanded = expandedId === ev._id;
                      const evColor = slugColor(ev.slug);
                      const op = eventOpacity(ev.timestamp);
                      return (
                        <div
                          key={ev._id}
                          style={{ opacity: op, borderBottom: `1px solid ${cardBorder}` }}
                          className="transition-opacity duration-500"
                        >
                          <button
                            onClick={() => toggleExpand(ev._id)}
                            aria-expanded={isExpanded}
                            className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-[#27272A]/50 transition-colors text-left"
                          >
                            {/* Slug badge */}
                            <div
                              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-white text-[11px] font-bold"
                              style={{ background: evColor, boxShadow: `0 0 12px ${evColor}40` }}
                            >
                              {ev.slug.slice(0, 2).toUpperCase()}
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[13px] font-semibold text-[#E4E4E7]">/{ev.slug}</span>
                                {ev.isQr && (
                                  <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[#FB923C]/15 text-[#FB923C] border border-[#FB923C]/20">
                                    <QrCode className="w-2.5 h-2.5" /> QR
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-0.5 flex-wrap text-[11px] text-[#71717A]">
                                <span className="flex items-center gap-1">
                                  {countryFlag(ev.country)}
                                  <span className="hidden sm:inline">{ev.city ? `${ev.city}, ` : ""}{ev.country ? countryName(ev.country) : "Unknown"}</span>
                                  <span className="sm:hidden">{ev.country ?? "—"}</span>
                                </span>
                                <span className="text-[#3F3F46]">·</span>
                                <span className="flex items-center gap-1">
                                  <DeviceIcon device={ev.device} className="w-3 h-3" />
                                  {ev.device ?? "desktop"}
                                </span>
                                <span className="hidden sm:inline text-[#3F3F46]">·</span>
                                <span className="hidden sm:inline">{ev.browser ?? "Unknown"}</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-[10px] text-[#52525B] whitespace-nowrap hidden sm:inline tabular-nums">
                                {formatDistanceToNow(new Date(ev.timestamp), { addSuffix: true })}
                              </span>
                              {isExpanded
                                ? <ChevronUp className="w-3.5 h-3.5 text-[#52525B]" />
                                : <ChevronDown className="w-3.5 h-3.5 text-[#52525B]" />
                              }
                            </div>
                          </button>

                          {isExpanded && (
                            <div className="mx-5 mb-3 rounded-xl overflow-hidden bg-[#09090B] border border-[#27272A]">
                              <div className="px-4 py-2.5 bg-[#18181B]/50" style={{ borderBottom: `1px solid ${cardBorder}` }}>
                                <p className="text-[10px] font-bold text-[#71717A] uppercase tracking-[0.12em]">Visitor Details</p>
                              </div>
                              <div className="grid grid-cols-2 gap-x-4 gap-y-3 p-4">
                                <DetailRow icon={<MapPin className="w-3.5 h-3.5 text-[#10B981]" />} label="Location" value={`${ev.city ? ev.city + ", " : ""}${ev.country ? countryName(ev.country) : "Unknown"}`} />
                                <DetailRow icon={<span className="flex items-center w-5">{countryFlag(ev.country)}</span>} label="Country" value={ev.country ?? "N/A"} />
                                <DetailRow icon={<DeviceIcon device={ev.device} className="w-3.5 h-3.5 text-[#8B5CF6]" />} label="Device" value={ev.device ?? "desktop"} />
                                <DetailRow icon={<span className="text-[14px]">{osIcon(ev.os)}</span>} label="OS" value={ev.os ?? "Unknown"} />
                                <DetailRow icon={<span className="text-[14px]">{browserIcon(ev.browser)}</span>} label="Browser" value={ev.browser ?? "Unknown"} />
                                <DetailRow icon={<Navigation className="w-3.5 h-3.5 text-[#A1A1AA]" />} label="Referrer" value={ev.referrer ?? "Direct"} />
                                <DetailRow icon={<Clock className="w-3.5 h-3.5 text-[#FB923C]" />} label="Time" value={new Date(ev.timestamp).toLocaleString()} />
                                <DetailRow icon={<QrCode className="w-3.5 h-3.5 text-[#A78BFA]" />} label="QR Scan" value={ev.isQr ? "Yes" : "No"} />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* ── Right sidebar (5col) ── */}
            <div className="lg:col-span-5 space-y-4">

              {/* Devices & Browsers */}
              <div className="overflow-hidden rounded-xl bg-[#18181B] border border-[#27272A]">
                <div className="px-5 py-3.5 flex items-center gap-2" style={cardHeaderStyle}>
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #FB923C, #F59E0B)" }}>
                    <Smartphone className="w-3.5 h-3.5 text-white" />
                  </div>
                  <h3 className="font-semibold text-[14px] text-[#FAFAFA]">Devices & Browsers</h3>
                </div>
                <div className="p-5">
                  {deviceTotal === 0 ? (
                    <div className="text-center py-8">
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-2 bg-[#FB923C]/10">
                        <Smartphone className="w-6 h-6 text-[#FB923C]/40" />
                      </div>
                      <p className="text-[13px] text-[#52525B]">Device data appears after first click</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Donut + Legend */}
                      <div className="flex items-center gap-5">
                        <DonutRing segments={[
                          { value: deviceCounts.mobile, color: "#FB923C" },
                          { value: deviceCounts.desktop, color: "#8B5CF6" },
                          { value: deviceCounts.tablet, color: "#A78BFA" },
                        ]} />
                        <div className="space-y-2.5 flex-1">
                          {[
                            { label: "Mobile", count: deviceCounts.mobile, color: "#FB923C", icon: <Smartphone className="w-3.5 h-3.5" /> },
                            { label: "Desktop", count: deviceCounts.desktop, color: "#8B5CF6", icon: <Monitor className="w-3.5 h-3.5" /> },
                            { label: "Tablet", count: deviceCounts.tablet, color: "#A78BFA", icon: <Tablet className="w-3.5 h-3.5" /> },
                          ].map(d => {
                            const pct = deviceTotal > 0 ? Math.round((d.count / deviceTotal) * 100) : 0;
                            return (
                              <div key={d.label} className="flex items-center justify-between">
                                <span className="flex items-center gap-2 text-[12px] text-[#A1A1AA]" style={{ color: d.color }}>
                                  {d.icon} {d.label}
                                </span>
                                <span className="text-[12px] font-bold text-[#E4E4E7] tabular-nums">{d.count} <span className="text-[#52525B] font-normal">({pct}%)</span></span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Browsers */}
                      {browserCounts.length > 0 && (
                        <div className="pt-3" style={{ borderTop: `1px solid ${cardBorder}` }}>
                          <p className="text-[10px] font-bold text-[#52525B] uppercase tracking-[0.12em] mb-2.5">Browsers</p>
                          <div className="space-y-2">
                            {browserCounts.map(([browser, count]) => (
                              <div key={browser} className="flex items-center justify-between">
                                <span className="text-[12px] text-[#A1A1AA] flex items-center gap-2">
                                  <span className="text-[13px]">{browserIcon(browser)}</span> {browser}
                                </span>
                                <span className="text-[12px] font-semibold text-[#E4E4E7] tabular-nums">{count}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* OS */}
                      {osCounts.length > 0 && (
                        <div className="pt-3" style={{ borderTop: `1px solid ${cardBorder}` }}>
                          <p className="text-[10px] font-bold text-[#52525B] uppercase tracking-[0.12em] mb-2.5">Operating Systems</p>
                          <div className="space-y-2">
                            {osCounts.map(([os, count]) => (
                              <div key={os} className="flex items-center justify-between">
                                <span className="text-[12px] text-[#A1A1AA] flex items-center gap-2">
                                  <span className="text-[13px]">{osIcon(os)}</span> {os}
                                </span>
                                <span className="text-[12px] font-semibold text-[#E4E4E7] tabular-nums">{count}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Countries */}
              <div className="overflow-hidden rounded-xl bg-[#18181B] border border-[#27272A]">
                <div className="px-5 py-3.5 flex items-center justify-between" style={cardHeaderStyle}>
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #34D399, #10B981)" }}>
                      <Globe className="w-3.5 h-3.5 text-white" />
                    </div>
                    <h3 className="font-semibold text-[14px] text-[#FAFAFA]">Countries</h3>
                  </div>
                  {uniqueCountries > 0 && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/20">
                      {uniqueCountries}
                    </span>
                  )}
                </div>
                <div>
                  {countryCounts.length === 0 ? (
                    <div className="text-center py-8 px-4">
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-2 bg-[#10B981]/10">
                        <Globe className="w-6 h-6 text-[#10B981]/40" />
                      </div>
                      <p className="text-[13px] text-[#52525B]">Country data appears after first click</p>
                    </div>
                  ) : (
                    <div>
                      {countryCounts.map(([country, count], i) => {
                        const maxCount = countryCounts[0][1];
                        const pct = recentEvents.length > 0 ? Math.round((count / recentEvents.length) * 100) : 0;
                        return (
                          <div key={country} className="flex items-center gap-3 px-5 py-3 hover:bg-[#27272A]/50 transition-colors" style={{ borderBottom: `1px solid ${cardBorder}` }}>
                            <span className="text-[10px] font-bold text-[#52525B] w-4 shrink-0 tabular-nums">#{i + 1}</span>
                            <span className="flex items-center shrink-0 w-5">{countryFlag(country)}</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex justify-between items-center mb-1">
                                <span className="text-[12px] font-semibold text-[#E4E4E7]">{country === "Unknown" ? "Unknown" : countryName(country)}</span>
                                <span className="text-[11px] font-bold text-[#E4E4E7] tabular-nums">{count} <span className="text-[#52525B] font-normal">({pct}%)</span></span>
                              </div>
                              <div className="h-[3px] rounded-full overflow-hidden bg-[#27272A]">
                                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${(count / maxCount) * 100}%`, background: "linear-gradient(90deg, #34D399, #10B981)" }} />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Top Links + Referrers side-by-side on lg */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">
                {/* Top Links */}
                <div className="overflow-hidden rounded-xl bg-[#18181B] border border-[#27272A]">
                  <div className="px-5 py-3.5 flex items-center gap-2" style={cardHeaderStyle}>
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #8B5CF6, #7C3AED)" }}>
                      <Layers className="w-3.5 h-3.5 text-white" />
                    </div>
                    <h3 className="font-semibold text-[14px] text-[#FAFAFA]">Top Active Links</h3>
                  </div>
                  <div>
                    {slugCounts.length === 0 ? (
                      <div className="text-center py-8 px-4">
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-2 bg-[#8B5CF6]/10">
                          <Layers className="w-6 h-6 text-[#8B5CF6]/40" />
                        </div>
                        <p className="text-[13px] text-[#52525B]">Link activity appears after first click</p>
                      </div>
                    ) : (
                      <div>
                        {slugCounts.map(([slug, count], i) => {
                          const maxCount = slugCounts[0][1];
                          return (
                            <div key={slug} className="flex items-center gap-3 px-5 py-3 hover:bg-[#27272A]/50 transition-colors" style={{ borderBottom: `1px solid ${cardBorder}` }}>
                              <div
                                className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                                style={{ background: slugColor(slug), boxShadow: `0 0 10px ${slugColor(slug)}30` }}
                              >
                                {slug.slice(0, 2).toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[12px] font-semibold text-[#E4E4E7] truncate">/{slug}</p>
                                <div className="mt-1 h-[3px] rounded-full overflow-hidden bg-[#27272A]">
                                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${(count / maxCount) * 100}%`, background: `linear-gradient(90deg, ${slugColor(slug)}, ${slugColor(slug)}88)` }} />
                                </div>
                              </div>
                              <span className="text-[12px] font-bold text-[#E4E4E7] shrink-0 tabular-nums">{count}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Referrers */}
                {referrerCounts.length > 0 && recentEvents.length > 0 && (
                  <div className="overflow-hidden rounded-xl bg-[#18181B] border border-[#27272A]">
                    <div className="px-5 py-3.5 flex items-center gap-2" style={cardHeaderStyle}>
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #38BDF8, #06B6D4)" }}>
                        <ArrowUpRight className="w-3.5 h-3.5 text-white" />
                      </div>
                      <h3 className="font-semibold text-[14px] text-[#FAFAFA]">Top Referrers</h3>
                    </div>
                    <div>
                      {referrerCounts.map(([ref, count]) => (
                        <div key={ref} className="flex items-center justify-between px-5 py-3 hover:bg-[#27272A]/50 transition-colors" style={{ borderBottom: `1px solid ${cardBorder}` }}>
                          <span className="text-[12px] text-[#A1A1AA] truncate mr-3">{ref}</span>
                          <span className="text-[12px] font-semibold text-[#E4E4E7] shrink-0 tabular-nums">{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

            </div>
          </div>

        </div>
      </div>
    </ProtectedLayout>
  );
}

/* ───────────── Sub-components ───────────── */

function StatusBadge({ status }: { status: "connecting" | "connected" | "disconnected" }) {
  const cfg = {
    connected: { label: "LIVE", bg: "rgba(16,185,129,0.12)", color: "#10B981", border: "rgba(16,185,129,0.25)" },
    connecting: { label: "Connecting...", bg: "rgba(251,146,60,0.12)", color: "#FB923C", border: "rgba(251,146,60,0.25)" },
    disconnected: { label: "Reconnecting...", bg: "rgba(248,113,113,0.12)", color: "#F87171", border: "rgba(248,113,113,0.25)" },
  }[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-0.5 rounded-lg"
      style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}
    >
      {status === "connected" && <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" />}
      {status === "connecting" && <RefreshCw className="w-2.5 h-2.5 animate-spin" />}
      {status === "disconnected" && <WifiOff className="w-2.5 h-2.5" />}
      {cfg.label}
    </span>
  );
}

function KpiCard({ label, value, sub, icon, gradient, glow, sparkline, pulse }: {
  label: string; value: number; sub: string;
  icon: React.ReactNode; gradient: string; glow: string;
  sparkline?: React.ReactNode; pulse?: boolean;
}) {
  return (
    <div className="p-4 relative overflow-hidden group rounded-xl bg-[#18181B] border border-[#27272A]">
      {/* Subtle glow on hover */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" style={{ background: `radial-gradient(circle at 50% 50%, ${glow}08, transparent 70%)` }} />
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] font-bold text-[#71717A] uppercase tracking-[0.12em]">{label}</p>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: gradient, boxShadow: `0 0 12px ${glow}30` }}>
            {icon}
          </div>
        </div>
        <div className="flex items-end justify-between gap-2">
          <div>
            <div className="flex items-end gap-1.5">
              <span className="text-[28px] font-extrabold text-[#FAFAFA] leading-none tabular-nums">{value}</span>
              {pulse && (
                <span className="relative flex h-2.5 w-2.5 mb-1">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-40" style={{ background: glow }} />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5" style={{ background: glow }} />
                </span>
              )}
            </div>
            <p className="text-[11px] text-[#52525B] mt-1">{sub}</p>
          </div>
          {sparkline}
        </div>
      </div>
    </div>
  );
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="mt-0.5 shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold text-[#52525B] uppercase tracking-[0.08em]">{label}</p>
        <p className="text-[12px] font-medium text-[#E4E4E7] break-all">{value}</p>
      </div>
    </div>
  );
}
