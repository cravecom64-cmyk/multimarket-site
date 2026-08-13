import { NextResponse } from "next/server";

// Тимчасовий діагностичний ендпоінт — НЕ повертає токен, лише публічну
// інформацію про мерчант-акаунт. Видалити після діагностики.
export async function GET() {
  const token = process.env.MONOBANK_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "NO_TOKEN" }, { status: 500 });
  }

  const [detailsRes, submerchantsRes] = await Promise.all([
    fetch("https://api.monobank.ua/api/merchant/details", {
      headers: { "X-Token": token },
    }),
    fetch("https://api.monobank.ua/api/merchant/submerchant/list", {
      headers: { "X-Token": token },
    }),
  ]);

  const details = await detailsRes.text();
  const submerchants = await submerchantsRes.text();

  return NextResponse.json({
    detailsStatus: detailsRes.status,
    details,
    submerchantsStatus: submerchantsRes.status,
    submerchants,
  });
}
