import type { Metadata } from "next";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "Політика конфіденційності",
  description:
    "Як Multimarket збирає, використовує і захищає персональні дані покупців.",
  alternates: {
    canonical: "https://multi-market.com.ua/privacy",
  },
};

export default function PrivacyPage() {
  return (
    <>
      <div className="mx-3 mt-3 rounded-2xl bg-gradient-to-br from-gray-800 to-gray-900 px-5 py-6">
        <h1 className="text-[20px] font-extrabold text-white leading-tight">
          Політика конфіденційності
        </h1>
        <p className="text-[11px] text-white/60 mt-1.5">
          Останнє оновлення: 28.07.2026
        </p>
      </div>

      <div className="px-4 py-6 text-[13px] text-gray-700 leading-relaxed space-y-5">
        <p>
          Ця Політика конфіденційності описує, як інтернет-магазин
          Multimarket (&laquo;ми&raquo;, &laquo;продавець&raquo;) збирає,
          використовує і захищає персональні дані відвідувачів та покупців
          сайту multi-market.com.ua відповідно до Закону України
          &laquo;Про захист персональних даних&raquo; №2297-VI.
        </p>

        <div>
          <div className="font-extrabold text-gray-900 text-[14px] mb-2">
            1. Які дані ми збираємо
          </div>
          <ul className="list-disc list-inside space-y-1 text-gray-600">
            <li>Ім&apos;я та прізвище</li>
            <li>Номер телефону</li>
            <li>Місто та відділення Нової Пошти для доставки</li>
            <li>
              Технічні дані під час перегляду сайту (IP-адреса, тип
              пристрою, cookie-файли, дані рекламних пікселів — Meta Pixel)
            </li>
          </ul>
        </div>

        <div>
          <div className="font-extrabold text-gray-900 text-[14px] mb-2">
            2. З якою метою
          </div>
          <ul className="list-disc list-inside space-y-1 text-gray-600">
            <li>Оформлення і доставка замовлення</li>
            <li>Зв&apos;язок з покупцем щодо статусу замовлення</li>
            <li>
              Покращення роботи сайту та показ релевантної реклами
              (ремаркетинг)
            </li>
          </ul>
        </div>

        <div>
          <div className="font-extrabold text-gray-900 text-[14px] mb-2">
            3. Кому передаються дані
          </div>
          <p>
            Дані, необхідні для доставки, передаються АТ &laquo;Укрпошта&raquo;
            / ТОВ &laquo;Нова Пошта&raquo; (транспортна компанія). Технічні
            дані про поведінку на сайті можуть оброблятись сервісами Meta
            (Facebook Pixel) та Google для аналітики й реклами. Ми не
            продаємо і не передаємо персональні дані третім особам з іншою
            метою.
          </p>
        </div>

        <div>
          <div className="font-extrabold text-gray-900 text-[14px] mb-2">
            4. Cookie-файли
          </div>
          <p>
            Сайт використовує cookie-файли для коректної роботи кошика,
            аналітики відвідувань та рекламних інструментів. Продовжуючи
            користуватись сайтом, ти погоджуєшся на використання
            cookie-файлів. Їх можна відключити в налаштуваннях браузера —
            це може вплинути на роботу кошика.
          </p>
        </div>

        <div>
          <div className="font-extrabold text-gray-900 text-[14px] mb-2">
            5. Права покупця
          </div>
          <p>
            Ти маєш право запросити перегляд, виправлення або видалення
            своїх персональних даних, звернувшись до нас у Telegram
            @multimarket_ua. Ми відповімо і виконаємо запит протягом
            розумного строку.
          </p>
        </div>

        <div>
          <div className="font-extrabold text-gray-900 text-[14px] mb-2">
            6. Зберігання і захист даних
          </div>
          <p>
            Дані зберігаються на серверах, доступ до яких обмежений. Ми
            вживаємо розумних технічних і організаційних заходів для
            захисту даних від несанкціонованого доступу.
          </p>
        </div>

        <div>
          <div className="font-extrabold text-gray-900 text-[14px] mb-2">
            7. Контакти
          </div>
          <p>
            Питання щодо цієї Політики — у Telegram{" "}
            <a
              href="https://t.me/multimarket_ua"
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-600 font-semibold"
            >
              @multimarket_ua
            </a>
            .
          </p>
        </div>

        <p className="text-[11px] text-gray-400 border-t border-gray-100 pt-4">
          Продавець: [ПІБ ФОП / назва ТОВ], РНОКПП або ЄДРПОУ [номер],
          адреса реєстрації [адреса] — реквізити уточнюються.
        </p>
      </div>

      <Footer />
    </>
  );
}
