import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookSignature, buildWebhookResponse, type WebhookPayload } from "@/lib/wayforpay";

function escapeMarkdown(text: string): string {
  return text.replace(/[_*[\]()~`>#+=|{}.!-]/g, "\\$&");
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
  let payload: WebhookPayload;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!verifyWebhookSignature(payload)) {
    console.error("WayForPay webhook: INVALID SIGNATURE — можлива підробка запиту");
    return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
  }

  const ref = escapeMarkdown(payload.orderReference);
  const sum = payload.amount;

  if (payload.transactionStatus === "Approved") {
    await sendTelegram(
      `✅ *ОПЛАТА ОТРИМАНА*\n\n🔖 Замовлення: ${ref}\n💰 Сума: ${sum}₴\n💳 Спосіб: WayForPay`
    );
  } else if (
    payload.transactionStatus === "Declined" ||
    payload.transactionStatus === "Expired" ||
    payload.transactionStatus === "Refunded" ||
    payload.transactionStatus === "Voided"
  ) {
    const reason = payload.reason ? escapeMarkdown(payload.reason) : "невідома причина";
    await sendTelegram(
      `❌ *ОПЛАТА НЕ ПРОЙШЛА*\n\n🔖 Замовлення: ${ref}\n💰 Сума: ${sum}₴\n⚠️ Причина: ${reason}`
    );
  }
  // InProcessing/Pending — проміжні статуси, окремо не сповіщаємо.

  // WayForPay ЧЕКАЄ саме таку підписану відповідь, інакше буде ретраїти
  // запит до 4 діб.
  return NextResponse.json(buildWebhookResponse(payload.orderReference));
}
