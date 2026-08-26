import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Віддає { product_id: popularity_score } з view product_popularity
// (Supabase) — зважена сума переглядів/кошика/покупок за 30 днів.
// Кешується на 5 хв (revalidate), щоб не бити Supabase на кожен рендер
// картки/категорії — 96 товарів і невисокий трафік роблять цей запит
// дешевим, але кеш все одно не зайвий при пікових заходах.
export const revalidate = 300;

function supabaseServer() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function GET() {
  const supabase = supabaseServer();
  if (!supabase) return NextResponse.json({});

  const { data, error } = await supabase
    .from("product_popularity")
    .select("product_id, popularity_score");

  if (error || !data) {
    console.error("[popularity] Supabase query failed:", error);
    return NextResponse.json({});
  }

  const map: Record<string, number> = {};
  for (const row of data as { product_id: string; popularity_score: number }[]) {
    map[row.product_id] = row.popularity_score;
  }

  return NextResponse.json(map);
}
