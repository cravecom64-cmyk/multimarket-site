import { getAllProducts, categories } from "@/lib/products";
import { articles } from "@/lib/articles";

// llms.txt – короткий путівник по магазину для ІІ-асистентів (ChatGPT,
// Perplexity, Gemini). Генерується з каталогу, тому містить лише видимі
// товари (приховані не потрапляють). Ціни не пишемо – вони змінюються,
// актуальна ціна завжди на сторінці товару.
const BASE = "https://www.multi-market.com.ua";

export const revalidate = 3600;

export function GET() {
  const products = getAllProducts().filter((p) => p.inStock !== false && !p.externalLanding);
  const lines: string[] = [
    "# Multimarket (multi-market.com.ua)",
    "",
    "> Український інтернет-магазин корисних товарів для дому, саду, тварин і для відключень світла (блекаут): аварійні LED-лампи, повербанки, ліхтарі, газові плити. Доставка Новою поштою по Україні.",
    "",
    "- Оплата карткою онлайн: повністю або (для більшості замовлень від 300₴) передоплата до 200₴ і решта при отриманні",
    "- Відправка 1-3 дні",
    "- Повернення протягом 14 днів",
    "- Мова сайту: українська",
    "",
    "## Інформація для покупців",
    "",
    `- [Доставка](${BASE}/delivery)`,
    `- [Повернення](${BASE}/returns)`,
    `- [Часті запитання](${BASE}/faq)`,
    `- [Про магазин](${BASE}/about)`,
    "",
    "## Поради",
    "",
    ...articles.map((a) => `- [${a.title}](${BASE}/porady/${a.slug}): ${a.description}`),
    "",
  ];
  for (const c of categories) {
    const items = products.filter((p) => p.category === c.slug);
    if (items.length === 0) continue;
    lines.push(`## ${c.name}`, "", `[Усі товари категорії](${BASE}/category/${c.slug})`, "");
    for (const p of items) {
      const desc = (p.shortDesc || "").replace(/\s+/g, " ").trim();
      lines.push(`- [${p.name}](${BASE}/product/${p.slug})${desc ? `: ${desc}` : ""}`);
    }
    lines.push("");
  }
  return new Response(lines.join("\n"), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
