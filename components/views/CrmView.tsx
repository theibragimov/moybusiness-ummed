"use client";

import { useMemo, useState } from "react";
import { Search, ChevronUp, ChevronDown, Users, Truck, IdCard } from "lucide-react";
import { useLanguage } from "@/lib/i18n/context";
import { formatMoney, formatNumber, formatPercent } from "@/lib/format";
import { Card } from "@/components/Card";
import { StatCard } from "@/components/StatCard";
import { PeriodPicker } from "@/components/PeriodPicker";
import type { CounterpartyRow, CounterpartySegment, CustomerAbcData } from "@/lib/reports";

type Tab = "customers" | "suppliers" | "employees" | "abc" | "inactive";
type SortKey = "name" | "demandsCount" | "demandsSum" | "averageReceipt" | "lastDemandDate" | "balance";
type SortDir = "asc" | "desc";
type AbcFilter = "all" | "A" | "B" | "C";

const DEFAULT_DIR: Record<SortKey, SortDir> = {
  name: "asc",
  demandsCount: "desc",
  demandsSum: "desc",
  averageReceipt: "desc",
  lastDemandDate: "desc",
  balance: "desc",
};

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

function CounterpartyTable({ rows }: { rows: CounterpartyRow[] }) {
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
    <>
      <div className="mb-4 flex items-center gap-2 rounded-full bg-white px-4 py-2.5 shadow-card">
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
    </>
  );
}

function AbcSection({ data, from, to }: { data: CustomerAbcData; from: string; to: string }) {
  const { t, locale } = useLanguage();
  const [abcFilter, setAbcFilter] = useState<AbcFilter>("all");
  const money = (v: number) => `${formatMoney(v, locale)} ${t.common.sum}`;

  const rows = abcFilter === "all" ? data.rows : data.rows.filter((r) => r.group === abcFilter);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-ink-900">{t.crm.abcTitle}</h2>
          <p className="mt-1 text-sm text-ink-500">{t.crm.abcSubtitle}</p>
        </div>
        <PeriodPicker from={from} to={to} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-3xl bg-white p-5 shadow-card sm:col-span-3">
          <p className="text-xs text-ink-400">{t.crm.abcTotalRevenue}</p>
          <p className="mt-1 text-2xl font-bold text-ink-900">{money(data.totalRevenue)}</p>
        </div>
        {data.summary.map((g) => (
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
              <span className="text-xs text-ink-400">
                {formatNumber(g.count, locale)} {t.crm.customersUnit}
              </span>
            </div>
            <p className="mt-3 text-2xl font-bold text-ink-900">{formatPercent(g.revenueShare)}</p>
            <p className="text-xs text-ink-400">{t.analytics.share}</p>
          </button>
        ))}
        <p className="sm:col-span-3 text-xs text-ink-400">{t.crm.abcHint}</p>
      </div>

      {abcFilter !== "all" && (
        <button
          onClick={() => setAbcFilter("all")}
          className="rounded-full bg-white px-4 py-2.5 text-sm font-medium text-ink-500 shadow-card hover:text-ink-900"
        >
          {t.analytics.filterAll}
        </button>
      )}

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-ink-400">
                <th className="pb-2 font-medium">#</th>
                <th className="pb-2 font-medium">{t.crm.name}</th>
                <th className="pb-2 text-right font-medium">{t.crm.revenue}</th>
                <th className="pb-2 text-right font-medium">{t.crm.share}</th>
                <th className="pb-2 text-right font-medium">{t.crm.cumulative}</th>
                <th className="pb-2 text-right font-medium">{t.crm.group}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface">
              {rows.map((r, i) => (
                <tr key={r.id} className={GROUP_ROW[r.group]}>
                  <td className="py-2.5 pl-3 text-ink-400">{i + 1}</td>
                  <td className="py-2.5 max-w-[280px] truncate font-medium text-ink-900">{r.name}</td>
                  <td className="py-2.5 text-right font-semibold text-ink-900">{money(r.revenue)}</td>
                  <td className="py-2.5 text-right text-ink-700">{formatPercent(r.share)}</td>
                  <td className="py-2.5 text-right text-ink-700">{formatPercent(r.cumulative)}</td>
                  <td className="py-2.5 pr-3 text-right">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${GROUP_BADGE[r.group]}`}>
                      {r.group}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && <p className="py-10 text-center text-sm text-ink-400">{t.crm.noCustomersInPeriod}</p>}
        </div>
      </Card>
    </div>
  );
}

function daysBetween(a: string, b: string): number {
  const d1 = new Date(`${a}T00:00:00Z`).getTime();
  const d2 = new Date(`${b}T00:00:00Z`).getTime();
  return Math.round((d2 - d1) / 86400000);
}

function InactiveSection({
  customers,
  today,
  oneMonthAgo,
}: {
  customers: CounterpartyRow[];
  today: string;
  oneMonthAgo: string;
}) {
  const { t, locale } = useLanguage();
  const money = (v: number) => `${formatMoney(v, locale)} ${t.common.sum}`;

  const rows = useMemo(
    () =>
      customers
        .filter((c) => c.lastDemandDate && c.lastDemandDate.slice(0, 10) < oneMonthAgo)
        .sort((a, b) => (a.lastDemandDate ?? "").localeCompare(b.lastDemandDate ?? "")),
    [customers, oneMonthAgo]
  );

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-ink-900">{t.crm.inactiveTitle}</h2>
        <p className="mt-1 text-sm text-ink-500">{t.crm.inactiveSubtitle}</p>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-ink-400">
                <th className="pb-2 font-medium">{t.crm.name}</th>
                <th className="pb-2 font-medium">{t.crm.lastDemand}</th>
                <th className="pb-2 text-right font-medium">{t.crm.daysSincePurchase}</th>
                <th className="pb-2 text-right font-medium">{t.crm.balance}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="py-2.5 max-w-[280px] truncate font-medium text-ink-900">{r.name}</td>
                  <td className="py-2.5 text-ink-500">{r.lastDemandDate?.slice(0, 10)}</td>
                  <td className="py-2.5 text-right text-ink-700">
                    {formatNumber(daysBetween(r.lastDemandDate!.slice(0, 10), today), locale)}
                  </td>
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
          {rows.length === 0 && <p className="py-10 text-center text-sm text-ink-400">{t.common.noData}</p>}
        </div>
      </Card>
    </div>
  );
}

export function CrmView({
  rows,
  abc,
  from,
  to,
  today,
  oneMonthAgo,
}: {
  rows: CounterpartyRow[];
  abc: CustomerAbcData;
  from: string;
  to: string;
  today: string;
  oneMonthAgo: string;
}) {
  const { t, locale } = useLanguage();
  const [tab, setTab] = useState<Tab>("customers");

  const bySegment = (segment: CounterpartySegment) => rows.filter((r) => r.segment === segment);
  const customers = useMemo(() => bySegment("customer"), [rows]);
  const suppliers = useMemo(() => bySegment("supplier"), [rows]);
  const employees = useMemo(() => bySegment("employee"), [rows]);

  const tabs: { key: Tab; label: string }[] = [
    { key: "customers", label: t.crm.customersTab },
    { key: "suppliers", label: t.crm.suppliersTab },
    { key: "employees", label: t.crm.employeesTab },
    { key: "abc", label: t.crm.abcTab },
    { key: "inactive", label: t.crm.inactiveTab },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink-900">{t.crm.title}</h1>
        <p className="mt-1 text-sm text-ink-500">{t.crm.subtitle}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard icon={Users} label={t.crm.totalCustomers} value={formatNumber(customers.length, locale)} accent="brand" />
        <StatCard icon={Truck} label={t.crm.totalSuppliers} value={formatNumber(suppliers.length, locale)} accent="amber" />
        <StatCard icon={IdCard} label={t.crm.totalEmployees} value={formatNumber(employees.length, locale)} accent="emerald" />
      </div>

      <div className="flex flex-wrap gap-2 rounded-full bg-white p-1.5 shadow-card">
        {tabs.map((tb) => (
          <button
            key={tb.key}
            onClick={() => setTab(tb.key)}
            className={`shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              tab === tb.key ? "bg-brand-500 text-white shadow-soft" : "text-ink-500 hover:bg-surface"
            }`}
          >
            {tb.label}
          </button>
        ))}
      </div>

      {tab === "customers" && <CounterpartyTable rows={customers} />}
      {tab === "suppliers" && <CounterpartyTable rows={suppliers} />}
      {tab === "employees" && <CounterpartyTable rows={employees} />}
      {tab === "abc" && <AbcSection data={abc} from={from} to={to} />}
      {tab === "inactive" && <InactiveSection customers={customers} today={today} oneMonthAgo={oneMonthAgo} />}
    </div>
  );
}
