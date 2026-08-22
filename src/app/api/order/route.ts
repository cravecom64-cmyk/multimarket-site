import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// ==================== КОМАНДНИЙ ЦЕНТР (Supabase) ====================
// Незалежна база — джерело істини по замовленнях. Пишеться ПЕРШОЮ, до
// Telegram і до CRM: навіть якщо Telegram чи KeyCRM зараз недоступні,
// замовлення все одно збережеться тут і нічого не загубиться.
// Ключі — тільки серверні env vars (Vercel → Project Settings → Environment
// Variables): NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY.
function supabaseServer() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null; // не налаштовано — просто пропускаємо крок
  return createClient(url, key, { auth: { persistSession: false } });
}

async function saveOrderToSupabase(body: OrderBody, calculatedTotal: number): Promise<number | null> {
  const supabase = supabaseServer();
  if (!supabase) return null;

  try {
    const { data: orderRow, error: orderError } = await supabase
      .from("orders")
      .insert({
        customer_name: body.name,
        customer_phone: body.phone,
        city: body.city,
        np_warehouse: body.branch,
        payment_method: body.paymentMethod === "cod" ? "cod" : "prepay_card",
        payment_status: "not_paid",
        total_amount: calculatedTotal,
        status: "new",
      })
      .select("id")
      .single();

    if (orderError || !orderRow) {
      console.error("[order] Supabase order insert failed:", orderError);
      return null;
    }

    const orderId = orderRow.id as number;

    const itemsToInsert = await Promise.all(
      body.items.map(async (item) => {
        let cheapest: { supplier_name: string; supplier_price: number; supplier_url: string } | null = null;
        if (item.id) {
          const { data } = await supabase
            .from("product_cheapest_supplier")
            .select("supplier_name, supplier_price, supplier_url")
            .eq("product_id", item.id)
            .maybeSingle();
          cheapest = data;
        }
        return {
          order_id: orderId,
          product_id: item.id ?? null,
          product_name_snap: item.name,
          qty: item.quantity,
          price_snap: item.price,
          supplier_name_snap: cheapest?.supplier_name ?? null,
          supplier_price_snap: cheapest?.supplier_price ?? null,
          supplier_url_snap: cheapest?.supplier_url ?? null,
        };
      })
    );

    const { error: itemsError } = await supabase.from("order_items").insert(itemsToInsert);
    if (itemsError) console.error("[order] Supabase order_items insert failed:", itemsError);

    return orderId;
  } catch (err) {
    console.error("[order] Supabase step threw:", err);
    return null;
  }
}

// ==================== KeyCRM (вимкнено, поки немає ключа) ====================
async function pushOrderToKeyCRM(body: OrderBody, orderId: number | null) {
  const apiKey = process.env.KEYCRM_API_KEY;
  const sourceId = process.env.KEYCRM_SOURCE_ID;
  if (!apiKey || !sourceId) return; // ключа ще нема — просто виходимо

  try {
    const res = await fetch("https://openapi.keycrm.app/v1/order", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        source_id: sourceId,
        buyer: { full_name: body.name, phone: body.phone },
        products: body.items.map((i) => ({ sku: i.id, name: i.name, quantity: i.quantity, price: i.price })),
        comment: orderId ? `Командний центр Multimarket #${orderId}` : undefined,
      }),
    });
    if (!res.ok) {
      console.error("[order] KeyCRM push failed:", res.status, await res.text());
      return;
    }
    const data = await res.json();
    if (orderId) {
      const supabase = supabaseServer();
      await supabase
        ?.from("orders")
        .update({ keycrm_order_id: String(data.id), keycrm_synced_at: new Date().toISOString() })
        .eq("id", orderId);
    }
  } catch (err) {
    console.error("[order] KeyCRM push error:", err);
  }
}

// ==================== RATE LIMITING ====================
// In-memory store: IP → timestamps of recent requests
const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_WINDOW = 60_000; // 1 minute
const RATE_LIMIT_MAX = 3; // max 3 orders per minute per IP

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const timestamps = rateLimitMap.get(ip) || [];
  // Keep only timestamps within the window
  const recent = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW);
  rateLimitMap.set(ip, recent);

  if (recent.length >= RATE_LIMIT_MAX) return true;
  recent.push(now);
  rateLimitMap.set(ip, recent);
  return false;
}

// Clean up old entries every 5 minutes to prevent memory leak
setInterval(() => {
  const now = Date.now();
  for (const [ip, timestamps] of rateLimitMap.entries()) {
    const recent = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW);
    if (recent.length === 0) rateLimitMap.delete(ip);
    else rateLimitMap.set(ip, recent);
  }
}, 300_000);

// ==================== VALIDATION ====================
// Приймає всі поширені формати: +380XXXXXXXXX, 380XXXXXXXXX, 0XXXXXXXXX
// (з пробілами/дужками/дефісами — вони прибираються нижче в validatePhone).
// "+38"/"38" — єдиний блок (не окремі опціональні символи), інакше можна
// випадково пропустити биту комбінацію типу "+80663306639" (без "3").
const UA_PHONE_REGEX = /^(?:\+?38)?0\d{9}$/;

function sanitize(str: string): string {
  return str
    .replace(/<[^>]*>/g, "") // strip HTML
    .replace(/[<>"'`;]/g, "") // strip dangerous chars
    .trim()
    .slice(0, 500); // max length
}

function validatePhone(phone: string): boolean {
  const cleaned = phone.replace(/[\s()-]/g, "");
  return UA_PHONE_REGEX.test(cleaned);
}

// ==================== TYPES ====================
interface OrderItem {
  id?: string; // id товару з products.json ('h01', 'bk19', ...) — для командного центру
  name: string;
  price: number;
  quantity: number;
}

interface OrderBody {
  name: string;
  phone: string;
  city: string;
  branch: string;
  comment: string;
  items: OrderItem[];
  totalPrice: number;
  // "card_mono" — оплата карткою через Monobank Acquiring;
  // "card_wfp" — оплата карткою через WayForPay;
  // "cod" — оплата при отриманні (за замовчуванням, якщо поле відсутнє)
  paymentMethod?: "card_mono" | "card_wfp" | "cod";
  // Наш внутрішній ID замовлення — генерується на клієнті ДО відправки,
  // передається і сюди (для Telegram), і в /api/checkout/monobank (як
  // reference в інвойсі), і в webhook — так продавець може зіставити
  // заявку з підтвердженням оплати за одним номером.
  orderId?: string;
  // Honeypot field — must be empty
  website?: string;
  // Timing check — timestamp when form was loaded
  _t?: number;
}

// ==================== HANDLER ====================
export async function POST(req: NextRequest) {
  try {
    // --- Rate limiting ---
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";

    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429 }
      );
    }

    // --- Check content type ---
    const contentType = req.headers.get("content-type");
    if (!contentType?.includes("application/json")) {
      return NextResponse.json(
        { error: "Invalid content type" },
        { status: 415 }
      );
    }

    const body: OrderBody = await req.json();

    // --- Honeypot check (bots fill hidden fields) ---
    if (body.website) {
      // Bot detected — return fake success so bot thinks it worked
      return NextResponse.json({ success: true });
    }

    // --- Timing check (form filled in < 3 seconds = bot) ---
    if (body._t && Date.now() - body._t < 3000) {
      return NextResponse.json({ success: true });
    }

    // --- Validate & sanitize ---
    const name = sanitize(body.name || "");
    const phone = (body.phone || "").replace(/[\s()-]/g, "");
    const city = sanitize(body.city || "");
    const branch = sanitize(body.branch || "");
    const comment = sanitize(body.comment || "");

    if (!name || name.length < 2) {
      return NextResponse.json(
        { error: "Invalid name" },
        { status: 400 }
      );
    }

    if (!validatePhone(phone)) {
      return NextResponse.json(
        { error: "Invalid phone number" },
        { status: 400 }
      );
    }

    if (!city || city.length < 2) {
      return NextResponse.json(
        { error: "Invalid city" },
        { status: 400 }
      );
    }

    if (!branch || branch.length < 3) {
      return NextResponse.json(
        { error: "Invalid NP branch" },
        { status: 400 }
      );
    }

    if (!body.items || !Array.isArray(body.items) || body.items.length === 0 || body.items.length > 50) {
      return NextResponse.json(
        { error: "Invalid cart" },
        { status: 400 }
      );
    }

    // Validate each item
    for (const item of body.items) {
      if (!item.name || typeof item.price !== "number" || item.price <= 0 ||
          typeof item.quantity !== "number" || item.quantity <= 0 || item.quantity > 99) {
        return NextResponse.json(
          { error: "Invalid cart item" },
          { status: 400 }
        );
      }
    }

    // --- Build Telegram message ---
    const itemsText = body.items
      .map(
        (item) =>
          `  • ${sanitize(item.name)} × ${item.quantity} = ${item.price * item.quantity}₴`
      )
      .join("\n");

    const calculatedTotal = body.items.reduce(
      (sum, item) => sum + item.price * item.quantity, 0
    );

    // --- Командний центр: пишемо ПЕРШИМИ, до Telegram і CRM ---
    // Не блокує відповідь користувачу, якщо Supabase недоступний.
    const commandCenterOrderId = await saveOrderToSupabase(body, calculatedTotal);

    const paymentMethod =
      body.paymentMethod === "card_mono" || body.paymentMethod === "card_wfp"
        ? body.paymentMethod
        : "cod";
    const paymentLine =
      paymentMethod === "card_mono"
        ? "💳 *Оплата: КАРТКОЮ ОНЛАЙН через Monobank — очікуємо підтвердження оплати*"
        : paymentMethod === "card_wfp"
        ? "💳 *Оплата: КАРТКОЮ ОНЛАЙН через WayForPay — очікуємо підтвердження оплати*"
        : "💰 *Оплата: при отриманні \\(накладений платіж\\)*";
    const orderIdLine = body.orderId ? `🔖 *№ ${escapeMarkdown(body.orderId)}*\n` : "";

    const message = `🛒 *НОВЕ ЗАМОВЛЕННЯ!*
${orderIdLine}
👤 *Ім'я:* ${escapeMarkdown(name)}
📞 *Телефон:* ${escapeMarkdown(phone)}
🏙 *Місто:* ${escapeMarkdown(city)}
📦 *Відділення НП:* ${escapeMarkdown(branch)}
${comment ? `💬 *Коментар:* ${escapeMarkdown(comment)}` : ""}

📋 *Товари:*
${itemsText}

💰 *Сума: ${calculatedTotal}₴*
${calculatedTotal >= 2000 ? "✅ Безкоштовна доставка" : "📦 Доставка НП ~60\\-80₴"}
${paymentLine}

🌐 IP: ${ip}
⏰ ${new Date().toLocaleString("uk-UA", { timeZone: "Europe/Kyiv" })}`;

    // --- Send to Telegram ---
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!botToken || !chatId) {
      console.error("Telegram credentials not configured");
      return NextResponse.json({ success: true, notified: false });
    }

    const tgRes = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: "Markdown",
        }),
      }
    );

    if (!tgRes.ok) {
      console.error("Telegram API error:", await tgRes.text());
    }

    // --- KeyCRM: no-op, поки немає ключа (див. функцію вище) ---
    await pushOrderToKeyCRM(body, commandCenterOrderId);

    return NextResponse.json({ success: true, notified: tgRes.ok });
  } catch (error) {
    console.error("Order error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

function escapeMarkdown(text: string): string {
  return text.replace(/[_*[\]()~`>#+=|{}.!-]/g, "\\$&");
}
