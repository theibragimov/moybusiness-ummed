import { NextRequest, NextResponse } from "next/server";
import { getWellSellingLowStockAlerts, getLowMarginSalesAlerts } from "@/lib/reports";
import { sendTelegramMessage, escapeHtml } from "@/lib/telegram";
import { formatMoney, formatNumber } from "@/lib/format";

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
  const rows = await getWellSellingLowStockAlerts();
  if (rows.length === 0) return { sent: false, count: 0 };

  const lines = rows.slice(0, 30).map((r) => {
    const days = r.daysOfStockLeft !== null ? `${Math.max(0, Math.round(r.daysOfStockLeft))} kunlik zaxira` : "zaxira tugagan";
    return `• <b>${escapeHtml(r.name)}</b> — qoldiq: ${formatNumber(r.stock)} dona, kuniga ~${r.avgDailySales.toFixed(1)} dona sotilmoqda, ${days}`;
  });
  const text = `⚠️ <b>Yaxshi sotilayotgan, lekin tugab qolayotgan mahsulotlar</b>\n\n${lines.join("\n")}`;
  await sendTelegramMessage(text);
  return { sent: true, count: rows.length };
}

async function runMarginCheck(): Promise<{ sent: boolean; count: number }> {
  const sales = await getLowMarginSalesAlerts(MARGIN_LOOKBACK_HOURS);
  if (sales.length === 0) return { sent: false, count: 0 };

  const lines = sales.flatMap((s) =>
    s.items.map(
      (i) =>
        `• <b>${escapeHtml(i.name)}</b> — marja ${(i.margin * 100).toFixed(1)}% (${formatMoney(i.sum)} so'm), chek: ${escapeHtml(s.demandName)}${s.agent ? `, ${escapeHtml(s.agent)}` : ""}`
    )
  );
  const text = `🔻 <b>Past marjali sotuvlar (≤10%)</b>\n\n${lines.join("\n")}`;
  await sendTelegramMessage(text);
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
