import { NextRequest, NextResponse } from "next/server";
import { getOutOfStockRecentSellers, getStockMoneyData, getStockBucketProducts, STOCK_BUCKET_LABELS } from "@/lib/reports";
import {
  sendTelegramMessage,
  answerCallbackQuery,
  OUT_OF_STOCK_BUTTON_LABEL,
  STOCK_MONEY_BUTTON_LABEL,
  MAIN_KEYBOARD,
  type InlineKeyboard,
} from "@/lib/telegram";
import {
  formatOutOfStockMessage,
  formatStockMoneyMessage,
  formatStockBucketMessage,
  stockBucketCallbackData,
  parseStockBucketCallback,
} from "@/lib/alertMessages";

export const dynamic = "force-dynamic";

interface TelegramUpdate {
  message?: {
    chat: { id: number };
    text?: string;
  };
  callback_query?: {
    id: string;
    data?: string;
    message?: { chat: { id: number } };
  };
}

function authorized(req: NextRequest): boolean {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret) return false;
  return req.headers.get("x-telegram-bot-api-secret-token") === secret;
}

const STOCK_BUCKET_KEYBOARD: InlineKeyboard = {
  inline_keyboard: (["fast", "normal", "slow", "dead"] as const).map((bucket) => [
    { text: STOCK_BUCKET_LABELS[bucket], callback_data: stockBucketCallbackData(bucket) },
  ]),
};

async function handleMessage(chatId: number, text: string) {
  if (text === "/start") {
    await sendTelegramMessage(
      "Salom! Quyidagi tugmalar orqali ombor holatini tekshirishingiz mumkin.",
      { chatId: String(chatId), replyMarkup: MAIN_KEYBOARD }
    );
  } else if (text === OUT_OF_STOCK_BUTTON_LABEL) {
    const rows = await getOutOfStockRecentSellers();
    await sendTelegramMessage(formatOutOfStockMessage(rows), {
      chatId: String(chatId),
      replyMarkup: MAIN_KEYBOARD,
    });
  } else if (text === STOCK_MONEY_BUTTON_LABEL) {
    const data = await getStockMoneyData();
    await sendTelegramMessage(formatStockMoneyMessage(data), {
      chatId: String(chatId),
      replyMarkup: STOCK_BUCKET_KEYBOARD,
    });
  }
}

async function handleCallbackQuery(callbackQueryId: string, chatId: number, data: string) {
  const bucket = parseStockBucketCallback(data);
  await answerCallbackQuery(callbackQueryId);
  if (!bucket) return;
  const rows = await getStockBucketProducts(bucket);
  await sendTelegramMessage(formatStockBucketMessage(STOCK_BUCKET_LABELS[bucket], rows), {
    chatId: String(chatId),
  });
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const update = (await req.json().catch(() => null)) as TelegramUpdate | null;

  try {
    if (update?.message?.text && update.message.chat.id !== undefined) {
      await handleMessage(update.message.chat.id, update.message.text);
    } else if (update?.callback_query?.data && update.callback_query.message?.chat.id !== undefined) {
      await handleCallbackQuery(update.callback_query.id, update.callback_query.message.chat.id, update.callback_query.data);
    }
  } catch {
    // Swallow errors here — Telegram retries a non-200 response, and a transient
    // MoySklad failure shouldn't turn into a retry storm against the bot API.
  }

  // Telegram expects a fast 200 regardless of what we did with the update.
  return NextResponse.json({ ok: true });
}
