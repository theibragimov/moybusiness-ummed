import { NextRequest, NextResponse } from "next/server";
import {
  getOutOfStockRecentSellers,
  getYesterdaySoldNowOutOfStock,
  getRestockAlerts,
  getLowMarginProducts,
  getStockMoneyData,
  getStockBucketProducts,
  getStaleDebtors30d,
  getDormantDebtors3mo,
  STOCK_BUCKET_LABELS,
  type StockValueBucket,
} from "@/lib/reports";
import {
  sendTelegramMessage,
  editTelegramMessage,
  answerCallbackQuery,
  sendPlaceholder,
  isAllowedTelegramChat,
  OUT_OF_STOCK_BUTTON_LABEL,
  STOCK_MONEY_BUTTON_LABEL,
  LOW_MARGIN_PRODUCTS_BUTTON_LABEL,
  CRM_BUTTON_LABEL,
  PRODUCT_ANALYSIS_BUTTON_LABEL,
  MAIN_KEYBOARD,
  type InlineKeyboard,
} from "@/lib/telegram";
import {
  buildOosPage,
  buildYesterdaySoldOosPage,
  buildRestockPage,
  buildLowMarginProductsPage,
  buildStockBucketPage,
  buildDebtor30Page,
  buildDebtor3moPage,
  formatStockMoneyMessage,
  encodePageCallback,
  parsePageCallback,
  type Page,
} from "@/lib/alertMessages";

export const dynamic = "force-dynamic";
// The debtor lists page through MoySklad reports that are slow on this account;
// give the function room to finish instead of Vercel cutting it off mid-fetch.
export const maxDuration = 60;

interface TelegramUpdate {
  message?: {
    chat: { id: number };
    text?: string;
    from?: { first_name?: string; last_name?: string; username?: string };
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

const CRM_KEYBOARD: InlineKeyboard = {
  inline_keyboard: [
    [{ text: "🕐 30 kun to'lov qilmagan qarzdorlar", callback_data: encodePageCallback("debtor30", "-", 0) }],
    [{ text: "💤 3 oy to'lov ham, xarid ham yo'q", callback_data: encodePageCallback("debtor3mo", "-", 0) }],
  ],
};

const ANALYTICS_URL = "https://moybusiness-ummed.vercel.app/analytics";

const PRODUCT_ANALYSIS_KEYBOARD: InlineKeyboard = {
  inline_keyboard: [[{ text: "🔗 To'liq tahlil bilan tanishish", url: ANALYTICS_URL }]],
};

/** Replaces the "⏳ Yuklanmoqda…" placeholder with the real result once it's ready. */
async function deliver(chatId: number, placeholderId: number | null, text: string, keyboard?: InlineKeyboard) {
  if (placeholderId !== null) {
    await editTelegramMessage(String(chatId), placeholderId, text, keyboard);
  } else {
    // Placeholder send failed for some reason — still deliver the result.
    await sendTelegramMessage(text, { chatId: String(chatId), replyMarkup: keyboard });
  }
}

async function handleMessage(chatId: number, text: string) {
  if (text === "/start") {
    await sendTelegramMessage("Salom! Quyidagi tugmalar orqali ombor holatini tekshirishingiz mumkin.", {
      chatId: String(chatId),
      replyMarkup: MAIN_KEYBOARD,
    });
  } else if (text === OUT_OF_STOCK_BUTTON_LABEL) {
    const placeholderId = await sendPlaceholder(String(chatId));
    const rows = await getOutOfStockRecentSellers();
    const page = buildOosPage(rows);
    await deliver(chatId, placeholderId, page.text, page.keyboard);
  } else if (text === LOW_MARGIN_PRODUCTS_BUTTON_LABEL) {
    const placeholderId = await sendPlaceholder(String(chatId));
    const rows = await getLowMarginProducts();
    const page = buildLowMarginProductsPage(rows);
    await deliver(chatId, placeholderId, page.text, page.keyboard);
  } else if (text === STOCK_MONEY_BUTTON_LABEL) {
    const placeholderId = await sendPlaceholder(String(chatId));
    const data = await getStockMoneyData();
    await deliver(chatId, placeholderId, formatStockMoneyMessage(data), STOCK_BUCKET_KEYBOARD);
  } else if (text === CRM_BUTTON_LABEL) {
    await sendTelegramMessage("👥 <b>CRM</b>\n\nQaysi qarzdorlar ro'yxatini ko'rmoqchisiz?", {
      chatId: String(chatId),
      replyMarkup: CRM_KEYBOARD,
    });
  } else if (text === PRODUCT_ANALYSIS_BUTTON_LABEL) {
    await sendTelegramMessage("📊 <b>Mahsulotlar bo'yicha tahlil</b>\n\nSotuvlar, marja va ABC-tahlil — havola orqali to'liq tahlil bilan tanishing.", {
      chatId: String(chatId),
      replyMarkup: PRODUCT_ANALYSIS_KEYBOARD,
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
  if (kind === "oosYesterday") {
    return buildYesterdaySoldOosPage(await getYesterdaySoldNowOutOfStock(), offset);
  }
  if (kind === "lowmargin") {
    return buildLowMarginProductsPage(await getLowMarginProducts(), offset);
  }
  if (kind === "bucket" && STOCK_BUCKETS.includes(param as StockValueBucket)) {
    const bucket = param as StockValueBucket;
    return buildStockBucketPage(bucket, STOCK_BUCKET_LABELS[bucket], await getStockBucketProducts(bucket), offset);
  }
  if (kind === "debtor30") {
    return buildDebtor30Page(await getStaleDebtors30d(), offset);
  }
  if (kind === "debtor3mo") {
    return buildDebtor3moPage(await getDormantDebtors3mo(), offset);
  }
  return null;
}

async function handleCallbackQuery(callbackQueryId: string, chatId: number, messageId: number, data: string) {
  await answerCallbackQuery(callbackQueryId);
  const parsed = parsePageCallback(data);
  if (!parsed) return;
  // Explicit "please wait" edit — Telegram's own button spinner clears after a
  // few seconds on slow requests, so it isn't a reliable indicator by itself.
  await editTelegramMessage(String(chatId), messageId, "⏳ Yuklanmoqda…");
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
    if (update?.message?.text && update.message.chat.id !== undefined && isAllowedTelegramChat(update.message.chat.id)) {
      await handleMessage(update.message.chat.id, update.message.text);
    } else if (update?.message?.text === "/start" && update.message.chat.id !== undefined) {
      // Not on the allowed list yet: hand back the chat id (harmless — no business
      // data) so the owner can add it to TELEGRAM_CHAT_IDS without digging through logs.
      const from = update.message.from;
      const name = [from?.first_name, from?.last_name].filter(Boolean).join(" ") || "noma'lum";
      // eslint-disable-next-line no-console
      console.log(
        `[telegram] unauthorized /start — chatId=${update.message.chat.id} name="${name}" username=${from?.username ?? "-"}`
      );
      await sendTelegramMessage(
        `Sizning chat ID'ingiz: <code>${update.message.chat.id}</code>\n\nBuni administratorga yuboring — u sizni ro'yxatga qo'shgach, botdan foydalana olasiz.`,
        { chatId: String(update.message.chat.id) }
      );
    } else if (
      update?.callback_query?.data &&
      update.callback_query.message &&
      isAllowedTelegramChat(update.callback_query.message.chat.id)
    ) {
      const { chat, message_id } = update.callback_query.message;
      await handleCallbackQuery(update.callback_query.id, chat.id, message_id, update.callback_query.data);
    } else if (update?.callback_query) {
      // Still ack unauthorized button presses so the pressing user's client doesn't spin.
      await answerCallbackQuery(update.callback_query.id);
    }
  } catch {
    // Swallow errors here — Telegram retries a non-200 response, and a transient
    // MoySklad failure shouldn't turn into a retry storm against the bot API.
  }

  // Telegram expects a fast 200 regardless of what we did with the update.
  return NextResponse.json({ ok: true });
}
