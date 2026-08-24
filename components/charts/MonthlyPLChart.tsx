"use client";

import { useMemo, useState } from "react";
import { MousePointerClick, ChevronDown, ChevronUp } from "lucide-react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fromMs, formatNumber } from "@/lib/format";
import { useLanguage } from "@/lib/i18n/context";
import type { MonthlyPLRow } from "@/lib/reports";

const LINES: { key: "revenue" | "grossProfit" | "netProfit" | "expenses"; color: string }[] = [
  { key: "revenue", color: "#3b63f5" },
  { key: "grossProfit", color: "#16a34a" },
  { key: "netProfit", color: "#0d9488" },
  { key: "expenses", color: "#dc2626" },
];

export function MonthlyPLChart({ data }: { data: MonthlyPLRow[] }) {
  const { locale, t } = useLanguage();
  const [range, setRange] = useState<6 | 12>(12);
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
  const [showCategories, setShowCategories] = useState(false);
  const money = (v: number) => `${formatNumber(fromMs(v), locale)} ${t.common.sum}`;

  const legendLabels: Record<string, string> = {
    revenue: t.dashboard.legendRevenue,
    grossProfit: t.dashboard.legendGrossProfit,
    netProfit: t.dashboard.legendNetProfit,
    expenses: t.dashboard.legendExpenses,
  };

  const sliced = useMemo(() => (range === 6 ? data.slice(-6) : data), [data, range]);

  const chartData = useMemo(
    () =>
      sliced.map((r) => ({
        month: r.label.slice(5, 7),
        fullMonth: r.label,
        revenue: fromMs(r.revenue),
        grossProfit: fromMs(r.grossProfit),
        netProfit: fromMs(r.netProfit),
        expenses: fromMs(r.expenses),
      })),
    [sliced]
  );

  const selected = useMemo(
    () => sliced.find((r) => r.label === selectedLabel) ?? sliced[sliced.length - 1] ?? null,
    [sliced, selectedLabel]
  );

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
        <LineChart
          data={chartData}
          margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
          onClick={(e) => {
            const label = e?.activePayload?.[0]?.payload?.fullMonth as string | undefined;
            if (label) {
              setSelectedLabel(label);
              setShowCategories(false);
            }
          }}
          style={{ cursor: "pointer" }}
        >
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
          {LINES.map((l) => {
            const isSelected = (d: { fullMonth: string }) => d.fullMonth === selected?.label;
            return (
              <Line
                key={l.key}
                type="monotone"
                dataKey={l.key}
                stroke={l.color}
                strokeWidth={2.5}
                dot={(props: { cx: number; cy: number; payload: { fullMonth: string }; index: number }) => (
                  <circle
                    key={props.index}
                    cx={props.cx}
                    cy={props.cy}
                    r={isSelected(props.payload) ? 6 : 3}
                    fill={isSelected(props.payload) ? l.color : "#fff"}
                    stroke={l.color}
                    strokeWidth={2}
                  />
                )}
                activeDot={{ r: 6, style: { cursor: "pointer" } }}
              />
            );
          })}
        </LineChart>
      </ResponsiveContainer>

      {!selected && <p className="mt-2 flex items-center gap-1.5 text-xs text-ink-400"><MousePointerClick size={13} /> {t.dashboard.monthDetailHint}</p>}

      {selected && (
        <div className="mt-4 rounded-2xl bg-surface p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h4 className="text-sm font-bold text-ink-900">
              {selected.label} — {t.dashboard.monthDetailTitle}
            </h4>
            <p className="flex items-center gap-1.5 text-xs text-ink-400">
              <MousePointerClick size={13} /> {t.dashboard.monthDetailHint}
            </p>
          </div>

          <div className="space-y-1.5 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-ink-500">{t.dashboard.legendRevenue}</span>
              <span className="font-semibold text-ink-900">{money(selected.revenue)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-ink-500">
                {t.dashboard.formulaMinus} {t.dashboard.costOfGoods}
              </span>
              <span className="font-semibold text-ink-900">{money(selected.cogs)}</span>
            </div>
            <div className="flex items-center justify-between border-t border-surface pt-1.5">
              <span className="font-medium text-ink-700">
                {t.dashboard.formulaEquals} {t.dashboard.grossProfit}
              </span>
              <span className={`font-bold ${selected.grossProfit >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                {money(selected.grossProfit)}
              </span>
            </div>

            <button
              onClick={() => setShowCategories((v) => !v)}
              className="mt-2 flex w-full items-center justify-between rounded-xl bg-white px-3 py-2 text-left transition-colors hover:bg-white/70"
            >
              <span className="text-ink-500">
                {t.dashboard.formulaMinus} {t.dashboard.operatingExpenses}
              </span>
              <span className="flex items-center gap-1.5 font-semibold text-ink-900">
                {money(selected.expenses)}
                {showCategories ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </span>
            </button>

            {showCategories && (
              <div className="ml-3 space-y-1 border-l-2 border-rose-200 py-1 pl-3">
                {selected.expensesByCategory.length === 0 && (
                  <p className="text-xs text-ink-400">{t.common.noData}</p>
                )}
                {selected.expensesByCategory.map((c) => (
                  <div key={c.category} className="flex items-center justify-between text-xs">
                    <span className="text-ink-500">{c.category}</span>
                    <span className="font-medium text-ink-700">{money(c.sum)}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between border-t border-surface pt-1.5">
              <span className="font-medium text-ink-700">
                {t.dashboard.formulaEquals} {t.dashboard.netProfit}
              </span>
              <span className={`font-bold ${selected.netProfit >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                {money(selected.netProfit)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
