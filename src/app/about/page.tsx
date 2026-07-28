import type { Metadata } from "next";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "Про нас",
  description:
    "Multimarket — команда, яка тестує трендові товари з TikTok перед тим, як показати їх тобі. Дізнайся як ми працюємо.",
  alternates: {
    canonical: "https://multi-market.com.ua/about",
  },
};

export default function AboutPage() {
  return (
    <>
      <div className="mx-3 mt-3 rounded-2xl bg-gradient-to-br from-gray-800 to-gray-900 px-5 py-6">
        <h1 className="text-[20px] font-extrabold text-white leading-tight">
          Хто ми і навіщо це все
        </h1>
      </div>

      <div className="px-4 py-6 text-[13px] text-gray-700 leading-relaxed space-y-4">
        <p>
          Ми — маленька команда, яка витрачає години на скролінг TikTok,
          тестування дивних штук з Китаю та пакування посилок. Не тому що
          нам нема чим зайнятись — а тому що ми реально кайфуємо від моменту,
          коли покупець пише &laquo;О, це топ!&raquo;.
        </p>

        <div>
          <div className="font-extrabold text-gray-900 text-[14px] mb-2">
            Як ми працюємо
          </div>
          <p>
            Знаходимо трендові товари → Замовляємо зразки → Тестуємо самі (і
            на своїх котах) → Знімаємо відео → Викладаємо тільки те, що
            пройшло перевірку.
          </p>
        </div>

        <p>
          Якщо товар крихкий, зламався через тиждень або виглядає гірше ніж
          на фото — він не потрапить на сайт. Навіть якщо у нього мільйон
          переглядів у TikTok.
        </p>

        <div className="bg-gray-50 rounded-xl px-4 py-4 space-y-2">
          <div className="flex items-start gap-2">
            <span>✅</span>
            <span>Перевіряємо кожен товар перед тим як викласти на сайт</span>
          </div>
          <div className="flex items-start gap-2">
            <span>📦</span>
            <span>Відправляємо в день замовлення до 15:00</span>
          </div>
          <div className="flex items-start gap-2">
            <span>↩️</span>
            <span>Повернення 14 днів без зайвих питань</span>
          </div>
        </div>

        <p>
          Є питання? Пиши в{" "}
          <a
            href="https://t.me/multimarket_ua"
            target="_blank"
            rel="noopener noreferrer"
            className="text-emerald-600 font-semibold"
          >
            Telegram
          </a>{" "}
          — відповідаємо живою людиною, не ботом.
        </p>
      </div>

      <Footer />
    </>
  );
}
