"use client";
import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { useGetConversions, useGetRevenueReport } from "@workspace/api-client-react";
import { TrendingUp, DollarSign, Target, Activity, TerminalSquare, Loader2 } from "lucide-react";
import { format } from "date-fns";

const EXAMPLE_CURL = `curl -X POST /api/conversions \\
  -H "Content-Type: application/json" \\
  -d '{"slug":"your-slug","eventName":"purchase","revenue":99.99}'`;

function formatCurrency(val: number | string | null | undefined, currency = "USD") {
  if (val === null || val === undefined) return "—";
  const num = typeof val === "string" ? parseFloat(val) : val;
  if (isNaN(num)) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(num);
}

export default function Conversions() {
  const { data: revenueData, isLoading: isLoadingRevenue } = useGetRevenueReport();
  const { data: conversions, isLoading: isLoadingConversions } = useGetConversions();

  const totalConversions = revenueData?.totalConversions ?? 0;
  const totalRevenue = revenueData?.totalRevenue ?? 0;
  const avgRevenue = totalConversions > 0 ? totalRevenue / totalConversions : 0;
  const topLink = (revenueData as any)?.byLink?.[0]?.slug ?? null;

  const kpis = [
    {
      label: "Total Conversions",
      value: isLoadingRevenue ? null : totalConversions.toLocaleString(),
      icon: <Target className="w-4 h-4 text-[#4F46E5]" />,
      iconBg: "bg-[#EEF0F8]",
    },
    {
      label: "Total Revenue",
      value: isLoadingRevenue ? null : formatCurrency(totalRevenue),
      icon: <DollarSign className="w-4 h-4 text-emerald-600" />,
      iconBg: "bg-emerald-50",
      valueColor: "text-emerald-600",
    },
    {
      label: "Avg. Order Value",
      value: isLoadingRevenue ? null : formatCurrency(avgRevenue),
      icon: <TrendingUp className="w-4 h-4 text-violet-600" />,
      iconBg: "bg-violet-50",
    },
    {
      label: "Top Converting Link",
      value: isLoadingRevenue ? null : topLink ? `/${topLink}` : "—",
      icon: <Activity className="w-4 h-4 text-orange-500" />,
      iconBg: "bg-orange-50",
      valueColor: topLink ? "text-[#4F46E5]" : undefined,
    },
  ];

  return (
    <ProtectedLayout>
      <div className="p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-[#111827] tracking-tight">Conversions</h1>
          <p className="text-[#8B96A8] mt-1">Track events and revenue driven by your short links.</p>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {kpis.map(({ label, value, icon, iconBg, valueColor }) => (
            <div
              key={label}
              className="bg-white rounded-2xl border border-[#DDE2EE] shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-5"
            >
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-[#8B96A8] uppercase tracking-wide">{label}</p>
                <div className={`w-7 h-7 rounded-lg ${iconBg} flex items-center justify-center`}>{icon}</div>
              </div>
              {value === null ? (
                <div className="h-7 w-20 bg-[#F2F4FB] rounded-lg animate-pulse" />
              ) : (
                <p className={`text-2xl font-bold truncate ${valueColor ?? "text-[#111827]"}`}>{value}</p>
              )}
            </div>
          ))}
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-[#DDE2EE] shadow-[0_1px_3px_rgba(0,0,0,0.06)] overflow-hidden">
          <div className="px-6 py-4 border-b border-[#F2F4FB]">
            <h2 className="text-sm font-semibold text-[#111827]">Recent Conversions</h2>
            <p className="text-xs text-[#8B96A8] mt-0.5">Last 200 events in the past 30 days</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="bg-[#F8F9FB] border-b border-[#F2F4FB]">
                  {["Date", "Link", "Event", "Campaign", "Source", "Revenue"].map((col, i) => (
                    <th
                      key={col}
                      className={`px-5 py-3 text-xs font-semibold text-[#8B96A8] uppercase tracking-wide ${i === 5 ? "text-right" : ""}`}
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F2F4FB]">
                {isLoadingConversions ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center">
                      <Loader2 className="w-5 h-5 animate-spin text-[#8B96A8] mx-auto" />
                    </td>
                  </tr>
                ) : !conversions || conversions.length === 0 ? (
                  <tr>
                    <td colSpan={6}>
                      <div className="py-16 flex flex-col items-center gap-4 text-center px-6">
                        <div className="w-12 h-12 rounded-2xl bg-[#EEF0F8] flex items-center justify-center">
                          <TerminalSquare className="w-6 h-6 text-[#4F46E5]" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-[#111827]">No conversions tracked yet</p>
                          <p className="text-xs text-[#8B96A8] mt-1 max-w-xs mx-auto">
                            Send a POST request to start recording conversion events.
                          </p>
                        </div>
                        <pre className="w-full max-w-lg bg-[#0F1117] text-[#E2E8F0] text-xs text-left rounded-xl p-4 overflow-x-auto font-mono leading-relaxed">
                          {EXAMPLE_CURL}
                        </pre>
                      </div>
                    </td>
                  </tr>
                ) : (
                  (conversions as any[]).map((conv) => (
                    <tr key={conv.id} className="hover:bg-[#F8F9FB] transition-colors">
                      <td className="px-5 py-3.5 text-xs text-[#8B96A8] whitespace-nowrap">
                        {format(new Date(conv.createdAt), "MMM d, yyyy HH:mm")}
                      </td>
                      <td className="px-5 py-3.5 font-semibold text-[#4F46E5] text-xs">
                        /{conv.slug ?? "—"}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[#EEF0F8] text-[#4F46E5]">
                          {conv.eventName}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-xs text-[#8B96A8]">{conv.utmCampaign ?? "—"}</td>
                      <td className="px-5 py-3.5 text-xs text-[#8B96A8]">{conv.utmSource ?? "—"}</td>
                      <td className="px-5 py-3.5 text-right font-bold text-emerald-600 text-sm">
                        {formatCurrency(conv.revenue, conv.currency)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Integration guide */}
        <div className="bg-[#EEF0F8] rounded-2xl border border-[#DDE2EE] p-5">
          <p className="text-xs font-semibold text-[#4F46E5] uppercase tracking-wider mb-3">How to track conversions</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            {[
              {
                step: "1",
                title: "Create a short link",
                body: "Create a link to your product page. Note the slug (e.g. /buy).",
              },
              {
                step: "2",
                title: "Fire an event on purchase",
                body: "On checkout completion, POST to /api/conversions with the slug, event name and revenue amount.",
              },
              {
                step: "3",
                title: "View attribution",
                body: "Conversions appear here and in Revenue, broken down by link, campaign and event.",
              },
            ].map(({ step, title, body }) => (
              <div key={step} className="flex gap-3">
                <div className="w-5 h-5 rounded-full bg-[#4F46E5] text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                  {step}
                </div>
                <div>
                  <p className="font-semibold text-[#111827]">{title}</p>
                  <p className="text-[#8B96A8] mt-0.5 leading-relaxed">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </ProtectedLayout>
  );
}
