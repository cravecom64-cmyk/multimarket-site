import { createHash } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

// ДОДАНО 24.11.2026 (аудит сайту, п.2+п.3): серверне підтвердження Purchase
// по сигналу реальної оплати (вебхуки Monobank/WayForPay), а не лише коли
// браузер клієнта сам долітає до /order/success і встигає виконати JS.
// Раніше ВСІ Purchase-події (GA4 + Meta Pixel) йшли ВИКЛЮЧНО з браузера на
// сторінці успіху — а з 12.11.2026 чистої "наложки" без онлайн-оплати більше
// нема (рішення Павла), тобто buh ЦЕ ЄДИНИЙ шлях Purchase для 100% замовлень.
// Якщо людина закриває вкладку одразу після оплати (типово — закрила банк.
// застосунок і не чекає редиректу назад), конверсія повністю губиться для
// рекламних платформ, хоча гроші реально отримані і в Supabase/CRM все ок.
//
// Тут — відправка тієї ж Purchase-події напряму з сервера (GA4 Measurement
// Protocol + Meta Conversions API), в момент коли вебхук підтверджує оплату.
// Разом із цим — п.3 аудиту: хешований телефон/ім'я покупця в Meta (advanced
// matching) підвищує якість матчингу conversion-подій з конкретним
// рекламним кліком/акаунтом.
//
// Дедуплікація з клієнтським пікселем:
//  - Meta: той самий event_id (= orderId) і в fbq('track', ..., {eventID}),
//    і в CAPI — Meta сама дедуплікує, якщо обидва долетіли (документована
//    поведінка Conversions API).
//  - GA4 Measurement Protocol НЕ має офіційної дедуплікації по event_id —
//    тому хто першим "застовбить" orders.analytics_purchase_sent_at
//    (атомарний UPDATE ... WHERE analytics_purchase_sent_at IS NULL) —
//    той і шле GA4 Purchase; другий — пропускає. Де саме береться на себе
//    ця умова: /api/track-purchase-confirmed (клієнт) і самі вебхуки (сервер).
//
// Обидві функції — безпечні no-op, поки не задані env-змінні з токенами
// (той самий принцип, що вже є для SALESDRIVE_API_KEY/TURBOSMS_API_KEY) —
// можна деплоїти вже зараз, а активувати просто додавши ключі в Vercel,
// без правок коду.

export type ConversionOrder = {
  order_ref: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  total_amount: number | null;
  fbp: string | null;
  fbc: string | null;
  ga_client_id: string | null;
  client_user_agent: string | null;
  client_ip: string | null;
};

export type ConversionItem = {
  product_id: string | null;
  product_name_snap: string;
  qty: number;
  price_snap: number;
};

const CURRENCY = "UAH";
// Той самий Measurement ID, що й у клієнтському GoogleAnalytics.tsx —
// публічний ідентифікатор потоку даних, не секрет.
const GA4_MEASUREMENT_ID = "G-FZDD4K8SFP";

function sha256Lower(value: string): string {
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

// Meta вимагає телефон у форматі "код_країни+номер" БЕЗ "+", пробілів, дужок.
// Наші номери приходять як "+380XXXXXXXXX" / "380XXXXXXXXX" / "0XXXXXXXXX".
function normalizePhoneForMeta(phone: string): string | null {
  const digits = phone.replace(/[^\d]/g, "");
  if (digits.startsWith("380") && digits.length === 12) return digits;
  if (digits.startsWith("0") && digits.length === 10) return `38${digits}`;
  return digits.length >= 10 ? digits : null;
}

/**
 * Meta Conversions API — server-side Purchase. eventId має збігатись з
 * eventID, який клієнтський fbq() шле для того самого замовлення (dedup).
 */
export async function sendMetaCapiPurchase(
  order: ConversionOrder,
  items: ConversionItem[],
  eventId: string
): Promise<void> {
  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;
  const accessToken = process.env.META_CONVERSIONS_API_TOKEN;
  if (!pixelId || !accessToken) return; // не налаштовано — тихо пропускаємо, як і решта інтеграцій

  const userData: Record<string, unknown> = {};
  if (order.customer_phone) {
    const normalized = normalizePhoneForMeta(order.customer_phone);
    if (normalized) userData.ph = [sha256Lower(normalized)];
  }
  if (order.customer_name) {
    const parts = order.customer_name.trim().split(/\s+/);
    if (parts[0]) userData.fn = [sha256Lower(parts[0])];
    if (parts.length > 1) userData.ln = [sha256Lower(parts.slice(1).join(" "))];
  }
  if (order.client_ip) userData.client_ip_address = order.client_ip;
  if (order.client_user_agent) userData.client_user_agent = order.client_user_agent;
  if (order.fbp) userData.fbp = order.fbp;
  if (order.fbc) userData.fbc = order.fbc;

  const payload = {
    data: [
      {
        event_name: "Purchase",
        event_time: Math.floor(Date.now() / 1000),
        event_id: eventId,
        action_source: "website",
        event_source_url: "https://multi-market.com.ua/order/success",
        user_data: userData,
        custom_data: {
          currency: CURRENCY,
          value: Number(order.total_amount ?? 0),
          content_type: "product",
          contents: items.map((i) => ({
            id: i.product_id ?? undefined,
            quantity: i.qty,
            item_price: Number(i.price_snap),
          })),
          num_items: items.reduce((s, i) => s + i.qty, 0),
        },
      },
    ],
  };

  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${pixelId}/events?access_token=${encodeURIComponent(accessToken)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );
    if (!res.ok) {
      console.error("[serverConversions] Meta CAPI Purchase failed:", res.status, await res.text());
    }
  } catch (e) {
    console.error("[serverConversions] Meta CAPI Purchase error:", e);
  }
}

/**
 * GA4 Measurement Protocol — server-side Purchase. transaction_id (= eventId)
 * той самий orderId, щоб у звітах можна було зіставити з клієнтською подією
 * (сама GA4 офіційного dedup по ньому не робить — про це подбано на рівні
 * виклику, див. коментар на початку файлу).
 */
export async function sendGa4Purchase(
  order: ConversionOrder,
  items: ConversionItem[],
  eventId: string
): Promise<void> {
  const apiSecret = process.env.GA4_MEASUREMENT_PROTOCOL_API_SECRET;
  if (!apiSecret) return;

  // GA4 Measurement Protocol вимагає client_id. Якщо кукі _ga з якоїсь
  // причини не знялась (блокувальник, Safari ITP тощо) — генеруємо разовий
  // псевдо-client_id: подія однаково потрапить у GA4 (дохід порахується),
  // просто не прив'яжеться до історичної сесії цього відвідувача.
  const clientId = order.ga_client_id || `server.${Date.now()}.${Math.random().toString(36).slice(2)}`;

  const payload = {
    client_id: clientId,
    events: [
      {
        name: "purchase",
        params: {
          transaction_id: eventId,
          currency: CURRENCY,
          value: Number(order.total_amount ?? 0),
          items: items.map((i) => ({
            item_id: i.product_id ?? undefined,
            item_name: i.product_name_snap,
            price: Number(i.price_snap),
            quantity: i.qty,
          })),
        },
      },
    ],
  };

  try {
    const res = await fetch(
      `https://www.google-analytics.com/mp/collect?measurement_id=${GA4_MEASUREMENT_ID}&api_secret=${encodeURIComponent(apiSecret)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );
    // GA4 MP завжди повертає 2xx навіть при частково некоректному payload
    // (валідація лише через debug-ендпоінт) — усе одно логуємо не-2xx про всяк випадок.
    if (!res.ok) {
      console.error("[serverConversions] GA4 Measurement Protocol Purchase failed:", res.status, await res.text());
    }
  } catch (e) {
    console.error("[serverConversions] GA4 Measurement Protocol Purchase error:", e);
  }
}

/**
 * Атомарно "застовбити" право відправити Purchase-аналітику для цього
 * замовлення — щоб клієнт (/order/success) і вебхук оплати не задвоїли
 * GA4-подію (Meta дедуплікує сама по event_id, але застовбити все одно
 * варто, щоб не слати CAPI двічі без потреби).
 */
export async function claimAnalyticsPurchase(
  db: SupabaseClient,
  orderId: number
): Promise<boolean> {
  const { data } = await db
    .from("orders")
    .update({ analytics_purchase_sent_at: new Date().toISOString() })
    .eq("id", orderId)
    .is("analytics_purchase_sent_at", null)
    .select("id");
  return Array.isArray(data) && data.length > 0;
}

type OrderForConversions = ConversionOrder & { id: number };

/**
 * Викликається з вебхуків оплати (Monobank/WayForPay) одразу після
 * підтвердження успішної оплати. Meta CAPI шлемо ЗАВЖДИ (Meta дедуплікує
 * сама по event_id з клієнтським Pixel, якщо той теж долетить) — GA4
 * тільки якщо саме цей виклик встиг першим "застовбити" замовлення
 * (claimAnalyticsPurchase), інакше клієнт на /order/success вже міг
 * порахувати його сам (GA4 Measurement Protocol дедуплікації не має).
 */
export async function reportPaidOrderConversions(db: SupabaseClient, orderRef: string): Promise<void> {
  if (!orderRef || orderRef === "?") return;

  const { data: order } = await db
    .from("orders")
    .select("id, order_ref, customer_name, customer_phone, total_amount, fbp, fbc, ga_client_id, client_user_agent, client_ip")
    .eq("order_ref", orderRef)
    .maybeSingle<OrderForConversions>();
  if (!order) return;

  const { data: items } = await db
    .from("order_items")
    .select("product_id, product_name_snap, qty, price_snap")
    .eq("order_id", order.id);

  const eventId = order.order_ref ?? orderRef;
  await sendMetaCapiPurchase(order, (items ?? []) as ConversionItem[], eventId);

  const wonClaim = await claimAnalyticsPurchase(db, order.id);
  if (wonClaim) {
    await sendGa4Purchase(order, (items ?? []) as ConversionItem[], eventId);
  }
}
