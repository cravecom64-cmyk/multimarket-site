import { NextRequest, NextResponse } from "next/server";

// Проксі до Nova Poshta API v2.0 — пошук міст за підрядком, для автозаповнення
// поля "Місто" у формі оформлення (OrderModal). Ключ лишається тільки на
// сервері (NOVA_POSHTA_API_KEY у Vercel env vars), клієнт його не бачить.
// Якщо ключ не налаштований або сам запит до НП впав — тихо повертаємо
// порожній список: поле просто лишається звичайним текстовим, як і раніше,
// нічого не ламається і нікого не блокує.

interface NpCity {
  Ref: string;
  Description: string;
  AreaDescription?: string;
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) {
    return NextResponse.json({ cities: [] });
  }

  const apiKey = process.env.NOVA_POSHTA_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ cities: [] });
  }

  try {
    const res = await fetch("https://api.novaposhta.ua/v2.0/json/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apiKey,
        modelName: "Address",
        calledMethod: "getCities",
        methodProperties: { FindByString: q, Limit: "10" },
      }),
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json({ cities: [] });
    }

    const data = await res.json();
    if (!data?.success || !Array.isArray(data.data)) {
      return NextResponse.json({ cities: [] });
    }

    const cities = (data.data as NpCity[]).map((c) => ({
      ref: c.Ref,
      name: c.Description,
      area: c.AreaDescription ?? "",
    }));

    return NextResponse.json({ cities });
  } catch {
    return NextResponse.json({ cities: [] });
  }
}
