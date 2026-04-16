"use client";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts";

interface Props {
  data: Array<{ formattedTime: string; clicks: number; uniqueClicks: number }>;
}

export default function LinkAnalyticsChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
        <defs>
          <linearGradient id="linkClicksGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#818CF8" stopOpacity={0.15} />
            <stop offset="95%" stopColor="#818CF8" stopOpacity={0}   />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="rgba(255,255,255,0.06)" />
        <XAxis
          dataKey="formattedTime"
          axisLine={false}
          tickLine={false}
          tick={{ fill: "#475569", fontSize: 12 }}
          dy={10}
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          tick={{ fill: "#475569", fontSize: 12 }}
          dx={-10}
        />
        <Tooltip
          contentStyle={{
            borderRadius: "12px",
            border: "1px solid rgba(255,255,255,0.08)",
            boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
            background: "#0F172A",
          }}
          labelStyle={{ color: "#F1F5F9", fontWeight: 600, fontSize: 12 }}
          itemStyle={{ fontSize: 12, color: "#94A3B8" }}
          cursor={{ stroke: "rgba(255,255,255,0.08)", strokeWidth: 2, strokeDasharray: "4 4" }}
        />
        <Legend iconType="circle" wrapperStyle={{ paddingTop: "20px", color: "#94A3B8" }} />
        <Area
          type="monotone" name="Total Clicks" dataKey="clicks"
          stroke="#818CF8" strokeWidth={2}
          fillOpacity={1} fill="url(#linkClicksGrad)"
          activeDot={{ r: 5, fill: "#818CF8", strokeWidth: 2, stroke: "#0B0F1A" }}
        />
        <Area
          type="monotone" name="Unique Clicks" dataKey="uniqueClicks"
          stroke="#64748B" strokeWidth={2}
          fill="none"
          activeDot={{ r: 5, fill: "#64748B", strokeWidth: 2, stroke: "#0B0F1A" }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
