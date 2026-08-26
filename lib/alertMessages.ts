import "server-only";
import { escapeHtml } from "./telegram";
import { formatMoney, formatNumber } from "./format";
import type { RestockAlertRow, LowMarginSaleRow, OutOfStockRecentSellerRow } from "./reports";

export function formatRestockMessage(rows: RestockAlertRow[], limit = 25): string {
  // Most urgent first: highest recent sales pace outrunning stock by the widest margin.
  const sorted = [...rows].sort((a, b) => b.qty15 - b.stock - (a.qty15 - a.stock));
  const shown = sorted.slice(0, limit);
  const entries = shown.map((r, i) => {
    const stockLine =
      r.stock <= 0
        ? `📦 Qoldiq: <b>tugagan</b> (${formatNumber(r.stock)} dona)`
        : `📦 Qoldiq: <b>${formatNumber(r.stock)}</b> dona`;
    return `${i + 1}. <b>${escapeHtml(r.name)}</b>\n${stockLine}\n📈 15 kunlik sotuv: <b>${formatNumber(r.qty15)}</b> dona`;
  });
  const overflow = rows.length > limit ? `\n\n…yana ${rows.length - limit} ta mahsulot` : "";
  return `⚠️ <b>Tugab qolayotgan, yaxshi sotiladigan mahsulotlar</b>\n\n${entries.join("\n\n")}${overflow}`;
}

export function formatOutOfStockMessage(rows: OutOfStockRecentSellerRow[], limit = 25): string {
  if (rows.length === 0) {
    return "✅ Hozircha tugagan, lekin so'nggi 10 kunda sotilgan mahsulot yo'q.";
  }
  const shown = rows.slice(0, limit);
  const entries = shown.map(
    (r, i) =>
      `${i + 1}. <b>${escapeHtml(r.name)}</b>\n📦 Qoldiq: <b>${formatNumber(r.stock)}</b>\n📈 10 kunlik sotuv: <b>${formatNumber(r.qty10)}</b> dona`
  );
  const overflow = rows.length > limit ? `\n\n…yana ${rows.length - limit} ta mahsulot` : "";
  return `🚫 <b>Tugagan, lekin so'nggi 10 kunda sotilgan mahsulotlar</b>\n\n${entries.join("\n\n")}${overflow}`;
}

export function formatLowMarginMessage(sales: LowMarginSaleRow[], limit = 25): string {
  const flat = sales.flatMap((s) => s.items.map((i) => ({ ...i, demandName: s.demandName, agent: s.agent })));
  const shown = flat.slice(0, limit);
  const entries = shown.map((i, idx) => {
    const receipt = `${escapeHtml(i.demandName)}${i.agent ? `, ${escapeHtml(i.agent)}` : ""}`;
    return `${idx + 1}. <b>${escapeHtml(i.name)}</b>\n📉 Marja: <b>${(i.margin * 100).toFixed(1)}%</b>\n💵 Summa: <b>${formatMoney(i.sum)}</b> so'm\n🧾 Chek: ${receipt}`;
  });
  const overflow = flat.length > limit ? `\n\n…yana ${flat.length - limit} ta pozitsiya` : "";
  return `🔻 <b>Past marjali sotuvlar (≤10%)</b>\n\n${entries.join("\n\n")}${overflow}`;
}
