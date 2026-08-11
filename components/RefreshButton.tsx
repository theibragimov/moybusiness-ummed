"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { refreshAllData, warmAllData } from "@/app/actions";
import { useLanguage } from "@/lib/i18n/context";

export function RefreshButton() {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { t } = useLanguage();

  const onClick = () => {
    startTransition(async () => {
      await refreshAllData();
      router.refresh();
      warmAllData().catch(() => {});
    });
  };

  return (
    <button
      onClick={onClick}
      disabled={isPending}
      title={isPending ? t.common.refreshing : t.common.refresh}
      className="flex h-9 items-center gap-1.5 rounded-full bg-surface px-3 text-xs font-semibold text-ink-500 transition-colors hover:text-ink-900 disabled:opacity-60"
    >
      <RefreshCw size={14} className={isPending ? "animate-spin" : ""} />
      <span className="hidden lg:inline">{isPending ? t.common.refreshing : t.common.refresh}</span>
    </button>
  );
}
