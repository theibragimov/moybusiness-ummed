import { NextRequest, NextResponse } from "next/server";
import {
  getOutOfStockRecentSellers,
  getRestockAlerts,
  getLowMarginProducts,
  getStockMoneyData,
  getStockBucketProducts,
  STOCK_BUCKET_LABELS,
  type StockValueBucket,
} from "@/lib/reports";
import {
  sendTelegramMessage,
  editTelegramMessage,
  answerCallbackQuery,
  OUT_OF_STOCK_BUTTON_LABEL,
  STOCK_MONEY_BUTTON_LABEL,
  LOW_MARGIN_PRODUCTS_BUTTON_LABEL,
  MAIN_KEYBOARD,
  type InlineKeyboard,
} from "@/lib/telegram";
import {
  buildOosPage,
  buildRestockPage,
  buildLowMarginProductsPage,
  buildStockBucketPage,
  formatStockMoneyMessage,
  encodePageCallback,
  parsePageCallback,
  type Page,
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
    message?: { chat: { id: number }; message_id: number };
  };
}

function authorized(req: NextRequest): boolean {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret) return false;
  return req.headers.get("x-telegram-bot-api-secret-token") === secret;
}

const STOCK_BUCKETS: StockValueBucket[] = ["fast", "normal", "slow", "dead"];

const STOCK_BUCKET_KEYBOARD: InlineKeyboard = {
  inline_keyboard: STOCK_BUCKETS.map((bucket) => [
    { text: STOCK_BUCKET_LABELS[bucket], callback_data: encodePageCallback("bucket", bucket, 0) },
  ]),
};

async function handleMessage(chatId: number, text: string) {
  if (text === "/start") {
    await sendTelegramMessage("Salom! Quyidagi tugmalar orqali ombor holatini tekshirishingiz mumkin.", {
      chatId: String(chatId),
      replyMarkup: MAIN_KEYBOARD,
    });
  } else if (text === OUT_OF_STOCK_BUTTON_LABEL) {
    const rows = await getOutOfStockRecentSellers();
    const page = buildOosPage(rows);
    await sendTelegramMessage(page.text, { chatId: String(chatId), replyMarkup: page.keyboard ?? MAIN_KEYBOARD });
  } else if (text === LOW_MARGIN_PRODUCTS_BUTTON_LABEL) {
    const rows = await getLowMarginProducts();
    const page = buildLowMarginProductsPage(rows);
    await sendTelegramMessage(page.text, { chatId: String(chatId), replyMarkup: page.keyboard ?? MAIN_KEYBOARD });
  } else if (text === STOCK_MONEY_BUTTON_LABEL) {
    const data = await getStockMoneyData();
    await sendTelegramMessage(formatStockMoneyMessage(data), {
      chatId: String(chatId),
      replyMarkup: STOCK_BUCKET_KEYBOARD,
    });
  }
}

async function fetchPage(kind: string, param: string, offset: number): Promise<Page | null> {
  if (kind === "restock") {
    return buildRestockPage(await getRestockAlerts(), offset);
  }
  if (kind === "oos") {
    return buildOosPage(await getOutOfStockRecentSellers(), offset);
  }
  if (kind === "lowmargin") {
    return buildLowMarginProductsPage(await getLowMarginProducts(), offset);
  }
  if (kind === "bucket" && STOCK_BUCKETS.includes(param as StockValueBucket)) {
    const bucket = param as StockValueBucket;
    return buildStockBucketPage(bucket, STOCK_BUCKET_LABELS[bucket], await getStockBucketProducts(bucket), offset);
  }
  return null;
}

async function handleCallbackQuery(callbackQueryId: string, chatId: number, messageId: number, data: string) {
  await answerCallbackQuery(callbackQueryId);
  const parsed = parsePageCallback(data);
  if (!parsed) return;
  const page = await fetchPage(parsed.kind, parsed.param, parsed.offset);
  if (!page) return;
  // "Keyingisi ➡️" replaces the same message in place instead of piling up new ones.
  await editTelegramMessage(String(chatId), messageId, page.text, page.keyboard);
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const update = (await req.json().catch(() => null)) as TelegramUpdate | null;

  try {
    if (update?.message?.text && update.message.chat.id !== undefined) {
      await handleMessage(update.message.chat.id, update.message.text);
    } else if (update?.callback_query?.data && update.callback_query.message) {
      const { chat, message_id } = update.callback_query.message;
      await handleCallbackQuery(update.callback_query.id, chat.id, message_id, update.callback_query.data);
    }
  } catch {
    // Swallow errors here — Telegram retries a non-200 response, and a transient
    // MoySklad failure shouldn't turn into a retry storm against the bot API.
  }

  // Telegram expects a fast 200 regardless of what we did with the update.
  return NextResponse.json({ ok: true });
}
