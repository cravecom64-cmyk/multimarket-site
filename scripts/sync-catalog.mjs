// ==================== Автосинхронізація каталогу → Командний центр ====================
// products.json — єдине джерело істини по каталогу. Цей скрипт запускається
// перед кожним production-білдом на Vercel (див. "build" у package.json), тобто
// автоматично після кожної зміни products.json (ручна правка, підтвердження
// ціни з Telegram, автоприховування товару кроном check-suppliers).
//
// Що робить у Supabase-таблиці products:
//  - новий товар з json → додає;
//  - змінились назва/категорія/ціна/закупка/посилання/прихованість → оновлює;
//  - товар зник з json → active=false (НЕ видаляє: на нього посилаються
//    замовлення й події, видалення зламало б історію);
//  - товар повернувся в json → active=true.
// Кожен прогін пишеться в catalog_sync_runs — командний центр показує звідти
// статус і розбіжності.
//
// Ніколи не валить білд: будь-яка помилка лише логується (і в catalog_sync_runs,
// якщо база доступна) — сайт має задеплоїтись у будь-якому разі.
//
// Ручний запуск: NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SECRET_KEY=... SYNC_FORCE=1 node scripts/sync-catalog.mjs
// Тестовий прогін без запису: додати SYNC_DRY_RUN=1

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const SITE = "https://multi-market.com.ua";
const here = dirname(fileURLToPath(import.meta.url));
const log = (...a) => console.log("[sync-catalog]", ...a);

const isProd = process.env.VERCEL_ENV === "production" || process.env.SYNC_FORCE === "1";
const dryRun = process.env.SYNC_DRY_RUN === "1";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
const commit = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null;

const num = (v) => (v === null || v === undefined || v === "" ? null : Number(v));
const same = (a, b) => (a ?? null) === (b ?? null) || (typeof a === "number" && typeof b === "number" && Math.abs(a - b) < 0.005);
const FIELDS = ["name", "category", "our_url", "price", "buy_price", "is_hidden", "hidden_reason"];

async function main() {
  if (!isProd) return log("не production-білд — пропускаю");
  if (!url || !key) return log("немає NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY — пропускаю");

  // динамічний імпорт — щоб навіть зламаний пакет не завалив білд
  let supabase;
  try {
    const { createClient } = await import("@supabase/supabase-js");
    supabase = createClient(url, key, { auth: { persistSession: false } });
  } catch (e) {
    return log("не вдалося завантажити @supabase/supabase-js — пропускаю:", e?.message || e);
  }
  const run = { commit_sha: commit, source: process.env.VERCEL ? "vercel_build" : "manual", inserted: 0, updated: 0, deactivated: 0, reactivated: 0 };
  const changes = [];

  try {
    const json = JSON.parse(readFileSync(join(here, "..", "src", "data", "products.json"), "utf8"));
    run.json_count = json.length;

    const wanted = new Map(
      json.map((p) => [
        p.id,
        {
          id: p.id,
          name: p.name,
          category: p.categoryName || p.category,
          our_url: `${SITE}/product/${p.slug}`,
          price: num(p.price),
          buy_price: num(p.buyPrice),
          is_hidden: p.isHidden === true,
          hidden_reason: p.isHidden ? p.hiddenReason ?? null : null,
        },
      ])
    );
    if (wanted.size !== json.length) throw new Error("products.json містить дублікати id");

    const { data: rows, error } = await supabase.from("products").select("id, active, " + FIELDS.join(", "));
    if (error) throw error;
    const current = new Map(rows.map((r) => [r.id, r]));
    const now = new Date().toISOString();
    const upserts = [];

    for (const [id, w] of wanted) {
      const c = current.get(id);
      if (!c) {
        upserts.push({ ...w, active: true, synced_at: now, updated_at: now });
        run.inserted++;
        changes.push({ id, action: "insert" });
        continue;
      }
      const diff = FIELDS.filter((f) => !same(w[f], c[f])).map((f) => ({ field: f, from: c[f], to: w[f] }));
      if (!c.active) {
        run.reactivated++;
        changes.push({ id, action: "reactivate" });
      }
      if (diff.length || !c.active) {
        upserts.push({ ...w, active: true, synced_at: now, updated_at: now });
        if (diff.length) {
          run.updated++;
          changes.push({ id, action: "update", diff });
        }
      }
    }

    const gone = rows.filter((r) => r.active && !wanted.has(r.id)).map((r) => r.id);
    run.deactivated = gone.length;
    gone.forEach((id) => changes.push({ id, action: "deactivate" }));

    log(`json: ${json.length}, нових: ${run.inserted}, оновлено: ${run.updated}, повернуто: ${run.reactivated}, деактивовано: ${run.deactivated}`);
    if (dryRun) return log("DRY RUN — зміни:", JSON.stringify(changes, null, 1));

    if (upserts.length) {
      const { error: e } = await supabase.from("products").upsert(upserts, { onConflict: "id" });
      if (e) throw e;
    }
    if (gone.length) {
      const { error: e } = await supabase.from("products").update({ active: false, updated_at: now }).in("id", gone);
      if (e) throw e;
    }
    // позначка "звірено" для всіх актуальних рядків, навіть якщо змін не було
    const { error: e2 } = await supabase.from("products").update({ synced_at: now }).in("id", [...wanted.keys()]);
    if (e2) throw e2;

    await supabase.from("catalog_sync_runs").insert({ ...run, ok: true, changes });
    log("готово");
  } catch (err) {
    const msg = err?.message || String(err);
    console.warn("[sync-catalog] ПОМИЛКА (білд продовжується):", msg);
    if (!dryRun) await supabase.from("catalog_sync_runs").insert({ ...run, ok: false, error: msg, changes }).then(() => {}, () => {});
  }
}

main()
  .catch((e) => console.warn("[sync-catalog] неочікувана помилка (білд продовжується):", e?.message || e))
  .finally(() => process.exit(0));
