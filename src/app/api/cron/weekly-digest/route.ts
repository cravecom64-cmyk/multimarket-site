import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  getSiteSummary,
  getTopProducts,
  kyivToday,
  addDays,
  fmtDay,
  formatUAH,
  pctDelta,
  CLEAN_DATA_FROM,
} from "@/lib/siteStats";

// ==================== Тижнева зведення в Telegram ====================
// ДОДАНО 30.10.2026, ПЕРЕРОБЛЕНО 04.11.2026 (запит Павла: щопонеділка тижневий
// звіт по заходах на сайт, додаваннях у кошик і продажах). Звітний тиждень —
// повний календарний тиждень пн–нд за Києвом, що щойно минув, у порівнянні з
// попереднім. Цифри відвідувань/кошика — з тих самих SQL-функцій analytics_*,
// що й "Аналітика" в командному центрі (раніше події вибирались напряму, і
// ліміт PostgREST у 1000 рядків при рості трафіку тихо обрізав би тиждень).
//
// Ручний запуск без відправки: ?dry=1 (повертає текст у відповіді).

const CENTER_URL = "https://multimarket-command-center.vercel.app";
const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"];

function supabaseServer() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

type OrderRow = {
  created_at: string;
  status: string;
  order_items: { qty: number; price_snap: number; supplier_price_snap: number | null }[];
};

const kyivDate = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Kyiv" }).format(new Date(iso));

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function profitOf(orders: OrderRow[]) {
  let profit = 0;
  for (const o of orders) {
    if (o.status === "canceled") continue;
    for (const it of o.order_items) {
      if (it.supplier_price_snap !== null) profit += (Number(it.price_snap) - Number(it.supplier_price_snap)) * it.qty;
    }
  }
  return profit;
}

export async function GET(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  const dry = req.nextUrl.searchParams.get("dry") === "1";
  if (expected && req.headers.get("authorization") !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = supabaseServer();
  if (!supabase) return NextResponse.json({ error: "Supabase не налаштовано" }, { status: 500 });

  // Останній повний тиждень пн–нд за Києвом
  const today = kyivToday();
  const dow = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7; // 0 = понеділок
  const weekFrom = addDays(today, -dow - 7);
  const weekTo = addDays(weekFrom, 6);
  const prevFrom = addDays(weekFrom, -7);
  const prevTo = addDays(weekFrom, -1);

  const [week, prev, top, trafficRes, ordersRes, pendingRes, stockRes, searchRes, settingsRes, allOrdersRes] =
    await Promise.all([
      getSiteSummary(supabase, weekFrom, weekTo),
      getSiteSummary(supabase, prevFrom, prevTo),
      getTopProducts(supabase, weekFrom, weekTo, 5),
      supabase.rpc("analytics_traffic_daily", { p_from: weekFrom, p_to: weekTo }),
      supabase
        .from("orders")
        .select("created_at, status, order_items(qty, price_snap, supplier_price_snap)")
        .gte("created_at", `${addDays(prevFrom, -1)}T00:00:00Z`),
      supabase.from("price_proposals").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase
        .from("supplier_stock_events")
        .select("product_id, event, created_at")
        .in("event", ["out_of_stock", "price_up"])
        .gte("created_at", `${addDays(weekFrom, -1)}T00:00:00Z`),
      supabase.rpc("analytics_search", { p_from: weekFrom, p_to: weekTo }),
      supabase.from("app_settings").select("value").eq("key", "return_shipping_cost").maybeSingle(),
      supabase.from("orders").select("status"),
    ]);

  const orders = (ordersRes.data ?? []) as unknown as OrderRow[];
  const inRange = (o: OrderRow, f: string, t: string) => {
    const d = kyivDate(o.created_at);
    return d >= f && d <= t;
  };
  const weekProfit = profitOf(orders.filter((o) => inRange(o, weekFrom, weekTo)));
  const prevProfit = profitOf(orders.filter((o) => inRange(o, prevFrom, prevTo)));

  // Відвідувачів порівнюємо лише з чистими даними (без перевірок сайту й ботів)
  const cmpTraffic = prevFrom >= CLEAN_DATA_FROM;
  const dT = (cur: number, prv: number) => (cmpTraffic ? `  ${pctDelta(cur, prv)}` : "");
  const dS = (cur: number, prv: number) => `  ${pctDelta(cur, prv)}`;

  const lines: string[] = [];
  lines.push(`📊 <b>Тиждень ${fmtDay(weekFrom)} – ${fmtDay(weekTo)}</b>`);
  lines.push("");
  lines.push("<b>Сайт</b>");
  lines.push(`👀 Відвідувачів: <b>${week.sessions}</b>${dT(week.sessions, prev.sessions)}`);
  lines.push(`📄 Переглядів сторінок: ${week.pageviews}${dT(week.pageviews, prev.pageviews)}`);
  lines.push(`🛒 Додали в кошик: <b>${week.addedToCart}</b>${dT(week.addedToCart, prev.addedToCart)}`);
  lines.push(`📝 Почали оформлення: ${week.beganCheckout}${week.checkoutErrors ? ` (помилок: ${week.checkoutErrors})` : ""}`);

  const days = ((trafficRes.data ?? []) as { day: string; sessions: number }[]).map(
    (d, i) => `${WEEKDAYS[i] ?? fmtDay(String(d.day))} ${Number(d.sessions)}`
  );
  if (days.length === 7) lines.push(`📅 По днях: ${days.join(" · ")}`);

  lines.push("");
  lines.push("<b>Продажі</b>");
  lines.push(`✅ Замовлень: <b>${week.orders}</b>${dS(week.orders, prev.orders)}`);
  lines.push(`💰 Виручка: <b>${formatUAH(week.revenue)}</b>${dS(week.revenue, prev.revenue)}`);
  lines.push(`📈 Прибуток (до доставки/відмов): <b>${formatUAH(weekProfit)}</b>${dS(weekProfit, prevProfit)}`);
  if (week.sessions > 0) {
    const conv = (week.orders / week.sessions) * 100;
    lines.push(`🎯 Конверсія відвідувач → замовлення: ${conv < 10 ? conv.toFixed(1) : Math.round(conv)}%`);
  }

  const statuses = (allOrdersRes.data ?? []).map((o) => o.status as string);
  const delivered = statuses.filter((s) => s === "delivered").length;
  const returned = statuses.filter((s) => s === "returned").length;
  const unprocessed = statuses.filter((s) => s === "new").length;
  const returnCost = Number(settingsRes.data?.value ?? 0) || 0;
  if (delivered + returned > 0) {
    lines.push(
      `📦 Викуп за весь час: <b>${Math.round((delivered / (delivered + returned)) * 100)}%</b> (${delivered} отримано, ${returned} відмов` +
        (returnCost ? `, відмови коштували ~${formatUAH(returned * returnCost)}` : "") +
        ")"
    );
  }

  if (top.length > 0) {
    lines.push("");
    lines.push("<b>Топ товарів тижня</b>");
    for (const t of top) {
      const parts = [`${t.views} перегл.`];
      if (t.carts) parts.push(`${t.carts} у кошик`);
      if (t.orders) parts.push(`${t.orders} замовл.`);
      lines.push(`• ${esc(t.name)} — ${parts.join(", ")}`);
    }
  }

  // ---- Варто глянути ----
  const attention: string[] = [];
  if (unprocessed > 0) attention.push(`⏳ Не оброблено заказів: <b>${unprocessed}</b> — проставте статуси`);
  const pending = pendingRes.count ?? 0;
  if (pending > 0) attention.push(`💸 Ціни чекають рішення: <b>${pending}</b>`);
  const stock = (stockRes.data ?? []).filter((e) => {
    const d = kyivDate(e.created_at as string);
    return d >= weekFrom && d <= weekTo;
  });
  const priceUps = new Set(stock.filter((e) => e.event === "price_up").map((e) => e.product_id));
  const outOfStock = new Set(stock.filter((e) => e.event === "out_of_stock").map((e) => e.product_id));
  if (priceUps.size > 0) attention.push(`⬆️ Постачальники підняли ціну на ${priceUps.size} тов.`);
  if (outOfStock.size > 0) attention.push(`⛔ Закінчувались у постачальника: ${outOfStock.size} тов.`);
  const zero = ((searchRes.data ?? []) as { example: string; zero_results: number }[])
    .filter((r) => Number(r.zero_results) > 0)
    .sort((a, b) => Number(b.zero_results) - Number(a.zero_results))
    .slice(0, 5);
  if (zero.length > 0) {
    attention.push(
      `🔍 Шукали й не знайшли: ${zero.map((r) => `«${esc(r.example)}»${Number(r.zero_results) > 1 ? ` ×${r.zero_results}` : ""}`).join(", ")}`
    );
  }
  if (attention.length > 0) {
    lines.push("");
    lines.push("<b>Варто глянути</b>");
    lines.push(...attention);
  }

  if (!cmpTraffic) {
    lines.push("");
    lines.push("<i>Відвідувачів не порівнюємо з минулим тижнем: до 31.10 у статистику потрапляли перевірки сайту й боти.</i>");
  }

  lines.push("");
  lines.push(`<a href="${CENTER_URL}/analytics?from=${weekFrom}&to=${weekTo}">Відкрити тиждень у командному центрі</a>`);

  const text = lines.join("\n");
  if (dry) return NextResponse.json({ ok: true, dry: true, text });

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!botToken || !chatId) return NextResponse.json({ ok: false, error: "Telegram не налаштовано" });

  const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true }),
  });
  if (!tgRes.ok) console.error("[weekly-digest] Telegram error:", await tgRes.text());
  return NextResponse.json({ ok: tgRes.ok });
}
