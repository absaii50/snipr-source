"use client";
import { useState } from "react";
import { keepPreviousData } from "@tanstack/react-query";
import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { useGetRevenueReport, getGetRevenueReportQueryKey } from "@workspace/api-client-react";
import { DollarSign, TrendingUp, Hash, Link2, Loader2, CalendarDays } from "lucide-react";

function formatCurrency(val: number | null | undefined) {
  if (val === null || val === undefined) return "$0.00";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(val);
}

type TabKey = "links" | "campaigns" | "events";

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: "links", label: "By Link", icon: <Link2 className="w-3.5 h-3.5" /> },
  { key: "campaigns", label: "By Campaign", icon: <Hash className="w-3.5 h-3.5" /> },
  { key: "events", label: "By Event", icon: <TrendingUp className="w-3.5 h-3.5" /> },
];

export default function Revenue() {
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0];
  });
  const [toDate, setToDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [appliedDates, setAppliedDates] = useState({ from: fromDate, to: toDate });
  const [activeTab, setActiveTab] = useState<TabKey>("links");

  const revenueParams = { from: appliedDates.from, to: appliedDates.to };
  const { data: report, isLoading } = useGetRevenueReport(revenueParams, {
    query: {
      queryKey: getGetRevenueReportQueryKey(revenueParams),
      placeholderData: keepPreviousData,
    },
  });

  const totalRevenue = report?.totalRevenue ?? 0;
  const totalConversions = report?.totalConversions ?? 0;
  const avgOrder = totalConversions > 0 ? totalRevenue / totalConversions : 0;

  const activeData: any[] =
    activeTab === "links"
      ? ((report as any)?.byLink ?? [])
      : activeTab === "campaigns"
      ? ((report as any)?.byCampaign ?? [])
      : ((report as any)?.byEvent ?? []);

  const columns =
    activeTab === "links"
      ? ["Link", "Conversions", "Revenue"]
      : activeTab === "campaigns"
      ? ["UTM Campaign", "Conversions", "Revenue"]
      : ["Event Name", "Conversions", "Revenue"];

  return (
    <ProtectedLayout>
      <div className="p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#111827] tracking-tight">Revenue & Attribution</h1>
            <p className="text-[#8B96A8] mt-1">Break down earnings by link, campaign, and event type.</p>
          </div>

          {/* Date range picker */}
          <div className="flex items-center gap-2 bg-white rounded-xl border border-[#DDE2EE] shadow-sm px-3 py-2">
            <CalendarDays className="w-4 h-4 text-[#8B96A8] flex-shrink-0" />
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="bg-transparent border-none text-xs font-medium text-[#111827] outline-none"
            />
            <span className="text-[#8B96A8] text-xs">→</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="bg-transparent border-none text-xs font-medium text-[#111827] outline-none"
            />
            <button
              onClick={() => setAppliedDates({ from: fromDate, to: toDate })}
              className="ml-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#4F46E5] text-white hover:bg-[#4338CA] transition-colors"
            >
              Apply
            </button>
          </div>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            {
              label: "Total Revenue",
              value: isLoading ? null : formatCurrency(totalRevenue),
              icon: <DollarSign className="w-4 h-4 text-emerald-600" />,
              iconBg: "bg-emerald-50",
              valueColor: "text-emerald-600",
            },
            {
              label: "Total Conversions",
              value: isLoading ? null : totalConversions.toLocaleString(),
              icon: <TrendingUp className="w-4 h-4 text-[#4F46E5]" />,
              iconBg: "bg-[#EEF0F8]",
              valueColor: "text-[#111827]",
            },
            {
              label: "Avg. Order Value",
              value: isLoading ? null : formatCurrency(avgOrder),
              icon: <Hash className="w-4 h-4 text-violet-600" />,
              iconBg: "bg-violet-50",
              valueColor: "text-[#111827]",
            },
          ].map(({ label, value, icon, iconBg, valueColor }) => (
            <div
              key={label}
              className="bg-white rounded-2xl border border-[#DDE2EE] shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-5"
            >
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-[#8B96A8] uppercase tracking-wide">{label}</p>
                <div className={`w-7 h-7 rounded-lg ${iconBg} flex items-center justify-center`}>{icon}</div>
              </div>
              {value === null ? (
                <div className="h-7 w-24 bg-[#F2F4FB] rounded-lg animate-pulse" />
              ) : (
                <p className={`text-2xl font-bold ${valueColor}`}>{value}</p>
              )}
            </div>
          ))}
        </div>

        {/* Breakdown table */}
        <div className="bg-white rounded-2xl border border-[#DDE2EE] shadow-[0_1px_3px_rgba(0,0,0,0.06)] overflow-hidden">

          {/* Tab bar */}
          <div className="flex items-center gap-1 px-4 pt-4 border-b border-[#F2F4FB]">
            {TABS.map(({ key, label, icon }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`flex items-center gap-1.5 px-3 py-2 mb-[-1px] text-xs font-semibold rounded-t-lg border-b-2 transition-colors ${
                  activeTab === key
                    ? "text-[#4F46E5] border-[#4F46E5] bg-[#EEF0F8]"
                    : "text-[#8B96A8] border-transparent hover:text-[#111827]"
                }`}
              >
                {icon}
                {label}
              </button>
            ))}
          </div>

          {isLoading ? (
            <div className="py-16 flex justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-[#8B96A8]" />
            </div>
          ) : activeData.length === 0 ? (
            <div className="py-16 flex flex-col items-center gap-3 text-center px-6">
              <div className="w-12 h-12 rounded-2xl bg-[#EEF0F8] flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-[#4F46E5]" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[#111827]">No data for this period</p>
                <p className="text-xs text-[#8B96A8] mt-1">
                  Try adjusting the date range or start tracking conversions from the Conversions page.
                </p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="bg-[#F8F9FB] border-b border-[#F2F4FB]">
                    {columns.map((col, i) => (
                      <th
                        key={col}
                        className={`px-5 py-3 text-xs font-semibold text-[#8B96A8] uppercase tracking-wide ${i > 0 ? "text-right" : ""}`}
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F2F4FB]">
                  {activeData.map((row: any, i: number) => (
                    <tr key={i} className="hover:bg-[#F8F9FB] transition-colors">
                      <td className="px-5 py-3.5 font-medium text-[#111827]">
                        {activeTab === "links" ? (
                          <div>
                            <span className="text-[#4F46E5] font-semibold">/{row.slug ?? "unknown"}</span>
                            {row.title && (
                              <div className="text-xs text-[#8B96A8] mt-0.5">{row.title}</div>
                            )}
                          </div>
                        ) : activeTab === "campaigns" ? (
                          row.campaign === "(none)" ? (
                            <span className="text-[#8B96A8] italic text-sm">No campaign</span>
                          ) : (
                            row.campaign
                          )
                        ) : (
                          <span className="capitalize">{row.eventName}</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right font-semibold text-[#111827]">
                        {Number(row.conversions).toLocaleString()}
                      </td>
                      <td className="px-5 py-3.5 text-right font-bold text-emerald-600">
                        {formatCurrency(Number(row.revenue))}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-[#F8F9FB] border-t-2 border-[#DDE2EE]">
                    <td className="px-5 py-4 text-xs font-bold text-[#111827] uppercase tracking-wide">
                      Total
                    </td>
                    <td className="px-5 py-4 text-right font-bold text-[#111827]">
                      {totalConversions.toLocaleString()}
                    </td>
                    <td className="px-5 py-4 text-right font-bold text-emerald-600">
                      {formatCurrency(totalRevenue)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

      </div>
    </ProtectedLayout>
  );
}
