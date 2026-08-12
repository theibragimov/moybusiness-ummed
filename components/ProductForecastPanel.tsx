"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Search, PackageSearch, Boxes, TrendingUp, ShoppingBasket, Truck, Star } from "lucide-react";
import { useLanguage } from "@/lib/i18n/context";
import { formatNumber } from "@/lib/format";
import { Card } from "@/components/Card";
import { StatCard } from "@/components/StatCard";
import { QtyLineChart } from "@/components/charts/QtyLineChart";
import { MultiQtyLineChart } from "@/components/charts/MultiQtyLineChart";
import { searchProductsAction, getProductForecastAction } from "@/app/actions";
import type { ProductForecastData, ProductSearchResult } from "@/lib/reports";
import { Spinner } from "@/components/Spinner";

const HISTORY_OPTIONS = [6, 12, 18, 24] as const;
const FORECAST_OPTIONS = [3, 6, 12, 24] as const;

export function ProductForecastPanel() {
  const { t, locale } = useLanguage();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProductSearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<ProductSearchResult | null>(null);
  const [forecast, setForecast] = useState<ProductForecastData | null>(null);
  const [historyMonths, setHistoryMonths] = useState<number>(12);
  const [forecastMonths, setForecastMonths] = useState<number>(12);
  const [isSearching, startSearch] = useTransition();
  const [isLoadingForecast, startForecast] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextSearchRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (skipNextSearchRef.current) {
      skipNextSearchRef.current = false;
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(() => {
      startSearch(async () => {
        const rows = await searchProductsAction(query);
        setResults(rows);
        setOpen(true);
      });
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const loadForecast = (productId: string, hMonths: number, fMonths: number) => {
    startForecast(async () => {
      const data = await getProductForecastAction(productId, hMonths, fMonths);
      setForecast(data);
    });
  };

  const choose = (p: ProductSearchResult) => {
    skipNextSearchRef.current = true;
    setSelected(p);
    setQuery(p.name);
    setResults([]);
    setOpen(false);
    setForecast(null);
    loadForecast(p.id, historyMonths, forecastMonths);
  };

  const changeHistoryMonths = (v: number) => {
    setHistoryMonths(v);
    if (selected) {
      setForecast(null);
      loadForecast(selected.id, v, forecastMonths);
    }
  };

  const changeForecastMonths = (v: number) => {
    setForecastMonths(v);
    if (selected) {
      setForecast(null);
      loadForecast(selected.id, historyMonths, v);
    }
  };

  const qty = (v: number) => formatNumber(v, locale);
  const monthLabel = (n: number) => (t.analytics as Record<string, string>)[`months${n}`] ?? `${n}`;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-ink-900">{t.analytics.forecastTitle}</h2>
        <p className="mt-1 text-sm text-ink-500">{t.analytics.forecastSubtitle}</p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="relative max-w-xl flex-1 min-w-[240px]" ref={containerRef}>
          <div className="flex items-center gap-2 rounded-full bg-white px-4 py-2.5 shadow-card">
            <Search size={16} className="text-ink-400" />
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelected(null);
              }}
              onFocus={() => results.length > 0 && setOpen(true)}
              placeholder={t.analytics.chooseProductPlaceholder}
              className="w-full bg-transparent text-sm outline-none placeholder:text-ink-400"
            />
            {isSearching && <Spinner size={15} />}
          </div>
          {open && results.length > 0 && (
            <ul className="absolute z-10 mt-2 max-h-72 w-full overflow-y-auto rounded-2xl bg-white p-1.5 shadow-card">
              {results.map((r) => (
                <li key={r.id}>
                  <button
                    onClick={() => choose(r)}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-ink-700 hover:bg-surface"
                  >
                    <PackageSearch size={14} className="shrink-0 text-ink-400" />
                    <span className="truncate">{r.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <label className="flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm shadow-card">
          <span className="text-ink-400">{t.analytics.historyPeriod}:</span>
          <select
            value={historyMonths}
            onChange={(e) => changeHistoryMonths(Number(e.target.value))}
            className="bg-transparent font-medium text-ink-900 outline-none"
          >
            {HISTORY_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {monthLabel(n)}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm shadow-card">
          <span className="text-ink-400">{t.analytics.forecastPeriod}:</span>
          <select
            value={forecastMonths}
            onChange={(e) => changeForecastMonths(Number(e.target.value))}
            className="bg-transparent font-medium text-ink-900 outline-none"
          >
            {FORECAST_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {monthLabel(n)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {!selected && !isSearching && (
        <p className="rounded-3xl bg-white py-16 text-center text-sm text-ink-400 shadow-card">
          {t.analytics.noProductChosen}
        </p>
      )}

      {selected && isLoadingForecast && !forecast && (
        <div className="relative">
          <div className="pointer-events-none sticky top-24 z-10 flex justify-center">
            <div className="flex items-center gap-2 rounded-full bg-white px-4 py-2 shadow-card">
              <Spinner size={16} />
            </div>
          </div>
          <div className="animate-pulse space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-28 rounded-3xl bg-white shadow-card" />
              ))}
            </div>
            <div className="h-64 rounded-3xl bg-white shadow-card" />
          </div>
        </div>
      )}

      {forecast && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard icon={Boxes} label={t.analytics.currentStock} value={qty(forecast.currentStock)} accent="brand" />
            <StatCard
              icon={ShoppingBasket}
              label={t.analytics.historyTotal}
              value={qty(forecast.historyTotalQty)}
              accent="emerald"
            />
            <StatCard
              icon={TrendingUp}
              label={t.analytics.forecastTotal}
              value={qty(forecast.forecastTotalQty)}
              accent="amber"
            />
            <StatCard
              icon={Truck}
              label={t.analytics.suggestedPurchase}
              value={qty(forecast.suggestedPurchaseQty)}
              accent="rose"
            />
          </div>

          {forecast.modifications.length > 0 ? (
            <>
              <Card title={t.analytics.modificationsTitle}>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-wide text-ink-400">
                        <th className="pb-2 font-medium">{t.analytics.modification}</th>
                        <th className="pb-2 text-right font-medium">{t.analytics.stock}</th>
                        <th className="pb-2 text-right font-medium">{t.analytics.historyTotal}</th>
                        <th className="pb-2 text-right font-medium">{t.analytics.forecastTotal}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface">
                      {forecast.modifications.map((m, i) => (
                        <tr key={m.name} className={i === 0 ? "bg-emerald-50" : undefined}>
                          <td className="py-2.5 font-medium text-ink-900">
                            <span className="flex items-center gap-1.5">
                              {i === 0 && <Star size={13} className="shrink-0 fill-emerald-500 text-emerald-500" />}
                              {m.name}
                              {i === 0 && (
                                <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold text-white">
                                  {t.analytics.topSeller}
                                </span>
                              )}
                            </span>
                          </td>
                          <td className="py-2.5 text-right text-ink-700">{qty(m.stock)}</td>
                          <td className="py-2.5 text-right text-ink-700">{qty(m.historyTotalQty)}</td>
                          <td className="py-2.5 text-right font-semibold text-ink-900">{qty(m.forecastTotalQty)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Card title={t.analytics.modificationHistoryChart}>
                  <MultiQtyLineChart
                    points={forecast.history}
                    series={forecast.modifications.map((m) => ({ key: m.name, name: m.name, data: m.history }))}
                  />
                </Card>
                <Card title={t.analytics.modificationForecastChart}>
                  <MultiQtyLineChart
                    points={forecast.forecast}
                    series={forecast.modifications.map((m) => ({ key: m.name, name: m.name, data: m.forecast }))}
                  />
                </Card>
              </div>
            </>
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card title={t.analytics.historyChartTitle}>
                <QtyLineChart data={forecast.history} color="#3b63f5" gradientId="historyFill" />
              </Card>
              <Card title={t.analytics.forecastChartTitle}>
                <QtyLineChart data={forecast.forecast} color="#f59e0b" gradientId="forecastFill" />
              </Card>
            </div>
          )}

          <p className="text-xs text-ink-400">{t.analytics.forecastDisclaimer}</p>
        </div>
      )}
    </div>
  );
}
