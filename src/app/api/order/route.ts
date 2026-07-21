import { NextRequest, NextResponse } from "next/server";

// ==================== RATE LIMITING ====================
// In-memory store: IP → timestamps of recent requests
const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_WINDOW = 60_000; // 1 minute
const RATE_LIMIT_MAX = 3; // max 3 orders per minute per IP

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const timestamps = rateLimitMap.get(ip) || [];
  // Keep only timestamps within the window
  const recent = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW);
  rateLimitMap.set(ip, recent);

  if (recent.length >= RATE_LIMIT_MAX) return true;
  recent.push(now);
  rateLimitMap.set(ip, recent);
  return false;
}

// Clean up old entries every 5 minutes to prevent memory leak
setInterval(() => {
  const now = Date.now();
  for (const [ip, timestamps] of rateLimitMap.entries()) {
    const recent = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW);
    if (recent.length === 0) rateLimitMap.delete(ip);
    else rateLimitMap.set(ip, recent);
  }
}, 300_000);

// ==================== VALIDATION ====================
const UA_PHONE_REGEX = /^\+?3?8?(0\d{9})$/;

function sanitize(str: string): string {
  return str
    .replace(/<[^>]*>/g, "") // strip HTML
    .replace(/[<>"'`;]/g, "") // strip dangerous chars
    .trim()
    .slice(0, 500); // max length
}

function validatePhone(phone: string): boolean {
  const cleaned = phone.replace(/[\s()-]/g, "");
  return UA_PHONE_REGEX.test(cleaned);
}

// ==================== TYPES ====================
interface OrderItem {
  name: string;
  price: number;
  quantity: number;
}

interface OrderBody {
  name: string;
  phone: string;
  city: string;
  branch: string;
  comment: string;
  items: OrderItem[];
  totalPrice: number;
  // Honeypot field — must be empty
  website?: string;
  // Timing check — timestamp when form was loaded
  _t?: number;
}

// ==================== HANDLER ====================
export async function POST(req: NextRequest) {
  try {
    // --- Rate limiting ---
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";

    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429 }
      );
    }

    // --- Check content type ---
    const contentType = req.headers.get("content-type");
    if (!contentType?.includes("application/json")) {
      return NextResponse.json(
        { error: "Invalid content type" },
        { status: 415 }
      );
    }

    const body: OrderBody = await req.json();

    // --- Honeypot check (bots fill hidden fields) ---
    if (body.website) {
      // Bot detected — return fake success so bot thinks it worked
      return NextResponse.json({ success: true });
    }

    // --- Timing check (form filled in < 3 seconds = bot) ---
    if (body._t && Date.now() - body._t < 3000) {
      return NextResponse.json({ success: true });
    }

    // --- Validate & sanitize ---
    const name = sanitize(body.name || "");
    const phone = (body.phone || "").replace(/[\s()-]/g, "");
    const city = sanitize(body.city || "");
    const branch = sanitize(body.branch || "");
    const comment = sanitize(body.comment || "");

    if (!name || name.length < 2) {
      return NextResponse.json(
        { error: "Invalid name" },
        { status: 400 }
      );
    }

    if (!validatePhone(phone)) {
      return NextResponse.json(
        { error: "Invalid phone number" },
        { status: 400 }
      );
    }

    if (!city || city.length < 2) {
      return NextResponse.json(
        { error: "Invalid city" },
        { status: 400 }
      );
    }

    if (!branch || branch.length < 3) {
      return NextResponse.json(
        { error: "Invalid NP branch" },
        { status: 400 }
      );
    }

    if (!body.items || !Array.isArray(body.items) || body.items.length === 0 || body.items.length > 50) {
      return NextResponse.json(
        { error: "Invalid cart" },
        { status: 400 }
      );
    }

    // Validate each item
    for (const item of body.items) {
      if (!item.name || typeof item.price !== "number" || item.price <= 0 ||
          typeof item.quantity !== "number" || item.quantity <= 0 || item.quantity > 99) {
        return NextResponse.json(
          { error: "Invalid cart item" },
          { status: 400 }
        );
      }
    }

    // --- Build Telegram message ---
    const itemsText = body.items
      .map(
        (item) =>
          `  • ${sanitize(item.name)} × ${item.quantity} = ${item.price * item.quantity}₴`
      )
      .join("\n");

    const calculatedTotal = body.items.reduce(
      (sum, item) => sum + item.price * item.quantity, 0
    );

    const message = `🛒 *НОВЕ ЗАМОВЛЕННЯ!*

👤 *Ім'я:* ${escapeMarkdown(name)}
📞 *Телефон:* ${escapeMarkdown(phone)}
🏙 *Місто:* ${escapeMarkdown(city)}
📦 *Відділення НП:* ${escapeMarkdown(branch)}
${comment ? `💬 *Коментар:* ${escapeMarkdown(comment)}` : ""}

📋 *Товари:*
${itemsText}

💰 *Сума: ${calculatedTotal}₴*
${calculatedTotal >= 800 ? "✅ Безкоштовна доставка" : "📦 Доставка НП ~60\\-80₴"}

🌐 IP: ${ip}
⏰ ${new Date().toLocaleString("uk-UA", { timeZone: "Europe/Kyiv" })}`;

    // --- Send to Telegram ---
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!botToken || !chatId) {
      console.error("Telegram credentials not configured");
      return NextResponse.json({ success: true, notified: false });
    }

    const tgRes = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: "Markdown",
        }),
      }
    );

    if (!tgRes.ok) {
      console.error("Telegram API error:", await tgRes.text());
    }

    return NextResponse.json({ success: true, notified: tgRes.ok });
  } catch (error) {
    console.error("Order error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

function escapeMarkdown(text: string): string {
  return text.replace(/[_*[\]()~`>#+=|{}.!-]/g, "\\$&");
}
