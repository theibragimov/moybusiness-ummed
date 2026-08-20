"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { fromMs, formatNumber } from "@/lib/format";
import { useLanguage } from "@/lib/i18n/context";

// Warm palette (expenses read as "money going out" — distinct from the blue used for sales)
const COLORS = ["#dc2626", "#f97316", "#f59e0b", "#fb923c", "#facc15", "#ea580c", "#b91c1c"];

export function CategoryPie({ data }: { data: { category: string; sum: number }[] }) {
  const { locale, t } = useLanguage();
  const top = data.slice(0, 7);

  return (
    <div className="flex items-center gap-4">
      <ResponsiveContainer width={96} height={96}>
        <PieChart>
          <Pie
            data={top}
            dataKey="sum"
            nameKey="category"
            innerRadius={28}
            outerRadius={44}
            paddingAngle={2}
            strokeWidth={0}
          >
            {top.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ borderRadius: 16, border: "none", boxShadow: "0 8px 24px rgba(30,45,90,0.12)" }}
            formatter={(value: number) => [
              `${formatNumber(fromMs(value), locale)} ${t.common.sum}`,
              "",
            ]}
          />
        </PieChart>
      </ResponsiveContainer>
      <ul className="flex-1 space-y-1.5">
        {top.map((c, i) => (
          <li key={c.category} className="flex items-center justify-between gap-2 text-xs">
            <span className="flex items-center gap-1.5 truncate text-ink-500">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ background: COLORS[i % COLORS.length] }}
              />
              <span className="truncate">{c.category}</span>
            </span>
            <span className="shrink-0 font-semibold text-ink-900">
              {formatNumber(fromMs(c.sum), locale)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
