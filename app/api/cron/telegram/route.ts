import { NextRequest, NextResponse } from "next/server";
import {
  getRestockAlerts,
  getLowMarginSalesAlerts,
  getUrgentOutOfStockAlerts,
  getOutOfStockRecentSellers,
  getYesterdaySoldNowOutOfStock,
  getMonthlyComparisonReport,
} from "@/lib/reports";
import { sendTelegramMessage } from "@/lib/telegram";
import {
  formatLowMarginMessage,
  buildRestockPage,
  buildOosPage,
  buildYesterdaySoldOosPage,
  formatMonthlyComparisonMessage,
} from "@/lib/alertMessages";
import { isLastDayOfMonthTashkent } from "@/lib/tashkent";

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
async function runStockCheck(): Promise<{ restock: number; outOfStock: number; outOfStockYesterday: number }> {
  const [restock, urgentOutOfStock, yesterdaySoldOutOfStock] = await Promise.all([
    getRestockAlerts(),
    getUrgentOutOfStockAlerts(),
    getYesterdaySoldNowOutOfStock(),
  ]);
  if (restock.length > 0) {
    const page = buildRestockPage(restock);
    await sendTelegramMessage(page.text, { replyMarkup: page.keyboard });
  }
  if (urgentOutOfStock.length > 0) {
    const allOutOfStock = await getOutOfStockRecentSellers();
    const page = buildOosPage(allOutOfStock);
    await sendTelegramMessage(page.text, { replyMarkup: page.keyboard });
  }
  if (yesterdaySoldOutOfStock.length > 0) {
    const page = buildYesterdaySoldOosPage(yesterdaySoldOutOfStock);
    await sendTelegramMessage(page.text, { replyMarkup: page.keyboard });
  }
  return { restock: restock.length, outOfStock: urgentOutOfStock.length, outOfStockYesterday: yesterdaySoldOutOfStock.length };
}

async function runMarginCheck(): Promise<{ sent: boolean; count: number }> {
  const sales = await getLowMarginSalesAlerts(MARGIN_LOOKBACK_HOURS);
  if (sales.length === 0) return { sent: false, count: 0 };
  await sendTelegramMessage(formatLowMarginMessage(sales));
  return { sent: true, count: sales.length };
}

// Piggybacks on the "margin" cron (rather than its own schedule) because Vercel's
// Hobby plan caps a project at 2 cron jobs, both already spoken for by
// runStockCheck and runMarginCheck. The "margin" cron's time was moved to 21:00
// Tashkent specifically so this fires at the requested hour; it's a no-op on
// every day but the last of the month.
async function runMonthlyReport(): Promise<{ sent: boolean }> {
  if (!isLastDayOfMonthTashkent()) return { sent: false };
  const report = await getMonthlyComparisonReport();
  await sendTelegramMessage(formatMonthlyComparisonMessage(report));
  return { sent: true };
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const type = req.nextUrl.searchParams.get("type");
  try {
    if (type === "stock") return NextResponse.json(await runStockCheck());
    if (type === "margin") {
      const margin = await runMarginCheck();
      const monthly = await runMonthlyReport();
      return NextResponse.json({ margin, monthly });
    }
    return NextResponse.json({ error: "pass ?type=stock or ?type=margin" }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
