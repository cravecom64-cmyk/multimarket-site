import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// ==================== КОМАНДНИЙ ЦЕНТР (Supabase) ====================
// Пише в product_events — та сама незалежна база, що й orders/order_items
// (див. /api/order). Джерело правди для живого ранжування карток і для
// розділу "Аналітика" в командному центрі. Той самий підхід до ключів:
// тільки серверні env vars, ніколи публічний ключ.
function supabaseServer() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

// ==================== RATE LIMITING ====================
// М'якший ліміт, ніж /api/order чи /api/track-search — це фонові події
// (перегляд сторінки, клік "В кошик"), які можуть летіти на кожен клік
// під час звичайного гортання каталогу.
const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_WINDOW = 60_000;
const RATE_LIMIT_MAX = 90;

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

function sanitize(str: string, max = 300): string {
  return str
    .replace(/<[^>]*>/g, "")
    .replace(/[<>"'`;]/g, "")
    .trim()
    .slice(0, max);
}

interface TrackBody {
  eventType?: string;
  productId?: string;
  path?: string;
  sessionId?: string;
  utm?: {
    source?: string;
    medium?: string;
    campaign?: string;
    term?: string;
    content?: string;
  };
}

const ALLOWED_EVENTS = new Set(["page_view", "add_to_cart"]);

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

    const body: TrackBody = await req.json();

    if (!body.eventType || !ALLOWED_EVENTS.has(body.eventType)) {
      return NextResponse.json({ error: "Invalid event type" }, { status: 400 });
    }

    const supabase = supabaseServer();
    if (!supabase) {
      // Не налаштовано (немає env) — сайт все одно повинен працювати.
      return NextResponse.json({ success: true, tracked: false });
    }

    const { error } = await supabase.from("product_events").insert({
      event_type: body.eventType,
      product_id: body.productId ? sanitize(body.productId, 50) : null,
      path: body.path ? sanitize(body.path, 300) : null,
      session_id: body.sessionId ? sanitize(body.sessionId, 100) : null,
      utm_source: body.utm?.source ? sanitize(body.utm.source, 100) : null,
      utm_medium: body.utm?.medium ? sanitize(body.utm.medium, 100) : null,
      utm_campaign: body.utm?.campaign ? sanitize(body.utm.campaign, 150) : null,
      utm_term: body.utm?.term ? sanitize(body.utm.term, 150) : null,
      utm_content: body.utm?.content ? sanitize(body.utm.content, 150) : null,
    });

    if (error) {
      // Напр. FK-конфлікт, якщо productId не збігається з жодним товаром —
      // не повинно ламати досвід користувача, просто лог на сервері.
      console.error("[track] Supabase insert failed:", error);
      return NextResponse.json({ success: true, tracked: false });
    }

    return NextResponse.json({ success: true, tracked: true });
  } catch (error) {
    console.error("[track] error:", error);
    return NextResponse.json({ success: true, tracked: false });
  }
}
