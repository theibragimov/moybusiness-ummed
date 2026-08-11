"use client";

import { Line, LineChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";
import { formatNumber } from "@/lib/format";
import { useLanguage } from "@/lib/i18n/context";

const COLORS = ["#3b63f5", "#f97316", "#10b981", "#e11d48", "#8b5cf6", "#0ea5e9", "#eab308", "#64748b"];

export function MultiQtyLineChart({
  points,
  series,
}: {
  points: { label: string }[];
  series: { key: string; name: string; data: { label: string; qty: number }[] }[];
}) {
  const { locale } = useLanguage();

  const chartData = points.map((p, i) => {
    const row: Record<string, string | number> = { label: p.label };
    series.forEach((s) => {
      row[s.key] = s.data[i]?.qty ?? 0;
    });
    return row;
  });

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="#eef1f8" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "#94a0b8", fontSize: 11 }} />
        <YAxis tickLine={false} axisLine={false} tick={{ fill: "#94a0b8", fontSize: 12 }} width={40} />
        <Tooltip
          contentStyle={{ borderRadius: 16, border: "none", boxShadow: "0 8px 24px rgba(30,45,90,0.12)" }}
          formatter={(value: number) => [formatNumber(value, locale), ""]}
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
