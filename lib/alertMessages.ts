import "server-only";
import { escapeHtml, type InlineKeyboard } from "./telegram";
import { formatMoney, formatCompactMoney, formatNumber } from "./format";
import type {
  RestockAlertRow,
  LowMarginSaleRow,
  OutOfStockRecentSellerRow,
  LowMarginProductRow,
  StockMoneyData,
  StockBucketProductRow,
  StockValueBucket,
  DebtorRow,
} from "./reports";
import { dayOf } from "./tashkent";

export const PAGE_SIZE = 25;

export type PageKind = "restock" | "oos" | "lowmargin" | "bucket" | "debtor30" | "debtor3mo";

export interface Page {
  text: string;
  keyboard?: InlineKeyboard;
}

/** Encodes which list + how far into it a "Keyingisi ➡️" button should continue from. */
export function encodePageCallback(kind: PageKind, param: string, offset: number): string {
  return `pg:${kind}:${param}:${offset}`;
}

export function parsePageCallback(data: string): { kind: PageKind; param: string; offset: number } | null {
  const m = /^pg:(restock|oos|lowmargin|bucket|debtor30|debtor3mo):([a-z-]+):(\d+)$/.exec(data);
  if (!m) return null;
  return { kind: m[1] as PageKind, param: m[2], offset: Number(m[3]) };
}

/**
 * Builds one page of a numbered list: absolute numbering continues across pages
 * (26, 27, … not restarting at 1), and a "Keyingisi ➡️" button appears only when
 * more rows remain, encoding where the next page should pick up.
 */
function buildPage<T>(
  header: string,
  emptyText: string,
  rows: T[],
  offset: number,
  formatItem: (row: T, absoluteIndex: number) => string,
  kind: PageKind,
  param: string
): Page {
  if (rows.length === 0) {
    return { text: `${header}\n\n${emptyText}` };
  }
  const slice = rows.slice(offset, offset + PAGE_SIZE);
  const entries = slice.map((r, i) => formatItem(r, offset + i + 1));
  const rangeEnd = offset + slice.length;
  const rangeLabel = rows.length > PAGE_SIZE ? ` (${offset + 1}-${rangeEnd} / ${rows.length})` : "";
  const text = `${header}${rangeLabel}\n\n${entries.join("\n\n")}`;
  const hasMore = rangeEnd < rows.length;
  const keyboard: InlineKeyboard | undefined = hasMore
    ? { inline_keyboard: [[{ text: "Keyingisi ➡️", callback_data: encodePageCallback(kind, param, rangeEnd) }]] }
    : undefined;
  return { text, keyboard };
}

const RESTOCK_HEADER = "⚠️ <b>Tugab qolayotgan, yaxshi sotiladigan mahsulotlar</b>";

export function buildRestockPage(rows: RestockAlertRow[], offset = 0): Page {
  // Most urgent first: highest recent sales pace outrunning stock by the widest margin.
  const sorted = [...rows].sort((a, b) => b.qty15 - b.stock - (a.qty15 - a.stock));
  return buildPage(
    RESTOCK_HEADER,
    "Hozircha tugab qolayotgan mahsulot yo'q.",
    sorted,
    offset,
    (r, i) => {
      const stockLine =
        r.stock <= 0
          ? `📦 Qoldiq: <b>tugagan</b> (${formatNumber(r.stock)} dona)`
          : `📦 Qoldiq: <b>${formatNumber(r.stock)}</b> dona`;
      return `${i}. <b>${escapeHtml(r.name)}</b>\n${stockLine}\n📈 15 kunlik sotuv: <b>${formatNumber(r.qty15)}</b> dona`;
    },
    "restock",
    "-"
  );
}

const OOS_HEADER = "🚫 <b>Tugagan, lekin so'nggi 10 kunda sotilgan mahsulotlar</b>";

export function buildOosPage(rows: OutOfStockRecentSellerRow[], offset = 0): Page {
  return buildPage(
    OOS_HEADER,
    "Hozircha tugagan, lekin so'nggi 10 kunda sotilgan mahsulot yo'q.",
    rows,
    offset,
    (r, i) => `${i}. <b>${escapeHtml(r.name)}</b>\n📦 Qoldiq: <b>${formatNumber(r.stock)}</b>\n📈 10 kunlik sotuv: <b>${formatNumber(r.qty10)}</b> dona`,
    "oos",
    "-"
  );
}

const LOW_MARGIN_PRODUCTS_HEADER = "📉 <b>Past marjali mahsulotlar (&lt;15%)</b>";

export function buildLowMarginProductsPage(rows: LowMarginProductRow[], offset = 0): Page {
  return buildPage(
    LOW_MARGIN_PRODUCTS_HEADER,
    "Hozircha past marjali mahsulot yo'q.",
    rows,
    offset,
    (r, i) => `${i}. <b>${escapeHtml(r.name)}</b>\n📉 Marja: <b>${(r.margin * 100).toFixed(1)}%</b>\n📦 Sotilgan (30 kun): <b>${formatNumber(r.qty)}</b> dona`,
    "lowmargin",
    "-"
  );
}

export function buildStockBucketPage(bucket: StockValueBucket, label: string, rows: StockBucketProductRow[], offset = 0): Page {
  return buildPage(
    label,
    "Bu toifada mahsulot yo'q.",
    rows,
    offset,
    (r, i) => {
      const days = r.daysOfStockLeft !== null ? `${Math.round(r.daysOfStockLeft)} kun` : "harakatsiz (sotuv yo'q)";
      return `${i}. <b>${escapeHtml(r.name)}</b>\n📈 30 kunlik sotuv: <b>${formatNumber(r.qty30)}</b> dona\n📦 Zaxira: <b>${formatNumber(r.stock)}</b> dona\n⏳ Yetadi: <b>${days}</b>`;
    },
    "bucket",
    bucket
  );
}

function debtorEntry(r: DebtorRow, i: number): string {
  const paid = r.lastPaymentDate ? dayOf(r.lastPaymentDate) : "hech qachon";
  const bought = r.lastDemandDate ? dayOf(r.lastDemandDate) : "hech qachon";
  return (
    `${i}. <b>${escapeHtml(r.name)}</b>${r.phone ? ` (${escapeHtml(r.phone)})` : ""}\n` +
    `💸 Qarz: <b>${formatMoney(Math.abs(r.balance))}</b> so'm\n📅 Oxirgi to'lov: <b>${paid}</b>\n🛒 Oxirgi xarid: <b>${bought}</b>`
  );
}

const DEBTOR_30D_HEADER = "🕐 <b>So'nggi 30 kunda to'lov qilmagan qarzdorlar</b>";

export function buildDebtor30Page(rows: DebtorRow[], offset = 0): Page {
  return buildPage(DEBTOR_30D_HEADER, "Hozircha bunday qarzdor yo'q.", rows, offset, debtorEntry, "debtor30", "-");
}

const DEBTOR_3MO_HEADER = "💤 <b>Qarzdor, 3 oydan beri to'lov ham, xarid ham yo'q</b>";

export function buildDebtor3moPage(rows: DebtorRow[], offset = 0): Page {
  return buildPage(DEBTOR_3MO_HEADER, "Hozircha bunday qarzdor yo'q.", rows, offset, debtorEntry, "debtor3mo", "-");
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
