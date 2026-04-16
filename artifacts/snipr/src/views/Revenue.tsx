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
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 flex items-center justify-center rounded-xl"
              style={{ background: "linear-gradient(135deg, #8B5CF6, #A78BFA)" }}
            >
              <DollarSign className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-[family-name:var(--font-space-grotesk)] text-[28px] font-bold text-[#FAFAFA] tracking-tight">
                Revenue & Attribution
              </h1>
              <p className="text-[#A1A1AA] mt-0.5 text-sm">Break down earnings by link, campaign, and event type.</p>
            </div>
          </div>

          {/* Date range picker */}
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#18181B] border border-[#27272A]"
          >
            <CalendarDays className="w-4 h-4 text-[#71717A] flex-shrink-0" />
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="bg-transparent border-none text-xs font-medium text-[#E4E4E7] outline-none rounded-lg"
            />
            <span className="text-[#A1A1AA] text-xs">&rarr;</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="bg-transparent border-none text-xs font-medium text-[#E4E4E7] outline-none rounded-lg"
            />
            <button
              onClick={() => setAppliedDates({ from: fromDate, to: toDate })}
              className="ml-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-colors"
              style={{ background: "linear-gradient(135deg, #8B5CF6, #A78BFA)" }}
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
              icon: <DollarSign className="w-4 h-4 text-white" />,
              iconGradient: "linear-gradient(135deg, #10B981, #10B981)",
              valueColor: "text-[#10B981]",
            },
            {
              label: "Total Conversions",
              value: isLoading ? null : totalConversions.toLocaleString(),
              icon: <TrendingUp className="w-4 h-4 text-white" />,
              iconGradient: "linear-gradient(135deg, #8B5CF6, #A78BFA)",
              valueColor: "text-[#FAFAFA]",
            },
            {
              label: "Avg. Order Value",
              value: isLoading ? null : formatCurrency(avgOrder),
              icon: <Hash className="w-4 h-4 text-white" />,
              iconGradient: "linear-gradient(135deg, #A78BFA, #C4B5FD)",
              valueColor: "text-[#FAFAFA]",
            },
          ].map(({ label, value, icon, iconGradient, valueColor }) => (
            <div
              key={label}
              className="p-5 rounded-xl bg-[#18181B] border border-[#27272A]"
            >
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-[#A1A1AA] uppercase tracking-wide">{label}</p>
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center"
                  style={{ background: iconGradient }}
                >
                  {icon}
                </div>
              </div>
              {value === null ? (
                <div className="h-7 w-24 rounded-lg animate-pulse bg-[#27272A]" />
              ) : (
                <p className={`text-[28px] font-extrabold ${valueColor}`}>{value}</p>
              )}
            </div>
          ))}
        </div>

        {/* Breakdown table */}
        <div className="overflow-hidden rounded-xl bg-[#18181B] border border-[#27272A]">

          {/* Tab bar */}
          <div className="flex items-center gap-1 px-4 pt-4 pb-3">
            {TABS.map(({ key, label, icon }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition-colors ${
                  activeTab === key
                    ? "text-[#A78BFA]"
                    : "text-[#71717A] hover:text-[#E4E4E7] hover:bg-[#27272A]/50"
                }`}
                style={activeTab === key ? { background: "rgba(139,92,246,0.12)" } : undefined}
              >
                {icon}
                {label}
              </button>
            ))}
          </div>

          {isLoading ? (
            <div className="py-16 flex justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-[#71717A]" />
            </div>
          ) : activeData.length === 0 ? (
            <div className="py-16 flex flex-col items-center gap-3 text-center px-6">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ background: "linear-gradient(135deg, #8B5CF6, #A78BFA)" }}
              >
                <DollarSign className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[#FAFAFA]">No data for this period</p>
                <p className="text-xs text-[#71717A] mt-1">
                  Try adjusting the date range or start tracking conversions from the Conversions page.
                </p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="bg-[#09090B]/50">
                    {columns.map((col, i) => (
                      <th
                        key={col}
                        className={`px-5 py-3 text-xs font-semibold text-[#A1A1AA] uppercase tracking-wide ${i > 0 ? "text-right" : ""}`}
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#27272A]">
                  {activeData.map((row: any, i: number) => (
                    <tr key={i} className="hover:bg-[#27272A]/50 transition-colors">
                      <td className="px-5 py-3.5 font-medium text-[#E4E4E7]">
                        {activeTab === "links" ? (
                          <div>
                            <span className="text-[#8B5CF6] font-semibold">/{row.slug ?? "unknown"}</span>
                            {row.title && (
                              <div className="text-xs text-[#71717A] mt-0.5">{row.title}</div>
                            )}
                          </div>
                        ) : activeTab === "campaigns" ? (
                          row.campaign === "(none)" ? (
                            <span className="text-[#71717A] italic text-sm">No campaign</span>
                          ) : (
                            row.campaign
                          )
                        ) : (
                          <span className="capitalize">{row.eventName}</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right font-semibold text-[#E4E4E7]">
                        {Number(row.conversions).toLocaleString()}
                      </td>
                      <td className="px-5 py-3.5 text-right font-bold text-[#10B981]">
                        {formatCurrency(Number(row.revenue))}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-[#09090B]/50" style={{ borderTop: "2px solid #3F3F46" }}>
                    <td className="px-5 py-4 text-xs font-bold text-[#FAFAFA] uppercase tracking-wide">
                      Total
                    </td>
                    <td className="px-5 py-4 text-right font-bold text-[#FAFAFA]">
                      {totalConversions.toLocaleString()}
                    </td>
                    <td className="px-5 py-4 text-right font-bold text-[#10B981]">
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
