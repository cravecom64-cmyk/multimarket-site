import { supabaseService } from "@/lib/crmPush";
import type { PayMode } from "@/lib/checkout";

/**
 * Спосіб оплати для платіжних роутів береться з ЗБЕРЕЖЕНОГО замовлення
 * (api/order пише його першим), а не з тіла запиту — щоб не можна було
 * записати замовлення як «повна оплата», а заплатити лише передоплату.
 * Якщо рядка немає (Supabase недоступний) — те, що прислав клієнт.
 */
export async function storedPayMode(orderRef: string, fallback: unknown): Promise<PayMode> {
  const db = supabaseService();
  if (db && orderRef) {
    const { data } = await db.from("orders").select("payment_method").eq("order_ref", orderRef).maybeSingle();
    if (data?.payment_method) return data.payment_method === "deposit_cod" ? "cod" : "full";
  }
  return fallback === "cod" ? "cod" : "full";
}
