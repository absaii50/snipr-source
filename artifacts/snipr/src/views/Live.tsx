"use client";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import {
  Radio, Globe, Monitor, Smartphone, Tablet,
  RefreshCw, WifiOff, QrCode, Layers,
  MapPin, ChevronDown, ChevronUp, Clock, Zap,
  Signal, Eye, Navigation
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
    "#4F46E5", "#7C3AED", "#14B8A6", "#F59E0B", "#EC4899", "#0EA5E9", "#10B981"
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

  const toggleExpand = useCallback((id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  }, []);

  return (
    <ProtectedLayout>
      <div className="p-5 lg:p-8 max-w-[1400px] mx-auto w-full space-y-5">

        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <p className="text-[10px] font-bold tracking-[0.24em] uppercase text-[#728DA7]">
                Real-Time Intelligence
              </p>
              <span className={[
                "inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-0.5 rounded-full",
                status === "connected"
                  ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                  : status === "connecting"
                  ? "bg-amber-50 text-amber-600 border border-amber-200"
                  : "bg-red-50 text-red-500 border border-red-200"
              ].join(" ")}>
                {status === "connected" && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
                )}
                {status === "connecting" && (
                  <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                )}
                {status === "disconnected" && (
                  <WifiOff className="w-2.5 h-2.5" />
                )}
                {status === "connected" ? "LIVE" : status === "connecting" ? "Connecting..." : "Reconnecting..."}
              </span>
            </div>
            <h1 className="text-[28px] font-display font-black tracking-tight text-[#0F172A] leading-none">
              Live Tracking
            </h1>
            <p className="text-[13px] text-slate-500 mt-1">
              Monitor every click as it happens — full visitor details in real time.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {[
            {
              label: "Active Now",
              value: recentEvents.length,
              sub: "last 5 minutes",
              icon: <Zap className="w-4 h-4" />,
              color: "text-emerald-600",
              bg: "bg-emerald-50",
              pulse: recentEvents.length > 0,
            },
            {
              label: "Session Total",
              value: totalSession,
              sub: "since page load",
              icon: <Eye className="w-4 h-4" />,
              color: "text-indigo-600",
              bg: "bg-indigo-50",
            },
            {
              label: "Mobile",
              value: deviceCounts.mobile,
              sub: deviceTotal > 0 ? `${Math.round((deviceCounts.mobile / deviceTotal) * 100)}% of traffic` : "no data yet",
              icon: <Smartphone className="w-4 h-4" />,
              color: "text-violet-600",
              bg: "bg-violet-50",
            },
            {
              label: "Desktop",
              value: deviceCounts.desktop,
              sub: deviceTotal > 0 ? `${Math.round((deviceCounts.desktop / deviceTotal) * 100)}% of traffic` : "no data yet",
              icon: <Monitor className="w-4 h-4" />,
              color: "text-sky-600",
              bg: "bg-sky-50",
            },
            {
              label: "Countries",
              value: uniqueCountries,
              sub: "unique regions",
              icon: <Globe className="w-4 h-4" />,
              color: "text-teal-600",
              bg: "bg-teal-50",
            },
          ].map((kpi) => (
            <div key={kpi.label} className="bg-white border border-slate-200 rounded-2xl p-4 hover:shadow-sm transition-shadow">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.12em]">{kpi.label}</p>
                <div className={`w-7 h-7 rounded-lg ${kpi.bg} ${kpi.color} flex items-center justify-center`}>
                  {kpi.icon}
                </div>
              </div>
              <div className="flex items-end gap-1.5">
                <span className="text-[28px] font-display font-black text-slate-900 leading-none">{kpi.value}</span>
                {kpi.pulse && <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse mb-1.5" />}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">{kpi.sub}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

          <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 overflow-hidden flex flex-col">
            <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
              <h3 className="font-semibold text-[14px] text-slate-900 flex items-center gap-2">
                <Radio className="w-4 h-4 text-indigo-500" />
                Live Activity Feed
              </h3>
              <span className="text-[11px] text-slate-400">
                {events.length === 0 ? "Waiting for visits..." : `${events.length} events`}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto max-h-[560px] custom-scrollbar">
              {events.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 py-20 px-6 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center">
                    <Signal className="w-7 h-7 text-indigo-400" />
                  </div>
                  <div>
                    <p className="text-[14px] font-semibold text-slate-900">Listening for clicks</p>
                    <p className="text-[12px] text-slate-500 mt-0.5 max-w-xs">
                      {status === "connected"
                        ? "Click any of your short links to see detailed visitor information appear here instantly."
                        : "Connecting to the live stream..."}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {events.map((ev) => {
                    const isExpanded = expandedId === ev._id;
                    return (
                      <div key={ev._id} className="animate-in fade-in slide-in-from-top-1 duration-300">
                        <button
                          onClick={() => toggleExpand(ev._id)}
                          aria-expanded={isExpanded}
                          aria-controls={`detail-${ev._id}`}
                          className="w-full flex items-center gap-3 px-5 py-3 hover:bg-slate-50/70 transition-colors text-left"
                        >
                          <div
                            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-white text-[11px] font-bold shadow-sm"
                            style={{ background: slugColor(ev.slug) }}
                          >
                            {ev.slug.slice(0, 2).toUpperCase()}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[13px] font-semibold text-slate-900">/{ev.slug}</span>
                              {ev.isQr && (
                                <span className="inline-flex items-center gap-0.5 text-[9px] font-bold bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded-full border border-amber-200">
                                  <QrCode className="w-2.5 h-2.5" /> QR
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap text-[11px] text-slate-500">
                              <span className="flex items-center gap-1">
                                {countryFlag(ev.country)}
                                {ev.city ? `${ev.city}, ` : ""}{ev.country ? countryName(ev.country) : "Unknown"}
                              </span>
                              <span className="text-slate-300">·</span>
                              <span className="flex items-center gap-1">
                                <DeviceIcon device={ev.device} className="w-3 h-3" />
                                {ev.device ?? "desktop"}
                              </span>
                              <span className="text-slate-300">·</span>
                              <span>{ev.browser ?? "Unknown"}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[10px] text-slate-400 whitespace-nowrap">
                              {formatDistanceToNow(new Date(ev.timestamp), { addSuffix: true })}
                            </span>
                            {isExpanded
                              ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                              : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                            }
                          </div>
                        </button>

                        {isExpanded && (
                          <div id={`detail-${ev._id}`} className="mx-5 mb-3 rounded-xl bg-slate-50 border border-slate-200 p-4 animate-in fade-in slide-in-from-top-1 duration-200">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.12em] mb-3">
                              Full Visitor Details
                            </p>
                            <div className="grid grid-cols-2 gap-3">
                              <DetailRow icon={<MapPin className="w-3.5 h-3.5 text-teal-500" />} label="Location" value={`${ev.city ? ev.city + ", " : ""}${ev.country ? countryName(ev.country) : "Unknown"}`} />
                              <DetailRow icon={<span className="text-[14px]">{countryFlag(ev.country)}</span>} label="Country Code" value={ev.country ?? "N/A"} />
                              <DetailRow icon={<DeviceIcon device={ev.device} className="w-3.5 h-3.5 text-violet-500" />} label="Device" value={ev.device ?? "desktop"} />
                              <DetailRow icon={<span className="text-[14px]">{osIcon(ev.os)}</span>} label="Operating System" value={ev.os ?? "Unknown"} />
                              <DetailRow icon={<span className="text-[14px]">{browserIcon(ev.browser)}</span>} label="Browser" value={ev.browser ?? "Unknown"} />
                              <DetailRow icon={<Navigation className="w-3.5 h-3.5 text-sky-500" />} label="Referrer" value={ev.referrer ?? "Direct"} />
                              <DetailRow icon={<Clock className="w-3.5 h-3.5 text-amber-500" />} label="Timestamp" value={new Date(ev.timestamp).toLocaleString()} />
                              <DetailRow icon={<QrCode className="w-3.5 h-3.5 text-indigo-500" />} label="QR Scan" value={ev.isQr ? "Yes" : "No"} />
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

          <div className="lg:col-span-5 space-y-5">

            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/70">
                <h3 className="font-semibold text-[14px] text-slate-900 flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-violet-500" />
                  Device Breakdown
                </h3>
              </div>
              <div className="p-5 space-y-3">
                {deviceTotal === 0 ? (
                  <div className="text-center py-6">
                    <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center mx-auto mb-2">
                      <Smartphone className="w-5 h-5 text-violet-400" />
                    </div>
                    <p className="text-[12px] text-slate-400">Device data appears after first click</p>
                  </div>
                ) : (
                  <>
                    {[
                      { label: "Mobile", count: deviceCounts.mobile, icon: <Smartphone className="w-4 h-4" />, color: "#7C3AED", bg: "bg-violet-50" },
                      { label: "Desktop", count: deviceCounts.desktop, icon: <Monitor className="w-4 h-4" />, color: "#0EA5E9", bg: "bg-sky-50" },
                      { label: "Tablet", count: deviceCounts.tablet, icon: <Tablet className="w-4 h-4" />, color: "#14B8A6", bg: "bg-teal-50" },
                    ].map(d => {
                      const pct = deviceTotal > 0 ? Math.round((d.count / deviceTotal) * 100) : 0;
                      return (
                        <div key={d.label} className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg ${d.bg} flex items-center justify-center shrink-0`} style={{ color: d.color }}>
                            {d.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-[12px] font-semibold text-slate-900">{d.label}</span>
                              <span className="text-[11px] font-bold text-slate-600">{d.count} <span className="text-slate-400 font-normal">({pct}%)</span></span>
                            </div>
                            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-700"
                                style={{ width: `${pct}%`, background: d.color }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    <div className="border-t border-slate-100 pt-3 mt-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.12em] mb-2">Browsers</p>
                      <div className="space-y-1.5">
                        {browserCounts.map(([browser, count]) => (
                          <div key={browser} className="flex items-center justify-between">
                            <span className="text-[11px] text-slate-600 flex items-center gap-1.5">
                              <span className="text-[12px]">{browserIcon(browser)}</span>
                              {browser}
                            </span>
                            <span className="text-[11px] font-semibold text-slate-700">{count}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="border-t border-slate-100 pt-3 mt-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.12em] mb-2">Operating Systems</p>
                      <div className="space-y-1.5">
                        {osCounts.map(([os, count]) => (
                          <div key={os} className="flex items-center justify-between">
                            <span className="text-[11px] text-slate-600 flex items-center gap-1.5">
                              <span className="text-[12px]">{osIcon(os)}</span>
                              {os}
                            </span>
                            <span className="text-[11px] font-semibold text-slate-700">{count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
                <h3 className="font-semibold text-[14px] text-slate-900 flex items-center gap-2">
                  <Globe className="w-4 h-4 text-teal-500" />
                  Realtime Countries
                </h3>
                {uniqueCountries > 0 && (
                  <span className="text-[10px] font-bold bg-teal-50 text-teal-600 px-2 py-0.5 rounded-full border border-teal-200">
                    {uniqueCountries} region{uniqueCountries !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
              <div className="divide-y divide-slate-100">
                {countryCounts.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center mx-auto mb-2">
                      <Globe className="w-5 h-5 text-teal-400" />
                    </div>
                    <p className="text-[12px] text-slate-400">Country data appears after first click</p>
                  </div>
                ) : (
                  countryCounts.map(([country, count], i) => {
                    const maxCount = countryCounts[0][1];
                    const pct = maxCount > 0 ? Math.round((count / deviceTotal) * 100) : 0;
                    return (
                      <div key={country} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50/50 transition-colors">
                        <span className="text-[10px] font-bold text-slate-300 w-4 shrink-0">#{i + 1}</span>
                        <span className="text-[20px] leading-none shrink-0">{countryFlag(country)}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-[12px] font-semibold text-slate-900">{country === "Unknown" ? "Unknown" : countryName(country)}</span>
                            <span className="text-[11px] font-bold text-slate-600">{count} <span className="text-slate-400 font-normal">({pct}%)</span></span>
                          </div>
                          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-700"
                              style={{ width: `${(count / maxCount) * 100}%`, background: `hsl(${170 + i * 20}, 60%, 45%)` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/70">
                <h3 className="font-semibold text-[14px] text-slate-900 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-500" />
                  Top Active Links
                </h3>
              </div>
              <div className="divide-y divide-slate-100">
                {slugCounts.length === 0 ? (
                  <div className="text-center py-6">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center mx-auto mb-2">
                      <Layers className="w-5 h-5 text-indigo-400" />
                    </div>
                    <p className="text-[12px] text-slate-400">Link activity appears after first click</p>
                  </div>
                ) : (
                  slugCounts.map(([slug, count], i) => {
                    const maxCount = slugCounts[0][1];
                    return (
                      <div key={slug} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50/50 transition-colors">
                        <span className="text-[10px] font-bold text-slate-300 w-4 shrink-0">#{i + 1}</span>
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                          style={{ background: slugColor(slug) }}
                        >
                          {slug.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-semibold text-slate-900 truncate">/{slug}</p>
                          <div className="mt-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-700"
                              style={{ width: `${(count / maxCount) * 100}%`, background: slugColor(slug) }}
                            />
                          </div>
                        </div>
                        <span className="text-[12px] font-bold text-slate-700 shrink-0">{count}</span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

          </div>
        </div>

      </div>
    </ProtectedLayout>
  );
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <div className="mt-0.5 shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.08em]">{label}</p>
        <p className="text-[12px] font-medium text-slate-700 break-all">{value}</p>
      </div>
    </div>
  );
}
