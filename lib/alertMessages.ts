import "server-only";
import { escapeHtml } from "./telegram";
import { formatMoney, formatCompactMoney, formatNumber } from "./format";
import type {
  RestockAlertRow,
  LowMarginSaleRow,
  OutOfStockRecentSellerRow,
  StockMoneyData,
  StockBucketProductRow,
  StockValueBucket,
} from "./reports";

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
    return (
      `${idx + 1}. <b>${escapeHtml(i.name)}</b>\n📉 Marja: <b>${(i.margin * 100).toFixed(1)}%</b>\n` +
      `🛒 Xarid narxi: <b>${formatMoney(i.unitCost)}</b> so'm\n💵 Sotuv narxi: <b>${formatMoney(i.unitPrice)}</b> so'm\n🧾 Chek: ${receipt}`
    );
  });
  const overflow = flat.length > limit ? `\n\n…yana ${flat.length - limit} ta pozitsiya` : "";
  return `🔻 <b>Past marjali sotuvlar (≤5%)</b>\n\n${entries.join("\n\n")}${overflow}`;
}

export function formatStockMoneyMessage(data: StockMoneyData): string {
  const lines = data.buckets.map((b) => `${b.label}: <b>${formatCompactMoney(b.value)}</b> so'm`);
  return `💰 <b>Ombor puli</b>\n\nJami tovar qiymati: <b>${formatCompactMoney(data.totalValue)}</b> so'm\n\n${lines.join("\n")}`;
}

export function formatStockBucketMessage(label: string, rows: StockBucketProductRow[], limit = 25): string {
  if (rows.length === 0) {
    return `${label}\n\nBu toifada mahsulot yo'q.`;
  }
  const shown = rows.slice(0, limit);
  const entries = shown.map((r, i) => {
    const days = r.daysOfStockLeft !== null ? `${Math.round(r.daysOfStockLeft)} kun` : "harakatsiz (sotuv yo'q)";
    return `${i + 1}. <b>${escapeHtml(r.name)}</b>\n📈 30 kunlik sotuv: <b>${formatNumber(r.qty30)}</b> dona\n📦 Zaxira: <b>${formatNumber(r.stock)}</b> dona\n⏳ Yetadi: <b>${days}</b>`;
  });
  const overflow = rows.length > limit ? `\n\n…yana ${rows.length - limit} ta mahsulot` : "";
  return `${label}\n\n${entries.join("\n\n")}${overflow}`;
}

export function stockBucketCallbackData(bucket: StockValueBucket): string {
  return `stock:${bucket}`;
}

export function parseStockBucketCallback(data: string): StockValueBucket | null {
  const m = /^stock:(fast|normal|slow|dead)$/.exec(data);
  return m ? (m[1] as StockValueBucket) : null;
}
