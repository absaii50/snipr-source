"use client";
import { useState, useMemo } from "react";
import { keepPreviousData } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { 
  useGetLink,
  useGetLinkAnalytics, 
  getGetLinkAnalyticsQueryKey,
  useGetLinkTimeseries,
  getGetLinkTimeseriesQueryKey,
  useGetLinkEvents,
  getGetLinkEventsQueryKey,
} from "@workspace/api-client-react";
import { 
  ArrowLeft,
  MousePointerClick, 
  Users, 
  Globe, 
  QrCode,
  Loader2,
  CalendarDays,
  ExternalLink
} from "lucide-react";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Legend 
} from "recharts";
import { format, parseISO } from "date-fns";

function getDateRange(days: number) {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - days);
  return { 
    from: from.toISOString().split('T')[0], 
    to: to.toISOString().split('T')[0] 
  };
}

export default function LinkAnalytics() {
  const rawParams = useParams();
  const linkId = (rawParams?.linkId as string) ?? "";
  const [days, setDays] = useState<number>(30);

  const { from, to } = useMemo(() => getDateRange(days), [days]);

  const queryParams = { from, to };

  const { data: link, isLoading: isLoadingLink } = useGetLink(linkId || "");
  
  const { data: stats, isLoading: isLoadingStats } = useGetLinkAnalytics(linkId || "", queryParams, {
    query: { queryKey: getGetLinkAnalyticsQueryKey(linkId || "", queryParams), placeholderData: keepPreviousData, enabled: !!linkId }
  });

  const { data: timeseries, isLoading: isLoadingTimeseries } = useLinkTimeseriesWithFormatting(linkId || "", queryParams);

  const { data: events, isLoading: isLoadingEvents } = useGetLinkEvents(linkId || "", { limit: 50 }, {
    query: { queryKey: getGetLinkEventsQueryKey(linkId || "", { limit: 50 }), enabled: !!linkId }
  });

  if (isLoadingLink) {
    return (
      <ProtectedLayout>
        <div className="flex h-full min-h-[50vh] items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </ProtectedLayout>
    );
  }

  if (!link) {
    return (
      <ProtectedLayout>
        <div className="p-8 max-w-7xl mx-auto text-center py-20">
          <h2 className="text-2xl font-bold mb-4">Link not found</h2>
          <Link href="/analytics" className="text-primary hover:underline">
            Return to Analytics
          </Link>
        </div>
      </ProtectedLayout>
    );
  }

  return (
    <ProtectedLayout>
      <div className="p-8 max-w-7xl mx-auto w-full">
        {/* Top Nav */}
        <div className="mb-6">
          <Link href="/analytics" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mb-4">
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            Back to Overview
          </Link>
        </div>

        {/* Header & Controls */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-8 bg-card p-6 rounded-3xl border border-border shadow-sm">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-display font-bold tracking-tight text-foreground truncate">
                /{link.slug}
              </h1>
              <div className={`px-2.5 py-1 text-xs font-semibold rounded-full shrink-0 ${link.enabled ? 'bg-green-500/10 text-green-600' : 'bg-[#E5E7EB]/30 text-[#9CA3AF]'}`}>
                {link.enabled ? 'Active' : 'Disabled'}
              </div>
            </div>
            <a 
              href={link.destinationUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center text-muted-foreground hover:text-primary transition-colors w-fit max-w-full"
            >
              <span className="truncate">{link.destinationUrl}</span>
              <ExternalLink className="w-4 h-4 ml-1.5 shrink-0" />
            </a>
          </div>
          
          <div className="flex bg-[#F0F0F6] border border-[#E4E4EC] p-1 rounded-xl shrink-0">
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-5 py-2 text-sm font-semibold rounded-lg transition-all ${
                  days === d 
                    ? "bg-white text-[#0A0A0A] shadow-sm" 
                    : "text-[#8888A0] hover:text-[#0A0A0A]"
                }`}
              >
                {d} Days
              </button>
            ))}
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <KpiCard 
            title="Total Clicks" 
            value={stats?.totalClicks} 
            icon={<MousePointerClick className="w-5 h-5" />} 
            colorClass="text-blue-500 bg-blue-500/10" 
            isLoading={isLoadingStats} 
          />
          <KpiCard 
            title="Unique Clicks" 
            value={stats?.uniqueClicks} 
            icon={<Users className="w-5 h-5" />} 
            colorClass="text-purple-500 bg-purple-500/10" 
            isLoading={isLoadingStats} 
          />
          <KpiCard 
            title="Direct Clicks" 
            value={stats?.directClicks} 
            icon={<Globe className="w-5 h-5" />} 
            colorClass="text-emerald-500 bg-emerald-500/10" 
            isLoading={isLoadingStats} 
          />
          <KpiCard 
            title="QR Code Scans" 
            value={stats?.qrClicks} 
            icon={<QrCode className="w-5 h-5" />} 
            colorClass="text-amber-500 bg-amber-500/10" 
            isLoading={isLoadingStats} 
          />
        </div>

        {/* Timeseries Chart */}
        <div className="bg-card p-6 rounded-2xl border border-border shadow-sm mb-8">
          <div className="flex items-center gap-2 mb-6">
            <CalendarDays className="w-5 h-5 text-muted-foreground" />
            <h3 className="font-semibold font-display text-lg">Click Performance</h3>
          </div>
          <div className="h-[350px] w-full">
            {isLoadingTimeseries ? (
              <div className="h-full w-full flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary/50" />
              </div>
            ) : timeseries?.length === 0 ? (
              <div className="h-full w-full flex items-center justify-center text-muted-foreground">
                No click data available for this period.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timeseries} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <defs>
                    <linearGradient id="colorClicks" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#728DA7" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#728DA7" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                  <XAxis 
                    dataKey="formattedTime" 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'var(--color-muted-foreground)', fontSize: 12 }}
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'var(--color-muted-foreground)', fontSize: 12 }}
                    dx={-10}
                  />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: '1px solid var(--color-border)', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    cursor={{ stroke: 'var(--color-muted)', strokeWidth: 2, strokeDasharray: '4 4' }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                  <Area 
                    type="monotone" 
                    name="Total Clicks"
                    dataKey="clicks" 
                    stroke="#728DA7" 
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#colorClicks)"
                    activeDot={{ r: 6, strokeWidth: 0 }}
                  />
                  <Area 
                    type="monotone" 
                    name="Unique Clicks"
                    dataKey="uniqueClicks" 
                    stroke="#C3C3C1" 
                    strokeWidth={3}
                    fill="none"
                    activeDot={{ r: 6, fill: '#C3C3C1', strokeWidth: 0 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Demographics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
          <TopList title="Countries" data={stats?.topCountries} isLoading={isLoadingStats} />
          <TopList title="Referrers" data={stats?.topReferrers} isLoading={isLoadingStats} />
          <div className="flex flex-col gap-6">
            <TopList title="Browsers" data={stats?.topBrowsers} isLoading={isLoadingStats} compact />
            <TopList title="Operating Systems" data={stats?.topOs} isLoading={isLoadingStats} compact />
          </div>
          <TopList title="Devices" data={stats?.topDevices} isLoading={isLoadingStats} />
        </div>

        {/* Recent Events Table */}
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden mb-8">
          <div className="px-6 py-5 border-b border-border/50 bg-[#F8F8FC]">
            <h3 className="font-semibold font-display text-lg">Recent Clicks (Last 50)</h3>
          </div>
          <div className="overflow-x-auto">
            {isLoadingEvents ? (
               <div className="py-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
            ) : !events || events.length === 0 ? (
               <div className="py-12 text-center text-muted-foreground">No recent clicks recorded.</div>
            ) : (
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/30 text-muted-foreground">
                  <tr>
                    <th className="px-6 py-4 font-medium">Time</th>
                    <th className="px-6 py-4 font-medium">Location</th>
                    <th className="px-6 py-4 font-medium">System</th>
                    <th className="px-6 py-4 font-medium">Referrer</th>
                    <th className="px-6 py-4 font-medium text-center">Type</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {events.map((event) => (
                    <tr key={event.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-muted-foreground">
                        {format(parseISO(event.timestamp), "MMM d, HH:mm:ss")}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-medium">{event.country || "Unknown"}</span>
                          {event.city && <span className="text-xs text-muted-foreground">{event.city}</span>}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-medium">{event.browser || "Unknown"}</span>
                          <span className="text-xs text-muted-foreground">{event.os || "Unknown OS"} &bull; {event.device || "Desktop"}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 truncate max-w-[200px]" title={event.referrer || "Direct"}>
                        {event.referrer || <span className="text-muted-foreground italic">Direct</span>}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {event.isQr ? (
                           <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500/10 text-amber-600 text-xs font-semibold">
                             <QrCode className="w-3.5 h-3.5" /> QR
                           </span>
                        ) : (
                           <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#E5E7EB] text-[#9CA3AF] text-xs font-semibold">
                             <Globe className="w-3.5 h-3.5" /> Link
                           </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

      </div>
    </ProtectedLayout>
  );
}

interface TimeseriesQueryParams {
  from?: string;
  to?: string;
  interval?: "hour" | "day" | "week";
}

// Wrapper to format dates safely
function useLinkTimeseriesWithFormatting(id: string, params: TimeseriesQueryParams) {
  const result = useGetLinkTimeseries(id, params, { query: { queryKey: getGetLinkTimeseriesQueryKey(id, params), placeholderData: keepPreviousData, enabled: !!id }});
  
  const formattedData = useMemo(() => {
    if (!result.data) return [];
    return result.data.map(pt => ({
      ...pt,
      formattedTime: format(parseISO(pt.time), 'MMM d')
    }));
  }, [result.data]);

  return { ...result, data: formattedData };
}

interface KpiCardProps {
  title: string;
  value: number | null | undefined;
  icon: React.ReactNode;
  colorClass: string;
  isLoading: boolean;
}

function KpiCard({ title, value, icon, colorClass, isLoading }: KpiCardProps) {
  return (
    <div className="bg-card p-6 rounded-2xl border border-border shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-muted-foreground">{title}</h3>
        <div className={`p-2 rounded-lg ${colorClass}`}>
          {icon}
        </div>
      </div>
      <div className="text-4xl font-display font-bold">
        {isLoading ? <span className="text-muted-foreground/30 animate-pulse">-</span> : (value?.toLocaleString() || "0")}
      </div>
    </div>
  );
}

interface TopListItem {
  label: string;
  count: number;
}

interface TopListProps {
  title: string;
  data: TopListItem[] | null | undefined;
  isLoading: boolean;
  compact?: boolean;
}

function TopList({ title, data, isLoading, compact = false }: TopListProps) {
  const max = Math.max(...(data?.map((d) => d.count) || [0]), 1);

  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm flex flex-col h-full">
      <div className="px-5 py-4 border-b border-border/50 bg-[#FAFAFA]">
        <h3 className="font-semibold font-display text-base">{title}</h3>
      </div>
      <div className="p-5 flex-1">
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
               <div key={i} className="flex justify-between items-center">
                 <div className="w-1/3 h-4 bg-muted rounded animate-pulse" />
                 <div className="w-1/4 h-4 bg-muted rounded animate-pulse" />
               </div>
            ))}
          </div>
        ) : !data || data.length === 0 ? (
          <div className="h-full flex items-center justify-center py-6 text-muted-foreground text-sm">
            No data yet
          </div>
        ) : (
          <div className="space-y-4">
            {data.map((item) => (
              <div key={item.label || 'unknown'} className="flex justify-between items-center text-sm">
                <span className="font-medium truncate pr-3 text-foreground">
                  {item.label || 'Unknown'}
                </span>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-semibold w-8 text-right">{item.count.toLocaleString()}</span>
                  <div className={`w-16 bg-secondary h-1.5 rounded-full overflow-hidden`}>
                    <div 
                      className="bg-primary h-full rounded-full transition-all duration-1000 ease-out" 
                      style={{ width: `${(item.count / max) * 100}%` }} 
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
