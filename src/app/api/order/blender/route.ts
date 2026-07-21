import { NextRequest, NextResponse } from "next/server";

// Лід з окремого лендингу /landing/blender (Fresh Juice)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, phone, color, qty, amount } = body || {};

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

    const qtyNum = Number(qty) || 1;
    const amountNum = Number(amount) || 349;

    const text = [
      "🥤 <b>Лід — лендинг Fresh Juice (блендер)</b>",
      "",
      `👤 ${name}`,
      `📞 ${phone}`,
      `🎨 Колір на лендингу: ${color || "Білий"}`,
      `🎁 Кількість: ${qtyNum} шт`,
      "",
      "☎️ Зателефонувати, підтвердити колір, відділення НП і оплату",
      `💰 ${amountNum}₴`,
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
