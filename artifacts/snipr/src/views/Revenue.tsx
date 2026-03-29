"use client";
import { useState } from "react";
import { keepPreviousData } from "@tanstack/react-query";
import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { useGetRevenueReport, getGetRevenueReportQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, DollarSign, Filter } from "lucide-react";

export default function Revenue() {
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [toDate, setToDate] = useState(() => new Date().toISOString().split('T')[0]);
  
  const [appliedDates, setAppliedDates] = useState({ from: fromDate, to: toDate });

  const revenueParams = { from: appliedDates.from, to: appliedDates.to };
  const { data: report, isLoading } = useGetRevenueReport(revenueParams, {
    query: { queryKey: getGetRevenueReportQueryKey(revenueParams), placeholderData: keepPreviousData }
  });

  const formatCurrency = (val: number | null | undefined) => {
    if (val === null || val === undefined) return "$0.00";
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
  };

  const handleApply = () => {
    setAppliedDates({ from: fromDate, to: toDate });
  };

  return (
    <ProtectedLayout>
      <div className="p-8 max-w-6xl mx-auto w-full animate-in fade-in duration-500">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
          <div>
            <h1 className="text-3xl font-display font-bold tracking-tight">Revenue & Attribution</h1>
            <p className="text-muted-foreground mt-1">Break down your earnings by link, campaign, and event type.</p>
          </div>
          
          <div className="flex items-center gap-3 bg-card p-2 rounded-2xl border border-border shadow-sm">
            <div className="flex items-center px-3 gap-2 border-r border-border">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <input 
                type="date" 
                value={fromDate}
                onChange={e => setFromDate(e.target.value)}
                className="bg-transparent border-none text-sm outline-none text-foreground font-medium"
              />
            </div>
            <div className="flex items-center px-3 gap-2">
              <span className="text-muted-foreground text-sm">to</span>
              <input 
                type="date" 
                value={toDate}
                onChange={e => setToDate(e.target.value)}
                className="bg-transparent border-none text-sm outline-none text-foreground font-medium"
              />
            </div>
            <Button size="sm" onClick={handleApply} className="rounded-xl px-4 ml-1">
              <Filter className="w-4 h-4 mr-2" /> Apply
            </Button>
          </div>
        </div>

        <Tabs defaultValue="links" className="w-full">
          <TabsList className="bg-card border border-border h-14 w-full justify-start p-1 rounded-2xl mb-6 shadow-sm overflow-x-auto flex-nowrap">
            <TabsTrigger value="links" className="rounded-xl px-6 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all">By Link</TabsTrigger>
            <TabsTrigger value="campaigns" className="rounded-xl px-6 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all">By Campaign</TabsTrigger>
            <TabsTrigger value="events" className="rounded-xl px-6 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all">By Event Type</TabsTrigger>
          </TabsList>

          <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
            <TabsContent value="links" className="m-0 border-0">
              <DataTable 
                columns={["Link", "Conversions", "Revenue"]}
                data={report?.byLink}
                isLoading={isLoading}
                renderRow={(row: any) => (
                  <>
                    <td className="px-6 py-4 font-medium">
                      <div className="text-primary">/{row.slug}</div>
                      {row.title && <div className="text-xs text-muted-foreground">{row.title}</div>}
                    </td>
                    <td className="px-6 py-4 text-right font-semibold">{row.conversions.toLocaleString()}</td>
                    <td className="px-6 py-4 text-right font-bold text-green-600">{formatCurrency(row.revenue)}</td>
                  </>
                )}
                totalConversions={report?.totalConversions}
                totalRevenue={report?.totalRevenue}
              />
            </TabsContent>

            <TabsContent value="campaigns" className="m-0 border-0">
              <DataTable 
                columns={["UTM Campaign", "Conversions", "Revenue"]}
                data={report?.byCampaign}
                isLoading={isLoading}
                renderRow={(row: any) => (
                  <>
                    <td className="px-6 py-4 font-medium">
                      {row.campaign === "(none)" ? <span className="text-muted-foreground italic">No campaign</span> : row.campaign}
                    </td>
                    <td className="px-6 py-4 text-right font-semibold">{row.conversions.toLocaleString()}</td>
                    <td className="px-6 py-4 text-right font-bold text-green-600">{formatCurrency(row.revenue)}</td>
                  </>
                )}
                totalConversions={report?.totalConversions}
                totalRevenue={report?.totalRevenue}
              />
            </TabsContent>

            <TabsContent value="events" className="m-0 border-0">
              <DataTable 
                columns={["Event Name", "Conversions", "Revenue"]}
                data={report?.byEvent}
                isLoading={isLoading}
                renderRow={(row: any) => (
                  <>
                    <td className="px-6 py-4 font-medium capitalize">{row.eventName}</td>
                    <td className="px-6 py-4 text-right font-semibold">{row.conversions.toLocaleString()}</td>
                    <td className="px-6 py-4 text-right font-bold text-green-600">{formatCurrency(row.revenue)}</td>
                  </>
                )}
                totalConversions={report?.totalConversions}
                totalRevenue={report?.totalRevenue}
              />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </ProtectedLayout>
  );
}

function DataTable({ columns, data, isLoading, renderRow, totalConversions, totalRevenue }: any) {
  if (isLoading) {
    return <div className="p-12 text-center text-muted-foreground">Loading report data...</div>;
  }

  if (!data || data.length === 0) {
    return (
      <div className="p-16 text-center flex flex-col items-center justify-center">
        <DollarSign className="w-12 h-12 text-muted-foreground/30 mb-4" />
        <h3 className="text-lg font-bold">No data for this period</h3>
        <p className="text-muted-foreground mt-1">Try adjusting your date range filters.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left">
        <thead className="bg-muted/50 text-muted-foreground font-semibold border-b border-border">
          <tr>
            {columns.map((col: string, i: number) => (
              <th key={col} className={`px-6 py-4 ${i > 0 ? 'text-right' : ''}`}>{col}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {data.map((row: any, i: number) => (
            <tr key={i} className="hover:bg-muted/30 transition-colors">
              {renderRow(row)}
            </tr>
          ))}
        </tbody>
        <tfoot className="bg-[#FAFAFA] font-bold border-t-2 border-border">
          <tr>
            <td className="px-6 py-5 text-foreground">Total Summary</td>
            <td className="px-6 py-5 text-right">{totalConversions?.toLocaleString()}</td>
            <td className="px-6 py-5 text-right text-green-600">
              {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totalRevenue || 0)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
