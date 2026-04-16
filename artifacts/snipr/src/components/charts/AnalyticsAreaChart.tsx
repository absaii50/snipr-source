"use client";
import {
  AreaChart, Area, XAxis, YAxis, ResponsiveContainer,
  Tooltip, CartesianGrid,
} from "recharts";

interface Props {
  data: Array<{ formattedTime: string; clicks: number; uniqueClicks: number }>;
}

export default function AnalyticsAreaChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 4, right: 12, bottom: 0, left: -24 }}>
        <defs>
          <linearGradient id="analyticsClicksGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#728DA7" stopOpacity={0.18} />
            <stop offset="95%" stopColor="#728DA7" stopOpacity={0}    />
          </linearGradient>
          <linearGradient id="analyticsUniqueGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#7C5CC4" stopOpacity={0.12} />
            <stop offset="95%" stopColor="#7C5CC4" stopOpacity={0}    />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#27272A" />
        <XAxis
          dataKey="formattedTime"
          axisLine={false}
          tickLine={false}
          tick={{ fill: "#3F3F46", fontSize: 11 }}
          dy={8}
          interval="preserveStartEnd"
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          tick={{ fill: "#3F3F46", fontSize: 11 }}
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={{
            borderRadius: "12px", border: "1px solid #27272A",
            boxShadow: "0 4px 20px rgba(0,0,0,0.4)", background: "#18181B",
          }}
          labelStyle={{ color: "#FAFAFA", fontWeight: 600, fontSize: 12, marginBottom: 4 }}
          itemStyle={{ fontSize: 12, color: "#A1A1AA" }}
          cursor={{ stroke: "#27272A", strokeWidth: 1, strokeDasharray: "4 4" }}
        />
        <Area
          type="monotone" name="Total Clicks" dataKey="clicks"
          stroke="#728DA7" strokeWidth={2}
          fill="url(#analyticsClicksGrad)" dot={false}
          activeDot={{ r: 5, fill: "#728DA7", strokeWidth: 2, stroke: "#09090B" }}
        />
        <Area
          type="monotone" name="Unique" dataKey="uniqueClicks"
          stroke="#A78BFA" strokeWidth={1.5}
          fill="url(#analyticsUniqueGrad)" dot={false}
          activeDot={{ r: 4, fill: "#A78BFA", strokeWidth: 2, stroke: "#09090B" }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
