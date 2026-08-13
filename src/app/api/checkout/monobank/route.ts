import { NextRequest, NextResponse } from "next/server";
import { createInvoice } from "@/lib/monobank";

// Той самий rate-limit підхід, що й у /api/order — окремий лічильник,
// бо це окремий serverless endpoint (Vercel не ділить in-memory стан між ними).
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
  totalPrice: number;
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

    // Сума рахується СЕРВЕРНО з items, а не береться з body.totalPrice —
    // клієнт не може підмінити суму оплати.
    const calculatedTotal = body.items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );

    const invoice = await createInvoice({
      amount: Math.round(calculatedTotal * 100), // копійки
      reference: body.orderId,
      destination: `Замовлення ${body.orderId} — Multimarket`,
      basketOrder: body.items.map((i) => ({
        name: i.name.slice(0, 128),
        qty: i.quantity,
        sum: Math.round(i.price * 100),
        unit: "шт",
      })),
      redirectUrl: `${SITE_URL}/order/success?ref=${encodeURIComponent(body.orderId)}`,
      webHookUrl: `${SITE_URL}/api/webhook/monobank`,
      validitySeconds: 3600,
    });

    return NextResponse.json({
      invoiceId: invoice.invoiceId,
      pageUrl: invoice.pageUrl,
    });
  } catch (error) {
    console.error("Monobank checkout error:", error);
    return NextResponse.json({ error: "Payment gateway error" }, { status: 500 });
  }
}
