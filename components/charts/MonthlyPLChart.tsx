"use client";

import { useMemo, useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fromMs, formatNumber } from "@/lib/format";
import { useLanguage } from "@/lib/i18n/context";
import type { MonthlyPLRow } from "@/lib/reports";

const LINES: { key: keyof Omit<MonthlyPLRow, "label">; color: string }[] = [
  { key: "revenue", color: "#3b63f5" },
  { key: "grossProfit", color: "#16a34a" },
  { key: "netProfit", color: "#0d9488" },
  { key: "expenses", color: "#dc2626" },
];

export function MonthlyPLChart({ data }: { data: MonthlyPLRow[] }) {
  const { locale, t } = useLanguage();
  const [range, setRange] = useState<6 | 12>(12);

  const legendLabels: Record<string, string> = {
    revenue: t.dashboard.legendRevenue,
    grossProfit: t.dashboard.legendGrossProfit,
    netProfit: t.dashboard.legendNetProfit,
    expenses: t.dashboard.legendExpenses,
  };

  const chartData = useMemo(() => {
    const sliced = range === 6 ? data.slice(-6) : data;
    return sliced.map((r) => ({
      month: r.label.slice(5, 7),
      fullMonth: r.label,
      revenue: fromMs(r.revenue),
      grossProfit: fromMs(r.grossProfit),
      netProfit: fromMs(r.netProfit),
      expenses: fromMs(r.expenses),
    }));
  }, [data, range]);

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <div className="flex gap-1 rounded-full bg-surface p-1">
          {([6, 12] as const).map((n) => (
            <button
              key={n}
              onClick={() => setRange(n)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                range === n ? "bg-white text-ink-900 shadow-soft" : "text-ink-500 hover:text-ink-700"
              }`}
            >
              {n === 6 ? t.dashboard.period6 : t.dashboard.period12}
            </button>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="#eef1f8" />
          <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: "#94a0b8", fontSize: 12 }} />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fill: "#94a0b8", fontSize: 12 }}
            tickFormatter={(v) => (v >= 1_000_000 ? `${(v / 1_000_000).toFixed(0)}M` : `${v}`)}
            width={44}
          />
          <Tooltip
            contentStyle={{ borderRadius: 16, border: "none", boxShadow: "0 8px 24px rgba(30,45,90,0.12)" }}
            formatter={(value: number, name: string) => [`${formatNumber(value, locale)} ${t.common.sum}`, legendLabels[name] ?? name]}
            labelFormatter={(_, payload) => payload?.[0]?.payload?.fullMonth ?? ""}
          />
          <Legend
            formatter={(value: string) => legendLabels[value] ?? value}
            wrapperStyle={{ fontSize: 12, color: "#4a5568" }}
          />
          {LINES.map((l) => (
            <Line
              key={l.key}
              type="monotone"
              dataKey={l.key}
              stroke={l.color}
              strokeWidth={2.5}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
