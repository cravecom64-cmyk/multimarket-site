import type { Metadata } from "next";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "Публічна оферта",
  description:
    "Умови продажу товарів в інтернет-магазині Multimarket — публічна оферта (договір роздрібної купівлі-продажу).",
  alternates: {
    canonical: "https://multi-market.com.ua/terms",
  },
};

export default function TermsPage() {
  return (
    <>
      <div className="mx-3 mt-3 rounded-2xl bg-gradient-to-br from-gray-800 to-gray-900 px-5 py-6">
        <h1 className="text-[20px] font-extrabold text-white leading-tight">
          Публічна оферта
        </h1>
        <p className="text-[11px] text-white/60 mt-1.5">
          Договір роздрібної купівлі-продажу · останнє оновлення: 28.07.2026
        </p>
      </div>

      <div className="px-4 py-6 text-[13px] text-gray-700 leading-relaxed space-y-5">
        <p>
          Цей документ є публічною офертою (пропозицією) інтернет-магазину
          Multimarket (multi-market.com.ua) укласти договір
          роздрібної купівлі-продажу товарів дистанційним способом.
          Оформлюючи замовлення на сайті, покупець підтверджує, що
          погоджується з умовами нижче.
        </p>

        <div>
          <div className="font-extrabold text-gray-900 text-[14px] mb-2">
            1. Загальні положення
          </div>
          <p>
            Продавець — [ПІБ ФОП / назва ТОВ] (реквізити зазначені в кінці
            документа). Покупець — будь-яка дієздатна фізична особа, яка
            оформлює замовлення на сайті.
          </p>
        </div>

        <div>
          <div className="font-extrabold text-gray-900 text-[14px] mb-2">
            2. Оформлення замовлення
          </div>
          <p>
            Замовлення оформлюється через форму на сайті або в Telegram.
            Після оформлення продавець зв&apos;язується з покупцем для
            підтвердження — деталей товару, кількості, адреси доставки.
            Договір вважається укладеним з моменту підтвердження замовлення
            обома сторонами.
          </p>
        </div>

        <div>
          <div className="font-extrabold text-gray-900 text-[14px] mb-2">
            3. Ціна та оплата
          </div>
          <p>
            Ціни на сайті вказані в гривнях і можуть змінюватись без
            попередження до моменту підтвердження замовлення. Оплата —
            накладеним платежем при отриманні на відділенні Нової Пошти, або
            карткою онлайн.
          </p>
        </div>

        <div>
          <div className="font-extrabold text-gray-900 text-[14px] mb-2">
            4. Доставка
          </div>
          <p>
            Доставка здійснюється Новою Поштою по всій Україні. Строки і
            вартість — див.{" "}
            <a href="/delivery" className="text-emerald-600 font-semibold">
              сторінку &laquo;Доставка і оплата&raquo;
            </a>
            .
          </p>
        </div>

        <div>
          <div className="font-extrabold text-gray-900 text-[14px] mb-2">
            5. Повернення та обмін
          </div>
          <p>
            Покупець має право повернути товар належної якості протягом 14
            днів відповідно до Закону України &laquo;Про захист прав
            споживачів&raquo;. Умови — див.{" "}
            <a href="/returns" className="text-emerald-600 font-semibold">
              сторінку &laquo;Повернення та обмін&raquo;
            </a>
            .
          </p>
        </div>

        <div>
          <div className="font-extrabold text-gray-900 text-[14px] mb-2">
            6. Права та обов&apos;язки сторін
          </div>
          <p>
            Продавець зобов&apos;язується передати товар належної якості у
            зазначений строк. Покупець зобов&apos;язується надати достовірні
            контактні дані та оплатити товар згідно з обраним способом
            оплати.
          </p>
        </div>

        <div>
          <div className="font-extrabold text-gray-900 text-[14px] mb-2">
            7. Відповідальність сторін і форс-мажор
          </div>
          <p>
            Сторони звільняються від відповідальності за часткове або повне
            невиконання зобов&apos;язань, якщо це стало наслідком обставин
            непереборної сили (форс-мажору) — воєнних дій, стихійних лих,
            дій органів влади тощо.
          </p>
        </div>

        <div>
          <div className="font-extrabold text-gray-900 text-[14px] mb-2">
            8. Прикінцеві положення
          </div>
          <p>
            Усі спори вирішуються шляхом переговорів, а за неможливості —
            відповідно до чинного законодавства України. Продавець має
            право вносити зміни до цієї оферти в односторонньому порядку,
            актуальна версія завжди доступна на цій сторінці.
          </p>
        </div>

        <div>
          <div className="font-extrabold text-gray-900 text-[14px] mb-2">
            9. Реквізити продавця
          </div>
          <p className="text-gray-600">
            [ПІБ ФОП / назва ТОВ]
            <br />
            РНОКПП / ЄДРПОУ: [номер]
            <br />
            Адреса: [адреса реєстрації]
            <br />
            Контакти: Telegram @multimarket_ua
          </p>
        </div>

        <p className="text-[11px] text-gray-400 border-t border-gray-100 pt-4">
          Цей документ — базовий шаблон публічної оферти, реквізити продавця
          потрібно заповнити. Рекомендуємо перевірку юристом перед офіційним
          запуском продажів.
        </p>
      </div>

      <Footer />
    </>
  );
}
