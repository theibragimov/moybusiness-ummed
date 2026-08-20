"use client";

import { useEffect, useState } from "react";
import { Wallet2, Percent, Target } from "lucide-react";
import { useLanguage } from "@/lib/i18n/context";
import { formatMoney, formatPercent } from "@/lib/format";
import { Card } from "@/components/Card";
import { StatCard } from "@/components/StatCard";
import { PeriodPicker } from "@/components/PeriodPicker";
import { CategoryPie } from "@/components/charts/CategoryPie";
import { MultiMoneyLineChart } from "@/components/charts/MultiMoneyLineChart";
import type { ExpensesData } from "@/lib/reports";

export function ExpensesView({ data, from, to }: { data: ExpensesData; from: string; to: string }) {
  const { t, locale } = useLanguage();
  const money = (v: number) => `${formatMoney(v, locale)} ${t.common.sum}`;

  const [selected, setSelected] = useState<Set<string>>(new Set(data.byCategory.map((c) => c.category)));

  // Re-sync selection when the period changes and brings a different category set.
  useEffect(() => {
    setSelected(new Set(data.byCategory.map((c) => c.category)));
  }, [data]);

  const toggle = (category: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  };

  const selectedSeries = data.categoryDaily
    .filter((c) => selected.has(c.category))
    .map((c) => ({ key: c.category, name: c.category, days: c.days }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink-900">{t.expenses.title}</h1>
          <p className="mt-1 text-sm text-ink-500">{t.expenses.subtitle}</p>
        </div>
        <PeriodPicker from={from} to={to} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard icon={Wallet2} label={t.expenses.totalTitle} value={money(data.total)} accent="rose" />
        <StatCard
          icon={Percent}
          label={t.expenses.opexToRevenueTitle}
          value={formatPercent(data.opexToRevenue)}
          hint={`${t.expenses.opexToRevenueHint}: ${money(data.revenue)}`}
          accent="amber"
        />
        <StatCard
          icon={Target}
          label={t.expenses.budgetTitle}
          value={formatPercent(data.budgetUsage)}
          hint={`${t.expenses.budgetHint}: ${money(data.budgetAvg)}`}
          accent={data.budgetUsage > 1 ? "rose" : "emerald"}
        />
      </div>

      <Card title={t.expenses.byCategory}>
        {data.byCategory.length > 0 ? (
          <CategoryPie data={data.byCategory} />
        ) : (
          <p className="py-6 text-center text-sm text-ink-400">{t.common.noData}</p>
        )}
      </Card>

      <Card title={t.expenses.compareTitle}>
        <p className="mb-3 text-xs text-ink-400">{t.expenses.compareHint}</p>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <button
            onClick={() => setSelected(new Set(data.byCategory.map((c) => c.category)))}
            className="rounded-full bg-surface px-3 py-1.5 text-xs font-medium text-ink-500 hover:text-ink-900"
          >
            {t.expenses.selectAll}
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="rounded-full bg-surface px-3 py-1.5 text-xs font-medium text-ink-500 hover:text-ink-900"
          >
            {t.expenses.clearAll}
          </button>
          {data.byCategory.map((c) => {
            const active = selected.has(c.category);
            return (
              <button
                key={c.category}
                onClick={() => toggle(c.category)}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  active ? "bg-brand-500 text-white" : "bg-surface text-ink-500 hover:text-ink-900"
                }`}
              >
                <span
                  className={`h-3 w-3 rounded-[4px] border ${
                    active ? "border-white bg-white/30" : "border-ink-300"
                  }`}
                />
                {c.category}
              </button>
            );
          })}
        </div>

        {selectedSeries.length > 0 ? (
          <MultiMoneyLineChart points={data.byDay} series={selectedSeries} />
        ) : (
          <p className="py-10 text-center text-sm text-ink-400">{t.expenses.noCategorySelected}</p>
        )}
      </Card>

      <Card title={t.expenses.recentTitle}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-ink-400">
                <th className="pb-2 font-medium">{t.expenses.date}</th>
                <th className="pb-2 font-medium">{t.expenses.category}</th>
                <th className="pb-2 font-medium">{t.expenses.description}</th>
                <th className="pb-2 text-right font-medium">{t.expenses.amount}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface">
              {data.recent.map((r) => (
                <tr key={r.id}>
                  <td className="py-2.5 text-ink-500">{r.moment.slice(0, 16)}</td>
                  <td className="py-2.5 font-medium text-ink-900">{r.category}</td>
                  <td className="py-2.5 max-w-[280px] truncate text-ink-500">{r.description}</td>
                  <td className="py-2.5 text-right font-semibold text-ink-900">{money(r.sum)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.recent.length === 0 && (
            <p className="py-10 text-center text-sm text-ink-400">{t.common.noData}</p>
          )}
        </div>
      </Card>
    </div>
  );
}
