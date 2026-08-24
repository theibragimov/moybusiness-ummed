"use client";

import { CalendarCheck2, PackageCheck, ShoppingCart, TrendingUp, Wallet2 } from "lucide-react";
import { useLanguage } from "@/lib/i18n/context";
import { formatMoney, formatNumber, formatPercent } from "@/lib/format";
import { StatCard } from "@/components/StatCard";
import { Card } from "@/components/Card";
import { SalesLineChart } from "@/components/charts/SalesLineChart";
import { CategoryPie } from "@/components/charts/CategoryPie";
import { MonthlyPLChart } from "@/components/charts/MonthlyPLChart";
import type { DashboardData } from "@/lib/reports";

export function DashboardView({ data }: { data: DashboardData }) {
  const { t, locale } = useLanguage();
  const money = (v: number) => `${formatMoney(v, locale)} ${t.common.sum}`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink-900">{t.dashboard.title}</h1>
        <p className="mt-1 text-sm text-ink-500">{t.dashboard.subtitle}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={ShoppingCart}
          label={t.dashboard.todaySales}
          value={money(data.todaySalesSum)}
          hint={`${formatNumber(data.todaySalesCount, locale)} ${t.dashboard.documents}`}
          accent="brand"
        />
        <StatCard
          icon={TrendingUp}
          label={t.dashboard.monthRevenue}
          value={money(data.monthRevenueSum)}
          accent="emerald"
        />
        <StatCard
          icon={PackageCheck}
          label={t.dashboard.shipmentsCount}
          value={formatNumber(data.monthShipmentsCount, locale)}
          hint={money(data.monthShipmentsSum)}
          accent="amber"
        />
        <StatCard
          icon={Wallet2}
          label={t.dashboard.monthExpenses}
          value={money(data.monthExpensesSum)}
          accent="rose"
        />
      </div>

      <Card title={t.dashboard.plTitle}>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <div>
            <p className="text-xs text-ink-400">{t.dashboard.costOfGoods}</p>
            <p className="mt-1 text-base font-bold text-ink-900">{money(data.monthCostSum)}</p>
          </div>
          <div>
            <p className="text-xs text-ink-400">{t.dashboard.grossProfit}</p>
            <p className={`mt-1 text-base font-bold ${data.grossProfit >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
              {money(data.grossProfit)}
            </p>
          </div>
          <div>
            <p className="text-xs text-ink-400">{t.dashboard.grossMargin}</p>
            <p className="mt-1 text-base font-bold text-ink-900">{formatPercent(data.grossMargin)}</p>
          </div>
          <div>
            <p className="text-xs text-ink-400">{t.dashboard.operatingExpenses}</p>
            <p className="mt-1 text-base font-bold text-ink-900">{money(data.operatingExpensesSum)}</p>
          </div>
          <div>
            <p className="text-xs text-ink-400">{t.dashboard.netProfit}</p>
            <p className={`mt-1 text-base font-bold ${data.netProfit >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
              {money(data.netProfit)}
            </p>
          </div>
          <div>
            <p className="text-xs text-ink-400">{t.dashboard.netMargin}</p>
            <p className={`mt-1 text-base font-bold ${data.netMargin >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
              {formatPercent(data.netMargin)}
            </p>
          </div>
        </div>
      </Card>

      <Card title={t.dashboard.monthlyDynamicsTitle}>
        <p className="-mt-2 mb-4 text-sm text-ink-500">{t.dashboard.monthlyDynamicsSubtitle}</p>
        <MonthlyPLChart data={data.monthlyPL} />
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card title={t.dashboard.salesDynamics} className="lg:col-span-2">
          <SalesLineChart data={data.salesByDay} />
        </Card>
        <Card title={t.dashboard.expensesByCategory}>
          {data.expensesByCategory.length > 0 ? (
            <CategoryPie data={data.expensesByCategory} />
          ) : (
            <p className="py-10 text-center text-sm text-ink-400">{t.common.noData}</p>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card title={t.dashboard.topProducts} className="lg:col-span-1">
          <ul className="space-y-3">
            {data.topProducts.map((p, i) => (
              <li key={p.name} className="flex items-center gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand-600">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink-900">{p.name}</p>
                  <p className="text-xs text-ink-400">
                    {formatNumber(p.qty, locale)} {t.dashboard.pieces}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-semibold text-ink-700">{money(p.sum)}</span>
              </li>
            ))}
            {data.topProducts.length === 0 && (
              <p className="py-6 text-center text-sm text-ink-400">{t.common.noData}</p>
            )}
          </ul>
        </Card>

        <Card title={t.dashboard.recentShipments} className="lg:col-span-2">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-ink-400">
                  <th className="pb-2 font-medium">{t.dashboard.colDoc}</th>
                  <th className="pb-2 font-medium">{t.dashboard.colCounterparty}</th>
                  <th className="pb-2 font-medium">{t.dashboard.colDate}</th>
                  <th className="pb-2 text-right font-medium">{t.dashboard.colAmount}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface">
                {data.recentShipments.map((s) => (
                  <tr key={s.id}>
                    <td className="py-2.5 font-medium text-ink-900">{s.name}</td>
                    <td className="py-2.5 max-w-[220px] truncate text-ink-500">{s.agent}</td>
                    <td className="py-2.5 text-ink-500">{s.moment.slice(0, 16)}</td>
                    <td className="py-2.5 text-right font-semibold text-ink-900">{money(s.sum)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data.recentShipments.length === 0 && (
              <p className="py-6 text-center text-sm text-ink-400">{t.common.noData}</p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
