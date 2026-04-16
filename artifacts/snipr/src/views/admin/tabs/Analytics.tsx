"use client";
import { useEffect, useState, useCallback } from "react";
import { BarChart3, Globe, Monitor, RefreshCw, TrendingUp, Users, Link2, Download } from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  BarChart, Bar, Legend,
} from "recharts";
import { apiFetch, apiFetchBlob, downloadBlob, fmtNum } from "../utils";

interface AnalyticsData {
  clicksByDay: { day: string; clicks: string }[];
  topCountries: { country: string; clicks: string }[];
  topDevices: { device: string; clicks: string }[];
  topBrowsers: { browser: string; clicks: string }[];
  topReferrers: { referrer: string; clicks: string }[];
}

interface PlatformData {
  clicksByDay: { day: string; clicks: number }[];
  userGrowth: { day: string; users: number }[];
  linkGrowth: { day: string; links: number }[];
}

type Range = "7" | "30" | "90";

function BarList({ items, label, valueKey, nameKey }: {
  items: Record<string, string>[]; label: string;
  valueKey: string; nameKey: string;
}) {
  const max = Math.max(...items.map((i) => Number(i[valueKey])), 1);
  return (
    <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5">
      <h3 className="text-sm font-semibold text-[#0A0A0A] mb-4">{label}</h3>
      {items.length === 0 && (
        <p className="text-sm text-[#8888A0] py-6 text-center">No data for this period</p>
      )}
      <div className="space-y-2.5">
        {items.map((item) => {
          const pct = (Number(item[valueKey]) / max) * 100;
          return (
            <div key={item[nameKey]}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-[#3A3A3E] font-medium truncate max-w-[160px]">{item[nameKey] || "(unknown)"}</span>
                <span className="text-[#8888A0] tabular-nums">{fmtNum(Number(item[valueKey]))}</span>
              </div>
              <div className="h-2 bg-[#F4F4F6] rounded-full overflow-hidden">
                <div className="h-full bg-[#728DA7] rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ClicksTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#0A0A0A] text-white text-xs px-3 py-2 rounded-xl shadow-xl">
      <div className="text-[#8888A0] mb-0.5">{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="font-bold" style={{ color: p.color }}>
          {fmtNum(p.value)} {p.name}
        </div>
      ))}
    </div>
  );
}

export default function AnalyticsTab() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [platform, setPlatform] = useState<PlatformData | null>(null);
  const [range, setRange] = useState<Range>("30");
  const [loading, setLoading] = useState(true);
  const [activeChart, setActiveChart] = useState<"clicks" | "growth">("clicks");

  const load = useCallback(async (days: string) => {
    setLoading(true);
    try {
      const [d, p] = await Promise.all([
        apiFetch(`/admin/analytics?days=${days}`),
        apiFetch(`/admin/analytics/platform?days=${days}`),
      ]);
      setData(d);
      setPlatform({
        clicksByDay: (p.clicksByDay ?? []).map((r: Record<string, string>) => ({
          day: new Date(r.day).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
          clicks: Number(r.clicks),
        })),
        userGrowth: (p.userGrowth ?? []).map((r: Record<string, string>) => ({
          day: new Date(r.day).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
          users: Number(r.users),
        })),
        linkGrowth: (p.linkGrowth ?? []).map((r: Record<string, string>) => ({
          day: new Date(r.day).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
          links: Number(r.links),
        })),
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(range); }, [range, load]);

  const growthData = platform ? (() => {
    const days = new Map<string, { day: string; users: number; links: number }>();
    platform.userGrowth.forEach(({ day, users }) => {
      days.set(day, { day, users, links: 0 });
    });
    platform.linkGrowth.forEach(({ day, links }) => {
      if (days.has(day)) days.get(day)!.links = links;
      else days.set(day, { day, users: 0, links });
    });
    return Array.from(days.values()).sort((a, b) => a.day.localeCompare(b.day));
  })() : [];

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 justify-between flex-wrap">
        <div className="flex items-center gap-1 bg-white border border-[#E2E8F0] rounded-xl p-1">
          {([["7", "7 days"], ["30", "30 days"], ["90", "90 days"]] as [Range, string][]).map(([v, l]) => (
            <button key={v} onClick={() => setRange(v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${range === v ? "bg-[#E8EEF4] text-[#4A7A94]" : "text-[#8888A0] hover:text-[#3A3A3E]"}`}>
              {l}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-white border border-[#E2E8F0] rounded-xl p-1">
            {([["clicks", "Traffic"], ["growth", "Growth"]] as ["clicks" | "growth", string][]).map(([v, l]) => (
              <button key={v} onClick={() => setActiveChart(v)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${activeChart === v ? "bg-[#E8EEF4] text-[#4A7A94]" : "text-[#8888A0] hover:text-[#3A3A3E]"}`}>
                {l}
              </button>
            ))}
          </div>
          <button onClick={() => load(range)} className="p-2 rounded-xl border border-[#E2E8F0] bg-white hover:bg-[#F4F4F6] transition-all">
            <RefreshCw className={`w-3.5 h-3.5 text-[#8888A0] ${loading ? "animate-spin" : ""}`} />
          </button>
          <button onClick={async () => { try { const b = await apiFetchBlob("/admin/export/clicks"); downloadBlob(b, "snipr-clicks.csv"); } catch { alert("Export failed."); } }}
            className="flex items-center gap-1 px-2.5 py-2 rounded-xl border border-[#E2E8F0] bg-white hover:bg-[#F4F4F6] transition-all text-xs text-[#8888A0]">
            <Download className="w-3.5 h-3.5" /> CSV
          </button>
        </div>
      </div>

      {/* Main chart */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-[#E2E8F0] h-52 animate-pulse" />
      ) : (
        <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5">
          {activeChart === "clicks" ? (
            <>
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="w-4 h-4 text-[#728DA7]" />
                <h3 className="text-sm font-semibold text-[#0A0A0A]">Platform Clicks</h3>
                <span className="text-xs text-[#8888A0] ml-1">— last {range} days</span>
              </div>
              {(platform?.clicksByDay ?? []).length === 0 ? (
                <p className="text-sm text-[#8888A0] py-8 text-center">No click data for this period</p>
              ) : (
                <ResponsiveContainer width="100%" height={160}>
                  <AreaChart data={platform?.clicksByDay} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="clickGrad2" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#728DA7" stopOpacity={0.18} />
                        <stop offset="95%" stopColor="#728DA7" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F5" vertical={false} />
                    <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#8888A0" }} tickLine={false} axisLine={false}
                      interval={Math.floor((platform?.clicksByDay?.length ?? 1) / 6)} />
                    <YAxis tick={{ fontSize: 10, fill: "#8888A0" }} tickLine={false} axisLine={false} tickFormatter={fmtNum} />
                    <Tooltip content={<ClicksTooltip />} cursor={{ stroke: "#728DA7", strokeWidth: 1, strokeDasharray: "4 4" }} />
                    <Area type="monotone" dataKey="clicks" name="clicks" stroke="#728DA7" strokeWidth={2}
                      fill="url(#clickGrad2)" dot={false} activeDot={{ r: 4, fill: "#728DA7" }} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-4 h-4 text-[#728DA7]" />
                <h3 className="text-sm font-semibold text-[#0A0A0A]">Platform Growth</h3>
                <span className="text-xs text-[#8888A0] ml-1">— new users &amp; links per day</span>
              </div>
              {growthData.length === 0 ? (
                <p className="text-sm text-[#8888A0] py-8 text-center">No growth data for this period</p>
              ) : (
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={growthData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F5" vertical={false} />
                    <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#8888A0" }} tickLine={false} axisLine={false}
                      interval={Math.floor(growthData.length / 6)} />
                    <YAxis tick={{ fontSize: 10, fill: "#8888A0" }} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip content={<ClicksTooltip />} cursor={{ fill: "#F0F0F5" }} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                    <Bar dataKey="users" name="New Users" fill="#728DA7" radius={[3, 3, 0, 0]} maxBarSize={20} />
                    <Bar dataKey="links" name="New Links" fill="#2E9A72" radius={[3, 3, 0, 0]} maxBarSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </>
          )}
        </div>
      )}

      {/* Summary stats */}
      {!loading && platform && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Total Clicks", value: platform.clicksByDay.reduce((s, d) => s + d.clicks, 0), icon: BarChart3, color: "text-[#728DA7]", bg: "bg-[#EEF3F7]" },
            { label: "New Users", value: platform.userGrowth.reduce((s, d) => s + d.users, 0), icon: Users, color: "text-[#2E9A72]", bg: "bg-[#E6F7F1]" },
            { label: "New Links", value: platform.linkGrowth.reduce((s, d) => s + d.links, 0), icon: Link2, color: "text-[#7C5CC4]", bg: "bg-[#F0EBF9]" },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className="bg-white rounded-2xl border border-[#E2E8F0] p-4 flex items-center gap-3">
              <div className={`w-9 h-9 ${bg} rounded-xl flex items-center justify-center shrink-0`}>
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
              <div>
                <div className="text-lg font-bold text-[#0A0A0A] tabular-nums">{fmtNum(value)}</div>
                <div className="text-xs text-[#8888A0]">{label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-[#E2E8F0] h-52 animate-pulse" />
          ))}
        </div>
      ) : data ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <BarList label="Top Countries" items={data.topCountries} nameKey="country" valueKey="clicks" />
          <BarList label="Top Referrers" items={data.topReferrers} nameKey="referrer" valueKey="clicks" />
          <BarList label="Devices" items={data.topDevices} nameKey="device" valueKey="clicks" />
          <BarList label="Browsers" items={data.topBrowsers} nameKey="browser" valueKey="clicks" />
        </div>
      ) : null}
    </div>
  );
}
