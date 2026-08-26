import "server-only";

const API_BASE = "https://api.telegram.org";
// Telegram caps a single message at 4096 chars; stay under that with margin for entities.
const MAX_MESSAGE_LEN = 3800;

function token(): string {
  const t = process.env.TELEGRAM_BOT_TOKEN;
  if (!t) throw new Error("TELEGRAM_BOT_TOKEN is not set");
  return t;
}

function chatId(): string {
  const id = process.env.TELEGRAM_CHAT_ID;
  if (!id) throw new Error("TELEGRAM_CHAT_ID is not set");
  return id;
}

function chunkByLines(text: string, max: number): string[] {
  if (text.length <= max) return [text];
  const lines = text.split("\n");
  const chunks: string[] = [];
  let cur = "";
  for (const line of lines) {
    const next = cur ? `${cur}\n${line}` : line;
    if (next.length > max && cur) {
      chunks.push(cur);
      cur = line;
    } else {
      cur = next;
    }
  }
  if (cur) chunks.push(cur);
  return chunks;
}

/** Reply-keyboard button labels for the bot's persistent menu. */
export const OUT_OF_STOCK_BUTTON_LABEL = "🚫 Tugagan, lekin sotilayotgan mahsulotlar";
export const STOCK_MONEY_BUTTON_LABEL = "💰 Ombor puli";
export const LOW_MARGIN_PRODUCTS_BUTTON_LABEL = "📉 Past marjali mahsulotlar";

export const MAIN_KEYBOARD: ReplyKeyboard = {
  keyboard: [
    [{ text: OUT_OF_STOCK_BUTTON_LABEL }],
    [{ text: STOCK_MONEY_BUTTON_LABEL }],
    [{ text: LOW_MARGIN_PRODUCTS_BUTTON_LABEL }],
  ],
  resize_keyboard: true,
  is_persistent: true,
};

export interface ReplyKeyboard {
  keyboard: { text: string }[][];
  resize_keyboard?: boolean;
  is_persistent?: boolean;
}

export interface InlineKeyboard {
  inline_keyboard: { text: string; callback_data: string }[][];
}

interface SendOptions {
  /** Defaults to TELEGRAM_CHAT_ID — pass a different chat to reply to whoever triggered a bot command. */
  chatId?: string;
  replyMarkup?: ReplyKeyboard | InlineKeyboard;
}

async function sendOne(text: string, opts: SendOptions = {}): Promise<void> {
  const res = await fetch(`${API_BASE}/bot${token()}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: opts.chatId ?? chatId(),
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
      ...(opts.replyMarkup ? { reply_markup: opts.replyMarkup } : {}),
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Telegram sendMessage failed: ${res.status} ${body.slice(0, 300)}`);
  }
}

/** Acknowledges a button press so Telegram stops showing a loading spinner on it. */
export async function answerCallbackQuery(callbackQueryId: string): Promise<void> {
  await fetch(`${API_BASE}/bot${token()}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: callbackQueryId }),
  }).catch(() => undefined);
}

/** Sends a Telegram message, splitting it across multiple messages if it exceeds Telegram's length cap. */
export async function sendTelegramMessage(text: string, opts: SendOptions = {}): Promise<void> {
  const chunks = chunkByLines(text, MAX_MESSAGE_LEN);
  for (let i = 0; i < chunks.length; i++) {
    // A reply keyboard only needs to be (re)attached once; repeating it on every
    // chunk would just resend the same keyboard redundantly.
    await sendOne(chunks[i], i === chunks.length - 1 ? opts : { chatId: opts.chatId });
  }
}

/**
 * Edits an existing message in place — used for "Keyingisi ➡️" pagination, so
 * paging through a list replaces the same message instead of piling up new ones.
 * Silently no-ops on failure (e.g. the message is too old to edit, or was deleted).
 */
export async function editTelegramMessage(
  chatId: string,
  messageId: number,
  text: string,
  replyMarkup?: InlineKeyboard
): Promise<void> {
  await fetch(`${API_BASE}/bot${token()}/editMessageText`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
      ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
    }),
  }).catch(() => undefined);
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
