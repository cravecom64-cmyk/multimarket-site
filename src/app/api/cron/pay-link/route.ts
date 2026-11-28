import { NextRequest, NextResponse } from "next/server";
import { supabaseService } from "@/lib/crmPush";
import { payLinkUrl } from "@/lib/payLink";

// 28.11.2026: посилання на оплату (/pay/<ref>) для замовлень, оформлених ДО того,
// як ці посилання почали додаватися в Telegram і CRM. Повертає підписане посилання
// (рахунок mono на 24 год, сума — з бази). Авторизація як у /api/cron/crm-unpaid.
export async function GET(req: NextRequest) {
  const db = supabaseService();
  if (!db) return NextResponse.json({ error: "no_db" }, { status: 500 });
  const auth = req.headers.get("authorization") ?? "";
  const secret = process.env.CRON_SECRET;
  let ok = Boolean(secret && auth === `Bearer ${secret}`);
  if (!ok && auth.startsWith("Bearer ")) {
    const { data: tok } = await db.from("private_settings").select("value").eq("key", "crm_push_token").maybeSingle();
    ok = Boolean(tok?.value && tok.value.length >= 32 && auth === `Bearer ${tok.value}`);
  }
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const ref = req.nextUrl.searchParams.get("ref") ?? "";
  const { data: o } = await db.from("orders").select("order_ref, payment_status").eq("order_ref", ref).maybeSingle();
  if (!o) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ url: payLinkUrl(ref), paid: o.payment_status === "paid" });
}
