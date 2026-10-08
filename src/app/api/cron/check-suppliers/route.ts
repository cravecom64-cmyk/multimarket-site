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
// постачальника (звичайний fetch, без headless-браузера — усі 4 постачальники
// віддають готовий HTML на сервері, JS не потрібен) і парситься cheerio за
// правилами, підібраними вручну під кожну платформу (перевірено 07.10.2026
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

function supplierNameOf(row: SupplierRow): string {
  const s = row.suppliers;
  if (!s) return "?";
  return Array.isArray(s) ? s[0]?.name ?? "?" : s.name ?? "?";
}

function extractPrice(text: string): number | null {
  const match = text.replace(/ /g, " ").match(/(\d+(?:[.,]\d+)?)/);
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
      stockText = $(".summary .stock, .entry-summary .stock").first().text().trim();
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
      return { inStock: false, price: null, error: "не знайдено блок наявності (можливо, змінилась верстка сайту)" };
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

async function sendTelegramReport(changes: string[], failures: string[], checked: number, scoped: number) {
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
    lines.push("", `⚠️ Не вдалось перевірити (${failures.length}):`, ...failures.slice(0, 10).map((f) => `• ${f}`));
    if (failures.length > 10) lines.push(`…і ще ${failures.length - 10}`);
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
  const failures: string[] = [];
  let checked = 0;

  await runWithConcurrency(scoped, 6, async (row) => {
    const supplierName = supplierNameOf(row);
    const result = await fetchSupplierStatus(row.url);
    checked++;

    if (result.error) {
      failures.push(`${row.product_id} (${supplierName}): ${result.error}`);
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

    if (stockChanged) {
      changes.push(
        `${result.inStock ? "✅ Знову в наявності" : "⛔ Закінчився"}: ${row.product_id} у ${supplierName}` +
          (result.price !== null ? ` (${result.price}₴)` : "")
      );
    }
    if (priceChanged) {
      changes.push(`💰 Зміна ціни: ${row.product_id} у ${supplierName}: ${prevPrice}₴ → ${result.price}₴`);
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
