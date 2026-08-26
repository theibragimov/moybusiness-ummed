import { NextRequest, NextResponse } from "next/server";
import { getOutOfStockRecentSellers } from "@/lib/reports";
import { sendTelegramMessage, OUT_OF_STOCK_BUTTON_LABEL, MAIN_KEYBOARD } from "@/lib/telegram";
import { formatOutOfStockMessage } from "@/lib/alertMessages";

export const dynamic = "force-dynamic";

interface TelegramUpdate {
  message?: {
    chat: { id: number };
    text?: string;
  };
}

function authorized(req: NextRequest): boolean {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret) return false;
  return req.headers.get("x-telegram-bot-api-secret-token") === secret;
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const update = (await req.json().catch(() => null)) as TelegramUpdate | null;
  const chatId = update?.message?.chat.id;
  const text = update?.message?.text;

  // Telegram expects a fast 200 regardless of what we did with the update.
  if (chatId === undefined || !text) {
    return NextResponse.json({ ok: true });
  }

  try {
    if (text === "/start") {
      await sendTelegramMessage(
        "Salom! Quyidagi tugma orqali tugagan, lekin so'nggi 10 kunda sotilgan mahsulotlarni ko'rishingiz mumkin.",
        { chatId: String(chatId), replyMarkup: MAIN_KEYBOARD }
      );
    } else if (text === OUT_OF_STOCK_BUTTON_LABEL) {
      const rows = await getOutOfStockRecentSellers();
      await sendTelegramMessage(formatOutOfStockMessage(rows), {
        chatId: String(chatId),
        replyMarkup: MAIN_KEYBOARD,
      });
    }
  } catch {
    // Swallow errors here — Telegram retries a non-200 response, and a transient
    // MoySklad failure shouldn't turn into a retry storm against the bot API.
  }

  return NextResponse.json({ ok: true });
}
