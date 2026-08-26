import { NextRequest, NextResponse } from "next/server";
import { getRestockAlerts, getLowMarginSalesAlerts, getUrgentOutOfStockAlerts } from "@/lib/reports";
import { sendTelegramMessage } from "@/lib/telegram";
import { formatRestockMessage, formatLowMarginMessage, formatOutOfStockMessage } from "@/lib/alertMessages";
import { todayYmd } from "@/lib/tashkent";

export const dynamic = "force-dynamic";

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
    const [restock, sales, outOfStock] = await Promise.all([
      getRestockAlerts(),
      getLowMarginSalesAlerts(0.25), // last 15 min — this fires right after the sale
      getUrgentOutOfStockAlerts(),
    ]);

    const newRestock = restock.filter((r) => shouldAlert(`stock:${r.name}`, today));
    if (newRestock.length > 0) {
      await sendTelegramMessage(formatRestockMessage(newRestock));
    }

    if (sales.length > 0) {
      await sendTelegramMessage(formatLowMarginMessage(sales));
    }

    const newOutOfStock = outOfStock.filter((r) => shouldAlert(`oos:${r.name}`, today));
    if (newOutOfStock.length > 0) {
      await sendTelegramMessage(formatOutOfStockMessage(newOutOfStock));
    }

    return NextResponse.json({
      ok: true,
      restock: newRestock.length,
      lowMarginSales: sales.length,
      outOfStock: newOutOfStock.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
