"use client";

import { useMemo, useState } from "react";
import { Search, ChevronUp, ChevronDown } from "lucide-react";
import { useLanguage } from "@/lib/i18n/context";
import { formatMoney } from "@/lib/format";
import { Card } from "@/components/Card";
import type { CounterpartyRow } from "@/lib/reports";

type SortKey = "name" | "demandsCount" | "demandsSum" | "averageReceipt" | "lastDemandDate" | "balance";
type SortDir = "asc" | "desc";

const DEFAULT_DIR: Record<SortKey, SortDir> = {
  name: "asc",
  demandsCount: "desc",
  demandsSum: "desc",
  averageReceipt: "desc",
  lastDemandDate: "desc",
  balance: "desc",
};

function SortHeader({
  label,
  active,
  dir,
  align = "left",
  onClick,
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  align?: "left" | "right";
  onClick: () => void;
}) {
  return (
    <th className={`pb-2 font-medium ${align === "right" ? "text-right" : "text-left"}`}>
      <button
        onClick={onClick}
        className={`inline-flex items-center gap-1 ${align === "right" ? "flex-row-reverse" : ""} ${
          active ? "text-brand-600" : "text-ink-400 hover:text-ink-700"
        }`}
      >
        {label}
        {active ? (
          dir === "asc" ? (
            <ChevronUp size={13} />
          ) : (
            <ChevronDown size={13} />
          )
        ) : (
          <ChevronDown size={13} className="opacity-0" />
        )}
      </button>
    </th>
  );
}

export function CrmView({ rows }: { rows: CounterpartyRow[] }) {
  const { t, locale } = useLanguage();
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("demandsSum");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const money = (v: number) => `${formatMoney(v, locale)} ${t.common.sum}`;

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(DEFAULT_DIR[key]);
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? rows.filter((r) => r.name.toLowerCase().includes(q) || r.phone.includes(q)) : rows;
    const dirMul = sortDir === "asc" ? 1 : -1;
    return [...list].sort((a, b) => {
      if (sortKey === "name") return a.name.localeCompare(b.name) * dirMul;
      if (sortKey === "lastDemandDate") {
        const av = a.lastDemandDate ?? "";
        const bv = b.lastDemandDate ?? "";
        return av.localeCompare(bv) * dirMul;
      }
      return (a[sortKey] - b[sortKey]) * dirMul;
    });
  }, [rows, query, sortKey, sortDir]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink-900">{t.crm.title}</h1>
        <p className="mt-1 text-sm text-ink-500">{t.crm.subtitle}</p>
      </div>

      <div className="flex items-center gap-2 rounded-full bg-white px-4 py-2.5 shadow-card">
        <Search size={16} className="text-ink-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.common.search}
          className="w-full bg-transparent text-sm outline-none placeholder:text-ink-400"
        />
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-ink-400">
                <SortHeader
                  label={t.crm.name}
                  active={sortKey === "name"}
                  dir={sortDir}
                  onClick={() => toggleSort("name")}
                />
                <th className="pb-2 text-left font-medium">{t.crm.phone}</th>
                <SortHeader
                  label={t.crm.demandsCount}
                  active={sortKey === "demandsCount"}
                  dir={sortDir}
                  align="right"
                  onClick={() => toggleSort("demandsCount")}
                />
                <SortHeader
                  label={t.crm.demandsSum}
                  active={sortKey === "demandsSum"}
                  dir={sortDir}
                  align="right"
                  onClick={() => toggleSort("demandsSum")}
                />
                <SortHeader
                  label={t.crm.avgReceipt}
                  active={sortKey === "averageReceipt"}
                  dir={sortDir}
                  align="right"
                  onClick={() => toggleSort("averageReceipt")}
                />
                <SortHeader
                  label={t.crm.lastDemand}
                  active={sortKey === "lastDemandDate"}
                  dir={sortDir}
                  onClick={() => toggleSort("lastDemandDate")}
                />
                <SortHeader
                  label={t.crm.balance}
                  active={sortKey === "balance"}
                  dir={sortDir}
                  align="right"
                  onClick={() => toggleSort("balance")}
                />
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
