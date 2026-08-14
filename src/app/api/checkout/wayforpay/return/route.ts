import { NextRequest, NextResponse } from "next/server";

// WayForPay після оплати повертає клієнта на returnUrl НЕ звичайним
// GET-редиректом, а POST-запитом (авто-сабміт форми на їхній стороні).
// Next.js App Router сторінки (page.tsx) не вміють приймати POST напряму —
// звідси "Server action not found" на /order/success. Цей роут ловить
// і GET, і POST, дістає orderReference/ref, і робить 303-редирект на
// справжню сторінку — 303 примусово конвертує POST у GET у браузера.
const SITE_URL = "https://www.multi-market.com.ua";

function parseOrderId(reference: string | null): string | null {
  if (!reference) return null;
  const match = reference.match(/^(.+?)--p(\d*)--i(.*)$/);
  return match ? match[1] : reference;
}

async function handle(req: NextRequest): Promise<NextResponse> {
  let orderReference: string | null = null;

  if (req.method === "POST") {
    try {
      const form = await req.formData();
      const raw = form.get("orderReference");
      if (typeof raw === "string") orderReference = raw;
    } catch {
      // не форма — ігноруємо, впадемо на query params нижче
    }
  }

  if (!orderReference) {
    orderReference = req.nextUrl.searchParams.get("orderReference");
  }

  // Власний ?ref= (плоский orderId без телефону) — ми самі додаємо його в
  // returnUrl при створенні платежу, тож він завжди є в query.
  const refParam = req.nextUrl.searchParams.get("ref");
  const orderId = refParam || parseOrderId(orderReference) || "";

  const url = new URL("/order/success", SITE_URL);
  if (orderId) url.searchParams.set("ref", orderId);
  url.searchParams.set("gw", "wfp");

  return NextResponse.redirect(url, 303);
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
