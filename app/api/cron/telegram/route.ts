import { NextRequest, NextResponse } from "next/server";
import { getRestockAlerts, getLowMarginSalesAlerts, getUrgentOutOfStockAlerts, getOutOfStockRecentSellers } from "@/lib/reports";
import { sendTelegramMessage } from "@/lib/telegram";
import { formatLowMarginMessage, buildRestockPage, buildOosPage } from "@/lib/alertMessages";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// How far back to look for new sales on each "margin" run. Must be >= the cron
// interval that hits ?type=margin, or a sale near a run boundary could be missed.
// Vercel's Hobby plan only allows daily crons, so this covers a full day + buffer.
const MARGIN_LOOKBACK_HOURS = 25;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  // Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` automatically; the
  // other two forms just make the endpoint easy to trigger by hand for testing.
  return (
    req.headers.get("authorization") === `Bearer ${secret}` ||
    req.headers.get("x-cron-secret") === secret ||
    req.nextUrl.searchParams.get("secret") === secret
  );
}

// Folded into one "stock" job (rather than its own cron) because Vercel's Hobby
// plan caps a project at 2 cron jobs — this one and the margin check below. The
// message shows the full current list (not just what's new) so its "Keyingisi ➡️"
// pagination stays consistent with the on-demand bot buttons.
async function runStockCheck(): Promise<{ restock: number; outOfStock: number }> {
  const [restock, urgentOutOfStock] = await Promise.all([getRestockAlerts(), getUrgentOutOfStockAlerts()]);
  if (restock.length > 0) {
    const page = buildRestockPage(restock);
    await sendTelegramMessage(page.text, { replyMarkup: page.keyboard });
  }
  if (urgentOutOfStock.length > 0) {
    const allOutOfStock = await getOutOfStockRecentSellers();
    const page = buildOosPage(allOutOfStock);
    await sendTelegramMessage(page.text, { replyMarkup: page.keyboard });
  }
  return { restock: restock.length, outOfStock: urgentOutOfStock.length };
}

async function runMarginCheck(): Promise<{ sent: boolean; count: number }> {
  const sales = await getLowMarginSalesAlerts(MARGIN_LOOKBACK_HOURS);
  if (sales.length === 0) return { sent: false, count: 0 };
  await sendTelegramMessage(formatLowMarginMessage(sales));
  return { sent: true, count: sales.length };
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const type = req.nextUrl.searchParams.get("type");
  try {
    if (type === "stock") return NextResponse.json(await runStockCheck());
    if (type === "margin") return NextResponse.json(await runMarginCheck());
    return NextResponse.json({ error: "pass ?type=stock or ?type=margin" }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
