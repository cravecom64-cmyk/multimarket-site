import { NextResponse } from "next/server";
import { getAllProducts } from "@/lib/products";

// Товарний фід для Meta Commerce Manager / Google Merchant Center.
// URL: /api/feed — вставити його в Commerce Manager як "Feed URL"
// (розклад оновлення можна виставити на щоденний).
//
// У фід потрапляють ТІЛЬКИ товари з реальним фото (поле `image`) —
// emoji-заглушка не є валідним image_link для каталогу. Як тільки
// у нового товару з'явиться реальне фото (поле `image` в products.json),
// він автоматично з'явиться у фіді без правок цього файлу.

const SITE_URL = "https://www.multi-market.com.ua";
const BRAND = "Multimarket";

// Приблизний мапінг наших категорій на категорії Google/Meta.
// Можна уточнити пізніше в Commerce Manager вручну по конкретних товарах.
const CATEGORY_MAP: Record<string, string> = {
  home: "Home & Garden",
  garden: "Home & Garden > Yard, Garden & Outdoor Living",
  pets: "Animals & Pet Supplies",
  tiktok: "Home & Garden",
};

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET() {
  const products = getAllProducts().filter((p) => !!p.image);

  const items = products
    .map((p) => {
      const link = p.externalLanding
        ? `${SITE_URL}${p.externalLanding}`
        : `${SITE_URL}/product/${p.slug}`;
      const image = `${SITE_URL}${p.image}`;
      const category = CATEGORY_MAP[p.category] || "Home & Garden";
      const regularPrice = p.oldPrice ?? p.price;
      const saleBlock = p.oldPrice
        ? `\n      <g:sale_price>${p.price} UAH</g:sale_price>`
        : "";

      return `
    <item>
      <g:id>${p.id}</g:id>
      <title>${escapeXml(p.name)}</title>
      <description>${escapeXml(p.shortDesc || p.description)}</description>
      <link>${link}</link>
      <g:image_link>${image}</g:image_link>
      <g:availability>in stock</g:availability>
      <g:price>${regularPrice} UAH</g:price>${saleBlock}
      <g:brand>${BRAND}</g:brand>
      <g:condition>new</g:condition>
      <g:identifier_exists>no</g:identifier_exists>
      <g:google_product_category>${escapeXml(category)}</g:google_product_category>
      <g:fb_product_category>${escapeXml(category)}</g:fb_product_category>
    </item>`;
    })
    .join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
<channel>
<title>Multimarket — товарний фід</title>
<link>${SITE_URL}</link>
<description>Product feed для Meta Commerce Manager / Google Merchant Center</description>${items}
</channel>
</rss>
`;

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
    },
  });
}
