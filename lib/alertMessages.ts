import "server-only";
import { escapeHtml } from "./telegram";
import { formatMoney, formatNumber } from "./format";
import type { RestockAlertRow, LowMarginSaleRow } from "./reports";

export function formatRestockMessage(rows: RestockAlertRow[], limit = 25): string {
  const shown = rows.slice(0, limit);
  const entries = shown.map((r, i) => {
    const stockLine =
      r.stock <= 0
        ? `tugagan (qoldiq: <b>${formatNumber(r.stock)}</b>)`
        : `qoldiq: <b>${formatNumber(r.stock)}</b> dona`;
    return `${i + 1}. <b>${escapeHtml(r.name)}</b>\n    ${stockLine} · 15 kunda: <b>${formatNumber(r.qty15)}</b> dona sotilgan`;
  });
  const overflow = rows.length > limit ? `\n\n…yana ${rows.length - limit} ta mahsulot` : "";
  return `⚠️ <b>Tugab qolayotgan, yaxshi sotiladigan mahsulotlar</b>\n\n${entries.join("\n\n")}${overflow}`;
}

export function formatLowMarginMessage(sales: LowMarginSaleRow[], limit = 25): string {
  const flat = sales.flatMap((s) => s.items.map((i) => ({ ...i, demandName: s.demandName, agent: s.agent })));
  const shown = flat.slice(0, limit);
  const entries = shown.map((i, idx) => {
    const receipt = `chek: ${escapeHtml(i.demandName)}${i.agent ? `, ${escapeHtml(i.agent)}` : ""}`;
    return `${idx + 1}. <b>${escapeHtml(i.name)}</b> — marja <b>${(i.margin * 100).toFixed(1)}%</b>\n    ${formatMoney(i.sum)} so'm · ${receipt}`;
  });
  const overflow = flat.length > limit ? `\n\n…yana ${flat.length - limit} ta pozitsiya` : "";
  return `🔻 <b>Past marjali sotuvlar (≤10%)</b>\n\n${entries.join("\n\n")}${overflow}`;
}
