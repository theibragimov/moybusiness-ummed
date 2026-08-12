"use client";

import { Line, LineChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";
import { fromMs, formatNumber } from "@/lib/format";
import { useLanguage } from "@/lib/i18n/context";

const COLORS = ["#dc2626", "#f97316", "#f59e0b", "#3b63f5", "#10b981", "#8b5cf6", "#0ea5e9", "#64748b"];

export function MultiMoneyLineChart({
  points,
  series,
}: {
  points: { day: string }[];
  series: { key: string; name: string; days: { day: string; sum: number }[] }[];
}) {
  const { locale, t } = useLanguage();

  const chartData = points.map((p, i) => {
    const row: Record<string, string | number> = { day: p.day.slice(8, 10) };
    series.forEach((s) => {
      row[s.key] = fromMs(s.days[i]?.sum ?? 0);
    });
    return row;
  });

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="#eef1f8" />
        <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fill: "#94a0b8", fontSize: 12 }} />
        <YAxis
          tickLine={false}
          axisLine={false}
          tick={{ fill: "#94a0b8", fontSize: 12 }}
          tickFormatter={(v) => (v >= 1_000_000 ? `${(v / 1_000_000).toFixed(0)}M` : `${v}`)}
          width={44}
        />
        <Tooltip
          contentStyle={{ borderRadius: 16, border: "none", boxShadow: "0 8px 24px rgba(30,45,90,0.12)" }}
          formatter={(value: number) => [`${formatNumber(value, locale)} ${t.common.sum}`, ""]}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {series.map((s, i) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.name}
            stroke={COLORS[i % COLORS.length]}
            strokeWidth={2}
            dot={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
