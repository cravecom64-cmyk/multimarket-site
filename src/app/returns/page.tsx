import type { Metadata } from "next";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "Повернення та обмін",
  description:
    "Повернення протягом 14 днів без зайвих питань. Товар пошкоджений або не відповідає опису — заміна або повернення коштів за наш рахунок.",
  alternates: {
    canonical: "https://multi-market.com.ua/returns",
  },
};

export default function ReturnsPage() {
  return (
    <>
      <div className="mx-3 mt-3 rounded-2xl bg-gradient-to-br from-gray-800 to-gray-900 px-5 py-6">
        <h1 className="text-[20px] font-extrabold text-white leading-tight">
          Повернення та обмін
        </h1>
      </div>

      <div className="px-4 py-6 text-[13px] text-gray-700 leading-relaxed space-y-4">
        <p>
          Не підійшов розмір, колір, або просто передумав? Буває. Ми не
          робимо з цього проблему.
        </p>

        <div>
          <div className="font-extrabold text-gray-900 text-[14px] mb-2">
            Як повернути
          </div>
          <ol className="list-decimal list-inside space-y-1.5">
            <li>
              Напиши нам у{" "}
              <a
                href="https://t.me/multimarket_ua"
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-600 font-semibold"
              >
                Telegram
              </a>{" "}
              протягом 14 днів після отримання
            </li>
            <li>Ми надішлемо інструкцію і номер ТТН для повернення</li>
            <li>
              Відправ товар Новою Поштою, гроші повернемо протягом 3 робочих
              днів
            </li>
          </ol>
        </div>

        <div>
          <div className="font-extrabold text-gray-900 text-[14px] mb-2">
            Умови
          </div>
          <ul className="list-disc list-inside space-y-1.5 text-gray-600">
            <li>Товар в оригінальній упаковці, без слідів використання</li>
            <li>14 днів з моменту отримання</li>
            <li>
              Зворотна доставка — за рахунок покупця (якщо товар справний)
            </li>
          </ul>
        </div>

        <p className="bg-gray-50 rounded-xl px-4 py-3">
          Товар зламався або прийшов пошкоджений? Замінимо або повернемо
          гроші. Зворотна доставка — за наш рахунок.
        </p>
      </div>

      <Footer />
    </>
  );
}
