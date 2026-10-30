import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// ==================== Тижнева зведення в Telegram ====================
// ДОДАНО 30.10.2026 (запит Павла: щоденний звіт без реклами не потрібен,
// тижневий — так). Щопонеділка вранці (vercel.json) шле в той самий чат, що
// й заказы, підсумок тижня з командного центру: заказы, виручка, прибуток,
// викуп, ціни, що чекають рішення, проблеми з наявністю, пошук без
// результатів, воронка. Усі цифри — з тієї самої бази, що й центр.
//
// Ручний запуск без відправки: ?dry=1 (повертає текст у відповіді).

const CENTER_URL = "https://multimarket-command-center.vercel.app";

function supabaseServer() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

type OrderRow = {
  id: number;
  created_at: string;
  status: string;
  total_amount: number | null;
  order_items: { qty: number; price_snap: number; supplier_price_snap: number | null }[];
};

function uah(n: number) {
  return `${new Intl.NumberFormat("uk-UA", { maximumFractionDigits: 0 }).format(Math.round(n))} ₴`;
}

function delta(cur: number, prev: number) {
  if (prev === 0) return cur === 0 ? "" : " (було 0)";
  const pct = Math.round(((cur - prev) / prev) * 100);
  return ` (${pct >= 0 ? "+" : ""}${pct}% до мин. тижня)`;
}

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function summarize(orders: OrderRow[]) {
  const active = orders.filter((o) => o.status !== "canceled");
  let revenue = 0;
  let profit = 0;
  for (const o of active) {
    for (const it of o.order_items) {
      const rev = Number(it.price_snap) * it.qty;
      revenue += rev;
      if (it.supplier_price_snap !== null) profit += rev - Number(it.supplier_price_snap) * it.qty;
    }
  }
  return { count: active.length, revenue, profit };
}

export async function GET(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  const dry = req.nextUrl.searchParams.get("dry") === "1";
  if (expected && req.headers.get("authorization") !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = supabaseServer();
  if (!supabase) return NextResponse.json({ error: "Supabase не налаштовано" }, { status: 500 });

  const now = Date.now();
  const weekAgo = new Date(now - 7 * 86400000).toISOString();
  const twoWeeksAgo = new Date(now - 14 * 86400000).toISOString();

  const [ordersRes, pendingRes, stockRes, searchRes, eventsRes, settingsRes, allOrdersRes] = await Promise.all([
    supabase
      .from("orders")
      .select("id, created_at, status, total_amount, order_items(qty, price_snap, supplier_price_snap)")
      .gte("created_at", twoWeeksAgo),
    supabase.from("price_proposals").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase
      .from("supplier_stock_events")
      .select("product_id, event")
      .in("event", ["out_of_stock", "back_in_stock", "price_up"])
      .gte("created_at", weekAgo),
    supabase
      .from("search_queries")
      .select("query_norm, results_count")
      .eq("results_count", 0)
      .gte("created_at", weekAgo),
    supabase
      .from("product_events")
      .select("session_id, event_type")
      .gte("created_at", weekAgo)
      .in("event_type", ["page_view", "add_to_cart", "begin_checkout"]),
    supabase.from("app_settings").select("key, value").eq("key", "return_shipping_cost").maybeSingle(),
    supabase.from("orders").select("status"),
  ]);

  const orders = (ordersRes.data ?? []) as unknown as OrderRow[];
  const thisWeek = summarize(orders.filter((o) => o.created_at >= weekAgo));
  const lastWeek = summarize(orders.filter((o) => o.created_at < weekAgo));

  // Викуп рахуємо по всіх заказах із завершеним результатом (доставлено / повернення)
  const statuses = (allOrdersRes.data ?? []).map((o) => o.status as string);
  const delivered = statuses.filter((s) => s === "delivered").length;
  const returned = statuses.filter((s) => s === "returned").length;
  const unprocessed = statuses.filter((s) => s === "new").length;
  const returnCost = Number(settingsRes.data?.value ?? 0) || 0;

  const stock = stockRes.data ?? [];
  const outOfStock = new Set(stock.filter((e) => e.event === "out_of_stock").map((e) => e.product_id));
  const priceUps = new Set(stock.filter((e) => e.event === "price_up").map((e) => e.product_id));

  const zeroCounts = new Map<string, number>();
  for (const r of searchRes.data ?? []) {
    zeroCounts.set(r.query_norm, (zeroCounts.get(r.query_norm) ?? 0) + 1);
  }
  const topZero = [...zeroCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  const sessions = new Set<string>();
  const carted = new Set<string>();
  const checkout = new Set<string>();
  for (const e of eventsRes.data ?? []) {
    if (!e.session_id) continue;
    if (e.event_type === "page_view") sessions.add(e.session_id);
    if (e.event_type === "add_to_cart") carted.add(e.session_id);
    if (e.event_type === "begin_checkout") checkout.add(e.session_id);
  }

  const lines: string[] = [];
  lines.push("📊 <b>Тиждень у Multimarket</b>");
  lines.push("");
  lines.push(`🛒 Заказів: <b>${thisWeek.count}</b>${delta(thisWeek.count, lastWeek.count)}`);
  lines.push(`💰 Виручка: <b>${uah(thisWeek.revenue)}</b>${delta(thisWeek.revenue, lastWeek.revenue)}`);
  lines.push(`📈 Прибуток (до доставки/відмов): <b>${uah(thisWeek.profit)}</b>`);
  if (delivered + returned > 0) {
    const buyout = Math.round((delivered / (delivered + returned)) * 100);
    lines.push(
      `📦 Викуп за весь час: <b>${buyout}%</b> (${delivered} отримано, ${returned} відмов` +
        (returnCost ? `, відмови коштували ~${uah(returned * returnCost)}` : "") +
        ")"
    );
  }
  if (unprocessed > 0) lines.push(`⏳ Не оброблено заказів: <b>${unprocessed}</b> — проставте статуси`);

  lines.push("");
  lines.push(`👀 Відвідувачів: ${sessions.size} → у кошик: ${carted.size} → оформлення: ${checkout.size}`);

  const attention: string[] = [];
  const pending = pendingRes.count ?? 0;
  if (pending > 0) attention.push(`💸 Ціни чекають рішення: <b>${pending}</b>`);
  if (priceUps.size > 0) attention.push(`⬆️ Постачальники підняли ціну на ${priceUps.size} тов.`);
  if (outOfStock.size > 0) attention.push(`⛔ Закінчувались у постачальника: ${outOfStock.size} тов.`);
  if (topZero.length > 0) {
    attention.push(
      `🔍 Шукали й не знайшли: ${topZero.map(([q, n]) => `«${esc(q)}»${n > 1 ? ` ×${n}` : ""}`).join(", ")}`
    );
  }
  if (attention.length > 0) {
    lines.push("");
    lines.push("<b>Варто глянути:</b>");
    lines.push(...attention);
  }

  lines.push("");
  lines.push(`<a href="${CENTER_URL}">Відкрити командний центр</a>`);

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
