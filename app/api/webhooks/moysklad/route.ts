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

// Best-effort de-dup so a product already flagged today doesn't re-alert on every
// later sale in the same warm serverless instance. Resets on cold start and isn't
// shared across instances — occasional repeat alerts for the same item on the
// same day are expected, not a bug.
const alertedToday = new Map<string, string>();

function shouldAlert(key: string, today: string): boolean {
  if (alertedToday.get(key) === today) return false;
  alertedToday.set(key, today);
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

    // Dedup decides WHETHER to push (so the same item doesn't re-alert on every
    // later sale today); the message itself always shows the full current list,
    // so its "Keyingisi ➡️" pagination stays consistent with the bot buttons.
    const newRestock = restock.filter((r) => shouldAlert(`stock:${r.name}`, today));
    if (newRestock.length > 0) {
      const page = buildRestockPage(restock);
      await sendTelegramMessage(page.text, { replyMarkup: page.keyboard });
    }

    if (sales.length > 0) {
      await sendTelegramMessage(formatLowMarginMessage(sales));
    }

    const newUrgentOutOfStock = urgentOutOfStock.filter((r) => shouldAlert(`oos:${r.name}`, today));
    if (newUrgentOutOfStock.length > 0) {
      const allOutOfStock = await getOutOfStockRecentSellers();
      const page = buildOosPage(allOutOfStock);
      await sendTelegramMessage(page.text, { replyMarkup: page.keyboard });
    }

    return NextResponse.json({
      ok: true,
      restock: newRestock.length,
      lowMarginSales: sales.length,
      outOfStock: newUrgentOutOfStock.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
