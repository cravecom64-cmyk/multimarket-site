import { NextRequest, NextResponse } from "next/server";

// Тимчасовий діагностичний ендпоінт — НЕ повертає токен, лише публічну
// інформацію та тестові виклики invoice/create з різними варіантами тіла,
// щоб з'ясувати яке саме поле Monobank вважає відсутнім ("'code' is required").
// Не створює жодних реальних сум — validity дуже короткий, і жодна оплата
// не проходить сама по собі. Видалити після діагностики.

async function callCreate(token: string, body: Record<string, unknown>) {
  const res = await fetch("https://api.monobank.ua/api/merchant/invoice/create", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Token": token },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, text };
}

export async function GET(req: NextRequest) {
  const token = process.env.MONOBANK_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "NO_TOKEN" }, { status: 500 });
  }

  const variant = req.nextUrl.searchParams.get("variant") || "no-merchantpayminfo";
  const redirectUrl = "https://www.multi-market.com.ua/order/success?ref=DEBUG";
  const webHookUrl = "https://www.multi-market.com.ua/api/webhook/monobank";

  let body: Record<string, unknown>;

  if (variant === "no-merchantpayminfo") {
    body = { amount: 100, ccy: 980, redirectUrl, webHookUrl, validity: 60, paymentType: "debit" };
  } else if (variant === "with-merchantpayminfo-no-basket") {
    body = {
      amount: 100,
      ccy: 980,
      merchantPaymInfo: { reference: "DEBUG1", destination: "Debug test" },
      redirectUrl,
      webHookUrl,
      validity: 60,
      paymentType: "debit",
    };
  } else if (variant === "with-basket-no-item-code") {
    body = {
      amount: 100,
      ccy: 980,
      merchantPaymInfo: {
        reference: "DEBUG2",
        destination: "Debug test",
        basketOrder: [{ name: "Test item", qty: 1, sum: 100, unit: "шт" }],
      },
      redirectUrl,
      webHookUrl,
      validity: 60,
      paymentType: "debit",
    };
  } else {
    return NextResponse.json({ error: "Unknown variant" }, { status: 400 });
  }

  const result = await callCreate(token, body);
  return NextResponse.json({ variant, sentBody: body, ...result });
}
