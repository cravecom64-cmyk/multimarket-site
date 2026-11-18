import { getAllProducts } from "@/lib/products";

// Міні-markdown для розділів details: екранування HTML, **жирний**,
// [текст](/внутрішній-шлях) — тільки внутрішні посилання, "• " = список.
const VISIBLE_SLUGS = new Set(getAllProducts().map((p) => p.slug));

const HIDDEN_LINK = /\[([^\]]+)\]\(\/product\/([^)\s]+)\)/g;
const CONNECTOR = "(?:,\\s*|\\s+(?:або|і|й|та)\\s+)";

// Товари ховаються автоматично, коли їх немає в наявності. Щоб тексти не
// радили те, що не можна купити: рядок списку, де всі посилання ведуть на
// приховані товари, прибираємо; у змішаному рядку прибираємо лише приховане
// посилання разом зі сполучником ("A або [B]" -> "A").
export function pruneHidden(src: string): string {
  const isHidden = (slug: string) => !VISIBLE_SLUGS.has(slug);
  return src
    .split("\n")
    .filter((line) => {
      if (!line.trim().startsWith("• ")) return true;
      const slugs = [...line.matchAll(HIDDEN_LINK)].map((m) => m[2]);
      return slugs.length === 0 || slugs.some((s) => !isHidden(s));
    })
    .map((line) => {
      for (const m of [...line.matchAll(HIDDEN_LINK)]) {
        if (!isHidden(m[2])) continue;
        const link = m[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const before = new RegExp(CONNECTOR + link);
        const after = new RegExp(link + CONNECTOR);
        if (before.test(line)) line = line.replace(before, "");
        else if (after.test(line)) line = line.replace(after, "");
        else line = line.replace(m[0], m[1]);
      }
      return line;
    })
    .join("\n");
}

export function renderDetailBody(src: string): string {
  src = pruneHidden(src);
  const esc = (t: string) =>
    t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const inline = (t: string) =>
    esc(t)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\[([^\]]+)\]\((\/[^)\s]*)\)/g, (_m, label: string, href: string) => {
        // Посилання на товар, який приховали чи видалили, показуємо як звичайний текст.
        const slug = href.startsWith("/product/") ? href.slice("/product/".length) : null;
        if (slug && !VISIBLE_SLUGS.has(slug)) return label;
        return `<a href="${href}">${label}</a>`;
      });
  return src
    .trim()
    .split(/\n\s*\n/)
    .map((block) => {
      const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
      if (lines.every((l) => l.startsWith("• "))) {
        return `<ul>${lines.map((l) => `<li>• ${inline(l.slice(2))}</li>`).join("")}</ul>`;
      }
      return `<p>${lines.map(inline).join("<br>")}</p>`;
    })
    .join("");
}

// Пари "питання – відповідь" з розділу "Часті запитання" (для FAQPage JSON-LD).
export function parseFaq(body: string): { q: string; a: string }[] {
  return pruneHidden(body)
    .split(/\n\s*\n/)
    .map((block) => {
      const m = block.trim().match(/^\*\*(.+?)\*\*\s*\n([\s\S]+)$/);
      if (!m) return null;
      const a = m[2].replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/\*\*/g, "").trim();
      return { q: m[1].trim(), a };
    })
    .filter((x): x is { q: string; a: string } => !!x);
}
