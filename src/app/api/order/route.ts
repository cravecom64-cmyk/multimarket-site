import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import productsData from "@/data/products.json";
import { getPaymentSplit, type PaymentSplit } from "@/lib/checkout";
import { variantLabel } from "@/lib/products";

// Мапа товарів за id — для перевірки, що покупець не оформлює замовлення
// на прихований/видалений товар (пряме посилання на стару/прибрану картку).
const PRODUCTS_BY_ID = new Map(
  (productsData as Array<{ id: string; isHidden?: boolean; colors?: { name: string; wire?: string; soldOut?: boolean }[] }>).map((p) => [p.id, p])
);

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

async function saveOrderToSupabase(body: OrderBody, calculatedTotal: number, split: PaymentSplit): Promise<number | null> {
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
        payment_method: split.isDeposit ? "deposit_cod" : "prepay_card",
        payment_status: "not_paid",
        total_amount: calculatedTotal,
        prepaid_amount: split.onlineAmount,
        cod_amount: split.codRemainder,
        // Клієнтський orderId (той самий, що летить у Monobank/WayForPay як
        // reference/orderReference) — по ньому вебхуки оплати (api/webhook/*)
        // знаходять цей рядок і виставляють payment_status. 12.11.2026.
        order_ref: body.orderId || null,
        status: "new",
        confirm_call: body.confirmCall !== false, // чекбокс на сайті; відсутнє поле = true (старі клієнти/дефолт)
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
          // Товар з кольором: посилання саме на цей колір (у LUGI кожен колір —
          // окрема сторінка), щоб замовляти в постачальника той, що обрав клієнт.
          const colorName = item.name.match(/\(([^()]+)\)\s*$/)?.[1];
          if (colorName) {
            const { data: byColor } = await supabase
              .from("product_suppliers")
              .select("price, url, in_stock, suppliers(name)")
              .eq("product_id", item.id)
              .eq("color", colorName)
              .order("in_stock", { ascending: false })
              .order("price", { ascending: true })
              .limit(1)
              .maybeSingle();
            if (byColor) {
              const sup = byColor.suppliers as unknown as { name: string } | { name: string }[] | null;
              cheapest = {
                supplier_name: (Array.isArray(sup) ? sup[0]?.name : sup?.name) ?? "",
                supplier_price: Number(byColor.price),
                supplier_url: byColor.url,
              };
            }
          }
          if (!cheapest) {
            const { data } = await supabase
              .from("product_cheapest_supplier")
              .select("supplier_name, supplier_price, supplier_url")
              .eq("product_id", item.id)
              .maybeSingle();
            cheapest = data;
          }
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

// ==================== SalesDrive (колл-центр SalesWave) ====================
// Окремий, незалежний від KeyCRM пуш — SalesWave дзвонить клієнту й підтверджує
// замовлення перед відправкою. Мінімальний набір полів (без email — його й
// нема в формі, без UTM/gaClientId — це наша внутрішня аналітика, їм зайве).
async function pushOrderToSalesDrive(body: OrderBody, orderId: number | null, split: PaymentSplit) {
  const apiKey = process.env.SALESDRIVE_API_KEY;
  if (!apiKey) return; // ключа ще нема — просто виходимо

  // Форма сайту збирає одне поле "ім'я" — ділимо на ім'я/прізвище для SalesDrive
  const nameParts = body.name.trim().split(/\s+/);
  const fName = nameParts[0] ?? body.name;
  const lName = nameParts.slice(1).join(" ") || undefined;

  // Чистої "наложки" без онлайн-частини більше не існує (Рішення Павла
  // 12.11.2026) — лейбл явно каже, скільки вже прийшло онлайн і скільки
  // лишилось стягнути при отриманні, щоб КЦ/ТТН не взяли повну суму ще раз.
  const paymentLabel = split.isDeposit
    ? `Передоплата ${split.onlineAmount}\u20b4 ОТРИМАНА онлайн, накладений платіж ${split.codRemainder}\u20b4 (НЕ стягувати повну суму!)`
    : "Оплата карткою онлайн (повна сума)";

  // Чекбокс "Зв'язатися зі мною для підтвердження замовлення" з форми —
  // передаємо менеджеру SalesDrive, щоб він знав дзвонити чи просто писати.
  // За замовчуванням (поле відсутнє) вважаємо true, як і на сайті.
  const callPrefTag =
    body.confirmCall === false
      ? "\ud83d\udce9 Клієнт просить НЕ дзвонити — писати повідомленням/SMS"
      : "\u260e\ufe0f Клієнт очікує дзвінок для підтвердження";

  // Та сама інформація про залишок — ще й у коментар, щоб було видно й
  // живій людині, яка дивиться заявку, а не лише в полі payment_method.
  const paymentNote = split.isDeposit
    ? `\u26a0\ufe0f Передоплата ${split.onlineAmount}\u20b4 вже отримана онлайн. До сплати при отриманні: ${split.codRemainder}\u20b4.`
    : null;

  const fullComment = [callPrefTag, paymentNote, body.comment].filter(Boolean).join(" | ");

  try {
    const res = await fetch("https://saleswave.salesdrive.me/handler/", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Api-Key": apiKey },
      body: JSON.stringify({
        getResultData: "1",
        phone: body.phone,
        fName,
        lName,
        novaposhta: {
          ServiceType: "Warehouse",
          payer: "recipient",
          city: body.city,
          WarehouseNumber: body.branch,
        },
        products: body.items.map((i) => ({
          id: i.id,
          name: i.name,
          costPerItem: i.price,
          amount: i.quantity,
          sku: i.id,
        })),
        payment_method: paymentLabel,
        shipping_method: "Нова Пошта",
        comment: fullComment,
        sajt: "multi-market.com.ua",
        externalId: orderId ? String(orderId) : body.orderId,
      }),
    });
    if (!res.ok) {
      console.error("[order] SalesDrive push failed:", res.status, await res.text());
      return;
    }
    const data = await res.json();
    if (orderId && data?.data?.id) {
      const supabase = supabaseServer();
      await supabase
        ?.from("orders")
        .update({ salesdrive_order_id: String(data.data.id), salesdrive_synced_at: new Date().toISOString() })
        .eq("id", orderId);
    }
  } catch (err) {
    console.error("[order] SalesDrive push error:", err);
  }
}

// ==================== TurboSMS ====================
// SMS одразу після оформлення заявки — "Дякуємо, менеджер зателефонує".
// Незалежний від Telegram/KeyCRM/SalesDrive пуш: якщо він впаде, замовлення
// все одно вже збережене в Supabase і пішло в Telegram/SalesDrive вище.
//
// Ім'я відправника "Multimarket" зараз на НАЙПЕРШІЙ стадії модерації
// (⏳ — на розгляді в самого TurboSMS, ще навіть не передано операторам).
// На цій стадії TurboSMS НЕ підміняє його на загальний відправник (на
// відміну від того, що написано в їх загальній документації) — запит
// з sender="Multimarket" просто відхиляється з кодом
// NOT_ALLOWED_MESSAGE_SENDER (перевірено 07.11.2026 по живих логах).
// Автопідміна запрацює тільки на НАСТУПНІЙ стадії (✅🔄 — пройшло
// модерацію TurboSMS, очікує реєстрації в операторів).
//
// Тому поки що відправляємо від готового "спільного" (Общие) відправника
// з кабінету TurboSMS — TurboSMS → Отправители → Отправители SMS → Общие.
// Коли "Multimarket" дійде до стадії ✅🔄 (чи повної реєстрації), просто
// повернути sender назад на "Multimarket" нижче.
const TURBOSMS_SENDER = "MAGAZIN";
function toTurboSmsPhone(phone: string): string | null {
  const cleaned = phone.replace(/[\s()-]/g, "").replace(/^\+/, "");
  if (/^380\d{9}$/.test(cleaned)) return cleaned;
  if (/^0\d{9}$/.test(cleaned)) return "38" + cleaned;
  return null;
}

async function pushSmsNotification(body: OrderBody, orderId: number | null) {
  const apiKey = process.env.TURBOSMS_API_KEY;
  if (!apiKey) {
    console.error("[order] TurboSMS: TURBOSMS_API_KEY не знайдено в env — SMS не відправлено");
    return;
  }
  console.log(`[order] TurboSMS: ключ знайдено (довжина ${apiKey.length}), готуємо відправку`);

  const recipient = toTurboSmsPhone(body.phone);
  if (!recipient) {
    console.error("[order] TurboSMS: не вдалось розпізнати номер телефону", body.phone);
    return;
  }

  // Без номера замовлення (виглядає зайво "офіційно" для нового магазину —
  // знижує довіру) і без прямої обіцянки "зателефонує": частина клієнтів
  // на сайті явно просить НЕ дзвонити (чекбокс confirmCall), а ця SMS
  // йде всім однаково, тож формулювання має підходити для обох випадків.
  // Тепліший тон (пряма вказівка Павла 07.11.2026) — і без "гарного дня",
  // бо замовлення оформлюють і ввечері/вночі, коли це звучить дивно.
  const text = `Дякуємо, що вибрали Multimarket! 🧡 Ваше замовлення вже в обробці — незабаром з Вами зв'яжемося!`.replace(
    /\s+/g,
    " "
  );

  console.log(`[order] TurboSMS: відправляємо на ${recipient}, sequence_id=order-${orderId}`);

  try {
    const res = await fetch("https://api.turbosms.ua/message/send.json", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        recipients: [recipient],
        sms: { sender: TURBOSMS_SENDER, text },
        // orderId як sequence_id — захист від повторної відправки SMS, якщо
        // цей самий запит випадково прилетить двічі (ретрай тощо).
        sequence_id: orderId ? `order-${orderId}` : undefined,
      }),
    });
    const responseText = await res.text();
    if (!res.ok) {
      console.error("[order] TurboSMS push failed:", res.status, responseText);
    } else {
      console.log("[order] TurboSMS push OK:", res.status, responseText);
    }
  } catch (err) {
    console.error("[order] TurboSMS push error:", err);
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
  // "card_mono" — оплата карткою через Monobank Acquiring (депозит або повна
  // сума — рахує getPaymentSplit, src/lib/checkout.ts); "card_wfp" — те
  // саме через WayForPay. Чистої "наложки" без онлайн-частини більше не
  // існує — відсутнє/некоректне поле трактуємо як "card_mono" (Рішення
  // Павла 12.11.2026).
  paymentMethod?: "card_mono" | "card_wfp";
  // Наш внутрішній ID замовлення — генерується на клієнті ДО відправки,
  // передається і сюди (для Telegram), і в /api/checkout/monobank (як
  // reference в інвойсі), і в webhook — так продавець може зіставити
  // заявку з підтвердженням оплати за одним номером.
  orderId?: string;
  // Чекбокс "зв'язатися для підтвердження замовлення" на формі оформлення.
  // Відсутнє поле (старі клієнти/кеш) трактуємо як true — дефолтна поведінка.
  confirmCall?: boolean;
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

    // "Ім'я та прізвище" - одне поле, але вимагаємо хоча б два слова (не
    // лише довжину), інакше "тест" чи будь-яке одне слово проходило далі
    // і прізвище потім доводилось уточнювати в дзвінку (10.11.2026).
    const nameWordCount = name.split(/\s+/).filter(Boolean).length;
    if (!name || name.length < 2 || nameWordCount < 2) {
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

    // --- Guard: приховані/невідомі товари не можуть пройти оформлення ---
    // Карточка ховається саме тому, що товару реально нема (постачальник
    // зліг, немає в наявності, лінк на постачальника не знайдено) — пряме
    // посилання на таку сторінку НЕ повинно давати оформити замовлення,
    // навіть якщо хтось зберіг стару сторінку чи прийшов зі старого кешу
    // пошуковика. (Інцидент 03.11.2026: замовлення на bk26, у якого взагалі
    // не було постачальника — картку видалено, і додано цю перевірку.)
    for (const item of body.items) {
      if (!item.id) continue; // товари без id (напр. бонусні позиції) — як і раніше, не перевіряємо
      const catalogProduct = PRODUCTS_BY_ID.get(item.id);
      if (!catalogProduct || catalogProduct.isHidden) {
        console.error(`[order] Rejected checkout for hidden/unknown product id: ${item.id}`);
        return NextResponse.json(
          { error: "Один із товарів у замовленні зараз недоступний. Оновіть сторінку і спробуйте ще раз." },
          { status: 400 }
        );
      }
      // Колір, що вже закінчився (кошик зібрано до ранкової перевірки).
      // Назва позиції з кольором має вигляд "Назва (Колір)".
      const soldOutColor = catalogProduct.colors?.find((c) => c.soldOut && item.name.endsWith(`(${variantLabel(c)})`));
      if (soldOutColor) {
        return NextResponse.json(
          { error: `Колір «${variantLabel(soldOutColor)}» щойно закінчився. Видаліть його з кошика й оберіть інший колір.` },
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

    // Чистої "наложки" без онлайн-частини більше не існує (Рішення Павла
    // 12.11.2026): від COD_MIN_TOTAL — передоплата COD_DEPOSIT_AMOUNT,
    // залишок накладеним платежем; нижче порогу — повна оплата онлайн.
    // Єдине джерело цієї логіки — src/lib/checkout.ts.
    const split = getPaymentSplit(calculatedTotal);

    const paymentMethod: "card_mono" | "card_wfp" =
      body.paymentMethod === "card_wfp" ? "card_wfp" : "card_mono";

    // --- Командний центр: пишемо ПЕРШИМИ, до Telegram і CRM ---
    // Не блокує відповідь користувачу, якщо Supabase недоступний.
    const commandCenterOrderId = await saveOrderToSupabase(body, calculatedTotal, split);

    const gatewayLabel = paymentMethod === "card_mono" ? "Monobank" : "WayForPay";
    const paymentLine = split.isDeposit
      ? `💳 *Передоплата ${split.onlineAmount}\u20b4 через ${gatewayLabel} — очікуємо підтвердження*\n💰 *Залишок ${split.codRemainder}\u20b4 — накладеним платежем при отриманні*`
      : `💳 *Оплата: ПОВНІСТЮ ОНЛАЙН через ${gatewayLabel}, ${split.onlineAmount}\u20b4 — очікуємо підтвердження*`;
    const orderIdLine = body.orderId ? `🔖 *№ ${escapeMarkdown(body.orderId)}*\n` : "";
    const confirmCallLine =
      body.confirmCall === false
        ? "⚠️ *Клієнт просив НЕ дзвонити для підтвердження*"
        : "☎️ Погодився на підтвердження дзвінком";

    const message = `🛒 *НОВЕ ЗАМОВЛЕННЯ!*
${orderIdLine}
👤 *Ім'я:* ${escapeMarkdown(name)}
📞 *Телефон:* ${escapeMarkdown(phone)}
🏙 *Місто:* ${escapeMarkdown(city)}
📦 *Відділення НП:* ${escapeMarkdown(branch)}
${comment ? `💬 *Коментар:* ${escapeMarkdown(comment)}` : ""}
${confirmCallLine}

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

    // --- SalesDrive: no-op, поки немає ключа (див. функцію вище) ---
    await pushOrderToSalesDrive(body, commandCenterOrderId, split);

    // --- TurboSMS: no-op, поки немає ключа (див. функцію вище) ---
    await pushSmsNotification(body, commandCenterOrderId);

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
