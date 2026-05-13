"use client";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  Tooltip, Legend, CartesianGrid,
} from "recharts";

interface Props {
  labels: string[];
  data: Array<{ day: string } & Record<string, number>>;
  colors: string[];
}

export default function UtmStackedChart({ labels, data, colors }: Props) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 10, right: 16, left: -8, bottom: 0 }}>
        <defs>
          {labels.map((label, i) => (
            <linearGradient key={label} id={`utm-grad-${i}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={colors[i % colors.length]} stopOpacity={0.45} />
              <stop offset="100%" stopColor={colors[i % colors.length]} stopOpacity={0.05} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#27272A" vertical={false} />
        <XAxis
          dataKey="day"
          tick={{ fill: "#71717A", fontSize: 11 }}
          tickLine={false}
          axisLine={{ stroke: "#27272A" }}
        />
        <YAxis
          tick={{ fill: "#71717A", fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={{ background: "#09090B", border: "1px solid #27272A", borderRadius: 8, fontSize: 12 }}
          labelStyle={{ color: "#A1A1AA" }}
          itemStyle={{ color: "#E4E4E7" }}
        />
        <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} iconType="circle" iconSize={8} />
        {labels.map((label, i) => (
          <Area
            key={label}
            type="monotone"
            dataKey={label}
            stackId="1"
            stroke={colors[i % colors.length]}
            strokeWidth={1.5}
            fill={`url(#utm-grad-${i})`}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}
