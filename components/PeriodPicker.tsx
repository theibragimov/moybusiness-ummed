"use client";

import { useState, useTransition } from "react";
import { useRouter, usePathname } from "next/navigation";
import { CalendarRange } from "lucide-react";
import { useLanguage } from "@/lib/i18n/context";
import { Spinner } from "@/components/Spinner";

export function PeriodPicker({ from, to }: { from: string; to: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useLanguage();
  const [draftFrom, setDraftFrom] = useState(from);
  const [draftTo, setDraftTo] = useState(to);
  const [isPending, startTransition] = useTransition();

  const apply = () => {
    startTransition(() => {
      router.push(`${pathname}?from=${draftFrom}&to=${draftTo}`);
    });
  };

  return (
    <div className="flex w-full flex-wrap items-center gap-2 rounded-2xl border border-ink-100 bg-white p-1.5 shadow-card sm:w-auto">
      <div className="flex items-center gap-2 pl-2 text-ink-400">
        <CalendarRange size={16} className="shrink-0" />
        <span className="hidden text-sm sm:inline">{t.analytics.period}:</span>
      </div>
      <input
        type="date"
        value={draftFrom}
        onChange={(e) => setDraftFrom(e.target.value)}
        className="min-w-0 flex-1 rounded-xl bg-surface px-2 py-1.5 text-sm text-ink-900 outline-none sm:flex-none"
      />
      <span className="text-ink-300">—</span>
      <input
        type="date"
        value={draftTo}
        onChange={(e) => setDraftTo(e.target.value)}
        className="min-w-0 flex-1 rounded-xl bg-surface px-2 py-1.5 text-sm text-ink-900 outline-none sm:flex-none"
      />
      <button
        onClick={apply}
        disabled={isPending}
        className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand-500 px-3.5 py-1.5 text-sm font-medium text-white transition-colors hover:bg-brand-600 disabled:opacity-70 sm:flex-none"
      >
        {isPending ? <Spinner size={14} className="text-white" /> : null}
        {isPending ? t.analytics.applyingPeriod : t.analytics.applyPeriod}
      </button>
    </div>
  );
}
