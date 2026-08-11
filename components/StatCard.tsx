import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function StatCard({
  icon: Icon,
  label,
  value,
  suffix,
  hint,
  accent = "brand",
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  suffix?: string;
  hint?: string;
  accent?: "brand" | "emerald" | "amber" | "rose";
}) {
  const accentClasses: Record<string, string> = {
    brand: "from-brand-400 to-brand-600",
    emerald: "from-emerald-400 to-emerald-600",
    amber: "from-amber-400 to-amber-600",
    rose: "from-rose-400 to-rose-600",
  };

  return (
    <div className="flex flex-col gap-3 rounded-3xl bg-white p-5 shadow-card">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-ink-500">{label}</span>
        <div
          className={`flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br text-white ${accentClasses[accent]}`}
        >
          <Icon size={16} />
        </div>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-2xl font-bold tracking-tight text-ink-900">{value}</span>
        {suffix && <span className="text-sm font-medium text-ink-400">{suffix}</span>}
      </div>
      {hint && <span className="text-xs text-ink-400">{hint}</span>}
    </div>
  );
}
