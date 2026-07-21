import { NextRequest, NextResponse } from "next/server";

// Лід з окремого лендингу /landing/ventilyator (AeroMist Duo)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, phone, qty, total } = body || {};

    if (!name || !phone) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!token || !chatId) {
      return NextResponse.json(
        { error: "Bot not configured" },
        { status: 500 }
      );
    }

    const text = [
      "❄️ <b>Лід — лендинг AeroMist Duo (вентилятор)</b>",
      "",
      `👤 ${name}`,
      `📞 ${phone}`,
      `📦 Кількість: ${qty || 1} шт`,
      `💰 Разом: ${total || 690}₴ · оплата при отриманні`,
      "",
      "☎️ Зателефонувати, підтвердити кількість і відділення НП",
    ].join("\n");

    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
    });

    if (!r.ok) {
      return NextResponse.json({ error: "Telegram error" }, { status: 502 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
