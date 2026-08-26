import { NextRequest, NextResponse } from "next/server";
import {
  getLowMarginSalesAlerts,
  getUrgentOutOfStockAlerts,
  getOutOfStockRecentSellers,
  getJustSoldOutProducts,
} from "@/lib/reports";
import { sendTelegramMessage, escapeHtml } from "@/lib/telegram";
import { formatLowMarginMessage, buildOosPage } from "@/lib/alertMessages";
import { formatNumber } from "@/lib/format";
import { todayYmd } from "@/lib/tashkent";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: NextRequest): boolean {
  const secret = process.env.MOYSKLAD_WEBHOOK_SECRET;
  if (!secret) return false;
  return req.nextUrl.searchParams.get("secret") === secret;
}

// Best-effort de-dup: at most one out-of-stock digest per day, not one per
// product — otherwise a busy day's worth of sales each re-sends the whole
// (barely-changed) list. First qualifying sale of the day triggers it; later
// sales that day stay quiet. Resets on cold start and isn't shared across
// instances, so an occasional repeat on the same day is possible, not a bug.
// The restock ("⚠️ Tugab qolayotgan") check used to live here too, firing on
// every sale — moved out entirely; it now only runs from the daily cron
// (see app/api/cron/telegram/route.ts), so it can't send more than once a day.
const sentToday = new Map<string, string>();

function shouldAlert(key: string, today: string): boolean {
  if (sentToday.get(key) === today) return false;
  sentToday.set(key, today);
  return true;
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  // The webhook body's exact shape varies by MoySklad entity/action; we only use
  // it as a "something changed" trigger and re-check live state ourselves,
  // so there's nothing to parse from it.
  await req.text().catch(() => "");

  const today = todayYmd();
  try {
    const [sales, urgentOutOfStock, justSoldOut] = await Promise.all([
      getLowMarginSalesAlerts(0.25), // last 15 min — this fires right after the sale
      getUrgentOutOfStockAlerts(),
      getJustSoldOutProducts(),
    ]);

    if (sales.length > 0) {
      await sendTelegramMessage(formatLowMarginMessage(sales));
    }

    const sendOutOfStock = urgentOutOfStock.length > 0 && shouldAlert("oos-digest", today);
    if (sendOutOfStock) {
      const allOutOfStock = await getOutOfStockRecentSellers();
      const page = buildOosPage(allOutOfStock);
      await sendTelegramMessage(page.text, { replyMarkup: page.keyboard });
    }

    // Fires the instant a sale empties a product, at most once per product per day
    // (see `shouldAlert`) — a later sale of the same already-empty product the same
    // day stays quiet instead of re-alerting.
    const newlyOut = justSoldOut.filter((r) => shouldAlert(`zero-stock:${r.name}`, today));
    if (newlyOut.length > 0) {
      const lines = newlyOut
        .map((r) => `⛔ <b>${escapeHtml(r.name)}</b> — qoldiq: <b>${formatNumber(r.stock)}</b>`)
        .join("\n");
      await sendTelegramMessage(`🔔 <b>Hozirgina tugadi</b>\n\n${lines}`);
    }

    return NextResponse.json({
      ok: true,
      lowMarginSales: sales.length,
      outOfStock: sendOutOfStock ? urgentOutOfStock.length : 0,
      justSoldOut: newlyOut.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
