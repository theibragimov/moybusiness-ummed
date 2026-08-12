"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useLanguage } from "@/lib/i18n/context";
import { formatMoney, formatNumber, formatPercent } from "@/lib/format";
import { Card } from "@/components/Card";
import { PeriodPicker } from "@/components/PeriodPicker";
import { ProductForecastPanel } from "@/components/ProductForecastPanel";
import type { AnalyticsData } from "@/lib/reports";

type Tab =
  | "topSold"
  | "topMargin"
  | "topProfit"
  | "abc"
  | "turnover"
  | "stockValue"
  | "deadStock6mo"
  | "growing"
  | "declining"
  | "slowMovers"
  | "forecast";

type AbcRow = AnalyticsData["abc"][number];
type AbcFilter = "all" | "A" | "B" | "C";

const GROUP_BADGE: Record<"A" | "B" | "C", string> = {
  A: "bg-emerald-500 text-white",
  B: "bg-amber-500 text-white",
  C: "bg-rose-500 text-white",
};

const GROUP_ROW: Record<"A" | "B" | "C", string> = {
  A: "bg-emerald-50 hover:bg-emerald-100",
  B: "bg-amber-50 hover:bg-amber-100",
  C: "bg-rose-50 hover:bg-rose-100",
};

export function AnalyticsView({ data, from, to }: { data: AnalyticsData; from: string; to: string }) {
  const { t, locale } = useLanguage();
  const [tab, setTab] = useState<Tab>("topSold");
  const [search, setSearch] = useState("");
  const [abcFilter, setAbcFilter] = useState<AbcFilter>("all");
  const money = (v: number) => `${formatMoney(v, locale)} ${t.common.sum}`;
  const signedPercent = (v: number) => `${v >= 0 ? "+" : ""}${formatPercent(v)}`;

  const tabs: { key: Tab; label: string }[] = [
    { key: "topSold", label: t.analytics.topSoldTitle },
    { key: "topMargin", label: t.analytics.topMarginTitle },
    { key: "topProfit", label: t.analytics.topProfitTitle },
    { key: "turnover", label: t.analytics.turnoverTitle },
    { key: "stockValue", label: t.analytics.stockValueTitle },
    { key: "deadStock6mo", label: t.analytics.deadStock6moTitle },
    { key: "growing", label: t.analytics.growingTitle },
    { key: "declining", label: t.analytics.decliningTitle },
    { key: "abc", label: t.analytics.abcTitle },
    { key: "slowMovers", label: t.analytics.deadStockTitle },
    { key: "forecast", label: t.analytics.forecastTab },
  ];

  type Column<T> = {
    header: string;
    right?: boolean;
    render: (row: T) => React.ReactNode;
  };

  const nameCol = <T extends { name: string }>(): Column<T> => ({
    header: t.analytics.product,
    render: (r) => r.name,
  });

  const columns = useMemo(() => {
    switch (tab) {
      case "topSold":
      case "topMargin":
      case "topProfit":
      case "slowMovers":
        return [
          nameCol<AnalyticsData["topSold"][number]>(),
          { header: t.analytics.qty, right: true, render: (r) => formatNumber(r.qty, locale) },
          { header: t.analytics.revenue, right: true, render: (r) => money(r.revenue) },
          { header: t.analytics.profit, right: true, render: (r) => money(r.profit) },
          { header: t.analytics.margin, right: true, render: (r) => formatPercent(r.margin) },
        ] as Column<AnalyticsData["topSold"][number]>[];
      case "abc":
        return [
          nameCol<AbcRow>(),
          { header: t.analytics.qty, right: true, render: (r) => formatNumber(r.qty, locale) },
          { header: t.analytics.revenue, right: true, render: (r) => money(r.revenue) },
          { header: t.analytics.profit, right: true, render: (r) => money(r.profit) },
          { header: t.analytics.margin, right: true, render: (r) => formatPercent(r.margin) },
          { header: t.analytics.cumulative, right: true, render: (r) => formatPercent(r.cumulative) },
          {
            header: t.analytics.group,
            right: true,
            render: (r) => (
              <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${GROUP_BADGE[r.group]}`}>{r.group}</span>
            ),
          },
        ] as Column<AbcRow>[];
      case "turnover":
        return [
          nameCol<AnalyticsData["turnover"][number]>(),
          { header: t.analytics.qty, right: true, render: (r) => formatNumber(r.qty, locale) },
          { header: t.analytics.currentStockCol, right: true, render: (r) => formatNumber(r.currentStock, locale) },
          { header: t.analytics.sellThrough, right: true, render: (r) => formatPercent(r.sellThrough) },
          { header: t.analytics.revenue, right: true, render: (r) => money(r.revenue) },
        ] as Column<AnalyticsData["turnover"][number]>[];
      case "stockValue":
        return [
          nameCol<AnalyticsData["stockValue"][number]>(),
          { header: t.analytics.currentStockCol, right: true, render: (r) => formatNumber(r.currentStock, locale) },
          { header: t.analytics.stockValueCol, right: true, render: (r) => money(r.stockValue) },
          { header: t.analytics.qty, right: true, render: (r) => formatNumber(r.qty, locale) },
          { header: t.analytics.revenue, right: true, render: (r) => money(r.revenue) },
        ] as Column<AnalyticsData["stockValue"][number]>[];
      case "deadStock6mo":
        return [
          nameCol<AnalyticsData["deadStock6mo"][number]>(),
          { header: t.analytics.currentStockCol, right: true, render: (r) => formatNumber(r.currentStock, locale) },
          { header: t.analytics.qty6mo, right: true, render: (r) => formatNumber(r.qty6mo, locale) },
          { header: t.analytics.stockValueCol, right: true, render: (r) => money(r.stockValue) },
        ] as Column<AnalyticsData["deadStock6mo"][number]>[];
      case "growing":
      case "declining":
        return [
          nameCol<AnalyticsData["growing"][number]>(),
          { header: t.analytics.qty, right: true, render: (r) => formatNumber(r.qty, locale) },
          { header: t.analytics.prevRevenue, right: true, render: (r) => money(r.prevRevenue) },
          { header: t.analytics.revenue, right: true, render: (r) => money(r.revenue) },
          {
            header: t.analytics.growthCol,
            right: true,
            render: (r) => (
              <span className={r.growth >= 0 ? "text-emerald-600" : "text-rose-600"}>{signedPercent(r.growth)}</span>
            ),
          },
        ] as Column<AnalyticsData["growing"][number]>[];
      default:
        return [] as Column<unknown>[];
    }
  }, [tab, locale, t]);

  const baseRows: unknown[] =
    tab === "topSold"
      ? data.topSold
      : tab === "topMargin"
        ? data.topMargin
        : tab === "topProfit"
          ? data.topProfit
          : tab === "slowMovers"
            ? data.slowMovers
            : tab === "turnover"
              ? data.turnover
              : tab === "stockValue"
                ? data.stockValue
                : tab === "deadStock6mo"
                  ? data.deadStock6mo
                  : tab === "growing"
                    ? data.growing
                    : tab === "declining"
                      ? data.declining
                      : data.abc;

  const rows = useMemo(() => {
    let list = baseRows as { name: string; group?: "A" | "B" | "C" }[];
    if (tab === "abc" && abcFilter !== "all") {
      list = data.abc.filter((r) => r.group === abcFilter);
    }
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((r) => r.name.toLowerCase().includes(q));
    return list;
  }, [baseRows, tab, abcFilter, search, data.abc]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink-900">{t.analytics.title}</h1>
          <p className="mt-1 text-sm text-ink-500">{t.analytics.subtitle}</p>
        </div>
        {tab !== "forecast" && <PeriodPicker from={from} to={to} />}
      </div>

      {tab === "abc" && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-3xl bg-white p-5 shadow-card sm:col-span-3">
            <p className="text-xs text-ink-400">{t.analytics.abcTotalRevenue}</p>
            <p className="mt-1 text-2xl font-bold text-ink-900">{money(data.abcTotalRevenue)}</p>
          </div>
          {data.abcSummary.map((g) => (
            <button
              key={g.group}
              onClick={() => setAbcFilter(abcFilter === g.group ? "all" : g.group)}
              className={`rounded-3xl bg-white p-5 text-left shadow-card ring-2 transition-colors ${
                abcFilter === g.group ? "ring-brand-400" : "ring-transparent"
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-2xl text-sm font-bold ${GROUP_BADGE[g.group]}`}
                >
                  {g.group}
                </span>
                <span className="text-xs text-ink-400">{formatNumber(g.count, locale)} SKU</span>
              </div>
              <p className="mt-3 text-2xl font-bold text-ink-900">{formatPercent(g.revenueShare)}</p>
              <p className="text-xs text-ink-400">{t.analytics.share}</p>
            </button>
          ))}
          <p className="sm:col-span-3 text-xs text-ink-400">{t.analytics.abcHint}</p>
        </div>
      )}

      <div className="no-scrollbar flex gap-2 overflow-x-auto rounded-full bg-white p-1.5 shadow-card">
        {tabs.map((tb) => (
          <button
            key={tb.key}
            onClick={() => {
              setTab(tb.key);
              setAbcFilter("all");
              setSearch("");
            }}
            className={`shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              tab === tb.key ? "bg-brand-500 text-white shadow-soft" : "text-ink-500 hover:bg-surface"
            }`}
          >
            {tb.label}
          </button>
        ))}
      </div>

      {tab === "forecast" ? (
        <ProductForecastPanel />
      ) : (
        <>
          <div className="flex items-center gap-3">
            <div className="flex max-w-md flex-1 items-center gap-2 rounded-full bg-white px-4 py-2.5 shadow-card">
              <Search size={16} className="text-ink-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t.analytics.searchPlaceholder}
                className="w-full bg-transparent text-sm outline-none placeholder:text-ink-400"
              />
            </div>
            {tab === "abc" && abcFilter !== "all" && (
              <button
                onClick={() => setAbcFilter("all")}
                className="rounded-full bg-white px-4 py-2.5 text-sm font-medium text-ink-500 shadow-card hover:text-ink-900"
              >
                {t.analytics.filterAll}
              </button>
            )}
          </div>

          <Card>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-ink-400">
                    <th className="pb-2 font-medium">#</th>
                    {columns.map((c) => (
                      <th
                        key={c.header}
                        className={`pb-2 font-medium ${c.right ? "text-right" : ""}`}
                      >
                        {c.header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface">
                  {rows.map((r, i) => {
                    const abcRow = tab === "abc" ? (r as AbcRow) : null;
                    return (
                      <tr key={r.name + i} className={abcRow ? GROUP_ROW[abcRow.group] : undefined}>
                        <td className="py-2.5 pl-3 text-ink-400">{i + 1}</td>
                        {columns.map((c, ci) => (
                          <td
                            key={c.header}
                            className={`py-2.5 text-ink-700 ${c.right ? "text-right" : "max-w-[320px] truncate font-medium text-ink-900"} ${
                              ci === columns.length - 1 ? "pr-3" : ""
                            }`}
                          >
                            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                            {c.render(r as any)}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {rows.length === 0 && <p className="py-10 text-center text-sm text-ink-400">{t.common.noData}</p>}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
