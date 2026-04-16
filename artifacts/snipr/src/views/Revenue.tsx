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

const glassCard = {
  background: "rgba(17,24,39,0.65)",
  backdropFilter: "blur(16px)",
  WebkitBackdropFilter: "blur(16px)",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: "16px",
} as const;

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
              className="w-11 h-11 flex items-center justify-center rounded-[14px]"
              style={{ background: "linear-gradient(135deg, #818CF8, #A78BFA)" }}
            >
              <DollarSign className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-[family-name:var(--font-space-grotesk)] text-[28px] font-bold text-[#F1F5F9] tracking-tight">
                Revenue & Attribution
              </h1>
              <p className="text-[#94A3B8] mt-0.5 text-sm">Break down earnings by link, campaign, and event type.</p>
            </div>
          </div>

          {/* Date range picker */}
          <div
            className="flex items-center gap-2 px-3 py-2"
            style={{ ...glassCard, borderRadius: "14px" }}
          >
            <CalendarDays className="w-4 h-4 text-[#64748B] flex-shrink-0" />
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="bg-transparent border-none text-xs font-medium text-[#E2E8F0] outline-none rounded-[14px]"
            />
            <span className="text-[#94A3B8] text-xs">&rarr;</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="bg-transparent border-none text-xs font-medium text-[#E2E8F0] outline-none rounded-[14px]"
            />
            <button
              onClick={() => setAppliedDates({ from: fromDate, to: toDate })}
              className="ml-1 px-3 py-1.5 rounded-[14px] text-xs font-semibold text-white transition-colors"
              style={{ background: "linear-gradient(135deg, #818CF8, #A5B4FC)" }}
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
              iconGradient: "linear-gradient(135deg, #34D399, #10B981)",
              valueColor: "text-[#34D399]",
            },
            {
              label: "Total Conversions",
              value: isLoading ? null : totalConversions.toLocaleString(),
              icon: <TrendingUp className="w-4 h-4 text-white" />,
              iconGradient: "linear-gradient(135deg, #818CF8, #A5B4FC)",
              valueColor: "text-[#F1F5F9]",
            },
            {
              label: "Avg. Order Value",
              value: isLoading ? null : formatCurrency(avgOrder),
              icon: <Hash className="w-4 h-4 text-white" />,
              iconGradient: "linear-gradient(135deg, #A78BFA, #C4B5FD)",
              valueColor: "text-[#F1F5F9]",
            },
          ].map(({ label, value, icon, iconGradient, valueColor }) => (
            <div
              key={label}
              className="p-5"
              style={glassCard}
            >
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wide">{label}</p>
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center"
                  style={{ background: iconGradient }}
                >
                  {icon}
                </div>
              </div>
              {value === null ? (
                <div className="h-7 w-24 rounded-lg animate-pulse" style={{ background: "rgba(255,255,255,0.03)" }} />
              ) : (
                <p className={`text-[28px] font-extrabold ${valueColor}`}>{value}</p>
              )}
            </div>
          ))}
        </div>

        {/* Breakdown table */}
        <div className="overflow-hidden" style={glassCard}>

          {/* Tab bar */}
          <div className="flex items-center gap-1 px-4 pt-4 pb-3">
            {TABS.map(({ key, label, icon }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-[14px] transition-colors ${
                  activeTab === key
                    ? "text-[#A5B4FC]"
                    : "text-[#64748B] hover:text-[#E2E8F0] hover:bg-[rgba(255,255,255,0.03)]"
                }`}
                style={activeTab === key ? { background: "rgba(129,140,248,0.12)" } : undefined}
              >
                {icon}
                {label}
              </button>
            ))}
          </div>

          {isLoading ? (
            <div className="py-16 flex justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-[#64748B]" />
            </div>
          ) : activeData.length === 0 ? (
            <div className="py-16 flex flex-col items-center gap-3 text-center px-6">
              <div
                className="w-12 h-12 rounded-[14px] flex items-center justify-center"
                style={{ background: "linear-gradient(135deg, #818CF8, #A5B4FC)" }}
              >
                <DollarSign className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[#F1F5F9]">No data for this period</p>
                <p className="text-xs text-[#64748B] mt-1">
                  Try adjusting the date range or start tracking conversions from the Conversions page.
                </p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr style={{ background: "rgba(255,255,255,0.03)" }}>
                    {columns.map((col, i) => (
                      <th
                        key={col}
                        className={`px-5 py-3 text-xs font-semibold text-[#94A3B8] uppercase tracking-wide ${i > 0 ? "text-right" : ""}`}
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[rgba(255,255,255,0.06)]">
                  {activeData.map((row: any, i: number) => (
                    <tr key={i} className="hover:bg-[rgba(255,255,255,0.03)] transition-colors">
                      <td className="px-5 py-3.5 font-medium text-[#E2E8F0]">
                        {activeTab === "links" ? (
                          <div>
                            <span className="text-[#818CF8] font-semibold">/{row.slug ?? "unknown"}</span>
                            {row.title && (
                              <div className="text-xs text-[#64748B] mt-0.5">{row.title}</div>
                            )}
                          </div>
                        ) : activeTab === "campaigns" ? (
                          row.campaign === "(none)" ? (
                            <span className="text-[#64748B] italic text-sm">No campaign</span>
                          ) : (
                            row.campaign
                          )
                        ) : (
                          <span className="capitalize">{row.eventName}</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right font-semibold text-[#E2E8F0]">
                        {Number(row.conversions).toLocaleString()}
                      </td>
                      <td className="px-5 py-3.5 text-right font-bold text-[#34D399]">
                        {formatCurrency(Number(row.revenue))}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: "rgba(255,255,255,0.03)", borderTop: "2px solid rgba(255,255,255,0.1)" }}>
                    <td className="px-5 py-4 text-xs font-bold text-[#F1F5F9] uppercase tracking-wide">
                      Total
                    </td>
                    <td className="px-5 py-4 text-right font-bold text-[#F1F5F9]">
                      {totalConversions.toLocaleString()}
                    </td>
                    <td className="px-5 py-4 text-right font-bold text-[#34D399]">
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
