import type { Metadata } from "next";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "Часті питання",
  description:
    "Доставка, оплата, повернення — відповіді на найчастіші питання про замовлення в Multimarket.",
  alternates: {
    canonical: "https://multi-market.com.ua/faq",
  },
};

const faqs = [
  {
    q: "Як швидко відправите?",
    a: "Якщо замовив до 15:00 — відправимо сьогодні. Після 15:00 — наступного робочого дня. Трекінг надішлемо у SMS одразу після відправки.",
  },
  {
    q: "Скільки коштує доставка?",
    a: "Нова Пошта — за тарифами перевізника (зазвичай 60-80₴). Якщо замовлення від 2000₴ — доставка безкоштовна.",
  },
  {
    q: "А якщо не підійде?",
    a: "Повертай протягом 14 днів. Товар має бути в оригінальній упаковці. Напиши нам у Telegram — пояснимо як оформити повернення за 2 хвилини.",
  },
  {
    q: "Можна подивитися товар наживо?",
    a: "У нас немає офлайн-магазину, але кожен товар знятий на відео — дивись на сторінці товару або в нашому TikTok. Те що на відео = те що отримаєш.",
  },
  {
    q: "Це оригінальні товари?",
    a: "Працюємо з перевіреними українськими постачальниками. Кожну партію перевіряємо перед тим як відправляти. Якщо щось не так — повертаємо і замінюємо за свій рахунок.",
  },
  {
    q: "Як оплатити?",
    a: "Наложний платіж (оплата при отриманні на пошті) — нічим не ризикуєш. Або картка онлайн — Visa, Mastercard.",
  },
  {
    q: "Чи є гарантія?",
    a: "Так. Якщо товар зламався або не працює — пиши протягом 14 днів, замінимо або повернемо гроші.",
  },
];

export default function FaqPage() {
  return (
    <>
      <div className="mx-3 mt-3 rounded-2xl bg-gradient-to-br from-gray-800 to-gray-900 px-5 py-6">
        <h1 className="text-[20px] font-extrabold text-white leading-tight">
          Часті питання
        </h1>
      </div>

      <div className="px-4 py-4">
        {faqs.map((item, i) => (
          <details key={i} className="border-b border-gray-100 py-3 group">
            <summary className="flex justify-between items-center gap-3 cursor-pointer font-semibold text-[13px] text-gray-900 list-none">
              {item.q}
              <span className="text-gray-400 shrink-0 transition-transform group-open:rotate-180">
                ⌄
              </span>
            </summary>
            <p className="text-[12px] text-gray-600 mt-2 leading-relaxed">
              {item.a}
            </p>
          </details>
        ))}
      </div>

      <Footer />
    </>
  );
}
