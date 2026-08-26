import { NextRequest, NextResponse } from "next/server";
import { getRestockAlerts, getLowMarginSalesAlerts, getUrgentOutOfStockAlerts, getOutOfStockRecentSellers } from "@/lib/reports";
import { sendTelegramMessage } from "@/lib/telegram";
import { formatLowMarginMessage, buildRestockPage, buildOosPage } from "@/lib/alertMessages";
import { todayYmd } from "@/lib/tashkent";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: NextRequest): boolean {
  const secret = process.env.MOYSKLAD_WEBHOOK_SECRET;
  if (!secret) return false;
  return req.nextUrl.searchParams.get("secret") === secret;
}

// Best-effort de-dup: at most one restock digest and one out-of-stock digest per
// day, not one per product — otherwise a busy day's worth of sales each re-sends
// the whole (barely-changed) list. First qualifying sale of the day triggers it;
// later sales that day stay quiet. Resets on cold start and isn't shared across
// instances, so an occasional repeat on the same day is possible, not a bug.
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
    const [restock, sales, urgentOutOfStock] = await Promise.all([
      getRestockAlerts(),
      getLowMarginSalesAlerts(0.25), // last 15 min — this fires right after the sale
      getUrgentOutOfStockAlerts(),
    ]);

    // One digest per day, not one per product — see shouldAlert above. The
    // message itself always shows the full current list, so its "Keyingisi ➡️"
    // pagination stays consistent with the bot buttons.
    const sendRestock = restock.length > 0 && shouldAlert("restock-digest", today);
    if (sendRestock) {
      const page = buildRestockPage(restock);
      await sendTelegramMessage(page.text, { replyMarkup: page.keyboard });
    }

    if (sales.length > 0) {
      await sendTelegramMessage(formatLowMarginMessage(sales));
    }

    const sendOutOfStock = urgentOutOfStock.length > 0 && shouldAlert("oos-digest", today);
    if (sendOutOfStock) {
      const allOutOfStock = await getOutOfStockRecentSellers();
      const page = buildOosPage(allOutOfStock);
      await sendTelegramMessage(page.text, { replyMarkup: page.keyboard });
    }

    return NextResponse.json({
      ok: true,
      restock: sendRestock ? restock.length : 0,
      lowMarginSales: sales.length,
      outOfStock: sendOutOfStock ? urgentOutOfStock.length : 0,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
