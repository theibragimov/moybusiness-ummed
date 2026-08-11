"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useLanguage } from "@/lib/i18n/context";
import { formatMoney } from "@/lib/format";
import { Card } from "@/components/Card";
import type { CounterpartyRow } from "@/lib/reports";

type SortKey = "demandsSum" | "demandsCount" | "nameAsc" | "nameDesc";

export function CrmView({ rows }: { rows: CounterpartyRow[] }) {
  const { t, locale } = useLanguage();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("demandsSum");
  const money = (v: number) => `${formatMoney(v, locale)} ${t.common.sum}`;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? rows.filter((r) => r.name.toLowerCase().includes(q) || r.phone.includes(q)) : rows;
    return [...list].sort((a, b) => {
      if (sort === "nameAsc") return a.name.localeCompare(b.name);
      if (sort === "nameDesc") return b.name.localeCompare(a.name);
      return b[sort] - a[sort];
    });
  }, [rows, query, sort]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink-900">{t.crm.title}</h1>
        <p className="mt-1 text-sm text-ink-500">{t.crm.subtitle}</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-1 min-w-[220px] items-center gap-2 rounded-full bg-white px-4 py-2.5 shadow-card">
          <Search size={16} className="text-ink-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.common.search}
            className="w-full bg-transparent text-sm outline-none placeholder:text-ink-400"
          />
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="rounded-full bg-white px-4 py-2.5 text-sm text-ink-700 shadow-card outline-none"
        >
          <option value="demandsSum">{t.crm.demandsSum}</option>
          <option value="demandsCount">{t.crm.demandsCount}</option>
          <option value="nameAsc">
            {t.crm.name} ({t.common.sortAsc})
          </option>
          <option value="nameDesc">
            {t.crm.name} ({t.common.sortDesc})
          </option>
        </select>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-ink-400">
                <th className="pb-2 font-medium">{t.crm.name}</th>
                <th className="pb-2 font-medium">{t.crm.phone}</th>
                <th className="pb-2 text-right font-medium">{t.crm.demandsCount}</th>
                <th className="pb-2 text-right font-medium">{t.crm.demandsSum}</th>
                <th className="pb-2 text-right font-medium">{t.crm.avgReceipt}</th>
                <th className="pb-2 font-medium">{t.crm.lastDemand}</th>
                <th className="pb-2 text-right font-medium">{t.crm.balance}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface">
              {filtered.slice(0, 300).map((r) => (
                <tr key={r.id}>
                  <td className="py-2.5 max-w-[240px] truncate font-medium text-ink-900">{r.name}</td>
                  <td className="py-2.5 text-ink-500">{r.phone || "—"}</td>
                  <td className="py-2.5 text-right text-ink-700">{r.demandsCount}</td>
                  <td className="py-2.5 text-right font-semibold text-ink-900">{money(r.demandsSum)}</td>
                  <td className="py-2.5 text-right text-ink-500">{money(r.averageReceipt)}</td>
                  <td className="py-2.5 text-ink-500">{r.lastDemandDate?.slice(0, 10) ?? "—"}</td>
                  <td
                    className={`py-2.5 text-right font-semibold ${
                      r.balance < 0 ? "text-rose-500" : r.balance > 0 ? "text-emerald-500" : "text-ink-400"
                    }`}
                  >
                    {money(r.balance)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <p className="py-10 text-center text-sm text-ink-400">{t.common.noData}</p>}
        </div>
      </Card>
    </div>
  );
}
