import { NextRequest, NextResponse } from "next/server";
import { supabaseService } from "@/lib/crmPush";

// Витрати Google Ads по днях і кампаніях → Supabase ad_spend_daily (17.11.2026).
// Джерело — Windsor.ai (у нього вже підключено акаунт Google Ads 508-470-1978).
// Ключ API Windsor — змінна WINDSOR_API_KEY у Vercel (у код і чат не потрапляє).
// Викликає pg_cron у Supabase кожні 3 год (задача "ads-sync"), токен —
// private_settings.ads_sync_token. Розділ «Реклама» командного центру читає таблицю.
// ?days=N — скільки днів назад оновити (за замовчуванням 14; Google дооновлює
// витрати за останні дні, тож тягнемо із запасом).
export const maxDuration = 60;

const FIELDS = "date,campaign,campaign_id,spend,clicks,impressions,conversions,conversion_value";

type Row = {
  date?: string;
  campaign?: string;
  campaign_id?: string | number;
  spend?: number | string | null;
  clicks?: number | string | null;
  impressions?: number | string | null;
  conversions?: number | string | null;
  conversion_value?: number | string | null;
};

const num = (v: unknown) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

export async function GET(req: NextRequest) {
  const db = supabaseService();
  if (!db) return NextResponse.json({ error: "no_db" }, { status: 500 });

  const auth = req.headers.get("authorization") ?? "";
  const secret = process.env.CRON_SECRET;
  let ok = Boolean(secret && auth === `Bearer ${secret}`);
  if (!ok && auth.startsWith("Bearer ")) {
    const { data: tok } = await db.from("private_settings").select("value").eq("key", "ads_sync_token").maybeSingle();
    ok = Boolean(tok?.value && tok.value.length >= 32 && auth === `Bearer ${tok.value}`);
  }
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const apiKey = process.env.WINDSOR_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "WINDSOR_API_KEY не налаштовано у Vercel" }, { status: 500 });

  const days = Math.min(Math.max(Number(req.nextUrl.searchParams.get("days")) || 14, 1), 400);
  const to = new Date();
  const from = new Date(to.getTime() - (days - 1) * 86400_000);
  const ymd = (d: Date) => d.toISOString().slice(0, 10);

  const url =
    `https://connectors.windsor.ai/google_ads?api_key=${encodeURIComponent(apiKey)}` +
    `&date_from=${ymd(from)}&date_to=${ymd(to)}&fields=${FIELDS}`;
  let rows: Row[] = [];
  try {
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(50_000) });
    const text = await res.text();
    if (!res.ok) return NextResponse.json({ error: `Windsor HTTP ${res.status}: ${text.slice(0, 200)}` }, { status: 502 });
    const json = JSON.parse(text);
    rows = (Array.isArray(json) ? json : json?.data) ?? [];
  } catch (e) {
    return NextResponse.json({ error: `Windsor: ${e instanceof Error ? e.message : String(e)}` }, { status: 502 });
  }

  // кілька рядків на день/кампанію (якщо Windsor розбив) — сумуємо
  const agg = new Map<string, { date: string; campaign_id: string; campaign: string | null; spend: number; clicks: number; impressions: number; conversions: number; conversion_value: number }>();
  for (const r of rows) {
    if (!r.date || r.campaign_id == null) continue;
    const id = String(r.campaign_id);
    const k = `${r.date}|${id}`;
    const cur = agg.get(k) ?? { date: r.date, campaign_id: id, campaign: r.campaign ?? null, spend: 0, clicks: 0, impressions: 0, conversions: 0, conversion_value: 0 };
    cur.spend += num(r.spend);
    cur.clicks += num(r.clicks);
    cur.impressions += num(r.impressions);
    cur.conversions += num(r.conversions);
    cur.conversion_value += num(r.conversion_value);
    agg.set(k, cur);
  }
  const upserts = [...agg.values()].map((r) => ({
    platform: "google",
    ...r,
    spend: Math.round(r.spend * 100) / 100,
    clicks: Math.round(r.clicks),
    impressions: Math.round(r.impressions),
    updated_at: new Date().toISOString(),
  }));
  if (upserts.length) {
    const { error } = await db.from("ad_spend_daily").upsert(upserts, { onConflict: "platform,date,campaign_id" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, from: ymd(from), to: ymd(to), rows: upserts.length });
}
