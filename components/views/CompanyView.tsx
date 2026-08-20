"use client";

import {
  ArrowDownCircle,
  ArrowUpCircle,
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
  Landmark,
  Banknote,
  Sparkles,
  Percent,
  Target,
} from "lucide-react";
import { useLanguage } from "@/lib/i18n/context";
import { formatMoney, formatNumber, formatPercent } from "@/lib/format";
import { Card } from "@/components/Card";
import { StatCard } from "@/components/StatCard";
import { PeriodPicker } from "@/components/PeriodPicker";
import type { DebtsData, CompanyHealth, NetProfitData } from "@/lib/reports";

function CashSection({ health, totalDebtByUs }: { health: CompanyHealth; totalDebtByUs: number }) {
  const { t, locale } = useLanguage();
  const moneyRaw = (v: number) => `${formatMoney(v, locale)} ${t.common.sum}`;

  const availableCash = health.bankBalance + health.kassaBalance;
  const freeCash = availableCash - totalDebtByUs;

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-lg font-bold text-ink-900">{t.company.cashSectionTitle}</h2>
        <p className="mt-1 text-sm text-ink-500">{t.company.cashSectionSubtitle}</p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Landmark} label={t.company.bankMoney} value={moneyRaw(health.bankBalance)} accent="brand" />
        <StatCard icon={Banknote} label={t.company.kassaMoney} value={moneyRaw(health.kassaBalance)} accent="brand" />
        <StatCard
          icon={AlertTriangle}
          label={t.company.upcomingObligations}
          value={moneyRaw(totalDebtByUs)}
          hint={t.company.upcomingObligationsHint}
          accent="amber"
        />
        <StatCard
          icon={Sparkles}
          label={t.company.freeCash}
          value={moneyRaw(freeCash)}
          hint={t.company.freeCashHint}
          accent={freeCash >= 0 ? "emerald" : "rose"}
        />
      </div>
    </div>
  );
}

function NetProfitSection({ data }: { data: NetProfitData }) {
  const { t, locale } = useLanguage();
  const moneyRaw = (v: number) => `${formatMoney(v, locale)} ${t.common.sum}`;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-ink-900">{t.company.netProfitSectionTitle}</h2>
          <p className="mt-1 text-sm text-ink-500">{t.company.netProfitFormula}</p>
        </div>
        <PeriodPicker from={data.from} to={data.to} />
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-3xl bg-white p-5 text-sm shadow-card">
        <span className="font-semibold text-ink-900">{moneyRaw(data.revenue)}</span>
        <span className="text-ink-400">({t.company.netProfitFormulaRevenue})</span>
        <span className="text-ink-300">−</span>
        <span className="font-semibold text-ink-900">{moneyRaw(data.cogs)}</span>
        <span className="text-ink-400">({t.company.netProfitFormulaCogs})</span>
        <span className="text-ink-300">−</span>
        <span className="font-semibold text-ink-900">{moneyRaw(data.opex)}</span>
        <span className="text-ink-400">({t.company.netProfitFormulaOpex})</span>
        <span className="text-ink-300">=</span>
        <span className={`font-bold ${data.netProfit >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
          {moneyRaw(data.netProfit)}
        </span>
        <span className="text-ink-400">({t.company.netProfitFormulaResult})</span>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          icon={data.netProfit >= 0 ? TrendingUp : TrendingDown}
          label={t.company.mtdNetProfit}
          value={moneyRaw(data.netProfit)}
          hint={`${data.from} — ${data.to}`}
          accent={data.netProfit >= 0 ? "emerald" : "rose"}
        />
        <StatCard
          icon={Percent}
          label={t.company.netMarginPercent}
          value={formatPercent(data.netMargin)}
          accent={data.netMargin >= 0 ? "emerald" : "rose"}
        />
        <StatCard
          icon={Target}
          label={t.company.budgetVsActual}
          value={formatPercent(data.budgetUsage)}
          hint={`${t.company.budgetVsActualHint}: ${moneyRaw(data.budgetAvg)}`}
          accent={data.netProfit >= data.budgetAvg ? "emerald" : "amber"}
        />
      </div>
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
}: {
  health: CompanyHealth;
  totalDebtToUs: number;
  totalDebtByUs: number;
}) {
  const { t, locale } = useLanguage();
  // health.* money fields, and the debt totals, come straight from MoySklad
  // (x100 minor unit) and need fromMs applied — formatMoney does that internally.
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
        <StatCard icon={ArrowDownCircle} label={t.company.debitorQarz} value={moneyRaw(totalDebtToUs)} accent="rose" />
        <StatCard icon={ArrowUpCircle} label={t.company.kreditorQarz} value={moneyRaw(totalDebtByUs)} accent="emerald" />
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
  health,
  netProfit,
}: {
  data: DebtsData;
  health: CompanyHealth;
  netProfit: NetProfitData;
}) {
  const { t } = useLanguage();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink-900">{t.company.title}</h1>
        <p className="mt-1 text-sm text-ink-500">{t.company.subtitle}</p>
      </div>

      <CashSection health={health} totalDebtByUs={data.totalDebtByUs} />

      <NetProfitSection data={netProfit} />

      <HealthSection health={health} totalDebtToUs={data.totalDebtToUs} totalDebtByUs={data.totalDebtByUs} />
    </div>
  );
}
