import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { claimAnalyticsPurchase } from "@/lib/serverConversions";

// ДОДАНО 24.11.2026 (аудит сайту п.2): викликається з /order/success у
// момент, коли браузер клієнта сам підтвердив реальну оплату (опитуванням
// /api/checkout/*/status). Атомарно "застовблює" orders.analytics_purchase_
// sent_at — щоб коли вебхук оплати (Monobank/WayForPay) теж спробує
// відправити Purchase у GA4 по цьому ж замовленню, він побачив, що клієнт
// уже встиг це зробити сам, і не задвоїв дохід у GA4 (там немає офіційної
// дедуплікації по event_id, на відміну від Meta). Детальніше —
// src/lib/serverConversions.ts.
function supabaseServer() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function POST(req: NextRequest) {
  let body: { orderRef?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ claimed: false }, { status: 400 });
  }

  const orderRef = body.orderRef;
  const db = supabaseServer();
  if (!db || !orderRef) return NextResponse.json({ claimed: false });

  const { data: order } = await db
    .from("orders")
    .select("id")
    .eq("order_ref", orderRef)
    .maybeSingle();
  if (!order) return NextResponse.json({ claimed: false });

  const claimed = await claimAnalyticsPurchase(db, order.id as number);
  return NextResponse.json({ claimed });
}
