import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// ==================== Підтвердження пропозиції ціни ====================
// Друга половина фічі з /api/cron/check-suppliers (08.10.2026, запит Павла
// "нужно что бы при смене цен у поставщика наша цена росла на столько же %
// на сколько поднял цену поставщик"). Той роут створює рядок у Supabase
// price_proposals і шле в Telegram посилання на цей endpoint. Павло тапає
// з телефону (GET, без жодної форми — простіше для месенджера):
//   /api/cron/price-proposal?id=<uuid>&action=approve|reject&secret=...
//
// approve: читає поточний products.json з GitHub (Contents API, потрібен
// GITHUB_TOKEN — fine-grained PAT з правом Contents: Read and write саме на
// цей репозиторій), підміняє price/oldPrice/buyPrice для одного товару,
// комітить назад тим самим API — це той самий файл, яким керує і сайт, і
// наш звичний GitHub-воркфлоу публікації, тож Vercel підхопить зміну й
// задеплоїть сам, без мого втручання.
//
// Навмисно НЕ чіпає Supabase-таблицю product_suppliers/buy_price (та інша,
// публічна, для командного центру — див. multimarket-context.md) — це
// окрема синхронізація, якщо Павло захоче, зроблю окремим запитом.
//
// reject: просто позначає пропозицію відхиленою, щоб завтрашній прогін міг
// запропонувати її знову (chk-suppliers пропускає товар, поки є pending).
//
// Віддає просту HTML-сторінку (не JSON) — Павло відкриває посилання в
// браузері телефону після тапу з Telegram, а не дивиться на сирі дані.

function supabaseServer() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

const GITHUB_OWNER = "cravecom64-cmyk";
const GITHUB_REPO = "multimarket-site";
const PRODUCTS_PATH = "src/data/products.json";

function page(title: string, body: string, ok: boolean) {
  return new NextResponse(
    `<!doctype html><html lang="uk"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>${title}</title>
    <style>body{font-family:system-ui,sans-serif;background:${ok ? "#f0fdf4" : "#fef2f2"};color:#18181b;padding:32px 20px;max-width:480px;margin:0 auto;line-height:1.5}
    h1{font-size:20px}p{font-size:15px;color:#52525b}</style></head>
    <body><h1>${ok ? "✅" : "⚠️"} ${title}</h1><p>${body}</p></body></html>`,
    { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

interface ProposalRow {
  id: string;
  product_id: string;
  product_name: string;
  supplier_name: string;
  old_buy_price: number;
  new_buy_price: number;
  old_site_price: number;
  new_site_price: number;
  old_old_price: number | null;
  new_old_price: number | null;
  pct_change: number;
  status: string;
}

async function applyPriceToGitHub(proposal: ProposalRow): Promise<{ ok: boolean; message: string }> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    return {
      ok: false,
      message:
        "GITHUB_TOKEN не налаштовано на Vercel — попроси того, хто налаштовував бота, додати fine-grained токен з правом Contents: Read and write на репозиторій multimarket-site.",
    };
  }

  const ghHeaders = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  const getRes = await fetch(
    `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${PRODUCTS_PATH}?ref=main`,
    { headers: ghHeaders, cache: "no-store" }
  );
  if (!getRes.ok) {
    return { ok: false, message: `Не вдалось прочитати products.json з GitHub (HTTP ${getRes.status}).` };
  }
  const file = await getRes.json();
  const raw = Buffer.from(file.content, "base64").toString("utf-8");
  const data: Array<Record<string, unknown>> = JSON.parse(raw);

  const product = data.find((p) => p.id === proposal.product_id);
  if (!product) {
    return { ok: false, message: `Товар ${proposal.product_id} не знайдено в products.json (можливо, вже видалений).` };
  }

  // Безпека: якщо хтось встиг вручну змінити ціну після того, як пропозицію
  // створили (вона більше не збігається зі старою ціною в пропозиції) —
  // не перезаписуємо наосліп, повідомляємо й зупиняємось.
  if (Number(product.price) !== Number(proposal.old_site_price)) {
    return {
      ok: false,
      message: `Ціна товару ${proposal.product_id} на сайті (${product.price}₴) вже відрізняється від тієї, що була при створенні пропозиції (${proposal.old_site_price}₴) — хтось змінив її вручну. Пропозицію скасовано, щоб нічого не зламати.`,
    };
  }

  product.price = proposal.new_site_price;
  product.buyPrice = proposal.new_buy_price;
  if (proposal.new_old_price !== null) product.oldPrice = proposal.new_old_price;

  const newRaw = JSON.stringify(data, null, 2) + "\n";
  const newContent = Buffer.from(newRaw, "utf-8").toString("base64");

  const putRes = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${PRODUCTS_PATH}`, {
    method: "PUT",
    headers: { ...ghHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({
      message: `price: ${proposal.product_id} ${proposal.old_site_price}₴ → ${proposal.new_site_price}₴ (${proposal.supplier_name} подорожчав на ${proposal.pct_change}%)`,
      content: newContent,
      sha: file.sha,
      branch: "main",
    }),
  });

  if (!putRes.ok) {
    const errText = await putRes.text();
    return { ok: false, message: `GitHub відхилив коміт (HTTP ${putRes.status}): ${errText.slice(0, 200)}` };
  }

  return { ok: true, message: "Закомічено в GitHub, Vercel задеплоїть зміну протягом хвилини." };
}

export async function GET(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  const secret = req.nextUrl.searchParams.get("secret");
  if (expected && secret !== expected) {
    return page("Немає доступу", "Невірний або відсутній secret у посиланні.", false);
  }

  const id = req.nextUrl.searchParams.get("id");
  const action = req.nextUrl.searchParams.get("action");
  if (!id || (action !== "approve" && action !== "reject")) {
    return page("Невірне посилання", "Відсутній id або action=approve|reject.", false);
  }

  const supabase = supabaseServer();
  if (!supabase) {
    return page("Помилка", "Supabase не налаштовано.", false);
  }

  const { data: proposal, error } = await supabase
    .from("price_proposals")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !proposal) {
    return page("Не знайдено", "Цю пропозицію не знайдено — можливо, посилання застаріло.", false);
  }
  if (proposal.status !== "pending") {
    return page(
      "Вже оброблено",
      `Ця пропозиція вже має статус "${proposal.status}" — повторно нічого не роблю.`,
      false
    );
  }

  if (action === "reject") {
    await supabase
      .from("price_proposals")
      .update({ status: "rejected", resolved_at: new Date().toISOString() })
      .eq("id", id);
    return page(
      "Пропозицію відхилено",
      `Ціна ${proposal.product_name} лишається ${proposal.old_site_price}₴. Завтрашня перевірка зможе запропонувати її знову.`,
      true
    );
  }

  const result = await applyPriceToGitHub(proposal as ProposalRow);
  await supabase
    .from("price_proposals")
    .update({ status: result.ok ? "approved" : "failed", resolved_at: new Date().toISOString() })
    .eq("id", id);

  if (!result.ok) {
    return page("Не вдалось оновити ціну", result.message, false);
  }

  return page(
    "Ціну оновлено",
    `${proposal.product_name}: ${proposal.old_site_price}₴ → ${proposal.new_site_price}₴. ${result.message}`,
    true
  );
}
