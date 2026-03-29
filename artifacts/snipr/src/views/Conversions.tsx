"use client";
import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { useGetConversions, useGetRevenueReport } from "@workspace/api-client-react";
import { TrendingUp, DollarSign, Activity, Target, TerminalSquare } from "lucide-react";
import { format } from "date-fns";

export default function Conversions() {
  const { data: revenueData, isLoading: isLoadingRevenue } = useGetRevenueReport();
  const { data: conversions, isLoading: isLoadingConversions } = useGetConversions();

  const totalConversions = revenueData?.totalConversions || 0;
  const totalRevenue = revenueData?.totalRevenue || 0;
  const avgRevenue = totalConversions > 0 ? totalRevenue / totalConversions : 0;
  const topLink = revenueData?.byLink?.[0]?.slug || "N/A";

  const formatCurrency = (val: number | string | null | undefined, currency = "USD") => {
    if (val === null || val === undefined) return "-";
    const num = typeof val === "string" ? parseFloat(val) : val;
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(num);
  };

  return (
    <ProtectedLayout>
      <div className="p-8 max-w-7xl mx-auto w-full animate-in fade-in duration-500">
        <div className="mb-8">
          <h1 className="text-3xl font-display font-bold tracking-tight">Conversions</h1>
          <p className="text-muted-foreground mt-1">Track events and revenue driven by your short links.</p>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          <div className="bg-card p-6 rounded-2xl border border-border shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-muted-foreground">Total Conversions</h3>
              <div className="p-2 bg-blue-500/10 text-blue-500 rounded-lg"><Target className="w-5 h-5" /></div>
            </div>
            <div className="text-4xl font-display font-bold">
              {isLoadingRevenue ? "-" : totalConversions.toLocaleString()}
            </div>
          </div>
          
          <div className="bg-card p-6 rounded-2xl border border-border shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-muted-foreground">Total Revenue</h3>
              <div className="p-2 bg-green-500/10 text-green-500 rounded-lg"><DollarSign className="w-5 h-5" /></div>
            </div>
            <div className="text-4xl font-display font-bold text-green-600">
              {isLoadingRevenue ? "-" : formatCurrency(totalRevenue)}
            </div>
          </div>

          <div className="bg-card p-6 rounded-2xl border border-border shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-muted-foreground">Avg. Value</h3>
              <div className="p-2 bg-purple-500/10 text-purple-500 rounded-lg"><TrendingUp className="w-5 h-5" /></div>
            </div>
            <div className="text-4xl font-display font-bold">
              {isLoadingRevenue ? "-" : formatCurrency(avgRevenue)}
            </div>
          </div>

          <div className="bg-card p-6 rounded-2xl border border-border shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-muted-foreground">Top Link</h3>
              <div className="p-2 bg-orange-500/10 text-orange-500 rounded-lg"><Activity className="w-5 h-5" /></div>
            </div>
            <div className="text-2xl font-display font-bold truncate mt-2 text-primary">
              {isLoadingRevenue ? "-" : `/${topLink}`}
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
          <div className="px-6 py-5 border-b border-[#ECEDF0] bg-[#FAFAFA] flex items-center justify-between">
            <h3 className="font-semibold font-display text-lg">Recent Conversions</h3>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 text-muted-foreground font-semibold">
                <tr>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Link</th>
                  <th className="px-6 py-4">Event</th>
                  <th className="px-6 py-4">Campaign</th>
                  <th className="px-6 py-4">Source</th>
                  <th className="px-6 py-4 text-right">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoadingConversions ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">Loading conversions...</td>
                  </tr>
                ) : !conversions || conversions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center justify-center max-w-lg mx-auto">
                        <TerminalSquare className="w-12 h-12 text-muted-foreground/50 mb-4" />
                        <h4 className="text-lg font-bold mb-2">No conversions tracked yet</h4>
                        <p className="text-muted-foreground mb-6">Start sending conversion events to your API endpoint to see data here.</p>
                        <div className="w-full bg-[#1a1a2e] text-[#EFEFF0] p-4 rounded-xl text-left overflow-x-auto text-xs font-mono border border-[#2a2a3e]">
                          <code>
                            <span className="text-pink-400">curl</span> -X POST /api/conversions \<br/>
                            {'  '}-H <span className="text-green-400">"Content-Type: application/json"</span> \<br/>
                            {'  '}-d <span className="text-yellow-300">'{'{"slug":"your-slug","eventName":"purchase","revenue":99.99}'}'</span>
                          </code>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  conversions.map((conv) => (
                    <tr key={conv.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-6 py-4 text-muted-foreground">
                        {format(new Date(conv.createdAt), "MMM d, yyyy HH:mm")}
                      </td>
                      <td className="px-6 py-4 font-medium text-primary">/{conv.slug || "unknown"}</td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary text-secondary-foreground">
                          {conv.eventName}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">{conv.utmCampaign || "-"}</td>
                      <td className="px-6 py-4 text-muted-foreground">{conv.utmSource || "-"}</td>
                      <td className="px-6 py-4 text-right font-bold text-green-600">
                        {formatCurrency(conv.revenue, conv.currency)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </ProtectedLayout>
  );
}
