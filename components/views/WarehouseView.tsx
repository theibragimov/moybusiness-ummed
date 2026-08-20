"use client";

import { useMemo, useState } from "react";
import { Search, PackageCheck, Clock, PackageX, CalendarClock } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useLanguage } from "@/lib/i18n/context";
import { formatMoney, formatNumber } from "@/lib/format";
import { Card } from "@/components/Card";
import type { WarehouseData, WarehouseRow, WarehouseStatus } from "@/lib/reports";

type StatusFilter = "all" | WarehouseStatus;

const STATUS_BADGE: Record<WarehouseStatus, string> = {
  normal: "bg-emerald-500 text-white",
  slow: "bg-amber-500 text-white",
  dead: "bg-rose-500 text-white",
  expiring: "bg-violet-500 text-white",
};

const STATUS_ROW: Record<WarehouseStatus, string> = {
  normal: "",
  slow: "bg-amber-50 hover:bg-amber-100",
  dead: "bg-rose-50 hover:bg-rose-100",
  expiring: "bg-violet-50 hover:bg-violet-100",
};

const STATUS_ICON: Record<WarehouseStatus, LucideIcon> = {
  normal: PackageCheck,
  slow: Clock,
  dead: PackageX,
  expiring: CalendarClock,
};

const STATUS_CARD: Record<WarehouseStatus, string> = {
  normal: "from-emerald-400 to-emerald-600",
  slow: "from-amber-400 to-amber-600",
  dead: "from-rose-400 to-rose-600",
  expiring: "from-violet-400 to-violet-600",
};

export function WarehouseView({ data }: { data: WarehouseData }) {
  const { t, locale } = useLanguage();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const money = (v: number) => `${formatMoney(v, locale)} ${t.common.sum}`;

  const statusLabel: Record<WarehouseStatus, string> = {
    normal: t.warehouse.statusNormal,
    slow: t.warehouse.statusSlow,
    dead: t.warehouse.statusDead,
    expiring: t.warehouse.statusExpiring,
  };

  const rows = useMemo(() => {
    let list = data.rows;
    if (statusFilter !== "all") list = list.filter((r) => r.status === statusFilter);
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((r) => r.name.toLowerCase().includes(q));
    return list;
  }, [data.rows, statusFilter, search]);

  const daysLeftLabel = (r: WarehouseRow) =>
    r.daysOfStockLeft === null ? t.warehouse.noSales : formatNumber(Math.round(r.daysOfStockLeft), locale);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink-900">{t.warehouse.title}</h1>
        <p className="mt-1 text-sm text-ink-500">{t.warehouse.subtitle}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {data.summary.map((s) => {
          const Icon = STATUS_ICON[s.status];
          return (
            <button
              key={s.status}
              onClick={() => setStatusFilter(statusFilter === s.status ? "all" : s.status)}
              className={`rounded-3xl bg-white p-5 text-left shadow-card ring-2 transition-colors ${
                statusFilter === s.status ? "ring-brand-400" : "ring-transparent"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-ink-500">{statusLabel[s.status]}</span>
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br text-white ${STATUS_CARD[s.status]}`}
                >
                  <Icon size={16} />
                </div>
              </div>
              <p className="mt-3 text-2xl font-bold text-ink-900">
                {formatNumber(s.count, locale)} <span className="text-sm font-medium text-ink-400">{t.warehouse.skuCount}</span>
              </p>
              <p className="text-xs text-ink-400">{money(s.value)}</p>
            </button>
          );
        })}
      </div>

      <p className="text-xs text-ink-400">{t.warehouse.statusHint}</p>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex max-w-md flex-1 items-center gap-2 rounded-full bg-white px-4 py-2.5 shadow-card">
          <Search size={16} className="text-ink-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.warehouse.searchPlaceholder}
            className="w-full bg-transparent text-sm outline-none placeholder:text-ink-400"
          />
        </div>
        {statusFilter !== "all" && (
          <button
            onClick={() => setStatusFilter("all")}
            className="rounded-full bg-white px-4 py-2.5 text-sm font-medium text-ink-500 shadow-card hover:text-ink-900"
          >
            {t.warehouse.filterAll}
          </button>
        )}
        <span className="ml-auto rounded-full bg-white px-4 py-2.5 text-xs text-ink-400 shadow-card">
          {t.warehouse.leadTimeDaysLabel}: <span className="font-semibold text-ink-700">{data.leadTimeDays} {t.warehouse.days}</span>
        </span>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1360px] text-sm [font-variant-numeric:tabular-nums]">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-ink-400">
                <th className="whitespace-nowrap px-3 py-2 font-medium">#</th>
                <th className="whitespace-nowrap px-3 py-2 font-medium">{t.warehouse.product}</th>
                <th className="whitespace-nowrap px-3 py-2 text-right font-medium">{t.warehouse.stock}</th>
                <th className="whitespace-nowrap px-3 py-2 text-right font-medium">{t.warehouse.stockValue}</th>
                <th className="whitespace-nowrap px-3 py-2 text-right font-medium">{t.warehouse.qty30}</th>
                <th className="whitespace-nowrap px-3 py-2 text-right font-medium">{t.warehouse.avgDailySales}</th>
                <th className="whitespace-nowrap px-3 py-2 text-right font-medium">{t.warehouse.daysLeft}</th>
                <th
                  className="whitespace-nowrap px-3 py-2 text-right font-medium"
                  title={t.warehouse.reorderPointHint}
                >
                  {t.warehouse.reorderPoint}
                </th>
                <th className="whitespace-nowrap px-3 py-2 text-right font-medium">{t.warehouse.minStock}</th>
                <th className="whitespace-nowrap px-3 py-2 text-right font-medium">{t.warehouse.maxStock}</th>
                <th className="whitespace-nowrap px-3 py-2 text-right font-medium">{t.warehouse.excessStock}</th>
                <th className="min-w-[140px] whitespace-nowrap px-3 py-2 text-right font-medium">
                  {t.warehouse.status}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface">
              {rows.map((r, i) => (
                <tr key={r.name + i} className={STATUS_ROW[r.status]}>
                  <td className="whitespace-nowrap px-3 py-2.5 text-ink-400">{i + 1}</td>
                  <td className="max-w-[260px] truncate px-3 py-2.5 font-medium text-ink-900">{r.name}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right text-ink-700">
                    {formatNumber(r.stock, locale)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right text-ink-700">{money(r.stockValue)}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right text-ink-700">
                    {formatNumber(r.qty30, locale)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right text-ink-700">
                    {r.avgDailySales.toFixed(1)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right text-ink-700">{daysLeftLabel(r)}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right text-ink-700">
                    {formatNumber(r.reorderPoint, locale)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right text-ink-700">
                    {formatNumber(r.minStock, locale)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right text-ink-700">
                    {formatNumber(r.maxStock, locale)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right text-ink-700">
                    {r.excessStock > 0 ? (
                      <span className="font-semibold text-amber-600">{formatNumber(r.excessStock, locale)}</span>
                    ) : (
                      formatNumber(0, locale)
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right">
                    <span
                      className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold ${STATUS_BADGE[r.status]}`}
                    >
                      {statusLabel[r.status]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && <p className="py-10 text-center text-sm text-ink-400">{t.common.noData}</p>}
        </div>
      </Card>

      <p className="text-xs text-ink-400">{t.warehouse.leadTimeNote}</p>
    </div>
  );
}
