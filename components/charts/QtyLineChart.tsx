"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatNumber } from "@/lib/format";
import { useLanguage } from "@/lib/i18n/context";

export function QtyLineChart({
  data,
  color,
  gradientId,
}: {
  data: { label: string; qty: number }[];
  color: string;
  gradientId: string;
}) {
  const { locale } = useLanguage();

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="#eef1f8" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "#94a0b8", fontSize: 11 }} />
        <YAxis tickLine={false} axisLine={false} tick={{ fill: "#94a0b8", fontSize: 12 }} width={40} />
        <Tooltip
          contentStyle={{ borderRadius: 16, border: "none", boxShadow: "0 8px 24px rgba(30,45,90,0.12)" }}
          formatter={(value: number) => [formatNumber(value, locale), ""]}
        />
        <Area type="monotone" dataKey="qty" stroke={color} strokeWidth={2.5} fill={`url(#${gradientId})`} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
