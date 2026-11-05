import { NextRequest, NextResponse } from "next/server";

// Проксі до Nova Poshta API v2.0 — список відділень обраного міста (з
// опціональним фільтром по підрядку — номер відділення/вулиця), для
// автозаповнення поля "Відділення Нової Пошти". Та ж логіка тихого
// фолбеку, що й у /api/nova-poshta/cities: без ключа чи при помилці НП —
// просто порожній список, поле лишається звичайним текстовим.

interface NpWarehouse {
  Ref: string;
  Number: string;
  Description: string;
  ShortAddress?: string;
}

export async function GET(req: NextRequest) {
  const cityRef = req.nextUrl.searchParams.get("cityRef")?.trim() ?? "";
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";

  if (!cityRef) {
    return NextResponse.json({ warehouses: [] });
  }

  const apiKey = process.env.NOVA_POSHTA_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ warehouses: [] });
  }

  try {
    const methodProperties: Record<string, string> = {
      CityRef: cityRef,
      Limit: "30",
      Page: "1",
    };
    if (q.length >= 1) {
      methodProperties.FindByString = q;
    }

    const res = await fetch("https://api.novaposhta.ua/v2.0/json/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apiKey,
        modelName: "Address",
        calledMethod: "getWarehouses",
        methodProperties,
      }),
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json({ warehouses: [] });
    }

    const data = await res.json();
    if (!data?.success || !Array.isArray(data.data)) {
      return NextResponse.json({ warehouses: [] });
    }

    const warehouses = (data.data as NpWarehouse[]).map((w) => ({
      ref: w.Ref,
      number: w.Number,
      description: w.Description,
      shortAddress: w.ShortAddress ?? w.Description,
    }));

    return NextResponse.json({ warehouses });
  } catch {
    return NextResponse.json({ warehouses: [] });
  }
}
