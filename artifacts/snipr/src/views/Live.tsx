"use client";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import {
  Radio, Globe, Monitor, Smartphone, Tablet,
  RefreshCw, WifiOff, QrCode, Layers,
  MapPin, ChevronDown, ChevronUp, Clock, Zap,
  Signal, Eye, Navigation, Activity, ArrowUpRight,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

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

function DeviceIcon({ device, className }: { device: string | null; className?: string }) {
  const cls = className ?? "w-4 h-4";
  if (device === "mobile") return <Smartphone className={cls} />;
  if (device === "tablet") return <Tablet className={cls} />;
  return <Monitor className={cls} />;
}

function countryFlag(code: string | null) {
  if (!code || code.length !== 2) return "🌐";
  const codePoints = [...code.toUpperCase()].map(c => 0x1F1E0 + c.charCodeAt(0) - 65);
  return String.fromCodePoint(...codePoints);
}

function slugColor(slug: string): string {
  const colors = [
    "#4F46E5", "#7C5CC4", "#2E9A72", "#E07B30", "#E05050", "#0EA5E9", "#728DA7"
  ];
  let hash = 0;
  for (let i = 0; i < slug.length; i++) hash = slug.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function countryName(code: string | null): string {
  if (!code) return "Unknown";
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
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

function PulseRing({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <span className="relative flex h-2.5 w-2.5">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#2E9A72] opacity-40" />
      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#2E9A72]" />
    </span>
  );
}

export default function Live() {
  const [events, setEvents] = useState<ClickEvent[]>([]);
  const [status, setStatus] = useState<"connecting" | "connected" | "disconnected">("connecting");
  const [totalSession, setTotalSession] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const esRef = useRef<EventSource | null>(null);
  const eventsRef = useRef<ClickEvent[]>([]);

  useEffect(() => {
    let retryTimeout: ReturnType<typeof setTimeout>;

    function connect() {
      setStatus("connecting");
      const es = new EventSource("/api/realtime/stream", { withCredentials: true });
      esRef.current = es;

      es.onopen = () => setStatus("connected");

      es.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.type === "click") {
            const event: ClickEvent = { ...data, _id: Math.random().toString(36).slice(2) };
            eventsRef.current = [event, ...eventsRef.current].slice(0, 200);
            setEvents([...eventsRef.current]);
            setTotalSession(t => t + 1);
          }
        } catch {}
      };

      es.onerror = () => {
        setStatus("disconnected");
        es.close();
        retryTimeout = setTimeout(connect, 4000);
      };
    }

    connect();

    return () => {
      esRef.current?.close();
      clearTimeout(retryTimeout);
    };
  }, []);

  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
  const recentEvents = events.filter(e => new Date(e.timestamp) > fiveMinAgo);

  const deviceCounts = useMemo(() => {
    const counts = { mobile: 0, desktop: 0, tablet: 0 };
    events.forEach(e => {
      const d = e.device ?? "desktop";
      if (d === "mobile") counts.mobile++;
      else if (d === "tablet") counts.tablet++;
      else counts.desktop++;
    });
    return counts;
  }, [events]);

  const deviceTotal = deviceCounts.mobile + deviceCounts.desktop + deviceCounts.tablet;

  const osCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    events.forEach(e => {
      const key = e.os ?? "Unknown";
      counts[key] = (counts[key] ?? 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [events]);

  const browserCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    events.forEach(e => {
      const key = e.browser ?? "Unknown";
      counts[key] = (counts[key] ?? 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [events]);

  const slugCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    events.forEach(e => { counts[e.slug] = (counts[e.slug] ?? 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [events]);

  const countryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    events.forEach(e => {
      const key = e.country ?? "Unknown";
      counts[key] = (counts[key] ?? 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [events]);

  const uniqueCountries = Object.keys(
    events.reduce<Record<string, boolean>>((acc, e) => {
      if (e.country) acc[e.country] = true;
      return acc;
    }, {})
  ).length;

  const referrerCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    events.forEach(e => {
      const key = e.referrer || "Direct";
      counts[key] = (counts[key] ?? 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [events]);

  const toggleExpand = useCallback((id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  }, []);

  const statusConfig = {
    connected: { label: "LIVE", bg: "bg-[#E8F7F1]", text: "text-[#2E9A72]", border: "border-[#B4E8CE]", dot: true },
    connecting: { label: "Connecting…", bg: "bg-[#FEF3E8]", text: "text-[#E07B30]", border: "border-[#FDDCB6]", dot: false },
    disconnected: { label: "Reconnecting…", bg: "bg-[#FFF0F0]", text: "text-[#E05050]", border: "border-[#FFD5D5]", dot: false },
  };
  const sc = statusConfig[status];

  return (
    <ProtectedLayout>
      <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-[1400px] mx-auto w-full space-y-5 pt-14 lg:pt-6">

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[#E8F7F1] flex items-center justify-center shrink-0 relative">
              <Activity className="w-6 h-6 text-[#2E9A72]" />
              {status === "connected" && (
                <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#2E9A72] opacity-50" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-[#2E9A72] border-2 border-white" />
                </span>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <p className="text-[10px] font-bold tracking-[0.22em] uppercase text-[#728DA7]">Real-Time</p>
                <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-0.5 rounded-full ${sc.bg} ${sc.text} border ${sc.border}`}>
                  {sc.dot && <span className="w-1.5 h-1.5 rounded-full bg-[#2E9A72] animate-pulse" />}
                  {!sc.dot && status === "connecting" && <RefreshCw className="w-2.5 h-2.5 animate-spin" />}
                  {!sc.dot && status === "disconnected" && <WifiOff className="w-2.5 h-2.5" />}
                  {sc.label}
                </span>
              </div>
              <h1 className="text-[26px] font-display font-black tracking-tight text-[#0A0A0A] leading-none">Live Tracking</h1>
              <p className="text-[13px] text-[#8888A0] mt-1">Monitor every click as it happens — full visitor details in real time</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {[
            {
              label: "Active Now",
              value: recentEvents.length,
              sub: "last 5 minutes",
              icon: <Zap className="w-4 h-4" />,
              iconBg: "bg-[#E8F7F1]",
              iconColor: "text-[#2E9A72]",
              pulse: recentEvents.length > 0,
            },
            {
              label: "Session Total",
              value: totalSession,
              sub: "since page load",
              icon: <Eye className="w-4 h-4" />,
              iconBg: "bg-[#F0EBF9]",
              iconColor: "text-[#7C5CC4]",
            },
            {
              label: "Mobile",
              value: deviceCounts.mobile,
              sub: deviceTotal > 0 ? `${Math.round((deviceCounts.mobile / deviceTotal) * 100)}%` : "—",
              icon: <Smartphone className="w-4 h-4" />,
              iconBg: "bg-[#FEF3E8]",
              iconColor: "text-[#E07B30]",
            },
            {
              label: "Desktop",
              value: deviceCounts.desktop,
              sub: deviceTotal > 0 ? `${Math.round((deviceCounts.desktop / deviceTotal) * 100)}%` : "—",
              icon: <Monitor className="w-4 h-4" />,
              iconBg: "bg-[#EEF3F7]",
              iconColor: "text-[#728DA7]",
            },
            {
              label: "Countries",
              value: uniqueCountries,
              sub: uniqueCountries === 1 ? "region" : "regions",
              icon: <Globe className="w-4 h-4" />,
              iconBg: "bg-[#E8F7F1]",
              iconColor: "text-[#2E9A72]",
            },
          ].map((kpi) => (
            <div key={kpi.label} className="bg-white border border-[#EBEBF0] rounded-2xl p-3 sm:p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-bold text-[#A0A0AE] uppercase tracking-[0.12em]">{kpi.label}</p>
                <div className={`w-8 h-8 rounded-xl ${kpi.iconBg} ${kpi.iconColor} flex items-center justify-center`}>
                  {kpi.icon}
                </div>
              </div>
              <div className="flex items-end gap-1.5">
                <span className="text-[26px] sm:text-[30px] font-display font-black text-[#0A0A0A] leading-none tabular-nums">{kpi.value}</span>
                {kpi.pulse && <PulseRing active />}
              </div>
              <p className="text-[11px] text-[#A0A0AE] mt-1">{kpi.sub}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

          <div className="lg:col-span-7 bg-white rounded-2xl border border-[#EBEBF0] overflow-hidden flex flex-col shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <div className="px-5 py-3.5 border-b border-[#F0F0F6] bg-[#FAFAFE] flex items-center justify-between">
              <h3 className="font-semibold text-[14px] text-[#0A0A0A] flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#F0EBF9] flex items-center justify-center">
                  <Radio className="w-3.5 h-3.5 text-[#7C5CC4]" />
                </div>
                Live Activity Feed
              </h3>
              <span className="text-[11px] text-[#A0A0AE] font-medium">
                {events.length === 0 ? "Waiting for visits…" : `${events.length} events`}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto max-h-[600px]" style={{ scrollbarWidth: "thin", scrollbarColor: "#E4E4EC transparent" }}>
              {events.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-4 py-24 px-6 text-center">
                  <div className="relative">
                    <div className="w-16 h-16 rounded-2xl bg-[#F0EBF9] flex items-center justify-center">
                      <Signal className="w-8 h-8 text-[#7C5CC4]" />
                    </div>
                    {status === "connected" && (
                      <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#2E9A72] opacity-40" />
                        <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-[#2E9A72] border-2 border-white" />
                      </span>
                    )}
                  </div>
                  <div>
                    <p className="text-[15px] font-semibold text-[#0A0A0A]">Listening for clicks</p>
                    <p className="text-[13px] text-[#8888A0] mt-1 max-w-xs">
                      {status === "connected"
                        ? "Click any of your short links to see detailed visitor information appear here instantly."
                        : "Connecting to the live stream…"}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-[#F5F5F8]">
                  {events.map((ev) => {
                    const isExpanded = expandedId === ev._id;
                    const evColor = slugColor(ev.slug);
                    return (
                      <div key={ev._id} className="animate-in fade-in slide-in-from-top-1 duration-300">
                        <button
                          onClick={() => toggleExpand(ev._id)}
                          aria-expanded={isExpanded}
                          className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-[#FAFAFE] transition-colors text-left"
                        >
                          <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-white text-[11px] font-bold shadow-sm"
                            style={{ background: evColor }}
                          >
                            {ev.slug.slice(0, 2).toUpperCase()}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[13px] font-semibold text-[#0A0A0A]">/{ev.slug}</span>
                              {ev.isQr && (
                                <span className="inline-flex items-center gap-0.5 text-[9px] font-bold bg-[#FEF3E8] text-[#E07B30] px-1.5 py-0.5 rounded-full border border-[#FDDCB6]">
                                  <QrCode className="w-2.5 h-2.5" /> QR
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap text-[11px] text-[#8888A0]">
                              <span className="flex items-center gap-1">
                                {countryFlag(ev.country)}
                                <span className="hidden sm:inline">{ev.city ? `${ev.city}, ` : ""}{ev.country ? countryName(ev.country) : "Unknown"}</span>
                                <span className="sm:hidden">{ev.country ?? "—"}</span>
                              </span>
                              <span className="text-[#E4E4EC]">·</span>
                              <span className="flex items-center gap-1">
                                <DeviceIcon device={ev.device} className="w-3 h-3" />
                                {ev.device ?? "desktop"}
                              </span>
                              <span className="hidden sm:inline text-[#E4E4EC]">·</span>
                              <span className="hidden sm:inline">{ev.browser ?? "Unknown"}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[10px] text-[#A0A0AE] whitespace-nowrap hidden sm:inline">
                              {formatDistanceToNow(new Date(ev.timestamp), { addSuffix: true })}
                            </span>
                            {isExpanded
                              ? <ChevronUp className="w-3.5 h-3.5 text-[#C0C0CC]" />
                              : <ChevronDown className="w-3.5 h-3.5 text-[#C0C0CC]" />
                            }
                          </div>
                        </button>

                        {isExpanded && (
                          <div className="mx-5 mb-3 rounded-xl bg-[#FAFAFE] border border-[#EBEBF0] overflow-hidden animate-in fade-in slide-in-from-top-1 duration-200">
                            <div className="px-4 py-2.5 border-b border-[#F0F0F6] bg-[#F6F6F9]">
                              <p className="text-[10px] font-bold text-[#A0A0AE] uppercase tracking-[0.12em]">Visitor Details</p>
                            </div>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-3 p-4">
                              <DetailRow icon={<MapPin className="w-3.5 h-3.5 text-[#2E9A72]" />} label="Location" value={`${ev.city ? ev.city + ", " : ""}${ev.country ? countryName(ev.country) : "Unknown"}`} />
                              <DetailRow icon={<span className="text-[14px]">{countryFlag(ev.country)}</span>} label="Country" value={ev.country ?? "N/A"} />
                              <DetailRow icon={<DeviceIcon device={ev.device} className="w-3.5 h-3.5 text-[#7C5CC4]" />} label="Device" value={ev.device ?? "desktop"} />
                              <DetailRow icon={<span className="text-[14px]">{osIcon(ev.os)}</span>} label="OS" value={ev.os ?? "Unknown"} />
                              <DetailRow icon={<span className="text-[14px]">{browserIcon(ev.browser)}</span>} label="Browser" value={ev.browser ?? "Unknown"} />
                              <DetailRow icon={<Navigation className="w-3.5 h-3.5 text-[#728DA7]" />} label="Referrer" value={ev.referrer ?? "Direct"} />
                              <DetailRow icon={<Clock className="w-3.5 h-3.5 text-[#E07B30]" />} label="Time" value={new Date(ev.timestamp).toLocaleString()} />
                              <DetailRow icon={<QrCode className="w-3.5 h-3.5 text-[#7C5CC4]" />} label="QR Scan" value={ev.isQr ? "Yes" : "No"} />
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

          <div className="lg:col-span-5 space-y-4">

            <div className="bg-white rounded-2xl border border-[#EBEBF0] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
              <div className="px-5 py-3.5 border-b border-[#F0F0F6] bg-[#FAFAFE] flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#FEF3E8] flex items-center justify-center">
                  <Smartphone className="w-3.5 h-3.5 text-[#E07B30]" />
                </div>
                <h3 className="font-semibold text-[14px] text-[#0A0A0A]">Devices & Browsers</h3>
              </div>
              <div className="p-5">
                {deviceTotal === 0 ? (
                  <div className="text-center py-8">
                    <div className="w-12 h-12 rounded-2xl bg-[#FEF3E8] flex items-center justify-center mx-auto mb-2">
                      <Smartphone className="w-6 h-6 text-[#E07B30]/40" />
                    </div>
                    <p className="text-[13px] text-[#8888A0]">Device data appears after first click</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {[
                      { label: "Mobile", count: deviceCounts.mobile, icon: <Smartphone className="w-4 h-4" />, color: "#E07B30", bg: "bg-[#FEF3E8]" },
                      { label: "Desktop", count: deviceCounts.desktop, icon: <Monitor className="w-4 h-4" />, color: "#728DA7", bg: "bg-[#EEF3F7]" },
                      { label: "Tablet", count: deviceCounts.tablet, icon: <Tablet className="w-4 h-4" />, color: "#7C5CC4", bg: "bg-[#F0EBF9]" },
                    ].map(d => {
                      const pct = deviceTotal > 0 ? Math.round((d.count / deviceTotal) * 100) : 0;
                      return (
                        <div key={d.label} className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-xl ${d.bg} flex items-center justify-center shrink-0`} style={{ color: d.color }}>
                            {d.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-[12px] font-semibold text-[#0A0A0A]">{d.label}</span>
                              <span className="text-[11px] font-bold text-[#0A0A0A] tabular-nums">{d.count} <span className="text-[#A0A0AE] font-normal">({pct}%)</span></span>
                            </div>
                            <div className="h-1.5 bg-[#F2F2F6] rounded-full overflow-hidden">
                              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: d.color }} />
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {browserCounts.length > 0 && (
                      <div className="border-t border-[#F0F0F6] pt-3 mt-1">
                        <p className="text-[10px] font-bold text-[#A0A0AE] uppercase tracking-[0.12em] mb-2.5">Browsers</p>
                        <div className="space-y-2">
                          {browserCounts.map(([browser, count]) => (
                            <div key={browser} className="flex items-center justify-between">
                              <span className="text-[12px] text-[#3A3A3E] flex items-center gap-2">
                                <span className="text-[13px]">{browserIcon(browser)}</span>
                                {browser}
                              </span>
                              <span className="text-[12px] font-semibold text-[#0A0A0A] tabular-nums">{count}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {osCounts.length > 0 && (
                      <div className="border-t border-[#F0F0F6] pt-3 mt-1">
                        <p className="text-[10px] font-bold text-[#A0A0AE] uppercase tracking-[0.12em] mb-2.5">Operating Systems</p>
                        <div className="space-y-2">
                          {osCounts.map(([os, count]) => (
                            <div key={os} className="flex items-center justify-between">
                              <span className="text-[12px] text-[#3A3A3E] flex items-center gap-2">
                                <span className="text-[13px]">{osIcon(os)}</span>
                                {os}
                              </span>
                              <span className="text-[12px] font-semibold text-[#0A0A0A] tabular-nums">{count}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">

              <div className="bg-white rounded-2xl border border-[#EBEBF0] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                <div className="px-5 py-3.5 border-b border-[#F0F0F6] bg-[#FAFAFE] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-[#E8F7F1] flex items-center justify-center">
                      <Globe className="w-3.5 h-3.5 text-[#2E9A72]" />
                    </div>
                    <h3 className="font-semibold text-[14px] text-[#0A0A0A]">Countries</h3>
                  </div>
                  {uniqueCountries > 0 && (
                    <span className="text-[10px] font-bold bg-[#E8F7F1] text-[#2E9A72] px-2 py-0.5 rounded-full border border-[#B4E8CE]">
                      {uniqueCountries}
                    </span>
                  )}
                </div>
                <div>
                  {countryCounts.length === 0 ? (
                    <div className="text-center py-8 px-4">
                      <div className="w-12 h-12 rounded-2xl bg-[#E8F7F1] flex items-center justify-center mx-auto mb-2">
                        <Globe className="w-6 h-6 text-[#2E9A72]/40" />
                      </div>
                      <p className="text-[13px] text-[#8888A0]">Country data appears after first click</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-[#F5F5F8]">
                      {countryCounts.map(([country, count], i) => {
                        const maxCount = countryCounts[0][1];
                        const pct = deviceTotal > 0 ? Math.round((count / deviceTotal) * 100) : 0;
                        return (
                          <div key={country} className="flex items-center gap-3 px-5 py-3 hover:bg-[#FAFAFE] transition-colors">
                            <span className="text-[10px] font-bold text-[#C0C0CC] w-4 shrink-0 tabular-nums">#{i + 1}</span>
                            <span className="text-[20px] leading-none shrink-0">{countryFlag(country)}</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex justify-between items-center mb-1">
                                <span className="text-[12px] font-semibold text-[#0A0A0A]">{country === "Unknown" ? "Unknown" : countryName(country)}</span>
                                <span className="text-[11px] font-bold text-[#0A0A0A] tabular-nums">{count} <span className="text-[#A0A0AE] font-normal">({pct}%)</span></span>
                              </div>
                              <div className="h-1 bg-[#F2F2F6] rounded-full overflow-hidden">
                                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${(count / maxCount) * 100}%`, background: "#2E9A72" }} />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-[#EBEBF0] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                <div className="px-5 py-3.5 border-b border-[#F0F0F6] bg-[#FAFAFE] flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-[#F0EBF9] flex items-center justify-center">
                    <Layers className="w-3.5 h-3.5 text-[#7C5CC4]" />
                  </div>
                  <h3 className="font-semibold text-[14px] text-[#0A0A0A]">Top Active Links</h3>
                </div>
                <div>
                  {slugCounts.length === 0 ? (
                    <div className="text-center py-8 px-4">
                      <div className="w-12 h-12 rounded-2xl bg-[#F0EBF9] flex items-center justify-center mx-auto mb-2">
                        <Layers className="w-6 h-6 text-[#7C5CC4]/40" />
                      </div>
                      <p className="text-[13px] text-[#8888A0]">Link activity appears after first click</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-[#F5F5F8]">
                      {slugCounts.map(([slug, count], i) => {
                        const maxCount = slugCounts[0][1];
                        return (
                          <div key={slug} className="flex items-center gap-3 px-5 py-3 hover:bg-[#FAFAFE] transition-colors">
                            <span className="text-[10px] font-bold text-[#C0C0CC] w-4 shrink-0 tabular-nums">#{i + 1}</span>
                            <div
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                              style={{ background: slugColor(slug) }}
                            >
                              {slug.slice(0, 2).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[12px] font-semibold text-[#0A0A0A] truncate">/{slug}</p>
                              <div className="mt-1 h-1 bg-[#F2F2F6] rounded-full overflow-hidden">
                                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${(count / maxCount) * 100}%`, background: slugColor(slug) }} />
                              </div>
                            </div>
                            <span className="text-[12px] font-bold text-[#0A0A0A] shrink-0 tabular-nums">{count}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

            </div>

            {referrerCounts.length > 0 && events.length > 0 && (
              <div className="bg-white rounded-2xl border border-[#EBEBF0] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                <div className="px-5 py-3.5 border-b border-[#F0F0F6] bg-[#FAFAFE] flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-[#EEF3F7] flex items-center justify-center">
                    <ArrowUpRight className="w-3.5 h-3.5 text-[#728DA7]" />
                  </div>
                  <h3 className="font-semibold text-[14px] text-[#0A0A0A]">Top Referrers</h3>
                </div>
                <div className="divide-y divide-[#F5F5F8]">
                  {referrerCounts.map(([ref, count]) => (
                    <div key={ref} className="flex items-center justify-between px-5 py-3 hover:bg-[#FAFAFE] transition-colors">
                      <span className="text-[12px] text-[#3A3A3E] truncate mr-3">{ref}</span>
                      <span className="text-[12px] font-semibold text-[#0A0A0A] shrink-0 tabular-nums">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>

      </div>
    </ProtectedLayout>
  );
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="mt-0.5 shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold text-[#A0A0AE] uppercase tracking-[0.08em]">{label}</p>
        <p className="text-[12px] font-medium text-[#0A0A0A] break-all">{value}</p>
      </div>
    </div>
  );
}
