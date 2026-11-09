// Мета-описання: суть товару/категорії + реальні переваги магазину.
// Google показує ~155-160 символів, тому основний текст обрізаємо по слову.
export const STORE_USP = "✔️ Оплата при отриманні ✔️ Відправка 1-3 дні ✔️ Повернення 14 днів";

const TAIL_WORDS = new Set(["і", "й", "та", "з", "із", "зі", "в", "у", "на", "по", "до", "для", "від", "а", "або", "чи", "що", "під", "без", "при", "за", "через", "навіть", "час", "щоб", "як", "й"]);

// Обрізаємо природно: ціле речення → межа за комою/двокрапкою → по слову
// без «висячих» сполучників і прийменників у кінці.
export function buildMetaDescription(base: string, maxBase = 115): string {
  // Довге тире «—» замінюємо на «–» (стиль текстів магазину).
  let text = base.replace(/\s+/g, " ").replace(/—/g, "–").trim();
  if (text.length > maxBase) {
    const sentence = text.match(/^.+?[.!?](?=\s|$)/)?.[0];
    if (sentence && sentence.length <= maxBase && sentence.length >= 40) {
      text = sentence;
    } else {
      const cut = text.slice(0, maxBase);
      // Спершу кома/двокрапка/крапка з комою, тире – лише як запасний варіант.
      let clause = Math.max(cut.lastIndexOf(","), cut.lastIndexOf(":"), cut.lastIndexOf(";"));
      if (clause < 50) clause = cut.lastIndexOf(" – ");
      if (clause >= 50) {
        text = cut.slice(0, clause);
      } else {
        const words = cut.slice(0, cut.lastIndexOf(" ")).split(" ");
        while (words.length > 1 && TAIL_WORDS.has(words[words.length - 1].toLowerCase())) words.pop();
        text = words.join(" ");
      }
    }
  }
  // Незакрита дужка після обрізання — відкидаємо її разом із вмістом.
  if (text.lastIndexOf("(") > text.lastIndexOf(")")) text = text.slice(0, text.lastIndexOf("("));
  text = text.replace(/[\s,:;–—-]+$/, "");
  if (!/[.!?]$/.test(text)) text += ".";
  return `${text} ${STORE_USP}`;
}

// Українська множина: 1 товар, 2-4 товари, 5+ товарів.
export function pluralUk(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}
