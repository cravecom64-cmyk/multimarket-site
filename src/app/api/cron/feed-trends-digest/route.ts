import { NextRequest, NextResponse } from "next/server";
import { supabaseService } from "@/lib/crmPush";

// Щотижневий Telegram-дайджест «Тренди постачальників» (18.11.2026): що найкраще
// продається в LUGI, а в нас немає; наші товари, що скоро закінчаться в
// постачальника. Дані — SQL-функція feed_trends (знімки вивантажень кожні 2 год).
// pg_cron "feed-trends-digest" щопонеділка, токен private_settings.stock_check_token.
export const maxDuration = 30;

type Item = { name: string | null; sku: string | null; sold?: number; price?: number | null; qty?: number | null; our_product?: string | null; days_left?: number | null };

export async function GET(req: NextRequest) {
  const db = supabaseService();
  if (!db) return NextResponse.json({ error: "no_db" }, { status: 500 });
  const auth = req.headers.get("authorization") ?? "";
  const secret = process.env.CRON_SECRET;
  let ok = Boolean(secret && auth === `Bearer ${secret}`);
  if (!ok && auth.startsWith("Bearer ")) {
    const { data: tok } = await db.from("private_settings").select("value").eq("key", "stock_check_token").maybeSingle();
    ok = Boolean(tok?.value && tok.value.length >= 32 && auth === `Bearer ${tok.value}`);
  }
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data, error } = await db.rpc("feed_trends", { p_days: 7, p_limit: 10 });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const r = data as { top_new_for_us: Item[]; ours_running_out: Item[] };

  const lines: string[] = ["📊 Тренди постачальників за 7 днів"];
  lines.push("", "🔥 Найкраще продається в LUGI, а в нас немає:");
  if (r.top_new_for_us.length === 0) lines.push("— поки немає даних");
  r.top_new_for_us.forEach((i, n) =>
    lines.push(`${n + 1}. ${i.name} (${i.sku}) — продано ${i.sold} шт, РРЦ ${Math.round(Number(i.price ?? 0))}₴, залишок ${i.qty}`)
  );
  if (r.ours_running_out.length) {
    lines.push("", "⏳ Наші товари, що скоро закінчаться в постачальника:");
    r.ours_running_out.forEach((i) => lines.push(`• ${i.our_product}: ${i.name} — залишок ${i.qty}, вистачить на ~${i.days_left} дн.`));
  }
  lines.push("", "Детально: командний центр → «Тренды».");

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (botToken && chatId) {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: lines.join("\n").slice(0, 4000), disable_web_page_preview: true }),
    }).catch(() => undefined);
  }
  return NextResponse.json({ ok: true, sent: Boolean(botToken && chatId), items: r.top_new_for_us.length });
}
