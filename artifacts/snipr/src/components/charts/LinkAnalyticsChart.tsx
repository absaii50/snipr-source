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
            <stop offset="5%"  stopColor="#728DA7" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#728DA7" stopOpacity={0}   />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
        <XAxis
          dataKey="formattedTime"
          axisLine={false}
          tickLine={false}
          tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }}
          dy={10}
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }}
          dx={-10}
        />
        <Tooltip
          contentStyle={{
            borderRadius: "12px",
            border: "1px solid var(--color-border)",
            boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
          }}
          cursor={{ stroke: "var(--color-muted)", strokeWidth: 2, strokeDasharray: "4 4" }}
        />
        <Legend iconType="circle" wrapperStyle={{ paddingTop: "20px" }} />
        <Area
          type="monotone" name="Total Clicks" dataKey="clicks"
          stroke="#728DA7" strokeWidth={3}
          fillOpacity={1} fill="url(#linkClicksGrad)"
          activeDot={{ r: 6, strokeWidth: 0 }}
        />
        <Area
          type="monotone" name="Unique Clicks" dataKey="uniqueClicks"
          stroke="#C3C3C1" strokeWidth={3}
          fill="none"
          activeDot={{ r: 6, fill: "#C3C3C1", strokeWidth: 0 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
