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

// Google Product Taxonomy IDs (перевірено по taxonomy-with-ids.en-US.txt, 04.11.2026).
// Спершу точний мапінг по id товару, інакше — по нашій категорії.
const GPC_BY_CATEGORY: Record<string, number> = {
  home: 536, // Home & Garden
  garden: 689, // Home & Garden > Lawn & Garden
  pets: 2, // Animals & Pet Supplies > Pet Supplies
  tiktok: 536, // Home & Garden
  blackout: 1436, // Home & Garden > Lighting > Emergency Lighting
};
const GPC_BY_ID: Record<string, number> = {
  h02: 4636, // Lighting > Lamps
  h07: 505826, // Lighting > Night Lights & Ambient Lighting
  h13: 338, // Hardware > Tools > Flashlights & Headlamps
  g03: 4201, // Watering & Irrigation > Garden Hose Spray Nozzles
  g05: 717, // Outdoor Living > Hammocks
  g09: 7400, // Lighting > Landscape Pathway Lighting
  g10: 7400,
  g11: 7400,
  g17: 7400,
  g18: 7400,
  g13: 1017, // Food & Beverage Carriers > Coolers
  p01: 6383, // Pet Grooming Supplies
  p22: 6385, // Pet Grooming Supplies > Pet Combs & Brushes
  tt06: 594, // Home & Garden > Lighting
  tt07: 4971, // Bathroom Accessories > Soap & Lotion Dispensers
  bk06: 338, // Flashlights & Headlamps
  bk08: 338,
  bk29: 505295, // Electronics > ... > Power > Power Adapters & Chargers
};

// Важкі товари (> 2 кг): доставка НП по Україні до 10 кг — 135₴ (тарифи з 13.04.2026).
// Решта бере тариф з налаштувань Merchant Center: 90₴, безкоштовно від 2000₴.
// Item-level shipping перекриває налаштування акаунта, тому для товарів
// від 2000₴ нічого не задаємо — спрацює безкоштовна доставка з акаунта.
const HEAVY_IDS = new Set(["g20", "h24", "bk32", "p11"]);
const HEAVY_SHIPPING_UAH = 135;
const FREE_SHIPPING_FROM = 2000;

// Текстові категорії для Meta Commerce Manager (як було).
const FB_CATEGORY_MAP: Record<string, string> = {
  home: "Home & Garden",
  garden: "Home & Garden > Lawn & Garden",
  pets: "Animals & Pet Supplies",
  tiktok: "Home & Garden",
  blackout: "Home & Garden > Lighting > Emergency Lighting",
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
      const gpc = GPC_BY_ID[p.id] ?? GPC_BY_CATEGORY[p.category] ?? 536;
      const fbCategory = FB_CATEGORY_MAP[p.category] || "Home & Garden";
      // Ціна = реальна ціна продажу (як у JSON-LD на сторінці). oldPrice не
      // передаємо як sale: «стара» ціна фактично не діяла, а Merchant Center
      // вимагає, щоб звичайна ціна була реальною (misrepresentation).
      const shippingBlock =
        HEAVY_IDS.has(p.id) && p.price < FREE_SHIPPING_FROM
          ? `      <g:shipping>
        <g:country>UA</g:country>
        <g:service>Нова Пошта</g:service>
        <g:price>${HEAVY_SHIPPING_UAH} UAH</g:price>
      </g:shipping>\n`
          : "";
      const availability = p.inStock === false ? "out of stock" : "in stock";

      return `
    <item>
      <g:id>${p.id}</g:id>
      <title>${escapeXml(p.name)}</title>
      <description>${escapeXml(p.shortDesc || p.description)}</description>
      <link>${link}</link>
      <g:image_link>${image}</g:image_link>
      <g:availability>${availability}</g:availability>
      <g:price>${p.price} UAH</g:price>
      <g:condition>new</g:condition>
      <g:identifier_exists>no</g:identifier_exists>
      <g:google_product_category>${gpc}</g:google_product_category>
      <g:product_type>${escapeXml(p.categoryName)}</g:product_type>
      <g:fb_product_category>${escapeXml(fbCategory)}</g:fb_product_category>
${shippingBlock}    </item>`;
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
