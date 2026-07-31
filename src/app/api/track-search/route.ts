import { NextRequest, NextResponse } from "next/server";

// ==================== RATE LIMITING ====================
// Той самий патерн, що в /api/order — окрема мапа, бо ліміт тут м'якший:
// легітимний користувач може згенерувати кілька запитів поспіль, уточнюючи
// пошук (кожен дебаунсений запит — окремий виклик).
const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_WINDOW = 60_000; // 1 хвилина
const RATE_LIMIT_MAX = 15; // максимум 15 трекнутих пошуків на хвилину з одного IP

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const timestamps = rateLimitMap.get(ip) || [];
  const recent = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW);
  rateLimitMap.set(ip, recent);

  if (recent.length >= RATE_LIMIT_MAX) return true;
  recent.push(now);
  rateLimitMap.set(ip, recent);
  return false;
}

setInterval(() => {
  const now = Date.now();
  for (const [ip, timestamps] of rateLimitMap.entries()) {
    const recent = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW);
    if (recent.length === 0) rateLimitMap.delete(ip);
    else rateLimitMap.set(ip, recent);
  }
}, 300_000);

function sanitize(str: string): string {
  return str
    .replace(/<[^>]*>/g, "")
    .replace(/[<>"'`;]/g, "")
    .trim()
    .slice(0, 200);
}

function escapeMarkdown(text: string): string {
  return text.replace(/[_*[\]()~`>#+=|{}.!-]/g, "\\$&");
}

interface TrackSearchBody {
  query: string;
  resultsCount?: number;
}

export async function POST(req: NextRequest) {
  try {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";

    if (isRateLimited(ip)) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const contentType = req.headers.get("content-type");
    if (!contentType?.includes("application/json")) {
      return NextResponse.json({ error: "Invalid content type" }, { status: 415 });
    }

    const body: TrackSearchBody = await req.json();
    const query = sanitize(body.query || "");

    if (!query || query.length < 2) {
      return NextResponse.json({ error: "Invalid query" }, { status: 400 });
    }

    const resultsCount =
      typeof body.resultsCount === "number" ? body.resultsCount : null;

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!botToken || !chatId) {
      // Немає Telegram — тихо виходимо, пошук на сайті все одно має працювати
      // незалежно від того, чи налаштований трекінг.
      return NextResponse.json({ success: true, notified: false });
    }

    const resultsLine =
      resultsCount === null
        ? ""
        : resultsCount === 0
        ? "\n⚠️ *0 результатів — можливо, вартий уваги товар для каталогу*"
        : `\n📦 Знайдено: ${resultsCount}`;

    const message = `🔍 *Пошук на сайті:* "${escapeMarkdown(query)}"${resultsLine}
🌐 IP: ${ip}
⏰ ${new Date().toLocaleString("uk-UA", { timeZone: "Europe/Kyiv" })}`;

    const tgRes = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: "Markdown",
          disable_notification: true, // не будити Павла на кожен пошук
        }),
      }
    );

    if (!tgRes.ok) {
      console.error("Telegram API error (track-search):", await tgRes.text());
    }

    return NextResponse.json({ success: true, notified: tgRes.ok });
  } catch (error) {
    console.error("Track-search error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
