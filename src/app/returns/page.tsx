import type { Metadata } from "next";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "Повернення та обмін",
  description:
    "Повернення та обмін товарів належної якості протягом 14 днів згідно Закону «Про захист прав споживачів». Умови, порядок дій, контакти.",
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

      <div className="px-4 py-6 text-[13px] text-gray-700 leading-relaxed space-y-5">
        <div>
          <div className="font-extrabold text-gray-900 text-[14px] mb-2">
            Термін повернення
          </div>
          <p>
            Нам важливо, щоб ваші покупки були приємними та безпечними. Ми
            надаємо можливість повертати та обмінювати товари належної якості
            згідно Закону України «Про захист прав споживачів» протягом 14
            днів після отримання.
          </p>
        </div>

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
            <li>Ми надішлемо реквізити та інструкцію для повернення</li>
            <li>
              Відправ товар Новою Поштою — гроші повернемо протягом 3 робочих
              днів після отримання посилки
            </li>
          </ol>
        </div>

        <div>
          <div className="font-extrabold text-gray-900 text-[14px] mb-2">
            Умови повернення
          </div>
          <ul className="space-y-1.5 text-gray-600">
            <li>✔ Товар в оригінальній упаковці та стані, в якому отримали</li>
            <li>✔ Немає слідів використання</li>
            <li>✔ Є підтвердження купівлі (номер замовлення або чек)</li>
            <li>
              ✔ Якщо повернення з вини продавця (брак, пересорт) —
              доставку в обидва боки оплачує продавець. В інших випадках
              зворотну доставку оплачує покупець
            </li>
            <li>✔ Повернення коштів — лише на реквізити, надані вами при оформленні</li>
          </ul>
        </div>

        <div>
          <div className="font-extrabold text-gray-900 text-[14px] mb-2">
            Варто знати
          </div>
          <p>
            Обов&apos;язково перевіряйте стан товару в момент отримання на
            відділенні Нової Пошти. Якщо помітили пошкодження від
            транспортування — не забирайте посилку, зробіть фото пошкоджень,
            складіть акт-претензію на відділенні й повідомте нас у Telegram.
            Це дозволить оперативно вирішити питання і організувати заміну.
            Без акту при отриманні ми не зможемо компенсувати пошкодження,
            спричинені перевізником.
          </p>
        </div>

        <p className="bg-gray-50 rounded-xl px-4 py-3">
          Товар зламався або прийшов пошкодженим не з вашої вини? Замінимо
          або повернемо гроші, зворотна доставка — за наш рахунок.
        </p>
      </div>

      <Footer />
    </>
  );
}
