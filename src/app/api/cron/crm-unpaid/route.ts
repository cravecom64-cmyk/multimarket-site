import { NextRequest, NextResponse } from "next/server";
import { supabaseService, pushOrderToCrm } from "@/lib/crmPush";

// Кожні 10 хв (pg_cron у Supabase, задача "crm-unpaid-orders"):
//  • замовлення без оплати старші за 30 хв → у CRM з позначкою «НЕ ОПЛАЧЕНО»;
//  • оплачені, які не пішли в CRM (збій SalesDrive), → повтор, до 3 спроб.
// Авторизація: CRON_SECRET або токен private_settings.crm_push_token.
export const maxDuration = 60;

const UNPAID_AFTER_MIN = 30;

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

  const now = Date.now();
  const unpaidBefore = new Date(now - UNPAID_AFTER_MIN * 60_000).toISOString();
  const notOlderThan = new Date(now - 3 * 24 * 3600_000).toISOString();

  const { data: rows, error } = await db
    .from("orders")
    .select("id, payment_status, created_at")
    .is("crm_pushed_at", null)
    .lt("crm_push_attempts", 3)
    .gte("created_at", notOlderThan)
    .order("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const results: { id: number; mode: string; pushed: boolean; reason?: string }[] = [];
  for (const r of rows ?? []) {
    const paid = r.payment_status === "paid";
    if (!paid && r.created_at > unpaidBefore) continue; // ще чекаємо оплату
    const mode = paid ? "paid" : "unpaid";
    const res = await pushOrderToCrm(db, r.id as number, mode);
    results.push({ id: r.id as number, mode, ...res });
  }
  return NextResponse.json({ checked: rows?.length ?? 0, results });
}
