"use client";
import { useEffect, useRef, useState } from "react";
import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import {
  Radio, Globe, Monitor, Smartphone, Tablet, MousePointerClick,
  Link as LinkIcon, RefreshCw, Wifi, WifiOff, QrCode, Layers
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

function DeviceIcon({ device }: { device: string | null }) {
  const cls = "w-3.5 h-3.5";
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
    "#728DA7", "#7C5CC4", "#2E9A72", "#D4865A", "#C45C8A", "#5A8AC4", "#8AC45A"
  ];
  let hash = 0;
  for (let i = 0; i < slug.length; i++) hash = slug.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

export default function Live() {
  const [events, setEvents] = useState<ClickEvent[]>([]);
  const [status, setStatus] = useState<"connecting" | "connected" | "disconnected">("connecting");
  const [totalToday, setTotalToday] = useState(0);
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
            eventsRef.current = [event, ...eventsRef.current].slice(0, 150);
            setEvents([...eventsRef.current]);
            setTotalToday(t => t + 1);
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

  const slugCounts = events.reduce<Record<string, number>>((acc, e) => {
    acc[e.slug] = (acc[e.slug] ?? 0) + 1;
    return acc;
  }, {});
  const topSlugs = Object.entries(slugCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  const countryCounts = events.reduce<Record<string, number>>((acc, e) => {
    const key = e.country ?? "Unknown";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
  const topCountries = Object.entries(countryCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <ProtectedLayout>
      <div className="p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 mb-1.5">
              <p className="text-[10px] font-bold tracking-[0.24em] uppercase text-[#728DA7]">
                Real-Time Dashboard
              </p>
              <span className={[
                "inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full",
                status === "connected"
                  ? "bg-[#E6F7F1] text-[#2E9A72]"
                  : status === "connecting"
                  ? "bg-[#FFF8E6] text-[#D4865A]"
                  : "bg-[#FFF0F0] text-[#E05050]"
              ].join(" ")}>
                {status === "connected" && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[#2E9A72] animate-pulse inline-block" />
                )}
                {status === "connecting" && (
                  <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                )}
                {status === "disconnected" && (
                  <WifiOff className="w-2.5 h-2.5" />
                )}
                {status === "connected" ? "LIVE" : status === "connecting" ? "Connecting…" : "Reconnecting…"}
              </span>
            </div>
            <h1 className="text-[26px] font-display font-black tracking-tight text-[#0A0A0A] leading-none">
              Live Tracking
            </h1>
            <p className="text-[13px] text-[#8888A0] mt-1.5">
              Real-time link visits as they happen — no refresh needed.
            </p>
          </div>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-[#E4E4EC] rounded-2xl p-5">
            <p className="text-[10px] font-bold text-[#AAAAB4] uppercase tracking-[0.16em] mb-2">
              Active (5 min)
            </p>
            <div className="flex items-end gap-2">
              <span className="text-[32px] font-display font-black text-[#0A0A0A] leading-none">
                {recentEvents.length}
              </span>
              {recentEvents.length > 0 && (
                <span className="w-2 h-2 rounded-full bg-[#2E9A72] animate-pulse mb-1.5" />
              )}
            </div>
            <p className="text-[11px] text-[#8888A0] mt-1">visits in last 5 min</p>
          </div>

          <div className="bg-white border border-[#E4E4EC] rounded-2xl p-5">
            <p className="text-[10px] font-bold text-[#AAAAB4] uppercase tracking-[0.16em] mb-2">
              This Session
            </p>
            <span className="text-[32px] font-display font-black text-[#0A0A0A] leading-none">
              {totalToday}
            </span>
            <p className="text-[11px] text-[#8888A0] mt-1">total since page load</p>
          </div>

          <div className="bg-white border border-[#E4E4EC] rounded-2xl p-5">
            <p className="text-[10px] font-bold text-[#AAAAB4] uppercase tracking-[0.16em] mb-2">
              Unique Links
            </p>
            <span className="text-[32px] font-display font-black text-[#0A0A0A] leading-none">
              {Object.keys(slugCounts).length}
            </span>
            <p className="text-[11px] text-[#8888A0] mt-1">different links hit</p>
          </div>

          <div className="bg-white border border-[#E4E4EC] rounded-2xl p-5">
            <p className="text-[10px] font-bold text-[#AAAAB4] uppercase tracking-[0.16em] mb-2">
              Countries
            </p>
            <span className="text-[32px] font-display font-black text-[#0A0A0A] leading-none">
              {Object.keys(countryCounts).length}
            </span>
            <p className="text-[11px] text-[#8888A0] mt-1">unique countries</p>
          </div>
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Live feed */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-[#E4E4EC] overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-[#F0F0F6] bg-[#FAFAFE] flex items-center justify-between">
              <h3 className="font-semibold text-[14px] text-[#0A0A0A] flex items-center gap-2">
                <Radio className="w-4 h-4 text-[#728DA7]" />
                Live Activity Feed
              </h3>
              <span className="text-[11px] text-[#AAAAB4]">
                {events.length === 0 ? "Waiting for visits…" : `${events.length} event${events.length !== 1 ? "s" : ""} recorded`}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto max-h-[520px] custom-scrollbar divide-y divide-[#F4F4F8]">
              {events.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 py-20 px-6 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-[#EEF3F7] flex items-center justify-center">
                    <Wifi className="w-7 h-7 text-[#728DA7]/50" />
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold text-[#0A0A0A]">Listening for visits</p>
                    <p className="text-[12px] text-[#8888A0] mt-0.5">
                      {status === "connected"
                        ? "Click on any of your short links to see events appear here in real time."
                        : "Connecting to the live stream…"}
                    </p>
                  </div>
                </div>
              ) : (
                events.map((ev) => (
                  <div
                    key={ev._id}
                    className="flex items-center gap-3.5 px-5 py-3.5 hover:bg-[#FAFAFE] transition-colors animate-in fade-in slide-in-from-top-1 duration-300"
                  >
                    <div
                      className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-white text-[11px] font-bold"
                      style={{ background: slugColor(ev.slug) }}
                    >
                      {ev.slug.slice(0, 2).toUpperCase()}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[13px] font-semibold text-[#0A0A0A]">
                          /{ev.slug}
                        </span>
                        {ev.isQr && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold bg-[#EEF3F7] text-[#728DA7] px-1.5 py-0.5 rounded-full">
                            <QrCode className="w-2.5 h-2.5" /> QR
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2.5 mt-0.5 flex-wrap">
                        <span className="text-[12px] text-[#8888A0] flex items-center gap-1">
                          {countryFlag(ev.country)}
                          {ev.city ? `${ev.city}, ` : ""}{ev.country ?? "Unknown"}
                        </span>
                        <span className="text-[#E4E4EC]">·</span>
                        <span className="text-[12px] text-[#8888A0] flex items-center gap-1">
                          <DeviceIcon device={ev.device} />
                          {ev.device ?? "Desktop"}
                        </span>
                        {ev.browser && (
                          <>
                            <span className="text-[#E4E4EC]">·</span>
                            <span className="text-[12px] text-[#8888A0]">{ev.browser}</span>
                          </>
                        )}
                        {ev.referrer && (
                          <>
                            <span className="text-[#E4E4EC]">·</span>
                            <span className="text-[12px] text-[#AAAAB4] truncate max-w-[120px]">
                              via {ev.referrer}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <span className="text-[11px] text-[#CCCCDA] shrink-0 whitespace-nowrap">
                      {formatDistanceToNow(new Date(ev.timestamp), { addSuffix: true })}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right column: Top Links + Top Countries */}
          <div className="space-y-4">

            {/* Top Active Links */}
            <div className="bg-white rounded-2xl border border-[#E4E4EC] overflow-hidden">
              <div className="px-5 py-4 border-b border-[#F0F0F6] bg-[#FAFAFE]">
                <h3 className="font-semibold text-[14px] text-[#0A0A0A] flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[#728DA7]" />
                  Top Links
                </h3>
              </div>
              <div className="divide-y divide-[#F4F4F8]">
                {topSlugs.length === 0 ? (
                  <p className="text-[12px] text-[#AAAAB4] text-center py-8">No data yet</p>
                ) : (
                  topSlugs.map(([slug, count], i) => {
                    const maxCount = topSlugs[0][1];
                    return (
                      <div key={slug} className="flex items-center gap-3 px-5 py-3">
                        <span className="text-[10px] font-bold text-[#CCCCDA] w-4 shrink-0">#{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-semibold text-[#0A0A0A] truncate">/{slug}</p>
                          <div className="mt-1 h-1 bg-[#F0F0F6] rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-700"
                              style={{
                                width: `${(count / maxCount) * 100}%`,
                                background: slugColor(slug),
                              }}
                            />
                          </div>
                        </div>
                        <span className="text-[12px] font-bold text-[#0A0A0A] shrink-0">{count}</span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Top Countries */}
            <div className="bg-white rounded-2xl border border-[#E4E4EC] overflow-hidden">
              <div className="px-5 py-4 border-b border-[#F0F0F6] bg-[#FAFAFE]">
                <h3 className="font-semibold text-[14px] text-[#0A0A0A] flex items-center gap-2">
                  <Globe className="w-4 h-4 text-[#728DA7]" />
                  Top Countries
                </h3>
              </div>
              <div className="divide-y divide-[#F4F4F8]">
                {topCountries.length === 0 ? (
                  <p className="text-[12px] text-[#AAAAB4] text-center py-8">No data yet</p>
                ) : (
                  topCountries.map(([country, count]) => {
                    const maxCount = topCountries[0][1];
                    return (
                      <div key={country} className="flex items-center gap-3 px-5 py-3">
                        <span className="text-[18px] leading-none">{countryFlag(country)}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-semibold text-[#0A0A0A]">{country}</p>
                          <div className="mt-1 h-1 bg-[#F0F0F6] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[#728DA7] rounded-full transition-all duration-700"
                              style={{ width: `${(count / maxCount) * 100}%` }}
                            />
                          </div>
                        </div>
                        <span className="text-[12px] font-bold text-[#0A0A0A] shrink-0">{count}</span>
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
