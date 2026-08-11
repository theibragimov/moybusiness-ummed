"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDownCircle, ArrowUpCircle, Plus, Pencil, Trash2, Check, X } from "lucide-react";
import { useLanguage } from "@/lib/i18n/context";
import { formatNumber, fromMs } from "@/lib/format";
import { Card } from "@/components/Card";
import { StatCard } from "@/components/StatCard";
import { addManualDebtAction, updateManualDebtAction, deleteManualDebtAction } from "@/app/actions";
import type { DebtsData, CounterpartyRow } from "@/lib/reports";
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

export function CompanyView({ data, manualDebts }: { data: DebtsData; manualDebts: ManualDebt[] }) {
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard icon={ArrowDownCircle} label={t.company.totalDebtToUs} value={money(totalDebtToUs)} accent="rose" />
        <StatCard
          icon={ArrowUpCircle}
          label={t.company.totalDebtByUs}
          value={money(totalDebtByUs)}
          accent="emerald"
        />
      </div>

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
