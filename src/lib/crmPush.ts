import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// ==================== Передача замовлень у CRM (SalesDrive, КЦ SalesWave) ====================
// З 14.11.2026 (рішення Павла): замовлення йде в CRM НЕ одразу при
// оформленні, а:
//   • одразу після підтвердження оплати (вебхук mono / WayForPay) — "paid";
//   • якщо за 30 хв оплати немає — "unpaid", з позначкою «НЕ ОПЛАЧЕНО —
//     дотиснути» (крон /api/cron/crm-unpaid, викликається pg_cron у Supabase).
// Раніше заявка йшла одразу при натисканні «Оформити» з текстом
// «Передоплата ОТРИМАНА», навіть якщо клієнт так і не заплатив.
//
// Статус КЦ — поки текстом на початку коментаря. Коли SalesWave дасть ID
// статусів для API, вписати їх у SALESDRIVE_STATUS_IDS (і поле, як вони
// скажуть) — нічого іншого міняти не треба.

export type CrmStatus = "Новий" | "Підтверджено — післяплата" | "Підтверджено - оплатили" | "Переписка viber";

// TODO(SalesWave): ID статусів SalesDrive для /handler/. Поки невідомі.
const SALESDRIVE_STATUS_IDS: Partial<Record<CrmStatus, number>> = {};

type OrderRow = {
  id: number;
  created_at: string;
  customer_name: string | null;
  customer_phone: string | null;
  city: string | null;
  np_warehouse: string | null;
  payment_method: string | null;
  payment_status: string | null;
  total_amount: number | null;
  prepaid_amount: number | null;
  cod_amount: number | null;
  order_ref: string | null;
  confirm_call: boolean | null;
  order_comment: string | null;
  crm_pushed_at: string | null;
  crm_push_state: string | null;
  crm_push_attempts: number;
};
type ItemRow = { product_id: string | null; product_name_snap: string; qty: number; price_snap: number };

export function supabaseService(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

const uah = (n: number | null) => `${Math.round(Number(n ?? 0))}₴`;

// Який статус КЦ і що написати — за схемою, погодженою з Павлом 14.11.2026.
export function crmPlan(o: Pick<OrderRow, "payment_method" | "prepaid_amount" | "cod_amount" | "total_amount" | "confirm_call">, paid: boolean): {
  status: CrmStatus;
  paymentLabel: string;
  note: string;
} {
  const deposit = o.payment_method === "deposit_cod";
  const callOk = o.confirm_call !== false;
  if (paid && !deposit) {
    return {
      status: "Підтверджено - оплатили",
      paymentLabel: `ОПЛАЧЕНО ПОВНІСТЮ онлайн ${uah(o.total_amount)} — накладений платіж НЕ ставити`,
      note: `✅ Оплачено повністю ${uah(o.total_amount)} онлайн. Накладений платіж НЕ ставити. Дзвінок не потрібен.`,
    };
  }
  if (paid && deposit) {
    return {
      status: callOk ? "Новий" : "Підтверджено — післяплата",
      paymentLabel: `Передоплата ${uah(o.prepaid_amount)} ОТРИМАНА онлайн, накладений платіж ${uah(o.cod_amount)} (НЕ стягувати повну суму!)`,
      note: `✅ Передоплата ${uah(o.prepaid_amount)} отримана онлайн. Накладений платіж: ${uah(o.cod_amount)}.`,
    };
  }
  const due = deposit ? o.prepaid_amount : o.total_amount;
  return {
    status: callOk ? "Новий" : "Переписка viber",
    paymentLabel: `НЕ ОПЛАЧЕНО: потрібно ${deposit ? "передоплату" : "оплату"} ${uah(due)} онлайн`,
    note:
      `⚠️ НЕ ОПЛАЧЕНО — клієнт не завершив оплату ${uah(due)} на сайті. ` +
      (callOk ? "Зателефонувати" : "Написати у Viber (клієнт просив не дзвонити)") +
      ` і надіслати посилання на оплату. Без оплати НЕ відправляти.` +
      (deposit ? ` Після передоплати накладений платіж: ${uah(o.cod_amount)}.` : ""),
  };
}

async function sendToSalesDrive(o: OrderRow, items: ItemRow[], paid: boolean): Promise<{ ok: boolean; id?: string; error?: string }> {
  const apiKey = process.env.SALESDRIVE_API_KEY;
  if (!apiKey) return { ok: false, error: "SALESDRIVE_API_KEY не налаштовано" };

  const plan = crmPlan(o, paid);
  const nameParts = (o.customer_name ?? "").trim().split(/\s+/);
  const callTag =
    o.confirm_call === false
      ? "📩 Клієнт просить НЕ дзвонити — писати повідомленням/SMS"
      : "☎️ Клієнт очікує дзвінок для підтвердження";
  const comment = [`[СТАТУС: ${plan.status}]`, plan.note, callTag, o.order_comment].filter(Boolean).join(" | ");
  const statusId = SALESDRIVE_STATUS_IDS[plan.status];

  try {
    const res = await fetch("https://saleswave.salesdrive.me/handler/", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Api-Key": apiKey },
      body: JSON.stringify({
        getResultData: "1",
        phone: o.customer_phone,
        fName: nameParts[0] || o.customer_name,
        lName: nameParts.slice(1).join(" ") || undefined,
        novaposhta: { ServiceType: "Warehouse", payer: "recipient", city: o.city, WarehouseNumber: o.np_warehouse },
        products: items.map((i) => ({
          id: i.product_id ?? undefined,
          name: i.product_name_snap,
          costPerItem: Number(i.price_snap),
          amount: i.qty,
          sku: i.product_id ?? undefined,
        })),
        payment_method: plan.paymentLabel,
        shipping_method: "Нова Пошта",
        comment,
        sajt: "multi-market.com.ua",
        externalId: String(o.id),
        ...(statusId ? { status: statusId } : {}),
      }),
    });
    const text = await res.text();
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}: ${text.slice(0, 200)}` };
    let id: string | undefined;
    try {
      const data = JSON.parse(text);
      id = data?.data?.id ? String(data.data.id) : undefined;
    } catch {
      // SalesDrive інколи відповідає не JSON — це не помилка передачі
    }
    return { ok: true, id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

async function telegram(text: string) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!botToken || !chatId) return;
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  }).catch(() => undefined);
}

/**
 * Передати замовлення в CRM. Атомарно «бронює» рядок (crm_pushed_at), тож
 * вебхук і крон не задвоять заявку. Якщо замовлення вже пішло як «не
 * оплачено», а оплата прийшла пізніше, — повторно не шлемо, а пишемо в
 * Telegram змінити статус у SalesDrive вручну.
 */
export async function pushOrderToCrm(
  db: SupabaseClient,
  orderId: number,
  mode: "paid" | "unpaid"
): Promise<{ pushed: boolean; reason?: string }> {
  const { data: o } = await db.from("orders").select("*").eq("id", orderId).maybeSingle<OrderRow>();
  if (!o) return { pushed: false, reason: "not_found" };

  if (o.crm_pushed_at) {
    if (mode === "paid" && o.crm_push_state === "unpaid") {
      await db.from("orders").update({ crm_push_state: "unpaid_then_paid" }).eq("id", o.id).eq("crm_push_state", "unpaid");
      const plan = crmPlan(o, true);
      await telegram(
        `💳 Замовлення #${o.id} ОПЛАЧЕНО вже після передачі в CRM як «не оплачено».\n` +
          `Змініть у SalesDrive статус на «${plan.status}»: ${plan.note}`
      );
    }
    return { pushed: false, reason: "already" };
  }

  // бронюємо: лише один процес пройде цю умову
  const { data: claimed } = await db
    .from("orders")
    .update({ crm_pushed_at: new Date().toISOString(), crm_push_state: mode, crm_push_attempts: o.crm_push_attempts + 1 })
    .eq("id", o.id)
    .is("crm_pushed_at", null)
    .select("id");
  if (!claimed || claimed.length === 0) return { pushed: false, reason: "race" };

  const { data: items } = await db
    .from("order_items")
    .select("product_id, product_name_snap, qty, price_snap")
    .eq("order_id", o.id);
  const r = await sendToSalesDrive(o, (items ?? []) as ItemRow[], mode === "paid");

  if (!r.ok) {
    // знімаємо бронь — крон спробує ще (до 3 спроб), потім сигнал у Telegram
    const attempts = o.crm_push_attempts + 1;
    await db.from("orders").update({ crm_pushed_at: null, crm_push_state: null }).eq("id", o.id);
    console.error(`[crm] замовлення #${o.id}: ${r.error}`);
    if (attempts >= 3) {
      await telegram(`⚠️ Замовлення #${o.id} не вдалося передати в CRM (SalesDrive) за ${attempts} спроби: ${r.error}. Додайте вручну.`);
    }
    return { pushed: false, reason: r.error };
  }
  await db
    .from("orders")
    .update({ salesdrive_order_id: r.id ?? null, salesdrive_synced_at: new Date().toISOString() })
    .eq("id", o.id);
  return { pushed: true };
}

/** Для вебхуків оплати: знайти замовлення за order_ref і передати як оплачене. */
export async function pushPaidOrderByRef(orderRef: string): Promise<void> {
  const db = supabaseService();
  if (!db || !orderRef || orderRef === "?") return;
  const { data } = await db.from("orders").select("id").eq("order_ref", orderRef).maybeSingle();
  if (data?.id) await pushOrderToCrm(db, data.id as number, "paid");
}
