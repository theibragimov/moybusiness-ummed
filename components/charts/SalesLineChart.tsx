"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fromMs, formatNumber } from "@/lib/format";
import { useLanguage } from "@/lib/i18n/context";

export function SalesLineChart({ data }: { data: { day: string; sum: number; count: number }[] }) {
  const { locale, t } = useLanguage();
  const chartData = data.map((d) => ({
    day: d.day.slice(8, 10),
    fullDay: d.day,
    sum: fromMs(d.sum),
    count: d.count,
  }));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b63f5" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#3b63f5" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="#eef1f8" />
        <XAxis
          dataKey="day"
          tickLine={false}
          axisLine={false}
          tick={{ fill: "#94a0b8", fontSize: 12 }}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tick={{ fill: "#94a0b8", fontSize: 12 }}
          tickFormatter={(v) => (v >= 1_000_000 ? `${(v / 1_000_000).toFixed(0)}M` : `${v}`)}
          width={44}
        />
        <Tooltip
          contentStyle={{ borderRadius: 16, border: "none", boxShadow: "0 8px 24px rgba(30,45,90,0.12)" }}
          formatter={(value: number) => [
            `${formatNumber(value, locale)} ${t.common.sum}`,
            t.dashboard.salesDynamics,
          ]}
          labelFormatter={(_, payload) => payload?.[0]?.payload?.fullDay ?? ""}
        />
        <Area type="monotone" dataKey="sum" stroke="#3b63f5" strokeWidth={2.5} fill="url(#salesFill)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
