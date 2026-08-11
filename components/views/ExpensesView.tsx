"use client";

import { Wallet2 } from "lucide-react";
import { useLanguage } from "@/lib/i18n/context";
import { formatMoney } from "@/lib/format";
import { Card } from "@/components/Card";
import { StatCard } from "@/components/StatCard";
import { PeriodPicker } from "@/components/PeriodPicker";
import { CategoryPie } from "@/components/charts/CategoryPie";
import { SimpleBarChart } from "@/components/charts/SimpleBarChart";
import type { ExpensesData } from "@/lib/reports";

export function ExpensesView({ data, from, to }: { data: ExpensesData; from: string; to: string }) {
  const { t, locale } = useLanguage();
  const money = (v: number) => `${formatMoney(v, locale)} ${t.common.sum}`;

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
        <Card title={t.expenses.byCategory} className="sm:col-span-2">
          {data.byCategory.length > 0 ? (
            <CategoryPie data={data.byCategory} />
          ) : (
            <p className="py-6 text-center text-sm text-ink-400">{t.common.noData}</p>
          )}
        </Card>
      </div>

      <Card title={t.expenses.dynamics}>
        <SimpleBarChart data={data.byDay} />
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
