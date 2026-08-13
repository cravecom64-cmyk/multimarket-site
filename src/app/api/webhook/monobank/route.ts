import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/monobank";

// Тіло вебхука ідентичне відповіді "Статус рахунку" (invoice/status).
// Вебхук НЕ надсилається для статусу expired (документація Monobank).
interface WebhookPayload {
  invoiceId: string;
  status: "created" | "processing" | "hold" | "success" | "failure" | "reversed" | "expired";
  amount: number;
  ccy: number;
  finalAmount?: number;
  reference?: string;
  failureReason?: string;
  modifiedDate?: string;
}

function escapeMarkdown(text: string): string {
  return text.replace(/[_*[\]()~`>#+=|{}.!-]/g, "\\$&");
}

// reference має формат "orderId" або "orderId-phoneDigits" (телефон додається
// в /api/checkout/monobank, якщо клієнт його вказав). Розбираємо назад, щоб
// показати номер у сповіщенні без пошуку заявки в історії Telegram.
function parseReference(reference: string | undefined): { orderId: string; phone: string | null } {
  if (!reference) return { orderId: "?", phone: null };
  const match = reference.match(/^(.+)-(\d{9,15})$/);
  if (match) return { orderId: match[1], phone: match[2] };
  return { orderId: reference, phone: null };
}

function formatPhoneLink(phoneDigits: string): string {
  // Приводимо до +380XXXXXXXXX, щоб Telegram зробив номер клікабельним.
  const digits = phoneDigits.replace(/^380/, "").replace(/^0/, "");
  return `+380${digits}`;
}

async function sendTelegram(text: string) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!botToken || !chatId) {
    console.error("Telegram credentials not configured");
    return;
  }
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" }),
  }).catch((e) => console.error("Telegram send error:", e));
}

export async function POST(req: NextRequest) {
  // Читаємо СИРЕ тіло (до parse) — підпис рахується саме над ним.
  const rawBody = await req.text();
  const xSign = req.headers.get("x-sign");

  if (!xSign) {
    return NextResponse.json({ error: "Missing x-sign" }, { status: 400 });
  }

  let signatureValid = false;
  try {
    signatureValid = await verifyWebhookSignature(rawBody, xSign);
  } catch (error) {
    console.error("Monobank webhook signature check failed:", error);
    return NextResponse.json({ error: "Signature verification error" }, { status: 500 });
  }

  if (!signatureValid) {
    console.error("Monobank webhook: INVALID SIGNATURE — можлива підробка запиту");
    return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
  }

  let payload: WebhookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { orderId, phone } = parseReference(payload.reference);
  const ref = escapeMarkdown(orderId);
  const phoneLine = phone ? `\n📞 Телефон: ${formatPhoneLink(phone)}` : "";
  const sum = ((payload.finalAmount ?? payload.amount) / 100).toFixed(2);

  if (payload.status === "success") {
    await sendTelegram(
      `✅ *ОПЛАТА ОТРИМАНА*\n\n🔖 Замовлення: ${ref}\n💰 Сума: ${sum}₴\n💳 Спосіб: Monobank Acquiring${phoneLine}`
    );
  } else if (payload.status === "failure" || payload.status === "reversed") {
    const reason = payload.failureReason ? escapeMarkdown(payload.failureReason) : "невідома причина";
    await sendTelegram(
      `❌ *ОПЛАТА НЕ ПРОЙШЛА*\n\n🔖 Замовлення: ${ref}\n💰 Сума: ${sum}₴\n⚠️ Причина: ${reason}${phoneLine}\n\n☎️ Зателефонуй клієнту і допоможи провести оплату повторно.`
    );
  }
  // created/processing/hold — проміжні статуси, окремо не сповіщаємо,
  // щоб не спамити Telegram на кожен крок оплати.

  return NextResponse.json({ success: true });
}
