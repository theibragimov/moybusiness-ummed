"use client";

import { ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import { useLanguage } from "@/lib/i18n/context";
import { formatMoney } from "@/lib/format";
import { Card } from "@/components/Card";
import { StatCard } from "@/components/StatCard";
import type { DebtsData, CounterpartyRow } from "@/lib/reports";

function DebtTable({ rows, money }: { rows: CounterpartyRow[]; money: (v: number) => string }) {
  const { t } = useLanguage();
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[420px] text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-ink-400">
            <th className="pb-2 font-medium">{t.company.counterparty}</th>
            <th className="pb-2 font-medium">{t.company.lastActivity}</th>
            <th className="pb-2 text-right font-medium">{t.company.debt}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-surface">
          {rows.slice(0, 100).map((r) => (
            <tr key={r.id}>
              <td className="py-2.5 max-w-[240px] truncate font-medium text-ink-900">{r.name}</td>
              <td className="py-2.5 text-ink-500">{r.lastDemandDate?.slice(0, 10) ?? "—"}</td>
              <td className="py-2.5 text-right font-semibold text-ink-900">{money(Math.abs(r.balance))}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && <p className="py-10 text-center text-sm text-ink-400">{t.common.noData}</p>}
    </div>
  );
}

export function CompanyView({ data }: { data: DebtsData }) {
  const { t, locale } = useLanguage();
  const money = (v: number) => `${formatMoney(v, locale)} ${t.common.sum}`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink-900">{t.company.title}</h1>
        <p className="mt-1 text-sm text-ink-500">{t.company.subtitle}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard
          icon={ArrowDownCircle}
          label={t.company.totalDebtToUs}
          value={money(data.totalDebtToUs)}
          accent="rose"
        />
        <StatCard
          icon={ArrowUpCircle}
          label={t.company.totalDebtByUs}
          value={money(data.totalDebtByUs)}
          accent="emerald"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title={t.company.theyOweUs}>
          <DebtTable rows={data.theyOweUs} money={money} />
        </Card>
        <Card title={t.company.weOweThem}>
          <DebtTable rows={data.weOweThem} money={money} />
        </Card>
      </div>
    </div>
  );
}
