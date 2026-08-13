import { NextRequest, NextResponse } from "next/server";
import { buildPurchaseFields } from "@/lib/wayforpay";

const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_WINDOW = 60_000;
const RATE_LIMIT_MAX = 3;

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

interface OrderItem {
  name: string;
  price: number;
  quantity: number;
}

interface CheckoutBody {
  orderId: string;
  items: OrderItem[];
  // Телефон клієнта — вшивається у технічний orderReference, який іде до
  // WayForPay (і повертається назад у webhook/CHECK_STATUS). Видимий для
  // клієнта orderId (у ?ref= і localStorage) лишається БЕЗ телефону —
  // технічний reference потрібен лише щоб webhook-сповіщення про відмову
  // оплати одразу показувало кому телефонувати.
  customerPhone?: string;
}

const SITE_URL = "https://www.multi-market.com.ua";

export async function POST(req: NextRequest) {
  try {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";

    if (isRateLimited(ip)) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const body: CheckoutBody = await req.json();

    if (!body.orderId || typeof body.orderId !== "string") {
      return NextResponse.json({ error: "Invalid orderId" }, { status: 400 });
    }

    if (!body.items || !Array.isArray(body.items) || body.items.length === 0 || body.items.length > 50) {
      return NextResponse.json({ error: "Invalid cart" }, { status: 400 });
    }

    for (const item of body.items) {
      if (
        !item.name ||
        typeof item.price !== "number" ||
        item.price <= 0 ||
        typeof item.quantity !== "number" ||
        item.quantity <= 0 ||
        item.quantity > 99
      ) {
        return NextResponse.json({ error: "Invalid cart item" }, { status: 400 });
      }
    }

    const phoneDigits = (body.customerPhone || "").replace(/\D/g, "");
    const technicalRef = phoneDigits ? `${body.orderId}-${phoneDigits}` : body.orderId;

    const { actionUrl, fields } = buildPurchaseFields({
      orderReference: technicalRef,
      items: body.items.map((i) => ({
        name: i.name.slice(0, 128),
        price: i.price,
        count: i.quantity,
      })),
      // ?ref= лишається чистим orderId (без телефону) — саме з ним звіряє
      // /order/success localStorage-запис.
      returnUrl: `${SITE_URL}/order/success?ref=${encodeURIComponent(body.orderId)}&gw=wfp`,
      serviceUrl: `${SITE_URL}/api/webhook/wayforpay`,
    });

    return NextResponse.json({ actionUrl, fields });
  } catch (error) {
    console.error("WayForPay checkout error:", error);
    return NextResponse.json({ error: "Payment gateway error" }, { status: 500 });
  }
}
