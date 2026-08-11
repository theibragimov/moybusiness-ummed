"use client";

import { useRouter, usePathname } from "next/navigation";
import { useLanguage } from "@/lib/i18n/context";

export function PeriodPicker({ from, to }: { from: string; to: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useLanguage();

  const update = (nextFrom: string, nextTo: string) => {
    router.push(`${pathname}?from=${nextFrom}&to=${nextTo}`);
  };

  return (
    <div className="flex items-center gap-2 rounded-full bg-surface px-3 py-1.5 text-sm">
      <span className="text-ink-400">{t.analytics.period}:</span>
      <input
        type="date"
        value={from}
        onChange={(e) => update(e.target.value, to)}
        className="rounded-lg bg-transparent px-1 py-0.5 text-ink-900 outline-none"
      />
      <span className="text-ink-300">—</span>
      <input
        type="date"
        value={to}
        onChange={(e) => update(from, e.target.value)}
        className="rounded-lg bg-transparent px-1 py-0.5 text-ink-900 outline-none"
      />
    </div>
  );
}
