import type { SupabaseClient } from "@supabase/supabase-js";

// ==================== Статистика сайту для Telegram-звітів ====================
// ДОДАНО 04.11.2026 (запит Павла: щоденний звіт разом з ранковою перевіркою
// постачальників + щопонеділковий тижневий — заходи, кошик, продажі).
// Рахує ті самі SQL-функції analytics_*, що й розділ "Аналітика" в
// командному центрі, — цифри в Telegram і в центрі завжди однакові.
// Дати — календарні дні за Києвом (YYYY-MM-DD), обидві межі включно.

export type SiteSummary = {
  pageviews: number;
  sessions: number;
  viewedProduct: number;
  addedToCart: number;
  beganCheckout: number;
  checkoutErrors: number;
  orders: number;
  revenue: number;
};

export type ProductStat = { name: string; views: number; carts: number; orders: number; units: number };

// До 31.10.2026 у статистику потрапляли власні перевірки сайту й боти —
// порівнювати відвідувачів з тими днями некоректно.
export const CLEAN_DATA_FROM = "2026-10-31";

export function kyivToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Kyiv" }).format(new Date());
}

export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function fmtDay(date: string): string {
  const [, m, d] = date.split("-");
  return `${d}.${m}`;
}

const num = (v: unknown) => Number(v ?? 0);

export async function getSiteSummary(supabase: SupabaseClient, from: string, to: string): Promise<SiteSummary> {
  const { data, error } = await supabase.rpc("analytics_summary", { p_from: from, p_to: to }).single();
  if (error) throw error;
  const r = (data ?? {}) as Record<string, unknown>;
  return {
    pageviews: num(r.pageviews),
    sessions: num(r.sessions),
    viewedProduct: num(r.sessions_viewed_product),
    addedToCart: num(r.sessions_added_to_cart),
    beganCheckout: num(r.sessions_began_checkout),
    checkoutErrors: num(r.checkout_errors),
    orders: num(r.orders),
    revenue: num(r.revenue),
  };
}

// Топ товарів за період: спершу ті, що купували / клали в кошик, потім перегляди.
export async function getTopProducts(
  supabase: SupabaseClient,
  from: string,
  to: string,
  limit = 3
): Promise<ProductStat[]> {
  const { data, error } = await supabase.rpc("analytics_products", { p_from: from, p_to: to });
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[])
    .map((r) => ({
      name: String(r.name),
      views: num(r.views),
      carts: num(r.add_to_cart),
      orders: num(r.purchases),
      units: num(r.units),
      score: num(r.score),
    }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || b.views - a.views)
    .slice(0, limit)
    .map(({ name, views, carts, orders, units }) => ({ name, views, carts, orders, units }));
}

export function formatUAH(n: number): string {
  return `${new Intl.NumberFormat("uk-UA", { maximumFractionDigits: 0 }).format(Math.round(n))} ₴`;
}

// "+25%" / "−40%" / "" (коли порівнювати нема з чим)
export function pctDelta(cur: number, prev: number): string {
  if (prev === 0) return cur === 0 ? "" : "↑ (було 0)";
  const pct = Math.round(((cur - prev) / prev) * 100);
  if (pct === 0) return "= як було";
  return pct > 0 ? `↑ +${pct}%` : `↓ ${pct}%`;
}

// Короткий рядок воронки, напр. "13 → 2 у кошик → 1 оформл. → 1 замовл."
export function funnelLine(s: SiteSummary): string {
  return `${s.sessions} відвідувачів → ${s.addedToCart} у кошик → ${s.beganCheckout} оформлення → ${s.orders} замовл.`;
}
