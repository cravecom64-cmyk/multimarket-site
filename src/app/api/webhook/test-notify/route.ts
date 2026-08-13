import { NextRequest, NextResponse } from "next/server";

// ТИМЧАСОВИЙ роут — тільки щоб Павло побачив живий приклад Telegram-сповіщення
// з телефоном+товаром без реального платежу. Видалити після перевірки.

function escapeMarkdown(text: string): string {
  return text.replace(/[_*[\]()~`>#+=|{}.!-]/g, "\\$&");
}

async function sendTelegram(text: string) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!botToken || !chatId) {
    return { ok: false, error: "no creds" };
  }
  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" }),
  });
  return { ok: res.ok, status: res.status };
}

export async function POST(req: NextRequest) {
  const { kind } = await req.json().catch(() => ({ kind: "failure" }));

  const ref = escapeMarkdown("TESTMSG0001");
  const phoneLine = `\n📞 Телефон: +380663306639`;
  const itemLine = `\n📦 Товар: ${escapeMarkdown("Повербанк 10000mAh USAMS PB7")}`;
  const sum = "399.00";

  let text: string;
  if (kind === "success") {
    text = `✅ *ОПЛАТА ОТРИМАНА (ТЕСТ)*\n\n🔖 Замовлення: ${ref}\n💰 Сума: ${sum}₴\n💳 Спосіб: WayForPay${itemLine}${phoneLine}`;
  } else {
    text = `❌ *ОПЛАТА НЕ ПРОЙШЛА (ТЕСТ)*\n\n🔖 Замовлення: ${ref}\n💰 Сума: ${sum}₴\n⚠️ Причина: ${escapeMarkdown(
      "Cardholder session expired"
    )}${itemLine}${phoneLine}\n\n☎️ Зателефонуй клієнту і допоможи провести оплату повторно.`;
  }

  const result = await sendTelegram(text);
  return NextResponse.json(result);
}
