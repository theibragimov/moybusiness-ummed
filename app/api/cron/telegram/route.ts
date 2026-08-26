import { NextRequest, NextResponse } from "next/server";
import { getRestockAlerts, getLowMarginSalesAlerts } from "@/lib/reports";
import { sendTelegramMessage } from "@/lib/telegram";
import { formatRestockMessage, formatLowMarginMessage } from "@/lib/alertMessages";

export const dynamic = "force-dynamic";

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

async function runStockCheck(): Promise<{ sent: boolean; count: number }> {
  const rows = await getRestockAlerts();
  if (rows.length === 0) return { sent: false, count: 0 };
  await sendTelegramMessage(formatRestockMessage(rows));
  return { sent: true, count: rows.length };
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
