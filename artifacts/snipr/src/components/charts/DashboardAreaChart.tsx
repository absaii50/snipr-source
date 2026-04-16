"use client";
import {
  AreaChart, Area, XAxis, YAxis, ResponsiveContainer,
  Tooltip, CartesianGrid,
} from "recharts";

const I = "#8B5CF6";

interface ChartTipProps {
  active?: boolean;
  payload?: Array<{ value?: number | null; name?: string }>;
  label?: string;
}

function ChartTip({ active, payload, label }: ChartTipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#18181B] text-white px-3.5 py-2.5 rounded-xl shadow-2xl text-[12px] pointer-events-none" style={{ border: "1px solid #27272A" }}>
      <p className="text-[#71717A] font-medium mb-1">{label}</p>
      <p className="font-bold text-[15px]">
        {payload[0]?.value?.toLocaleString()}
        <span className="text-[#71717A] font-normal text-[11px]"> clicks</span>
      </p>
      {payload[1] && (
        <p className="text-[#8B5CF6] mt-0.5">{payload[1]?.value?.toLocaleString()} unique</p>
      )}
    </div>
  );
}

interface Props {
  data: Array<{ day: string; clicks: number; uniqueClicks: number }>;
  period: string;
}

export default function DashboardAreaChart({ data, period }: Props) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 4, right: 16, bottom: 0, left: -24 }}>
        <defs>
          <linearGradient id="dashAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={I}       stopOpacity={0.15} />
            <stop offset="100%" stopColor={I}       stopOpacity={0}    />
          </linearGradient>
          <linearGradient id="dashUniqueGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#8B5CF6" stopOpacity={0.08} />
            <stop offset="100%" stopColor="#8B5CF6" stopOpacity={0}    />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="#27272A" strokeDasharray="4 4" />
        <XAxis
          dataKey="day"
          axisLine={false}
          tickLine={false}
          tick={{ fill: "#3F3F46", fontSize: 10, fontWeight: 500 }}
          dy={6}
          interval={period === "all" ? 1 : period === "30d" ? 4 : 0}
        />
        <YAxis axisLine={false} tickLine={false} tick={{ fill: "#3F3F46", fontSize: 10 }} allowDecimals={false} />
        <Tooltip content={<ChartTip />} cursor={{ stroke: "#27272A", strokeWidth: 1 }} />
        <Area
          type="monotone" dataKey="uniqueClicks" name="Unique"
          stroke="#8B5CF6" strokeWidth={1.5}
          fill="url(#dashUniqueGrad)" dot={false}
          activeDot={{ r: 3, fill: "#8B5CF6", strokeWidth: 2, stroke: "#09090B" }}
        />
        <Area
          type="monotone" dataKey="clicks" name="Clicks"
          stroke={I} strokeWidth={2}
          fill="url(#dashAreaGrad)" dot={false}
          activeDot={{ r: 4, fill: I, strokeWidth: 2, stroke: "#09090B" }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
