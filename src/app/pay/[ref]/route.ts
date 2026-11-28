import { NextRequest, NextResponse } from "next/server";
import { createInvoice } from "@/lib/monobank";
import { supabaseService } from "@/lib/crmPush";
import { verifyPayLink } from "@/lib/payLink";

// Посилання на оплату, яке менеджер надсилає клієнту (див. src/lib/payLink.ts).
// GET /pay/<order_ref>?s=<підпис> → створює рахунок Monobank на суму, яку
// клієнт мав сплатити онлайн (prepaid_amount: передоплата або повна сума зі
// знижкою), і перенаправляє на сторінку оплати. reference — той самий формат,
// що й з сайту, тож вебхук /api/webhook/monobank зарахує оплату до замовлення.
export const dynamic = "force-dynamic";

const SITE_URL = "https://www.multi-market.com.ua";

function page(title: string, text: string, status = 200) {
  const html = `<!doctype html><html lang="uk"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${title} – Multimarket</title></head><body style="font-family:system-ui,sans-serif;max-width:480px;margin:15vh auto;padding:0 16px;text-align:center;color:#111"><h1 style="font-size:22px">${title}</h1><p style="color:#555;line-height:1.5">${text}</p><p><a href="${SITE_URL}" style="color:#16a34a">На головну Multimarket</a></p></body></html>`;
  return new NextResponse(html, { status, headers: { "Content-Type": "text/html; charset=utf-8", "X-Robots-Tag": "noindex" } });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  const orderRef = decodeURIComponent(ref);
  if (!verifyPayLink(orderRef, req.nextUrl.searchParams.get("s"))) {
    return page("Посилання недійсне", "Перевір, чи посилання скопійоване повністю, або напиши нам – надішлемо нове.", 404);
  }
  const db = supabaseService();
  if (!db) return page("Тимчасова помилка", "Спробуй ще раз за кілька хвилин.", 503);

  const { data: o } = await db
    .from("orders")
    .select("id, order_ref, customer_phone, payment_method, payment_status, prepaid_amount, cod_amount, status")
    .eq("order_ref", orderRef)
    .maybeSingle();
  if (!o) return page("Замовлення не знайдено", "Напиши нам – допоможемо з оплатою.", 404);
  if (o.payment_status === "paid") {
    return page("Замовлення вже оплачене", "Дякуємо! Оплата за цим замовленням уже надійшла – повторно платити не потрібно.");
  }
  if (o.status === "canceled" || o.status === "cancelled") {
    return page("Замовлення скасоване", "Якщо хочеш його відновити – напиши нам.");
  }
  const amount = Number(o.prepaid_amount);
  if (!(amount > 0)) return page("Немає суми до оплати", "Напиши нам – уточнимо деталі.", 400);

  const deposit = o.payment_method === "deposit_cod";
  const name = deposit
    ? `Передоплата за замовлення ${orderRef} (залишок ${Math.round(Number(o.cod_amount))}₴ – при отриманні)`
    : `Оплата замовлення ${orderRef}`;
  const phoneDigits = String(o.customer_phone ?? "").replace(/\D/g, "");
  try {
    const invoice = await createInvoice({
      amount: Math.round(amount * 100),
      reference: `${orderRef}--p${phoneDigits}--i${encodeURIComponent("посилання на оплату")}`,
      destination: deposit ? `Передоплата за замовлення ${orderRef} — Multimarket` : `Замовлення ${orderRef} — Multimarket`,
      basketOrder: [{ name: name.slice(0, 128), qty: 1, sum: Math.round(amount * 100), unit: "шт", code: deposit ? "deposit" : "order" }],
      redirectUrl: `${SITE_URL}/order/success?ref=${encodeURIComponent(orderRef)}&via=link`,
      webHookUrl: `${SITE_URL}/api/webhook/monobank`,
      validitySeconds: 86400,
    });
    return NextResponse.redirect(invoice.pageUrl, 302);
  } catch (e) {
    console.error("[pay] createInvoice failed:", e);
    return page("Не вдалося відкрити оплату", "Спробуй ще раз за хвилину або напиши нам.", 502);
  }
}
