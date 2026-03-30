"use client";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Monitor } from "lucide-react";

const PALETTE = ["#4F46E5", "#0EA5E9", "#14B8A6", "#F59E0B", "#94A3B8"];

function fmtK(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return n.toString();
}

interface DataItem {
  label: string;
  count: number;
}

interface Props {
  data: DataItem[];
}

export default function DeviceDonutChart({ data }: Props) {
  const top5  = data.slice(0, 5);
  const total = top5.reduce((s, d) => s + d.count, 0);

  if (top5.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 h-full py-6">
        <div className="relative w-[120px] h-[120px]">
          <svg viewBox="0 0 120 120" className="w-full h-full">
            <circle cx="60" cy="60" r="38" fill="none" stroke="#E2E8F0" strokeWidth="16" />
            <circle cx="60" cy="60" r="38" fill="none" stroke="#F1F5F9" strokeWidth="16"
              strokeDasharray="20 220" strokeLinecap="round" strokeDashoffset="-16" />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <Monitor className="w-5 h-5 text-[#CBD5E1]" />
          </div>
        </div>
        <div className="text-center">
          <p className="text-[11px] font-semibold text-[#475569]">No device data yet</p>
          <p className="text-[10px] text-[#94A3B8] mt-0.5">Appears after your first clicks</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4 h-full w-full py-2">
      <div className="relative shrink-0" style={{ width: 160, height: 160 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={top5}
              cx="50%" cy="50%"
              innerRadius={55} outerRadius={75}
              dataKey="count"
              nameKey="label"
              stroke="none"
              paddingAngle={2}
            >
              {top5.map((_, i) => (
                <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }: {
                active?: boolean;
                payload?: Array<{ name: string; value: number }>;
              }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0];
                const pct = total > 0 ? Math.round((p.value / total) * 100) : 0;
                return (
                  <div className="bg-[#0F172A] text-white px-3 py-2 rounded-xl shadow-xl text-[11px] pointer-events-none">
                    <p className="font-bold text-[12px]">{p.name}</p>
                    <p className="text-[#94A3B8] mt-0.5">{p.value?.toLocaleString()} clicks · {pct}%</p>
                  </div>
                );
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <p className="text-[16px] font-extrabold text-[#0F172A] tabular-nums leading-none">{fmtK(total)}</p>
          <p className="text-[8px] text-[#94A3B8] font-semibold uppercase tracking-wider mt-0.5">clicks</p>
        </div>
      </div>

      <div className="flex-1 min-w-0 space-y-2.5">
        {top5.map((d, i) => {
          const pct = total > 0 ? Math.round((d.count / total) * 100) : 0;
          return (
            <div key={i} className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: PALETTE[i % PALETTE.length] }} />
              <p className="text-[11px] text-[#475569] truncate flex-1 min-w-0">{d.label || "Unknown"}</p>
              <p className="text-[11px] font-bold text-[#0F172A] tabular-nums shrink-0">{pct}%</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
