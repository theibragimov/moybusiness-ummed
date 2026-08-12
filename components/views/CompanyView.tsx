"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  Wallet,
  TrendingUp,
  TrendingDown,
  ReceiptText,
  Boxes,
  PackageX,
  AlertTriangle,
  CircleCheck,
  CircleAlert,
  CircleX,
} from "lucide-react";
import { useLanguage } from "@/lib/i18n/context";
import { formatMoney, formatNumber, formatPercent, fromMs } from "@/lib/format";
import { Card } from "@/components/Card";
import { StatCard } from "@/components/StatCard";
import { addManualDebtAction, updateManualDebtAction, deleteManualDebtAction } from "@/app/actions";
import type { DebtsData, CounterpartyRow, CompanyHealth } from "@/lib/reports";
import type { ManualDebt, DebtDirection } from "@/lib/manualDebts";

interface MergedRow {
  key: string;
  name: string;
  lastActivity: string | null;
  amountSom: number;
  manual: boolean;
  manualId?: string;
}

function AddRow({
  direction,
  onDone,
}: {
  direction: DebtDirection;
  onDone: () => void;
}) {
  const { t } = useLanguage();
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [isPending, startTransition] = useTransition();

  const save = () => {
    const n = name.trim();
    const a = Number(amount);
    if (!n || !Number.isFinite(a) || a <= 0) return;
    startTransition(async () => {
      await addManualDebtAction(direction, n, a);
      onDone();
    });
  };

  return (
    <tr className="bg-brand-50/40">
      <td className="py-2 pr-2">
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t.company.namePlaceholder}
          className="w-full rounded-xl border border-brand-200 bg-white px-2.5 py-1.5 text-sm outline-none"
        />
      </td>
      <td className="py-2 pr-2 text-ink-400">—</td>
      <td className="py-2">
        <div className="flex items-center justify-end gap-1.5">
          <input
            type="number"
            min={0}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={t.company.amountPlaceholder}
            className="w-32 rounded-xl border border-brand-200 bg-white px-2.5 py-1.5 text-right text-sm outline-none"
          />
          <button
            onClick={save}
            disabled={isPending}
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500 text-white disabled:opacity-50"
          >
            <Check size={14} />
          </button>
          <button
            onClick={onDone}
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface text-ink-500"
          >
            <X size={14} />
          </button>
        </div>
      </td>
    </tr>
  );
}

function EditRow({ row, onDone }: { row: MergedRow; onDone: () => void }) {
  const { t } = useLanguage();
  const [name, setName] = useState(row.name);
  const [amount, setAmount] = useState(String(row.amountSom));
  const [isPending, startTransition] = useTransition();

  const save = () => {
    const n = name.trim();
    const a = Number(amount);
    if (!n || !Number.isFinite(a) || a <= 0 || !row.manualId) return;
    startTransition(async () => {
      await updateManualDebtAction(row.manualId!, n, a);
      onDone();
    });
  };

  return (
    <tr className="bg-brand-50/40">
      <td className="py-2 pr-2">
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-xl border border-brand-200 bg-white px-2.5 py-1.5 text-sm outline-none"
        />
      </td>
      <td className="py-2 pr-2 text-ink-400">—</td>
      <td className="py-2">
        <div className="flex items-center justify-end gap-1.5">
          <input
            type="number"
            min={0}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-32 rounded-xl border border-brand-200 bg-white px-2.5 py-1.5 text-right text-sm outline-none"
          />
          <button
            onClick={save}
            disabled={isPending}
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500 text-white disabled:opacity-50"
          >
            <Check size={14} />
          </button>
          <button
            onClick={onDone}
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface text-ink-500"
          >
            <X size={14} />
          </button>
        </div>
      </td>
    </tr>
  );
}

function DebtTable({
  direction,
  rows,
  money,
}: {
  direction: DebtDirection;
  rows: MergedRow[];
  money: (v: number) => string;
}) {
  const { t } = useLanguage();
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const finishMutation = () => {
    setAdding(false);
    setEditingId(null);
    router.refresh();
  };

  const remove = (manualId: string) => {
    if (!window.confirm(t.company.confirmDelete)) return;
    startTransition(async () => {
      await deleteManualDebtAction(manualId);
      router.refresh();
    });
  };

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
          {rows.slice(0, 100).map((r) =>
            editingId === r.manualId ? (
              <EditRow key={r.key} row={r} onDone={finishMutation} />
            ) : (
              <tr key={r.key}>
                <td className="py-2.5 max-w-[240px] truncate font-medium text-ink-900">
                  <span className="flex items-center gap-1.5">
                    {r.name}
                    {r.manual && (
                      <span className="shrink-0 rounded-full bg-brand-50 px-1.5 py-0.5 text-[10px] font-bold text-brand-600">
                        {t.company.manual}
                      </span>
                    )}
                  </span>
                </td>
                <td className="py-2.5 text-ink-500">{r.lastActivity?.slice(0, 10) ?? "—"}</td>
                <td className="py-2.5 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <span className="font-semibold text-ink-900">{money(r.amountSom)}</span>
                    {r.manual && (
                      <span className="flex shrink-0 items-center gap-1">
                        <button
                          onClick={() => setEditingId(r.manualId!)}
                          className="flex h-6 w-6 items-center justify-center rounded-lg text-ink-400 hover:bg-surface hover:text-ink-900"
                        >
                          <Pencil size={12} />
                        </button>
                        <button
                          onClick={() => remove(r.manualId!)}
                          className="flex h-6 w-6 items-center justify-center rounded-lg text-ink-400 hover:bg-rose-50 hover:text-rose-600"
                        >
                          <Trash2 size={12} />
                        </button>
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            )
          )}
          {adding && <AddRow direction={direction} onDone={finishMutation} />}
        </tbody>
      </table>
      {rows.length === 0 && !adding && (
        <p className="py-10 text-center text-sm text-ink-400">{t.common.noData}</p>
      )}
      {!adding && (
        <button
          onClick={() => setAdding(true)}
          className="mt-3 flex items-center gap-1.5 rounded-full bg-surface px-3.5 py-2 text-sm font-medium text-ink-500 hover:text-ink-900"
        >
          <Plus size={14} />
          {t.company.add}
        </button>
      )}
    </div>
  );
}

const VERDICT_STYLE = {
  good: { bg: "bg-emerald-50", text: "text-emerald-700", icon: CircleCheck },
  average: { bg: "bg-amber-50", text: "text-amber-700", icon: CircleAlert },
  bad: { bg: "bg-rose-50", text: "text-rose-700", icon: CircleX },
} as const;

function HealthSection({
  health,
  totalDebtToUs,
  totalDebtByUs,
  money,
}: {
  health: CompanyHealth;
  totalDebtToUs: number;
  totalDebtByUs: number;
  money: (v: number) => string;
}) {
  const { t, locale } = useLanguage();
  // health.* money fields come straight from MoySklad (x100 minor unit) and
  // haven't been pre-converted like the merged debt rows have, so they need
  // their own formatter that applies fromMs.
  const moneyRaw = (v: number) => `${formatMoney(v, locale)} ${t.common.sum}`;

  const verdictTitle =
    health.verdict === "good"
      ? t.company.verdictGoodTitle
      : health.verdict === "average"
        ? t.company.verdictAverageTitle
        : t.company.verdictBadTitle;
  const style = VERDICT_STYLE[health.verdict];
  const VerdictIcon = style.icon;

  const factorRows: { ok: boolean; goodKey: string; badKey: string }[] = [
    { ok: health.factors.margin !== "bad", goodKey: health.factors.margin === "good" ? "factorMarginGood" : "factorMarginOk", badKey: "factorMarginBad" },
    { ok: health.factors.growth === "good", goodKey: "factorGrowthGood", badKey: "factorGrowthBad" },
    { ok: health.factors.receivables === "good", goodKey: "factorReceivablesGood", badKey: "factorReceivablesBad" },
    { ok: health.factors.deadStock === "good", goodKey: "factorDeadStockGood", badKey: "factorDeadStockBad" },
    { ok: health.factors.stockouts === "good", goodKey: "factorStockoutsGood", badKey: "factorStockoutsBad" },
  ];

  const companyT = t.company as unknown as Record<string, string>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-ink-900">{t.company.healthTitle}</h2>
        <p className="mt-1 text-sm text-ink-500">{t.company.healthSubtitle}</p>
      </div>

      <div className={`rounded-3xl ${style.bg} p-5 shadow-card`}>
        <div className="flex items-center gap-2">
          <VerdictIcon size={22} className={style.text} />
          <h3 className={`text-lg font-bold ${style.text}`}>{verdictTitle}</h3>
        </div>
        <ul className="mt-3 space-y-1.5">
          {factorRows.map((f, i) => (
            <li key={i} className={`text-sm ${f.ok ? "text-ink-700" : "text-rose-700"}`}>
              {f.ok ? "✓ " : "✗ "}
              {companyT[f.ok ? f.goodKey : f.badKey]}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-ink-400">{t.company.verdictDisclaimer}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Wallet} label={t.company.cashPosition} value={moneyRaw(health.cashPosition)} accent="brand" />
        <StatCard icon={ArrowDownCircle} label={t.company.debitorQarz} value={money(totalDebtToUs)} accent="rose" />
        <StatCard icon={ArrowUpCircle} label={t.company.kreditorQarz} value={money(totalDebtByUs)} accent="emerald" />
        <StatCard icon={ReceiptText} label={t.company.revenue} value={moneyRaw(health.revenue)} accent="brand" />
        <StatCard
          icon={health.salesGrowth >= 0 ? TrendingUp : TrendingDown}
          label={t.company.salesGrowth}
          value={formatPercent(health.salesGrowth)}
          accent={health.salesGrowth >= 0 ? "emerald" : "rose"}
        />
        <StatCard icon={ReceiptText} label={t.company.averageCheck} value={moneyRaw(health.averageCheck)} accent="amber" />
        <StatCard
          icon={TrendingUp}
          label={t.dashboard.grossMargin}
          value={formatPercent(health.grossMargin)}
          accent="emerald"
        />
        <StatCard
          icon={health.netMargin >= 0 ? TrendingUp : TrendingDown}
          label={t.dashboard.netMargin}
          value={formatPercent(health.netMargin)}
          accent={health.netMargin >= 0 ? "emerald" : "rose"}
        />
        <StatCard icon={Boxes} label={t.company.stockValue} value={moneyRaw(health.stockValue)} accent="brand" />
        <StatCard
          icon={AlertTriangle}
          label={t.company.deadStock}
          value={formatNumber(health.deadStockCount, locale)}
          hint={moneyRaw(health.deadStockValue)}
          accent="amber"
        />
        <StatCard
          icon={PackageX}
          label={t.company.stockout}
          value={formatNumber(health.stockoutCount, locale)}
          accent="rose"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card title={t.company.topProfitableTitle}>
          <ul className="space-y-2.5">
            {health.topProfitable.map((p, i) => (
              <li key={i} className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate text-ink-700">{p.name}</span>
                <span className="shrink-0 font-semibold text-emerald-600">{moneyRaw(p.profit)}</span>
              </li>
            ))}
            {health.topProfitable.length === 0 && (
              <p className="py-4 text-center text-sm text-ink-400">{t.common.noData}</p>
            )}
          </ul>
        </Card>

        <Card title={t.company.lowMarginTitle}>
          <ul className="space-y-2.5">
            {health.lowMargin.map((p, i) => (
              <li key={i} className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate text-ink-700">{p.name}</span>
                <span className="shrink-0 font-semibold text-rose-600">{formatPercent(p.margin)}</span>
              </li>
            ))}
            {health.lowMargin.length === 0 && (
              <p className="py-4 text-center text-sm text-ink-400">{t.common.noData}</p>
            )}
          </ul>
        </Card>

        <Card title={t.company.expiringSoonTitle}>
          {health.expiryDetectedCount === 0 ? (
            <p className="py-4 text-center text-sm text-ink-400">{t.company.expiringNotDetected}</p>
          ) : (
            <>
              <ul className="space-y-2.5">
                {health.expiringSoon.map((p, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 text-sm">
                    <span className="truncate text-ink-700">{p.name}</span>
                    <span className="shrink-0 font-semibold text-amber-600">
                      {String(p.month).padStart(2, "0")}.{p.year}
                    </span>
                  </li>
                ))}
                {health.expiringSoon.length === 0 && (
                  <p className="py-4 text-center text-sm text-ink-400">{t.common.noData}</p>
                )}
              </ul>
              <p className="mt-3 text-xs text-ink-400">{t.company.expiringNote}</p>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

export function CompanyView({
  data,
  manualDebts,
  health,
}: {
  data: DebtsData;
  manualDebts: ManualDebt[];
  health: CompanyHealth;
}) {
  const { t, locale } = useLanguage();
  const money = (v: number) => `${formatNumber(v, locale)} ${t.common.sum}`;

  const toRows = (rows: CounterpartyRow[]): MergedRow[] =>
    rows.map((r) => ({
      key: `ms-${r.id}`,
      name: r.name,
      lastActivity: r.lastDemandDate,
      amountSom: fromMs(Math.abs(r.balance)),
      manual: false,
    }));

  const manualRows = (direction: DebtDirection): MergedRow[] =>
    manualDebts
      .filter((m) => m.direction === direction)
      .map((m) => ({
        key: `manual-${m.id}`,
        name: m.name,
        lastActivity: m.updatedAt,
        amountSom: m.amount,
        manual: true,
        manualId: m.id,
      }));

  const theyOweUs = [...toRows(data.theyOweUs), ...manualRows("theyOweUs")].sort(
    (a, b) => b.amountSom - a.amountSom
  );
  const weOweThem = [...toRows(data.weOweThem), ...manualRows("weOweThem")].sort(
    (a, b) => b.amountSom - a.amountSom
  );

  const totalDebtToUs = theyOweUs.reduce((s, r) => s + r.amountSom, 0);
  const totalDebtByUs = weOweThem.reduce((s, r) => s + r.amountSom, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink-900">{t.company.title}</h1>
        <p className="mt-1 text-sm text-ink-500">{t.company.subtitle}</p>
      </div>

      <HealthSection health={health} totalDebtToUs={totalDebtToUs} totalDebtByUs={totalDebtByUs} money={money} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title={t.company.theyOweUs}>
          <DebtTable direction="theyOweUs" rows={theyOweUs} money={money} />
        </Card>
        <Card title={t.company.weOweThem}>
          <DebtTable direction="weOweThem" rows={weOweThem} money={money} />
        </Card>
      </div>
    </div>
  );
}
