import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as cheerio from "cheerio";
import productsData from "@/data/products.json";

// ==================== Щоденний моніторинг постачальників ====================
// Запит Павла (07-08.10.2026): "нам нужна какая то система для отслеживания
// цен у поставщика и наличия что бы был постояный мониторинг" — приводом
// стало те, що й Фантом, і Aveopt показували g12 (кемпінгова лампа BL-588)
// "в наявності" у Supabase ще з 20-24.08.2026, хоча на живих сайтах
// постачальників товару вже понад місяць не було — мало не зірвало реальне
// оплачене замовлення Христини.
//
// Запускається Vercel Cron Jobs (vercel.json, 04:00 UTC = 7:00 Київ під час
// літнього часу) — працює повністю окремо від Клода, жодних токенів/лімітів
// Клода тут не задіяно.
//
// Обсяг навмисно обмежений ТІЛЬКИ товарами, які реально показані на сайті
// (isHidden !== true у products.json) — сезонні/приховані товари (вентилятори,
// кондиціонер і т.д., див. запис 08.10.2026 в документі проекту) не
// перевіряються: немає сенсу дьоргати сайти постачальників заради товару,
// якого й так немає на вітрині, і це тримає кількість запитів під контролем
// по мірі зростання каталогу (прохання Павла).
//
// Для кожного товару з Supabase product_suppliers читається сторінка
// постачальника (звичайний fetch, без headless-браузера) і парситься cheerio
// за правилами, підібраними вручну під кожну платформу (перевірено 07.10.2026
// через Chrome-девтулз на реальних сторінках):
//   - Aveopt і Фантом — WooCommerce: `.summary .stock` / `.summary .price`
//   - HUGO — маркетплейс Prom.ua: клас `b-product-data__item_type_*` для
//     наявності, `.b-product-cost__price` для ціни
//   - Тану Опт (od.tanu.ua) — платформа Хорошоп: `.product-header__availability`
//     і `.product-price`
// Результат пишеться назад у product_suppliers (price/in_stock/checked_at),
// а якщо щось змінилось (товар зник/зʼявився, чи ціна стрибнула більш ніж на
// 3%) — летить одне зведене повідомлення в той самий Telegram-канал, куди
// приходять сповіщення про замовлення (той самий TELEGRAM_BOT_TOKEN/
// TELEGRAM_CHAT_ID, що й у /api/order).
//
// ОНОВЛЕННЯ 08.10.2026 (перший реальний прогін, 125 товарів):
// 1) Павлу незрозумілі внутрішні коди товарів (bk02, g18...) у звіті —
//    тепер у звіті показується назва товару з products.json, код лишається
//    в дужках для довідки/пошуку в адмінці.
// 2) od.tanu.ua і phantom-drop.com.ua систематично (майже 100% товарів цих
//    двох постачальників) повертали "не знайдено блок наявності", хоча
//    та сама сторінка, відкрита звичайним браузером (fetch() з вкладки
//    Chrome, без кук), містить потрібний HTML і текст без проблем. Це НЕ
//    помилка верстки/селектора — дуже схоже на бот-захист, який віддає інший
//    (урізаний/challenge) контент дата-центровим IP (Vercel serverless), а
//    не звичайним відвідувачам. HUGO і Aveopt такої проблеми не мають.
//    Додано діагностику в fetchSupplierStatus: якщо шуканий блок не
//    знайдено, перевіряється, чи є в отриманому HTML взагалі слово
//    "наявність" — якщо немає, це явна ознака бот-захисту, а не зламаної
//    верстки. Звіт про збої тепер згрупований по постачальнику (кількість +
//    приклад причини), а не плаский список з дублями кодів товарів.
// 3) "Закінчився" + "Зміна ціни" для одного й того ж товару/постачальника
//    в одному прогоні (типово для HUGO — вони показують останню ціну навіть
//    для товару not in stock) тепер об'єднані в один рядок звіту, а не два
//    окремих — так зрозуміліше, що це одна подія, а не дві різні.
//
// УТОЧНЕННЯ 08.10.2026 (другий прогін, з діагностикою вище): виявилось, що
// дві різні причини ховались під однією помилкою:
//   - od.tanu.ua дійсно блокує дата-центрові IP — замість сторінки (~270Kб)
//     повертає заглушку ~885 байт без жодного тексту про наявність. Це не
//     лагодиться селекторами; потрібен інший канал перевірки (проксі-сервіс
//     з ротацією IP, або періодична ручна перевірка) — питання Павлу.
//   - phantom-drop.com.ua НЕ блокує — повертає повноцінну сторінку (~165Кб),
//     але в їхній темі WooCommerce `.stock` — порожній бейдж без тексту
//     (<p class="stock out-of-stock"></p>), текст лежить окремо в
//     `.outstock-qty`. Виправлено: якщо текст `.stock` порожній, статус
//     читається з CSS-класу (in-stock/out-of-stock), з фолбеком на сусідній
//     блок. Aveopt текст має одразу, тому для нього це просто не спрацьовує.

export const maxDuration = 60;

function supabaseServer() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

interface SupplierRow {
  id: number;
  product_id: string;
  url: string;
  price: string | number | null;
  in_stock: boolean;
  suppliers: { name: string } | { name: string }[] | null;
}

interface CheckResult {
  inStock: boolean;
  price: number | null;
  error?: string;
}

interface FailureInfo {
  productId: string;
  supplier: string;
  reason: string;
}

// id -> назва товару (products.json) — щоб у звіті було видно, що саме це
// за товар, а не тільки внутрішній код типу "bk02".
const productNameById = new Map<string, string>(
  (productsData as Array<{ id: string; name: string }>).map((p) => [p.id, p.name])
);

function productLabel(productId: string): string {
  const name = productNameById.get(productId);
  return name ? `${name} (${productId})` : productId;
}

function supplierNameOf(row: SupplierRow): string {
  const s = row.suppliers;
  if (!s) return "?";
  return Array.isArray(s) ? s[0]?.name ?? "?" : s.name ?? "?";
}

function extractPrice(text: string): number | null {
  const match = text.replace(/ /g, " ").match(/(\d+(?:[.,]\d+)?)/);
  if (!match) return null;
  return parseFloat(match[1].replace(",", "."));
}

async function fetchSupplierStatus(url: string): Promise<CheckResult> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        "Accept-Language": "uk-UA,uk;q=0.9,ru;q=0.8",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) return { inStock: false, price: null, error: `HTTP ${res.status}` };

    const html = await res.text();
    const $ = cheerio.load(html);

    let stockText = "";
    let priceText = "";

    if (url.includes("aveopt.com.ua") || url.includes("phantom-drop.com.ua")) {
      // WooCommerce
      const $stock = $(".summary .stock, .entry-summary .stock").first();
      stockText = $stock.text().trim();
      // Знахідка 08.10.2026: у теми Фантома `.stock` — порожній бейдж без
      // тексту (<p class="stock out-of-stock"></p>), статус читається тільки
      // з CSS-класу; людський текст "Нема в наявності" лежить окремо в
      // `.outstock-qty`/`.instock-qty`. Якщо текст порожній — пробуємо клас,
      // а якщо й класу немає — той сусідній блок. В Aveopt текст є одразу,
      // тож для нього це просто ніколи не спрацьовує (безпечний фолбек).
      if (!stockText) {
        const stockClass = $stock.attr("class") || "";
        if (/out-?of-?stock/i.test(stockClass)) stockText = "немає в наявності";
        else if (/\bin-?stock\b/i.test(stockClass)) stockText = "в наявності";
        else stockText = $(".outstock-qty, .instock-qty").first().text().trim();
      }
      priceText = $(".summary .price, .entry-summary .price").first().text().trim();
    } else if (url.includes("hugo.com.ua")) {
      // Prom.ua
      stockText = $('[class*="b-product-data__item_type_"]').first().text().trim();
      if (!stockText) {
        stockText = $(".cs-sticky-panel__product-status").first().text().trim();
      }
      priceText = $(".b-product-cost__price").first().text().trim();
    } else if (url.includes("tanu.ua")) {
      // Хорошоп
      stockText = $(".product-header__availability").first().text().trim();
      priceText = $(".product-price").first().text().trim();
    } else {
      return { inStock: false, price: null, error: "невідомий домен постачальника — потрібен новий парсер" };
    }

    if (!stockText) {
      // Діагностика (08.10.2026): якщо в усьому отриманому HTML взагалі
      // немає слова "наявність"/"відсутн", це не збіг селектора з версткою,
      // а ознака того, що сервер віддав зовсім іншу сторінку (бот-захист/
      // challenge) — на відміну від того, що бачить звичайний браузер.
      const hasAvailWordAnywhere = /наявн|відсутн/i.test(html);
      const reason = hasAvailWordAnywhere
        ? `блок наявності не знайдено (верстка відрізняється, html ${html.length}б)`
        : `схоже на бот-захист: у відповіді взагалі немає слова "наявність" (html ${html.length}б) — ймовірно, сайт віддає інший контент серверним IP`;
      return { inStock: false, price: null, error: reason };
    }

    const inStock = !/немає|нема\s|нема в|відсутн/i.test(stockText);
    const price = extractPrice(priceText);

    return { inStock, price };
  } catch (err) {
    return { inStock: false, price: null, error: err instanceof Error ? err.message : String(err) };
  }
}

async function runWithConcurrency<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function runner() {
    while (next < items.length) {
      const i = next++;
      results[i] = await worker(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, runner));
  return results;
}

// Групує збої по постачальнику: кількість + один приклад причини —
// замість плаского списку з купою дублів однакової причини під різними
// кодами товарів, яким незрозуміло що робити.
function summarizeFailures(failures: FailureInfo[]): string[] {
  const bySupplier = new Map<string, FailureInfo[]>();
  for (const f of failures) {
    if (!bySupplier.has(f.supplier)) bySupplier.set(f.supplier, []);
    bySupplier.get(f.supplier)!.push(f);
  }
  return Array.from(bySupplier.entries()).map(
    ([supplier, items]) => `• ${supplier}: ${items.length} шт. — ${items[0].reason}`
  );
}

async function sendTelegramReport(changes: string[], failures: FailureInfo[], checked: number, scoped: number) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!botToken || !chatId) return;

  const lines: string[] = [`📦 *Щоденна перевірка постачальників* (${checked}/${scoped} товарів)`];

  if (changes.length > 0) {
    lines.push("", ...changes.map((c) => `• ${c}`));
  } else {
    lines.push("", "Без змін — усе як учора.");
  }

  if (failures.length > 0) {
    lines.push("", `⚠️ Не вдалось перевірити (${failures.length}):`, ...summarizeFailures(failures));
  }

  const text = lines.join("\n");

  const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" }),
  });
  if (!tgRes.ok) {
    console.error("[check-suppliers] Telegram send failed:", await tgRes.text());
  }
}

export async function GET(req: NextRequest) {
  // Vercel сам підставляє "Authorization: Bearer $CRON_SECRET" при виклику
  // за розкладом (vercel.json), якщо в Project Settings → Environment
  // Variables заданий CRON_SECRET — тож цей env var треба один раз додати
  // вручну на Vercel (сюди немає прямого доступу з цієї сесії).
  const expected = process.env.CRON_SECRET;
  if (expected) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${expected}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const supabase = supabaseServer();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase не налаштовано" }, { status: 500 });
  }

  const activeProductIds = new Set(
    (productsData as Array<{ id: string; isHidden?: boolean }>)
      .filter((p) => !p.isHidden)
      .map((p) => p.id)
  );

  const { data: rows, error } = await supabase
    .from("product_suppliers")
    .select("id, product_id, url, price, in_stock, suppliers(name)")
    .order("product_id");

  if (error || !rows) {
    return NextResponse.json({ error: "Supabase query failed", details: error?.message }, { status: 500 });
  }

  const scoped = (rows as unknown as SupplierRow[]).filter((r) => activeProductIds.has(r.product_id));

  const changes: string[] = [];
  const failures: FailureInfo[] = [];
  let checked = 0;

  await runWithConcurrency(scoped, 6, async (row) => {
    const supplierName = supplierNameOf(row);
    const result = await fetchSupplierStatus(row.url);
    checked++;

    if (result.error) {
      failures.push({ productId: row.product_id, supplier: supplierName, reason: result.error });
      return;
    }

    const prevInStock = row.in_stock;
    const prevPrice = row.price !== null ? Number(row.price) : null;
    const stockChanged = result.inStock !== prevInStock;
    const priceChanged =
      result.price !== null &&
      prevPrice !== null &&
      prevPrice > 0 &&
      Math.abs(result.price - prevPrice) / prevPrice > 0.03;

    // Якщо і наявність, і ціна змінились одночасно (типово для HUGO — вони
    // показують останню ціну навіть для товару not in stock) — один рядок
    // замість двох, щоб було зрозуміло, що це одна подія.
    if (stockChanged && priceChanged) {
      const icon = result.inStock ? "✅" : "⛔";
      const statusWord = result.inStock ? "знову в наявності" : "закінчився";
      changes.push(
        `${icon} ${productLabel(row.product_id)} у ${supplierName}: ${statusWord}, ${prevPrice}₴ → ${result.price}₴`
      );
    } else if (stockChanged) {
      changes.push(
        `${result.inStock ? "✅ Знову в наявності" : "⛔ Закінчився"}: ${productLabel(row.product_id)} у ${supplierName}` +
          (result.price !== null ? ` (${result.price}₴)` : "")
      );
    } else if (priceChanged) {
      changes.push(`💰 Зміна ціни: ${productLabel(row.product_id)} у ${supplierName}: ${prevPrice}₴ → ${result.price}₴`);
    }

    await supabase
      .from("product_suppliers")
      .update({
        in_stock: result.inStock,
        price: result.price !== null ? result.price : row.price,
        checked_at: new Date().toISOString(),
      })
      .eq("id", row.id);
  });

  if (changes.length > 0 || failures.length > 0) {
    await sendTelegramReport(changes, failures, checked, scoped.length);
  }

  return NextResponse.json({
    scoped: scoped.length,
    checked,
    changes: changes.length,
    failures: failures.length,
    changeDetails: changes,
    failureDetails: failures,
  });
}
